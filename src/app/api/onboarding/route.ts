import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractHandle } from "@/lib/parse-handle";
import { syncUserPlatform } from "@/lib/platforms";
import { Platform, Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { z } from "zod";
import { lockPlatformProfileTransaction } from "@/lib/platform-sync-lease";

const onboardingSchema = z.object({
  username: z.string().trim().min(3).max(30),
  name: z.string().trim().max(80).default(""),
  profiles: z
    .array(
      z.object({
        platform: z.enum(["CODEFORCES", "LEETCODE", "ATCODER", "CODECHEF"]),
        url: z.string().trim().max(200),
      }),
    )
    .max(4)
    .default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = onboardingSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Check your profile details and try again" },
      { status: 400 },
    );
  }
  const { username, name, profiles } = parsedBody.data;

  const platformNames = profiles.map((profile) => profile.platform);
  if (new Set(platformNames).size !== platformNames.length) {
    return NextResponse.json(
      { error: "Add each platform at most once" },
      { status: 400 },
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingComplete: true,
      ownershipVerificationRequired: true,
    },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (currentUser.onboardingComplete) {
    return NextResponse.json(
      { error: "Onboarding is already complete" },
      { status: 409 },
    );
  }

  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters" },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json(
      { error: "Username can only contain lowercase letters, numbers, and underscores" },
      { status: 400 }
    );
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existingUsername && existingUsername.id !== userId) {
    return NextResponse.json(
      { error: "Username is already taken" },
      { status: 409 }
    );
  }

  const parsedProfiles = profiles
    .filter(
      (profile) =>
        profile.url?.trim() && Object.values(Platform).includes(profile.platform),
    )
    .map((profile) => ({
      platform: profile.platform,
      handle: extractHandle(profile.platform, profile.url).trim(),
    }))
    .filter((profile) => profile.handle);

  const ownershipProfiles = parsedProfiles.filter(
    (profile) =>
      profile.platform === "CODEFORCES" || profile.platform === "LEETCODE",
  );
  if (
    currentUser.ownershipVerificationRequired &&
    ownershipProfiles.length > 0
  ) {
    const verifiedProfiles = await prisma.platformProfile.findMany({
      where: {
        userId,
        platform: { in: ownershipProfiles.map((profile) => profile.platform) },
        verified: true,
        verifiedAt: { not: null },
        ownershipKey: { not: null },
      },
      select: { platform: true, handle: true },
    });
    const verifiedByPlatform = new Map(
      verifiedProfiles.map((profile) => [
        profile.platform,
        profile.handle.trim().toLowerCase(),
      ]),
    );
    const unverified = ownershipProfiles.find(
      (profile) =>
        verifiedByPlatform.get(profile.platform) !== profile.handle.toLowerCase(),
    );
    if (unverified) {
      return NextResponse.json(
        {
          error: `Verify your ${unverified.platform === "CODEFORCES" ? "Codeforces" : "LeetCode"} handle before finishing setup`,
          code: "VERIFICATION_REQUIRED",
        },
        { status: 409 },
      );
    }
  }

  let onboardingClaim;
  try {
    const submittedPlatforms = new Set(
      parsedProfiles.map((profile) => profile.platform),
    );
    onboardingClaim = await prisma.$transaction(async (tx) => {
      for (const platform of Object.values(Platform)) {
        if (submittedPlatforms.has(platform)) continue;
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
        await tx.platformProfile.deleteMany({ where: { userId, platform } });
      }

      return tx.user.updateMany({
        where: { id: userId, onboardingComplete: false },
        data: {
          username,
          name: name || username,
          onboardingComplete: true,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }
    throw error;
  }
  if (onboardingClaim.count !== 1) {
    return NextResponse.json(
      { error: "Onboarding is already complete" },
      { status: 409 },
    );
  }

  const syncPromises = parsedProfiles
    .map((profile) => {
      const needsChallenge =
        currentUser.ownershipVerificationRequired &&
        (profile.platform === "CODEFORCES" ||
          profile.platform === "LEETCODE");
      if (needsChallenge) {
        return Promise.resolve({
          platform: profile.platform,
          success: true as const,
        });
      }
      return syncUserPlatform(userId, profile.platform, profile.handle, {
        allowProfileCreate: true,
        minIntervalMs: 0,
        requireOwnershipVerification:
          currentUser.ownershipVerificationRequired,
      })
        .then(() => ({ platform: profile.platform, success: true as const }))
        .catch((error: unknown) => ({
          platform: profile.platform,
          success: false as const,
          error: error instanceof Error ? error.message : "Sync failed",
        }));
    });

  const syncResults = await Promise.all(syncPromises);
  if (syncResults.some((result) => result?.success)) {
    revalidateTag(CACHE_TAGS.landingStats, { expire: 0 });
    revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });
    if (
      syncResults.some(
        (result) =>
          result?.success &&
          (result.platform === "CODEFORCES" || result.platform === "LEETCODE"),
      )
    ) {
      revalidateTag(CACHE_TAGS.topicRadar, { expire: 0 });
    }
    if (
      syncResults.some(
        (result) => result?.success && result.platform === "CODEFORCES",
      )
    ) {
      revalidateTag(CACHE_TAGS.cpRankings, { expire: 0 });
    }
  }

  return NextResponse.json({ success: true, syncResults });
}
