import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncUserPlatform } from "@/lib/platforms";

export const maxDuration = 10;

const BATCH_SIZE = 3;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.platformProfile.findMany({
    where: { verified: true },
    include: { user: true },
    orderBy: { lastSynced: "asc" },
    take: BATCH_SIZE,
  });

  const results: { userId: string; platform: string; success: boolean; error?: string }[] = [];

  for (const profile of profiles) {
    try {
      await syncUserPlatform(profile.userId, profile.platform, profile.handle);
      results.push({ userId: profile.userId, platform: profile.platform, success: true });
    } catch (error) {
      results.push({
        userId: profile.userId,
        platform: profile.platform,
        success: false,
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  }

  return NextResponse.json({
    synced: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
