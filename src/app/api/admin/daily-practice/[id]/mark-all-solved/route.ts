import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { hasPotdAdminAccess } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST(
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

  const problem = await prisma.dailyPracticeProblem.findUnique({
    where: { id },
    select: { id: true, date: true, isPublished: true },
  });

  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  if (!problem.isPublished) {
    return NextResponse.json(
      { error: "Publish this POTD before marking it solved for everyone." },
      { status: 400 }
    );
  }

  const users = await prisma.user.findMany({
    select: { id: true },
  });

  if (users.length === 0) {
    return NextResponse.json({
      ok: true,
      created: 0,
      skipped: 0,
      totalUsers: 0,
    });
  }

  const result = await prisma.potdSolve.createMany({
    data: users.map((user) => ({
      userId: user.id,
      problemId: problem.id,
      solvedDate: problem.date,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/potd");
  revalidatePath("/daily-practice");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/daily-practice");

  return NextResponse.json({
    ok: true,
    created: result.count,
    skipped: users.length - result.count,
    totalUsers: users.length,
  });
}
