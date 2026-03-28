import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncUserPlatform } from "@/lib/platforms";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      username: true,
      university: {
        select: { shortName: true },
      },
      platformProfiles: {
        where: { verified: true },
        orderBy: { platform: "asc" },
        select: { platform: true, handle: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.platformProfiles.length === 0) {
    return NextResponse.json({ error: "No linked platforms to sync" }, { status: 400 });
  }

  const results: { platform: string; success: boolean; error?: string }[] = [];

  for (const profile of user.platformProfiles) {
    try {
      await syncUserPlatform(user.id, profile.platform, profile.handle);
      results.push({ platform: profile.platform, success: true });
    } catch (error) {
      results.push({
        platform: profile.platform,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;
  const codeforcesSynced = results.some((r) => r.success && r.platform === "CODEFORCES");

  if (successful > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/leaderboard");
    revalidatePath(`/leaderboard/${user.university.shortName}`);
    revalidatePath(`/u/${user.username}`);
    if (codeforcesSynced) {
      revalidatePath("/cp-rankings");
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
