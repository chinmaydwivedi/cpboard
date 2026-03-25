import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { LandingHero } from "./landing-hero";

async function getStats() {
  try {
    const [userCount, universityCount, profileCount] = await Promise.all([
      prisma.user.count(),
      prisma.university.count(),
      prisma.platformProfile.count(),
    ]);

    const totalSolved = await prisma.platformProfile.aggregate({
      _sum: { problemsSolved: true },
    });

    return {
      users: userCount,
      universities: universityCount,
      profiles: profileCount,
      totalSolved: totalSolved._sum.problemsSolved || 0,
    };
  } catch {
    return { users: 0, universities: 0, profiles: 0, totalSolved: 0 };
  }
}

export default async function HomePage() {
  const stats = await getStats();
  let isLoggedIn = false;

  try {
    const session = await auth();
    isLoggedIn = Boolean(session?.user?.email);
  } catch {
    // auth might not be available in every environment
  }

  return <LandingHero stats={stats} isLoggedIn={isLoggedIn} />;
}
