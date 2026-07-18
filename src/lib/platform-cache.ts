import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export function invalidatePlatformViews({
  username,
  universityShortName,
  codeforces,
  topicRadar,
}: {
  username: string;
  universityShortName: string;
  codeforces: boolean;
  topicRadar: boolean;
}) {
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath(`/leaderboard/${universityShortName}`);
  revalidatePath(`/u/${username}`);
  revalidateTag(CACHE_TAGS.landingStats, { expire: 0 });
  revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });
  if (topicRadar) {
    revalidateTag(CACHE_TAGS.topicRadar, { expire: 0 });
  }
  if (codeforces) {
    revalidatePath("/cp-rankings");
    revalidateTag(CACHE_TAGS.cpRankings, { expire: 0 });
  }
}
