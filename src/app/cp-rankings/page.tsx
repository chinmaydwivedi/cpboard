import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { CPRankingsClient } from "./cp-rankings-client";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const revalidate = 60;
const PAGE_SIZE = 10;

type RatingSummary = {
  totalUsers: number;
  highestRating: number;
  averageRating: number;
  newbie: number;
  pupil: number;
  specialist: number;
  expert: number;
  candidateMaster: number;
  master: number;
  internationalMasterPlus: number;
};

const getCPData = unstable_cache(
  async (requestedPage: number) => {
    try {
    const where = {
      platform: "CODEFORCES" as const,
      rating: { gt: 0 },
      verified: true,
      user: { onboardingComplete: true },
    };
    const [summaryRows, topProfiles] = await Promise.all([
      prisma.$queryRaw<RatingSummary[]>`
        SELECT
          COUNT(*)::integer AS "totalUsers",
          COALESCE(MAX("rating"), 0)::integer AS "highestRating",
          COALESCE(ROUND(AVG("rating")), 0)::integer AS "averageRating",
          COUNT(*) FILTER (WHERE "rating" BETWEEN 1 AND 1199)::integer AS "newbie",
          COUNT(*) FILTER (WHERE "rating" BETWEEN 1200 AND 1399)::integer AS "pupil",
          COUNT(*) FILTER (WHERE "rating" BETWEEN 1400 AND 1599)::integer AS "specialist",
          COUNT(*) FILTER (WHERE "rating" BETWEEN 1600 AND 1899)::integer AS "expert",
          COUNT(*) FILTER (WHERE "rating" BETWEEN 1900 AND 2099)::integer AS "candidateMaster",
          COUNT(*) FILTER (WHERE "rating" BETWEEN 2100 AND 2399)::integer AS "master",
          COUNT(*) FILTER (WHERE "rating" >= 2400)::integer AS "internationalMasterPlus"
        FROM "PlatformProfile" AS profiles
        INNER JOIN "User" AS users
          ON users."id" = profiles."userId"
          AND users."onboardingComplete" = true
        WHERE profiles."platform" = 'CODEFORCES'::"Platform"
          AND profiles."rating" > 0
          AND profiles."verified" = true
      `,
      prisma.platformProfile.findMany({
        where,
        select: {
          handle: true,
          rating: true,
          maxRating: true,
          rank: true,
          contestsCount: true,
          user: {
            select: {
              username: true,
              name: true,
              avatarUrl: true,
              university: { select: { shortName: true } },
            },
          },
        },
        orderBy: [{ rating: "desc" }, { userId: "asc" }],
        take: 3,
      }),
    ]);
    const summary = summaryRows[0] ?? {
      totalUsers: 0,
      highestRating: 0,
      averageRating: 0,
      newbie: 0,
      pupil: 0,
      specialist: 0,
      expert: 0,
      candidateMaster: 0,
      master: 0,
      internationalMasterPlus: 0,
    };
    const totalUsers = summary.totalUsers;
    const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);

    const cfProfiles = await prisma.platformProfile.findMany({
      where,
      select: {
        handle: true,
        rating: true,
        maxRating: true,
        rank: true,
        contestsCount: true,
        user: {
          select: {
            username: true,
            name: true,
            avatarUrl: true,
            university: { select: { shortName: true } },
          },
        },
      },
      orderBy: [{ rating: "desc" }, { userId: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    const users = cfProfiles.map((p, i) => ({
      rank: (page - 1) * PAGE_SIZE + i + 1,
      username: p.user.username,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
      handle: p.handle,
      rating: p.rating,
      maxRating: p.maxRating,
      cfRank: p.rank,
      universityShortName: p.user.university.shortName,
      contestsCount: p.contestsCount,
    }));
    const topUsers = topProfiles.map((p, i) => ({
      rank: i + 1,
      username: p.user.username,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
      handle: p.handle,
      rating: p.rating,
      maxRating: p.maxRating,
      cfRank: p.rank,
      universityShortName: p.user.university.shortName,
      contestsCount: p.contestsCount,
    }));

    const distribution = [
      { range: "Newbie", count: summary.newbie, minRating: 800 },
      { range: "Pupil", count: summary.pupil, minRating: 1200 },
      { range: "Specialist", count: summary.specialist, minRating: 1400 },
      { range: "Expert", count: summary.expert, minRating: 1600 },
      { range: "CM", count: summary.candidateMaster, minRating: 1900 },
      { range: "Master", count: summary.master, minRating: 2100 },
      { range: "IM+", count: summary.internationalMasterPlus, minRating: 2400 },
    ];

    return {
      users,
      topUsers,
      distribution,
      page,
      totalPages,
      totalUsers,
      highestRating: summary.highestRating,
      averageRating: summary.averageRating,
    };
  } catch {
    return {
      users: [],
      topUsers: [],
      distribution: [],
      page: 1,
      totalPages: 1,
      totalUsers: 0,
      highestRating: 0,
      averageRating: 0,
    };
    }
  },
  ["cp-rankings-data-v3"],
  { revalidate: 60, tags: [CACHE_TAGS.cpRankings] },
);

export default async function CPRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const rawPage = (await searchParams).page;
  const parsedPage = Number.parseInt(
    Array.isArray(rawPage) ? rawPage[0] : rawPage ?? "1",
    10,
  );
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const data = await getCPData(requestedPage);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8" data-tour="cp-header">
        <h1 className="text-2xl font-bold tracking-tight">CP Rankings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Codeforces ratings across all universities
        </p>
      </div>

      <CPRankingsClient {...data} />
    </div>
  );
}
