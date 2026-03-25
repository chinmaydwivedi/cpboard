import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncUserPlatform } from "@/lib/platforms";
import { extractHandle } from "@/lib/parse-handle";
import { Platform } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { platform, handle: rawHandle } = body as { platform: Platform; handle: string };
  const handle = rawHandle ? extractHandle(platform, rawHandle) : "";

  if (!platform || !handle) {
    return NextResponse.json(
      { error: "Platform and handle are required" },
      { status: 400 }
    );
  }

  if (!Object.values(Platform).includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const lastSync = await prisma.syncLog.findFirst({
    where: {
      userId: user.id,
      platform,
      status: "SUCCESS",
    },
    orderBy: { syncedAt: "desc" },
  });

  if (lastSync) {
    const minutesSinceSync =
      (Date.now() - lastSync.syncedAt.getTime()) / 1000 / 60;
    if (minutesSinceSync < 30) {
      return NextResponse.json(
        {
          error: `Please wait ${Math.ceil(30 - minutesSinceSync)} minutes before syncing again`,
        },
        { status: 429 }
      );
    }
  }

  try {
    const data = await syncUserPlatform(user.id, platform, handle.trim());
    return NextResponse.json({
      success: true,
      data: {
        rating: data.rating,
        maxRating: data.maxRating,
        problemsSolved: data.problemsSolved,
        rank: data.rank,
      },
    });
  } catch (error) {
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
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { platform } = body as { platform: Platform };

  if (!platform) {
    return NextResponse.json({ error: "Platform is required" }, { status: 400 });
  }

  if (!Object.values(Platform).includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [, , profileDelete] = await prisma.$transaction([
    prisma.dailyActivity.deleteMany({
      where: { userId: user.id, platform },
    }),
    prisma.syncLog.deleteMany({
      where: { userId: user.id, platform },
    }),
    prisma.platformProfile.deleteMany({
      where: { userId: user.id, platform },
    }),
  ]);

  if (profileDelete.count === 0) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
