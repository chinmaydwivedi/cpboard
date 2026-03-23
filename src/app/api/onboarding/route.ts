import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractHandle } from "@/lib/parse-handle";
import { syncUserPlatform } from "@/lib/platforms";
import { Platform } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { username, name, profiles } = body as {
    username: string;
    name: string;
    profiles: { platform: Platform; url: string }[];
  };

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
  });

  if (existingUsername && existingUsername.id !== user.id) {
    return NextResponse.json(
      { error: "Username is already taken" },
      { status: 409 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      name: name || username,
      onboardingComplete: true,
    },
  });

  const syncResults: { platform: Platform; success: boolean; error?: string }[] = [];

  for (const profile of profiles) {
    if (!profile.url?.trim()) continue;

    const handle = extractHandle(profile.platform, profile.url);
    if (!handle) continue;

    try {
      await syncUserPlatform(user.id, profile.platform, handle);
      syncResults.push({ platform: profile.platform, success: true });
    } catch (error) {
      syncResults.push({
        platform: profile.platform,
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }

  return NextResponse.json({ success: true, syncResults });
}
