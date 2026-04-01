import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computePotdStreak,
  dateToDateKey,
  getIstDateKey,
  getUtcDayBoundsFromDateKey,
  isDateKey,
  POTD_LANGUAGES,
} from "@/lib/potd";
import { PotdClient } from "./potd-client";

export const revalidate = 60;

async function findPublishedProblemByDateKey(dateKey: string) {
  const bounds = getUtcDayBoundsFromDateKey(dateKey);
  if (!bounds) return null;

  return prisma.dailyPracticeProblem.findFirst({
    where: {
      isPublished: true,
      date: {
        gte: bounds.start,
        lt: bounds.end,
      },
    },
    select: { id: true },
  });
}

export default async function PotdPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const todayKey = getIstDateKey();
  const { date: dateParam } = await searchParams;
  const selectedDateKey =
    typeof dateParam === "string" && isDateKey(dateParam) ? dateParam : null;

  let viewer:
    | {
        id: string;
        username: string;
        name: string | null;
      }
    | null = null;

  try {
    const session = await auth();
    if (session?.user?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          username: true,
          name: true,
        },
      });

      if (dbUser) {
        viewer = dbUser;
      }
    }
  } catch {
    viewer = null;
  }

  const [
    selectedProblemMeta,
    todayProblemMeta,
    latestProblemMeta,
    archiveRaw,
    solvedEntries,
  ] =
    await Promise.all([
      selectedDateKey ? findPublishedProblemByDateKey(selectedDateKey) : null,
      findPublishedProblemByDateKey(todayKey),
      prisma.dailyPracticeProblem.findFirst({
        where: { isPublished: true },
        select: { id: true },
        orderBy: { date: "desc" },
      }),
      prisma.dailyPracticeProblem.findMany({
        where: { isPublished: true },
        orderBy: { date: "desc" },
        take: 40,
        select: {
          id: true,
          date: true,
          title: true,
          platform: true,
          difficulty: true,
        },
      }),
      viewer
        ? prisma.potdSolve.findMany({
            where: { userId: viewer.id },
            select: { problemId: true, solvedDate: true },
            orderBy: { solvedDate: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const problemId =
    selectedProblemMeta?.id ?? todayProblemMeta?.id ?? latestProblemMeta?.id ?? null;

  const [problem, comments] = problemId
    ? await Promise.all([
        prisma.dailyPracticeProblem.findUnique({
          where: { id: problemId },
          include: {
            solutions: {
              orderBy: { language: "asc" },
            },
          },
        }),
        prisma.dailyPracticeComment.findMany({
          where: {
            problemId,
          },
          orderBy: { createdAt: "asc" },
          take: 200,
          select: {
            id: true,
            body: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        }),
      ])
    : [null, []];

  const solvedDateKeys = solvedEntries.map((entry) => dateToDateKey(entry.solvedDate));
  const solvedProblemIds = new Set(solvedEntries.map((entry) => entry.problemId));

  const streak = viewer ? computePotdStreak(solvedDateKeys, todayKey) : null;

  return (
    <PotdClient
      todayKey={todayKey}
      selectedDateKey={selectedDateKey}
      viewer={viewer}
      streak={streak}
      solvedDateKeys={solvedDateKeys}
      publishedDateKeys={archiveRaw.map((entry) => dateToDateKey(entry.date))}
      hasSolvedCurrent={problem ? solvedProblemIds.has(problem.id) : false}
      problem={
        problem
          ? {
              id: problem.id,
              dateKey: dateToDateKey(problem.date),
              platform: problem.platform,
              title: problem.title,
              problemUrl: problem.problemUrl,
              difficulty: problem.difficulty,
              notes: problem.notes,
              isToday: dateToDateKey(problem.date) === todayKey,
              solutions: [...problem.solutions]
                .sort(
                  (a, b) =>
                    POTD_LANGUAGES.indexOf(a.language) -
                    POTD_LANGUAGES.indexOf(b.language)
                )
                .map((solution) => ({
                  language: solution.language,
                  code: solution.code,
                  explanation: solution.explanation,
                })),
            }
          : null
      }
      archive={archiveRaw.map((entry) => ({
        id: entry.id,
        dateKey: dateToDateKey(entry.date),
        title: entry.title,
        platform: entry.platform,
        difficulty: entry.difficulty,
      }))}
      comments={comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        user: {
          id: comment.user.id,
          username: comment.user.username,
          name: comment.user.name,
          avatarUrl: comment.user.avatarUrl,
        },
      }))}
    />
  );
}
