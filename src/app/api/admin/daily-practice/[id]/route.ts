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

const patchDailyPracticeSchema = z
  .object({
    date: dateSchema.optional(),
    platform: z.nativeEnum(ProblemPlatform).optional(),
    title: z.string().trim().min(3).max(200).optional(),
    problemUrl: z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) => isValidProblemUrl(value),
        "Use a supported platform HTTPS problem link",
      )
      .optional(),
    difficulty: z
      .string()
      .trim()
      .max(64)
      .optional()
      .nullable()
      .transform((value) => {
        if (value === undefined) return undefined;
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
        if (value === undefined) return undefined;
        if (!value) return null;
        return value.trim() || null;
      }),
    isPublished: z.boolean().optional(),
    solutions: z
      .object({
        JAVA: solutionSchema,
        CPP: solutionSchema,
        PYTHON: solutionSchema,
      })
      .optional(),
  })
  .refine(
    (value) =>
      value.date !== undefined ||
      value.platform !== undefined ||
      value.title !== undefined ||
      value.problemUrl !== undefined ||
      value.difficulty !== undefined ||
      value.notes !== undefined ||
      value.isPublished !== undefined ||
      value.solutions !== undefined,
    {
      message: "No update fields provided",
    }
  );

function ensurePublishedProblemIsComplete(
  problem: {
    isPublished: boolean;
    solutions: { language: string; code: string }[];
  }
) {
  if (!problem.isPublished) return;

  const languageSet = new Set(problem.solutions.map((solution) => solution.language));
  const hasAllLanguages = POTD_LANGUAGES.every((language) => languageSet.has(language));
  if (!hasAllLanguages) {
    throw new Error("Cannot publish until Java, C++, and Python solutions are added");
  }

  const hasBlankCode = problem.solutions.some((solution) => !solution.code.trim());
  if (hasBlankCode) {
    throw new Error("Cannot publish with blank solution code");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccessAdmin = await hasPotdAdminAccess(session.user.email);
  if (!canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await readJsonBody(req, 256 * 1_024);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = patchDailyPracticeSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue?.message || "Invalid payload",
      },
      { status: 400 }
    );
  }

  const actor = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!actor) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
  }

  const updateData: Prisma.DailyPracticeProblemUpdateInput = {};

  if (parsed.data.date !== undefined) {
    const date = dateKeyToUtcDate(parsed.data.date);
    if (!date) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    updateData.date = date;
  }

  if (parsed.data.platform !== undefined) updateData.platform = parsed.data.platform;
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.problemUrl !== undefined) updateData.problemUrl = parsed.data.problemUrl;
  if (parsed.data.difficulty !== undefined) updateData.difficulty = parsed.data.difficulty;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.isPublished !== undefined) updateData.isPublished = parsed.data.isPublished;

  try {
    const problem = await prisma.$transaction(async (tx) => {
      if (parsed.data.solutions) {
        for (const language of POTD_LANGUAGES) {
          const nextSolution = parsed.data.solutions[language];
          await tx.dailyPracticeSolution.upsert({
            where: {
              problemId_language: {
                problemId: id,
                language,
              },
            },
            update: {
              code: nextSolution.code,
              explanation: nextSolution.explanation,
              createdById: actor.id,
            },
            create: {
              problemId: id,
              language,
              code: nextSolution.code,
              explanation: nextSolution.explanation,
              createdById: actor.id,
            },
          });
        }
      }

      const updated = await tx.dailyPracticeProblem.update({
        where: { id },
        data: updateData,
        include: {
          solutions: {
            orderBy: { language: "asc" },
          },
        },
      });

      ensurePublishedProblemIsComplete(updated);
      return updated;
    });

    revalidatePath("/potd");
    revalidatePath("/daily-practice");
    revalidatePath("/admin/daily-practice");

    return NextResponse.json({ problem });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("Cannot publish")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

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
      { error: "Failed to update daily practice problem" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccessAdmin = await hasPotdAdminAccess(session.user.email);
  if (!canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.dailyPracticeProblem.delete({
      where: { id },
    });

    revalidatePath("/potd");
    revalidatePath("/daily-practice");
    revalidatePath("/admin/daily-practice");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to delete daily practice problem" },
      { status: 500 }
    );
  }
}
