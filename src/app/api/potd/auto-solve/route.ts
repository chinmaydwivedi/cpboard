import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  detectAutoSolvedPotd,
  upsertPotdSolveAndGetStreak,
} from "@/lib/potd-solve";

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
    select: {
      id: true,
      university: { select: { shortName: true } },
      platformProfiles: {
        where: { platform: { in: ["LEETCODE", "CODEFORCES"] } },
        select: { platform: true, handle: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const problem = await prisma.dailyPracticeProblem.findUnique({
    where: { id: problemId },
    select: {
      id: true,
      date: true,
      platform: true,
      problemUrl: true,
      isPublished: true,
    },
  });

  if (!problem || !problem.isPublished) {
    return NextResponse.json({ error: "Problem not available" }, { status: 404 });
  }

  const existing = await prisma.potdSolve.findUnique({
    where: {
      problemId_userId: {
        problemId: problem.id,
        userId: user.id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({
      solved: true,
      auto: false,
    });
  }

  const leetcodeHandle =
    user.platformProfiles.find((profile) => profile.platform === "LEETCODE")
      ?.handle ?? null;
  const codeforcesHandle =
    user.platformProfiles.find((profile) => profile.platform === "CODEFORCES")
      ?.handle ?? null;

  const detection = await detectAutoSolvedPotd({
    platform: problem.platform,
    problemUrl: problem.problemUrl,
    leetcodeHandle,
    codeforcesHandle,
  });

  if (!detection.matched) {
    return NextResponse.json({
      solved: false,
      auto: true,
    });
  }

  const streak = await upsertPotdSolveAndGetStreak({
    userId: user.id,
    problemId: problem.id,
    solvedDate: problem.date,
  });

  revalidatePath("/potd");
  revalidatePath("/daily-practice");
  revalidatePath("/leaderboard");
  revalidatePath(`/leaderboard/${user.university.shortName}`);

  return NextResponse.json({
    solved: true,
    auto: true,
    source: detection.source,
    streak,
  });
}
