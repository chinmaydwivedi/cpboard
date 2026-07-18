import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPotdAdminAccess, hasAdminAccess } from "@/lib/admin";
import { dateToDateKey, getIstDateKey } from "@/lib/potd";
import { DailyPracticeAdminClient } from "./daily-practice-admin-client";

export default async function AdminDailyPracticePage() {
  let session;
  try {
    session = await getCurrentSession();
  } catch {
    redirect("/login");
  }

  if (!session?.user?.email) redirect("/login");

  const canAccessAdmin = await hasPotdAdminAccess(session.user.email);
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

  const isFullAdmin = await hasAdminAccess(session.user.email);

  return (
    <DailyPracticeAdminClient
      todayKey={getIstDateKey()}
      isFullAdmin={isFullAdmin}
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
