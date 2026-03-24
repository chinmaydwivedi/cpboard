import { prisma } from "@/lib/prisma";
import { getCodeforcesRankTitle, getCodeforcesRankColor } from "@/lib/scoring";
import { CPRankingsClient } from "./cp-rankings-client";

export const revalidate = 60;

async function getCPData() {
  try {
    const cfProfiles = await prisma.platformProfile.findMany({
      where: {
        platform: "CODEFORCES",
        rating: { gt: 0 },
      },
      include: {
        user: {
          include: { university: true },
        },
      },
      orderBy: { rating: "desc" },
    });

    const users = cfProfiles.map((p, i) => ({
      rank: i + 1,
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
      count: cfProfiles.filter((p) => p.rating >= b.min && p.rating <= b.max).length,
      minRating: b.min || 800,
    }));

    return { users, distribution };
  } catch {
    return { users: [], distribution: [] };
  }
}

export default async function CPRankingsPage() {
  const { users, distribution } = await getCPData();

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8" data-tour="cp-header">
        <h1 className="text-2xl font-bold tracking-tight">CP Rankings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Codeforces ratings across all universities
        </p>
      </div>

      <CPRankingsClient users={users} distribution={distribution} />
    </div>
  );
}
