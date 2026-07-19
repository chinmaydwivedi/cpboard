import { Platform, Prisma } from "@prisma/client";
import type { PlatformData } from "@/types";
import {
  acquirePlatformSyncLease,
  cancelPlatformSyncLease,
  completePlatformSyncLease,
  lockPlatformProfileTransaction,
  PlatformProfileNotLinkedError,
  USER_SYNC_COOLDOWN_MS,
} from "@/lib/platform-sync-lease";
import { fetchCodeforcesData } from "./codeforces";
import { fetchLeetcodeData } from "./leetcode";
import { fetchAtcoderData } from "./atcoder";
import { fetchCodechefData } from "./codechef";

const fetchers: Record<Platform, (handle: string) => Promise<PlatformData>> = {
  CODEFORCES: fetchCodeforcesData,
  LEETCODE: fetchLeetcodeData,
  ATCODER: fetchAtcoderData,
  CODECHEF: fetchCodechefData,
};

const OWNERSHIP_VERIFIED_PLATFORMS = new Set<Platform>([
  "CODEFORCES",
  "LEETCODE",
]);

export class PlatformVerificationRequiredError extends Error {
  constructor() {
    super("Verify ownership of this handle before linking it");
    this.name = "PlatformVerificationRequiredError";
  }
}

export class PlatformHandleAlreadyClaimedError extends Error {
  constructor() {
    super("This handle is already linked to another CPBoard account");
    this.name = "PlatformHandleAlreadyClaimedError";
  }
}

export class StalePlatformSyncError extends Error {
  constructor() {
    super("A newer platform update replaced this sync");
    this.name = "StalePlatformSyncError";
  }
}

export type PlatformSyncOptions = {
  /** Explicit onboarding/connect flows may create a profile. */
  allowProfileCreate?: boolean;
  /** New accounts prove protected handles; pre-rollout accounts are exempt. */
  requireOwnershipVerification?: boolean;
  /** Durable cooldown shared by all serverless instances. */
  minIntervalMs?: number;
  /** Explicit UI retries may recover a recorded failure after this interval. */
  interactiveFailureRetryMs?: number;
};

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
}

export async function fetchPlatformData(
  platform: Platform,
  handle: string,
): Promise<PlatformData> {
  const fetcher = fetchers[platform];
  if (!fetcher) throw new Error(`Unknown platform: ${platform}`);
  return fetcher(handle);
}

