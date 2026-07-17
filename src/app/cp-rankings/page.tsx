import { prisma } from "@/lib/prisma";
import { CPRankingsClient } from "./cp-rankings-client";

export const revalidate = 60;
const PAGE_SIZE = 10;

async function getCPData(requestedPage: number) {
  try {
    const where = {
      platform: "CODEFORCES" as const,
      rating: { gt: 0 },
    };
    const totalUsers = await prisma.platformProfile.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);

    const [cfProfiles, ratingRows, ratingStats] = await Promise.all([
      prisma.platformProfile.findMany({
        where,
        include: {
          user: {
            include: { university: true },
          },
        },
        orderBy: [{ rating: "desc" }, { userId: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.platformProfile.findMany({
        where,
        select: { rating: true },
      }),
      prisma.platformProfile.aggregate({
        where,
        _avg: { rating: true },
        _max: { rating: true },
      }),
    ]);

    const users = cfProfiles.map((p, i) => ({
      rank: (page - 1) * PAGE_SIZE + i + 1,
      username: p.user.username,
      name: p.user.name,
      handle: p.handle,
      rating: p.rating,
      maxRating: p.maxRating,
      cfRank: p.rank,
      universityShortName: p.user.university.shortName,
      contestsCount: p.contestsCount,
    }));

    const buckets = [
      { label: "Newbie", min: 0, max: 1199 },
      { label: "Pupil", min: 1200, max: 1399 },
      { label: "Specialist", min: 1400, max: 1599 },
      { label: "Expert", min: 1600, max: 1899 },
      { label: "CM", min: 1900, max: 2099 },
      { label: "Master", min: 2100, max: 2399 },
      { label: "IM+", min: 2400, max: 9999 },
    ];

    const distribution = buckets.map((b) => ({
      range: b.label,
      count: ratingRows.filter((p) => p.rating >= b.min && p.rating <= b.max).length,
      minRating: b.min || 800,
    }));

    return {
      users,
      distribution,
      page,
      totalPages,
      totalUsers,
      highestRating: ratingStats._max.rating ?? 0,
      averageRating: Math.round(ratingStats._avg.rating ?? 0),
    };
  } catch {
    return {
      users: [],
      distribution: [],
      page: 1,
      totalPages: 1,
      totalUsers: 0,
      highestRating: 0,
      averageRating: 0,
    };
  }
}

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
