import type { PlatformData } from "@/types";
import { format } from "date-fns";

const BASE = "https://codeforces.com/api";

type CFSubmission = {
  id: number;
  creationTimeSeconds: number;
  problem: { contestId: number; index: string; name: string };
  verdict: string;
};

type CFUser = {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  contribution?: number;
  avatar?: string;
};

export async function fetchCodeforcesData(handle: string): Promise<PlatformData> {
  const [userRes, subsRes] = await Promise.all([
    fetch(`${BASE}/user.info?handles=${encodeURIComponent(handle)}`, { next: { revalidate: 3600 } }),
    fetch(`${BASE}/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`, {
      next: { revalidate: 3600 },
    }),
  ]);

  if (!userRes.ok) throw new Error(`Codeforces user.info failed: ${userRes.status}`);
  if (!subsRes.ok) throw new Error(`Codeforces user.status failed: ${subsRes.status}`);

  const userData = await userRes.json();
  const subsData = await subsRes.json();

  if (userData.status !== "OK" || !userData.result?.length) {
    throw new Error("Codeforces user not found");
  }

  const user: CFUser = userData.result[0];
  const submissions: CFSubmission[] = subsData.result || [];

  const solvedSet = new Set<string>();
  const dailyActivity: Record<string, number> = {};

  for (const sub of submissions) {
    const dateStr = format(new Date(sub.creationTimeSeconds * 1000), "yyyy-MM-dd");
    dailyActivity[dateStr] = (dailyActivity[dateStr] || 0) + 1;

    if (sub.verdict === "OK") {
      solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
    }
  }

  const ratingRes = await fetch(
    `${BASE}/user.rating?handle=${encodeURIComponent(handle)}`,
    { next: { revalidate: 3600 } }
  );
  let contestsCount = 0;
  if (ratingRes.ok) {
    const ratingData = await ratingRes.json();
    if (ratingData.status === "OK") {
      contestsCount = ratingData.result?.length || 0;
    }
  }

  return {
    handle: user.handle,
    rating: user.rating || 0,
    maxRating: user.maxRating || 0,
    problemsSolved: solvedSet.size,
    rank: user.rank || null,
    contestsCount,
    dailyActivity,
  };
}
