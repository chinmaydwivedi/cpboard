import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePotdStreak, dateToDateKey, getIstDateKey } from "@/lib/potd";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const problemId =
    payload && typeof payload === "object" && "problemId" in payload
      ? (payload as { problemId?: unknown }).problemId
      : null;

  if (typeof problemId !== "string" || !problemId.trim()) {
    return NextResponse.json({ error: "problemId is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const problem = await prisma.dailyPracticeProblem.findUnique({
    where: { id: problemId },
    select: { id: true, date: true, isPublished: true },
  });

  if (!problem || !problem.isPublished) {
    return NextResponse.json({ error: "Problem not available" }, { status: 404 });
  }

  await prisma.potdSolve.upsert({
    where: {
      problemId_userId: {
        problemId: problem.id,
        userId: user.id,
      },
    },
    update: {
      solvedAt: new Date(),
    },
    create: {
      problemId: problem.id,
      userId: user.id,
      solvedDate: problem.date,
    },
  });

  const solvedDates = await prisma.potdSolve.findMany({
    where: { userId: user.id },
    select: { solvedDate: true },
    orderBy: { solvedDate: "asc" },
  });

  const streak = computePotdStreak(
    solvedDates.map((entry) => dateToDateKey(entry.solvedDate)),
    getIstDateKey()
  );

  revalidatePath("/potd");
  revalidatePath("/daily-practice");

  return NextResponse.json({
    ok: true,
    streak,
  });
}
