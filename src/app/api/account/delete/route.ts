import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidateTag(CACHE_TAGS.landingStats, { expire: 0 });
  revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });
  revalidateTag(CACHE_TAGS.cpRankings, { expire: 0 });

  return NextResponse.json({ success: true });
}
