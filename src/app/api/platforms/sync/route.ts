import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PlatformHandleAlreadyClaimedError,
  PlatformVerificationRequiredError,
  syncUserPlatform,
} from "@/lib/platforms";
import { extractHandle } from "@/lib/parse-handle";
import { Platform } from "@prisma/client";
import { invalidatePlatformViews } from "@/lib/platform-cache";
import {
  INTERACTIVE_FAILURE_RETRY_MS,
  lockPlatformProfileTransaction,
  PlatformProfileNotLinkedError,
  PlatformSyncLeaseError,
  USER_SYNC_COOLDOWN_MS,
} from "@/lib/platform-sync-lease";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const username = session?.username;
  const universityShortName = session?.university?.shortName;
  if (!userId || !username || !universityShortName) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    platform?: string;
    handle?: string;
  } | null;
  if (!body?.platform || !Object.values(Platform).includes(body.platform as Platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  const platform = body.platform as Platform;
  const handle = body.handle ? extractHandle(platform, body.handle) : "";

  if (!handle) {
    return NextResponse.json(
      { error: "Platform and handle are required" },
      { status: 400 }
    );
  }

  const [profile, user] = await Promise.all([
    prisma.platformProfile.findUnique({
      where: { userId_platform: { userId, platform } },
      select: {
        handle: true,
        verified: true,
        verifiedAt: true,
        ownershipKey: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { ownershipVerificationRequired: true },
    }),
  ]);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const ownershipPlatform =
    platform === "CODEFORCES" || platform === "LEETCODE";
  const requireOwnershipVerification =
    ownershipPlatform && user.ownershipVerificationRequired;

  if (requireOwnershipVerification) {
    if (
      !profile ||
      !profile.verified ||
      !profile.verifiedAt ||
      !profile.ownershipKey ||
      profile.handle.trim().toLowerCase() !== handle.trim().toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: "Verify ownership of this handle before linking it",
          code: "VERIFICATION_REQUIRED",
        },
        { status: 409 },
      );
    }
  }

  const allowProfileCreate = !profile;

  try {
    const data = await syncUserPlatform(userId, platform, handle.trim(), {
      allowProfileCreate,
      interactiveFailureRetryMs: INTERACTIVE_FAILURE_RETRY_MS,
      minIntervalMs: USER_SYNC_COOLDOWN_MS,
      requireOwnershipVerification,
    });
    invalidatePlatformViews({
      username,
      universityShortName,
      codeforces: platform === "CODEFORCES",
      topicRadar: platform === "CODEFORCES" || platform === "LEETCODE",
    });

    return NextResponse.json({
      success: true,
      data: {
        handle: data.handle,
        rating: data.rating,
        maxRating: data.maxRating,
        problemsSolved: data.problemsSolved,
        rank: data.rank,
        contestsCount: data.contestsCount,
      },
    });
  } catch (error) {
    if (error instanceof PlatformSyncLeaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfter) },
        },
      );
    }
    if (error instanceof PlatformProfileNotLinkedError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PlatformHandleAlreadyClaimedError) {
      return NextResponse.json(
        { error: error.message, code: "HANDLE_ALREADY_CLAIMED" },
        { status: 409 },
      );
    }
    if (error instanceof PlatformVerificationRequiredError) {
      return NextResponse.json(
        { error: error.message, code: "VERIFICATION_REQUIRED" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync platform data",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const username = session?.username;
  const universityShortName = session?.university?.shortName;
  if (!userId || !username || !universityShortName) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { platform } = body as { platform: Platform };

  if (!platform) {
    return NextResponse.json({ error: "Platform is required" }, { status: 400 });
  }

  if (!Object.values(Platform).includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const profileDelete = await prisma.$transaction(async (tx) => {
    await lockPlatformProfileTransaction(tx, userId, platform);
    await tx.dailyActivity.deleteMany({ where: { userId, platform } });
    await tx.syncLog.deleteMany({ where: { userId, platform } });
    await tx.platformVerificationChallenge.deleteMany({
      where: { userId, platform },
    });
    await tx.platformVerificationStartLease.deleteMany({
      where: { userId, platform },
    });
    await tx.platformSyncLease.deleteMany({ where: { userId, platform } });
    return tx.platformProfile.deleteMany({ where: { userId, platform } });
  });

  if (profileDelete.count === 0) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  invalidatePlatformViews({
    username,
    universityShortName,
    codeforces: platform === "CODEFORCES",
    topicRadar: platform === "CODEFORCES" || platform === "LEETCODE",
  });

  return NextResponse.json({ success: true });
}
