import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { getCurrentSession } from "@/lib/session";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { withReadRetry } from "@/lib/read-retry";
import { LandingHero } from "./landing-hero";

export const dynamic = "force-dynamic";

const getStats = unstable_cache(
  async () => {
    const [userCount, universityCount, profileStats] = await withReadRetry(
      () =>
        Promise.all([
          prisma.user.count({ where: { onboardingComplete: true } }),
          prisma.university.count(),
          prisma.platformProfile.aggregate({
            where: { verified: true, user: { onboardingComplete: true } },
            _count: { _all: true },
            _sum: { problemsSolved: true },
          }),
        ]),
    );

    return {
      users: userCount,
      universities: universityCount,
      profiles: profileStats._count._all,
      totalSolved: profileStats._sum.problemsSolved || 0,
    };
  },
  ["landing-stats-v2"],
  { revalidate: 60, tags: [CACHE_TAGS.landingStats] },
);

export default async function HomePage() {
  const [stats, session] = await Promise.all([
    getStats(),
    getCurrentSession().catch(() => null),
  ]);

  return <LandingHero stats={stats} isLoggedIn={Boolean(session?.user?.email)} />;
}
