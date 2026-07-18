import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const currentUsername = session?.username;
  if (!userId || !currentUsername) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { username, name } = body as { username?: string; name?: string };

  const updates: Record<string, string> = {};

  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      return NextResponse.json({ error: "Name must be 1-50 characters" }, { status: 400 });
    }
    updates.name = trimmed;
  }

  if (username !== undefined) {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (clean.length < 3 || clean.length > 30) {
      return NextResponse.json({ error: "Username must be 3-30 characters (letters, numbers, _ , -)" }, { status: 400 });
    }
    if (clean !== currentUsername) {
      const existing = await prisma.user.findUnique({
        where: { username: clean },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
      updates.username = clean;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No changes" });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: { username: true, name: true },
  });
  revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });

  return NextResponse.json(updated);
}
