import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAdminAccess } from "@/lib/admin";
import { dateToDateKey, getIstDateKey } from "@/lib/potd";
import { DailyPracticeAdminClient } from "./daily-practice-admin-client";

export default async function AdminDailyPracticePage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }

  if (!session?.user?.email) redirect("/login");

  const canAccessAdmin = await hasAdminAccess(session.user.email);
  if (!canAccessAdmin) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You need admin privileges to access this page.
        </p>
      </div>
    );
  }

  const problems = await prisma.dailyPracticeProblem.findMany({
    orderBy: { date: "desc" },
    take: 60,
    include: {
      solutions: {
        orderBy: { language: "asc" },
      },
      createdBy: {
        select: { id: true, username: true, name: true },
      },
    },
  });

  return (
    <DailyPracticeAdminClient
      todayKey={getIstDateKey()}
      problems={problems.map((problem) => ({
        id: problem.id,
        dateKey: dateToDateKey(problem.date),
        platform: problem.platform,
        title: problem.title,
        problemUrl: problem.problemUrl,
        difficulty: problem.difficulty,
        notes: problem.notes,
        isPublished: problem.isPublished,
        createdAt: problem.createdAt.toISOString(),
        updatedAt: problem.updatedAt.toISOString(),
        createdBy: problem.createdBy,
        solutions: problem.solutions.map((solution) => ({
          id: solution.id,
          language: solution.language,
          code: solution.code,
          explanation: solution.explanation,
        })),
      }))}
    />
  );
}
