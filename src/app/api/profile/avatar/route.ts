import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

const MAX_SIZE = 200 * 1024; // 200KB max for base64 data URL

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { avatar } = await req.json();
  if (!avatar || typeof avatar !== "string") {
    return NextResponse.json({ error: "No avatar data" }, { status: 400 });
  }

  if (!avatar.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
  }

  if (avatar.length > MAX_SIZE) {
    return NextResponse.json({ error: "Image too large. Max 200KB." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: avatar },
  });
  revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });

  return NextResponse.json({ success: true, avatarUrl: avatar });
}

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });
  revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });

  return NextResponse.json({ success: true });
}
