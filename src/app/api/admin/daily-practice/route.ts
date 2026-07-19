import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma, ProblemPlatform } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { hasPotdAdminAccess } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  POTD_LANGUAGES,
  dateKeyToUtcDate,
  isValidProblemUrl,
} from "@/lib/potd";
import { JsonRequestError, readJsonBody } from "@/lib/security";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const solutionSchema = z.object({
  code: z.string().trim().min(1).max(50000),
  explanation: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) return null;
      return value.trim() || null;
    }),
});

const createDailyPracticeSchema = z.object({
  date: dateSchema,
  platform: z.nativeEnum(ProblemPlatform),
  title: z.string().trim().min(3).max(200),
  problemUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => isValidProblemUrl(value),
      "Use a supported platform HTTPS problem link",
    ),
  difficulty: z
    .string()
    .trim()
    .max(64)
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) return null;
      return value.trim() || null;
    }),
  notes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) return null;
      return value.trim() || null;
    }),
  isPublished: z.boolean().optional().default(false),
  solutions: z.object({
    JAVA: solutionSchema,
    CPP: solutionSchema,
    PYTHON: solutionSchema,
  }),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccessAdmin = await hasPotdAdminAccess(session.user.email);
  if (!canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await readJsonBody(req, 256 * 1_024);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = createDailyPracticeSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue?.message || "Invalid payload",
      },
      { status: 400 }
    );
  }

  const date = dateKeyToUtcDate(parsed.data.date);
  if (!date) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const actor = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!actor) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
  }

  try {
    const problem = await prisma.dailyPracticeProblem.create({
      data: {
        date,
        platform: parsed.data.platform,
        title: parsed.data.title,
        problemUrl: parsed.data.problemUrl,
        difficulty: parsed.data.difficulty,
        notes: parsed.data.notes,
        isPublished: parsed.data.isPublished,
        createdById: actor.id,
        solutions: {
          create: POTD_LANGUAGES.map((language) => ({
            language,
            code: parsed.data.solutions[language].code,
            explanation: parsed.data.solutions[language].explanation,
            createdById: actor.id,
          })),
        },
      },
      include: {
        solutions: {
          orderBy: { language: "asc" },
        },
      },
    });

    revalidatePath("/potd");
    revalidatePath("/daily-practice");
    revalidatePath("/admin/daily-practice");

    return NextResponse.json({ problem }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A daily problem already exists for this date" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create daily practice problem" },
      { status: 500 }
    );
  }
}
