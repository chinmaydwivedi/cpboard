import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncUserPlatform } from "@/lib/platforms";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  PlatformProfileNotLinkedError,
  PlatformSyncLeaseError,
  USER_SYNC_COOLDOWN_MS,
} from "@/lib/platform-sync-lease";

const SYNC_CONCURRENCY = 2;

type SyncResult = {
  platform: string;
  success: boolean;
  error?: string;
  code?: string;
  retryAfter?: number;
};

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  const username = session?.username;
  const universityShortName = session?.university?.shortName;
  if (!userId || !username || !universityShortName) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const syncUserId = userId;

  const profiles = await prisma.platformProfile.findMany({
    where: { userId, verified: true },
    orderBy: { platform: "asc" },
    select: { platform: true, handle: true },
  });

  if (profiles.length === 0) {
    return NextResponse.json({ error: "No linked platforms to sync" }, { status: 400 });
  }

  const results = new Array<SyncResult>(profiles.length);
  let nextProfileIndex = 0;

  async function syncNextProfile() {
    while (nextProfileIndex < profiles.length) {
      const profileIndex = nextProfileIndex;
      nextProfileIndex += 1;
      const profile = profiles[profileIndex];
      if (!profile) break;

      try {
        await syncUserPlatform(syncUserId, profile.platform, profile.handle, {
          minIntervalMs: USER_SYNC_COOLDOWN_MS,
        });
        results[profileIndex] = { platform: profile.platform, success: true };
      } catch (error) {
        results[profileIndex] = {
          platform: profile.platform,
          success: false,
          error:
            error instanceof PlatformSyncLeaseError ||
            error instanceof PlatformProfileNotLinkedError
              ? error.message
              : "Provider sync failed",
          ...(error instanceof PlatformSyncLeaseError
            ? { code: error.code, retryAfter: error.retryAfter }
            : error instanceof PlatformProfileNotLinkedError
              ? { code: "PROFILE_NOT_LINKED" }
              : {}),
        };
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(SYNC_CONCURRENCY, profiles.length) },
      () => syncNextProfile(),
    ),
  );

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;
  const codeforcesSynced = results.some((r) => r.success && r.platform === "CODEFORCES");

  if (successful > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/leaderboard");
    revalidatePath(`/leaderboard/${universityShortName}`);
    revalidatePath(`/u/${username}`);
    revalidateTag(CACHE_TAGS.landingStats, { expire: 0 });
    revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });
    if (
      results.some(
        (result) =>
          result.success &&
          (result.platform === "CODEFORCES" || result.platform === "LEETCODE"),
      )
    ) {
      revalidateTag(CACHE_TAGS.topicRadar, { expire: 0 });
    }
    if (codeforcesSynced) {
      revalidatePath("/cp-rankings");
      revalidateTag(CACHE_TAGS.cpRankings, { expire: 0 });
    }
  }

  return NextResponse.json({
    success: failed === 0,
    total: results.length,
    successful,
    failed,
    results,
  });
}
