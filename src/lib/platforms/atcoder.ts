import type { PlatformData } from "@/types";
import { format } from "date-fns";

const KENKOOOO_API = "https://kenkoooo.com/atcoder/atcoder-api";

type AtCoderSubmission = {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  user_id: string;
  result: string;
  point: number;
};

async function fetchAllSubmissions(handle: string): Promise<AtCoderSubmission[]> {
  const all: AtCoderSubmission[] = [];
  let fromSecond = 0;

  for (let i = 0; i < 50; i++) {
    const res = await fetch(
      `${KENKOOOO_API}/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${fromSecond}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) break;

    const batch: AtCoderSubmission[] = await res.json();
    if (batch.length === 0) break;

    all.push(...batch);

    if (batch.length < 500) break;
    fromSecond = batch[batch.length - 1].epoch_second + 1;

    await new Promise((r) => setTimeout(r, 1100));
  }

  return all;
}

export async function fetchAtcoderData(handle: string): Promise<PlatformData> {
  const submissions = await fetchAllSubmissions(handle);

  if (submissions.length === 0) {
    throw new Error("AtCoder user not found or no submissions");
  }

  const solvedSet = new Set<string>();
  const dailyActivity: Record<string, number> = {};
  const contestSet = new Set<string>();

  for (const sub of submissions) {
    const dateStr = format(new Date(sub.epoch_second * 1000), "yyyy-MM-dd");
    dailyActivity[dateStr] = (dailyActivity[dateStr] || 0) + 1;
    contestSet.add(sub.contest_id);

    if (sub.result === "AC") {
      solvedSet.add(sub.problem_id);
    }
  }

  let rating = 0;
  try {
    const historyRes = await fetch(
      `${KENKOOOO_API}/v2/user_info?user=${encodeURIComponent(handle)}`,
      { next: { revalidate: 3600 } }
    );
    if (historyRes.ok) {
      const info = await historyRes.json();
      if (typeof info === "object" && info !== null) {
        // AtCoder problems API might not have direct rating — try scraping or use 0
        rating = 0;
      }
    }
  } catch {
    // rating fetch failed
  }

  return {
    handle,
    rating,
    maxRating: rating,
    problemsSolved: solvedSet.size,
    rank: null,
    contestsCount: contestSet.size,
    dailyActivity,
  };
}
