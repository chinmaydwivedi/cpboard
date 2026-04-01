import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncUserPlatform } from "@/lib/platforms";

export const maxDuration = 60;

const BATCH_SIZE = 3;
const TIME_BUDGET_MS = 55_000; // stop 5s before max to leave buffer

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  const profiles = await prisma.platformProfile.findMany({
    where: { verified: true },
    include: { user: true },
    orderBy: { lastSynced: "asc" },
  });

  const results: { userId: string; platform: string; success: boolean; error?: string }[] = [];
  let timedOut = false;

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }

    const batch = profiles.slice(i, i + BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map((profile) =>
        syncUserPlatform(profile.userId, profile.platform, profile.handle)
          .then(() => ({ userId: profile.userId, platform: profile.platform, success: true as const }))
          .catch((error) => ({
            userId: profile.userId,
            platform: profile.platform,
            success: false as const,
            error: error instanceof Error ? error.message : "Unknown",
          }))
      )
    );

    for (const result of settled) {
      results.push(result.status === "fulfilled" ? result.value : {
        userId: batch[0].userId,
        platform: batch[0].platform,
        success: false,
        error: "Promise rejected unexpectedly",
      });
    }
  }

  return NextResponse.json({
    synced: results.length,
    total: profiles.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    timedOut,
    results,
  });
}
