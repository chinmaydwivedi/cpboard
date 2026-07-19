import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { hasPotdAdminAccess } from "@/lib/admin";

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await hasPotdAdminAccess(email)) {
    return NextResponse.json(
      { error: "Admin accounts must be reassigned before deletion" },
      { status: 403 },
    );
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidateTag(CACHE_TAGS.landingStats, { expire: 0 });
  revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });
  revalidateTag(CACHE_TAGS.cpRankings, { expire: 0 });

  return NextResponse.json({ success: true });
}