export async function syncUserPlatform(
  userId: string,
  platform: Platform,
  handle: string,
  options: PlatformSyncOptions = {},
) {
  const { prisma } = await import("@/lib/prisma");
  const ownershipProtected = OWNERSHIP_VERIFIED_PLATFORMS.has(platform);
  const requireOwnershipVerification =
    ownershipProtected && options.requireOwnershipVerification !== false;
  const allowProfileCreate = Boolean(options.allowProfileCreate);
  const lease = await acquirePlatformSyncLease({
    userId,
    platform,
    minIntervalMs: options.minIntervalMs ?? USER_SYNC_COOLDOWN_MS,
    interactiveFailureRetryMs: options.interactiveFailureRetryMs,
  });

  try {
    const initialProfile = await prisma.platformProfile.findUnique({
      where: { userId_platform: { userId, platform } },
      select: {
        handle: true,
        verified: true,
        verifiedAt: true,
        ownershipKey: true,
      },
    });

    if (!initialProfile && !allowProfileCreate) {
      throw new PlatformProfileNotLinkedError();
    }
    if (
      requireOwnershipVerification &&
      (!initialProfile?.verified ||
        !initialProfile.verifiedAt ||
        !initialProfile.ownershipKey ||
        normalizeHandle(initialProfile.handle) !== normalizeHandle(handle))
    ) {
      throw new PlatformVerificationRequiredError();
    }

    const data = await fetchPlatformData(platform, handle);
    const syncedAt = new Date();
    const activityCutoff = new Date(syncedAt);
    activityCutoff.setUTCHours(0, 0, 0, 0);
    activityCutoff.setUTCFullYear(activityCutoff.getUTCFullYear() - 1);
    const activityRows = Object.entries(data.dailyActivity)
      .map(([dateStr, submissionCount]) => ({
        date: new Date(dateStr),
        submissionCount,
      }))
      .filter(
        (activity) =>
          Number.isFinite(activity.date.getTime()) &&
          activity.date >= activityCutoff,
      )
      .slice(0, 500);

    const mergedData = await prisma.$transaction(async (tx) => {
      await lockPlatformProfileTransaction(tx, userId, platform);

      const currentLeases = await tx.$queryRaw<Array<{ leaseToken: string }>>`
        SELECT "leaseToken"
        FROM "PlatformSyncLease"
        WHERE "userId" = ${userId}
          AND "platform" = CAST(${platform} AS "Platform")
        FOR UPDATE
      `;
      if (currentLeases[0]?.leaseToken !== lease.leaseToken) {
        throw new StalePlatformSyncError();
      }

      const currentProfile = await tx.platformProfile.findUnique({
        where: { userId_platform: { userId, platform } },
        select: {
          id: true,
          handle: true,
          rating: true,
          maxRating: true,
          problemsSolved: true,
          rank: true,
          contestsCount: true,
          verified: true,
          verifiedAt: true,
          verificationMethod: true,
          ownershipKey: true,
        },
      });

      if (!currentProfile && !allowProfileCreate) {
        throw new PlatformProfileNotLinkedError();
      }
      if (
        (currentProfile ? normalizeHandle(currentProfile.handle) : null) !==
        (initialProfile ? normalizeHandle(initialProfile.handle) : null)
      ) {
        throw new StalePlatformSyncError();
      }

      const normalizedHandle = normalizeHandle(data.handle);
      const sameExistingHandle =
        currentProfile != null &&
        normalizeHandle(currentProfile.handle) === normalizedHandle;
      const hasOwnershipVerification = Boolean(
        requireOwnershipVerification &&
          sameExistingHandle &&
          currentProfile?.verified &&
          currentProfile.verifiedAt &&
          currentProfile.ownershipKey === `${platform}:${normalizedHandle}`,
      );
      if (requireOwnershipVerification && !hasOwnershipVerification) {
        throw new PlatformVerificationRequiredError();
      }

      const previousData = sameExistingHandle ? currentProfile : null;
      const result: PlatformData = {
        ...data,
        rating:
          data.rating > 0
            ? data.rating
            : (previousData?.rating ?? data.rating),
        maxRating: Math.max(data.maxRating, previousData?.maxRating ?? 0),
        problemsSolved: Math.max(
          data.problemsSolved,
          previousData?.problemsSolved ?? 0,
        ),
        rank: data.rank || previousData?.rank || null,
        contestsCount: Math.max(
          data.contestsCount,
          previousData?.contestsCount ?? 0,
        ),
      };

      const profileData = {
        handle: result.handle,
        rating: result.rating,
        maxRating: result.maxRating,
        problemsSolved: result.problemsSolved,
        rank: result.rank,
        contestsCount: result.contestsCount,
        lastSynced: syncedAt,
        verified: true,
        verifiedAt: ownershipProtected
          ? requireOwnershipVerification
            ? currentProfile?.verifiedAt ?? null
            : sameExistingHandle
              ? currentProfile?.verifiedAt ?? syncedAt
              : syncedAt
          : null,
        verificationMethod: ownershipProtected
          ? requireOwnershipVerification
            ? currentProfile?.verificationMethod ?? null
            : "LEGACY_ACCOUNT"
          : "PUBLIC_PROFILE",
        ownershipKey: ownershipProtected
          ? requireOwnershipVerification
            ? currentProfile?.ownershipKey ?? null
            : `${platform}:${normalizedHandle}`
          : null,
      };

      if (currentProfile) {
        await tx.platformProfile.update({
          where: { id: currentProfile.id },
          data: profileData,
        });
      } else {
        if (requireOwnershipVerification) {
          throw new PlatformVerificationRequiredError();
        }
        await tx.platformProfile.create({
          data: { userId, platform, ...profileData },
        });
      }

      if (!sameExistingHandle) {
        await tx.dailyActivity.deleteMany({ where: { userId, platform } });
      } else if (activityRows.length > 0) {
        await tx.dailyActivity.deleteMany({
          where: {
            userId,
            platform,
            date: { in: activityRows.map((activity) => activity.date) },
          },
        });
      }

      if (activityRows.length > 0) {
        await tx.dailyActivity.createMany({
          data: activityRows.map((activity) => ({
            userId,
            platform,
            date: activity.date,
            submissionCount: activity.submissionCount,
          })),
          skipDuplicates: true,
        });
      }

      await tx.syncLog.create({
        data: { userId, platform, status: "SUCCESS", syncedAt },
      });
      return result;
    });

    await completePlatformSyncLease(lease, { success: true }).catch((error) => {
      console.error("Failed to release successful platform sync lease", error);
    });
    return mergedData;
  } catch (error) {
    const normalizedError =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
        ? new PlatformHandleAlreadyClaimedError()
        : error;
    const message =
      normalizedError instanceof Error ? normalizedError.message : "Unknown error";
    const shouldBackoff =
      !(normalizedError instanceof PlatformProfileNotLinkedError) &&
      !(normalizedError instanceof PlatformVerificationRequiredError) &&
      !(normalizedError instanceof PlatformHandleAlreadyClaimedError) &&
      !(normalizedError instanceof StalePlatformSyncError);
    const shouldCancelLease =
      normalizedError instanceof PlatformProfileNotLinkedError ||
      normalizedError instanceof PlatformVerificationRequiredError ||
      normalizedError instanceof StalePlatformSyncError;
    const cleanupTasks: Promise<unknown>[] = [
      shouldBackoff
        ? completePlatformSyncLease(lease, { success: false, error: message })
        : shouldCancelLease
          ? cancelPlatformSyncLease(lease)
          : completePlatformSyncLease(lease, { success: true }),
    ];
    if (
      !(normalizedError instanceof PlatformProfileNotLinkedError) &&
      !(normalizedError instanceof PlatformVerificationRequiredError) &&
      !(normalizedError instanceof PlatformHandleAlreadyClaimedError) &&
      !(normalizedError instanceof StalePlatformSyncError)
    ) {
      cleanupTasks.push(
        prisma.$transaction(async (tx) => {
          await lockPlatformProfileTransaction(tx, userId, platform);
          const profileStillExists = await tx.platformProfile.findUnique({
            where: { userId_platform: { userId, platform } },
            select: { id: true },
          });
          if (!profileStillExists) return;

          await tx.syncLog.create({
            data: {
              userId,
              platform,
              status: "FAILED",
              error: message.slice(0, 500),
            },
          });
        }),
      );
    }
    await Promise.allSettled(cleanupTasks);
    throw normalizedError;
  }
}
