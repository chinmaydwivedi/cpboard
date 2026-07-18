import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { getCurrentSession } from "@/lib/session";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { LandingHero } from "./landing-hero";

const getStats = unstable_cache(
  async () => {
    try {
      const [userCount, universityCount, profileCount, totalSolved] = await Promise.all([
        prisma.user.count({ where: { onboardingComplete: true } }),
        prisma.university.count(),
        prisma.platformProfile.count({
          where: { verified: true, user: { onboardingComplete: true } },
        }),
        prisma.platformProfile.aggregate({
          where: { verified: true, user: { onboardingComplete: true } },
          _sum: { problemsSolved: true },
        }),
      ]);

      return {
        users: userCount,
        universities: universityCount,
        profiles: profileCount,
        totalSolved: totalSolved._sum.problemsSolved || 0,
      };
    } catch {
      return { users: 0, universities: 0, profiles: 0, totalSolved: 0 };
    }
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
