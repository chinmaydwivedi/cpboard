import Link from "next/link";
import { prisma } from "@/lib/prisma";
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

  return <LandingHero stats={stats} />;
}
