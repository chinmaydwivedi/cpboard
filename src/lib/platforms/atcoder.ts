import type { PlatformData } from "@/types";

const KENKOOOO_API = "https://kenkoooo.com/atcoder/atcoder-api";
const ATCODER_BASE = "https://atcoder.jp";

type AtCoderSubmission = {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  user_id: string;
  result: string;
  point: number;
};

type AtCoderHistoryEntry = {
  IsRated?: boolean;
  NewRating?: number;
};

type AtCoderProfileStats = {
  rating: number;
  maxRating: number;
  ratedMatches: number;
  rank: string | null;
};

function parseIntSafe(value: string | null | undefined): number {
  if (!value) return 0;
  const n = parseInt(value.replace(/,/g, "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function matchNumber(html: string, pattern: RegExp): number {
  return parseIntSafe(html.match(pattern)?.[1]);
}

function matchText(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern)?.[1];
  return m ? m.replace(/\s+/g, " ").trim() : null;
}

async function fetchAtCoderProfilePage(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`${ATCODER_BASE}/users/${encodeURIComponent(handle)}?lang=en`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseAtCoderProfileStats(html: string): AtCoderProfileStats {
  const rating = matchNumber(
    html,
    /<th[^>]*>\s*Rating\s*<\/th>\s*<td[^>]*>[\s\S]*?<span[^>]*>([0-9,]+)<\/span>/i
  );
  const maxRating = matchNumber(
    html,
    /<th[^>]*>\s*Highest Rating\s*<\/th>\s*<td[^>]*>[\s\S]*?<span[^>]*>([0-9,]+)<\/span>/i
  );
  const ratedMatches = matchNumber(
    html,
    /<th[^>]*>\s*Rated Matches[\s\S]*?<\/th>\s*<td[^>]*>([0-9,]+)<\/td>/i
  );
  const rank = matchText(
    html,
    /<th[^>]*>\s*Rank\s*<\/th>\s*<td[^>]*>([^<]+)<\/td>/i
  );

  return {
    rating,
    maxRating: Math.max(maxRating, rating),
    ratedMatches,
    rank,
  };
}

async function fetchAtCoderHistory(handle: string): Promise<AtCoderHistoryEntry[]> {
  try {
    const res = await fetch(`${ATCODER_BASE}/users/${encodeURIComponent(handle)}/history/json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/plain, */*",
      },
    });
    if (!res.ok) return [];
    const payload = await res.json();
    return Array.isArray(payload) ? (payload as AtCoderHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

async function fetchAllSubmissions(handle: string): Promise<AtCoderSubmission[]> {
  const all: AtCoderSubmission[] = [];
  let fromSecond = 0;
  const signal = AbortSignal.timeout(35_000);

  for (let i = 0; i < 30; i++) {
    let res: Response;
    try {
      res = await fetch(
        `${KENKOOOO_API}/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${fromSecond}`,
        {
          cache: "no-store",
          signal,
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json, text/plain, */*",
          },
        }
      );
    } catch {
      break;
    }

    if (!res.ok) break;

    let batch: AtCoderSubmission[];
    try {
      const parsed = await res.json();
      if (!Array.isArray(parsed)) break;
      batch = parsed as AtCoderSubmission[];
    } catch {
      break;
    }

    if (batch.length === 0) break;

    all.push(...batch);

    if (batch.length < 500) break;
    fromSecond = batch[batch.length - 1].epoch_second + 1;

    await new Promise((r) => setTimeout(r, 350));
  }

  return all;
}

export async function fetchAtcoderData(handle: string): Promise<PlatformData> {
  const [profileHtml, history, submissions] = await Promise.all([
    fetchAtCoderProfilePage(handle),
    fetchAtCoderHistory(handle),
    fetchAllSubmissions(handle),
  ]);

  if (!profileHtml) {
    throw new Error("AtCoder user not found");
  }
  const profileStats = parseAtCoderProfileStats(profileHtml);

  const ratedRatings = history
    .filter((h) => h?.IsRated && typeof h.NewRating === "number")
    .map((h) => Number(h.NewRating) || 0)
    .filter((r) => r >= 0);
  const ratingFromHistory =
    ratedRatings.length > 0 ? ratedRatings[ratedRatings.length - 1] : 0;
  const maxRatingFromHistory =
    ratedRatings.length > 0 ? Math.max(...ratedRatings) : 0;

  const firstAcceptedAt = new Map<string, number>();
  const dailyActivity: Record<string, number> = {};
  const contestSet = new Set<string>();

  for (const sub of submissions) {
    contestSet.add(sub.contest_id);

    if (sub.result === "AC") {
      const previous = firstAcceptedAt.get(sub.problem_id);
      if (previous === undefined || sub.epoch_second < previous) {
        firstAcceptedAt.set(sub.problem_id, sub.epoch_second);
      }
    }
  }

  for (const acceptedAt of firstAcceptedAt.values()) {
    const dateStr = new Date(acceptedAt * 1000).toISOString().slice(0, 10);
    dailyActivity[dateStr] = (dailyActivity[dateStr] || 0) + 1;
  }

  const rating = ratingFromHistory || profileStats.rating || 0;
  const maxRating = Math.max(maxRatingFromHistory, profileStats.maxRating, rating);
  const contestsCount =
    contestSet.size > 0 ? contestSet.size : Math.max(history.length, profileStats.ratedMatches);

  return {
    handle,
    rating,
    maxRating,
    problemsSolved: firstAcceptedAt.size,
    rank: profileStats.rank,
    contestsCount,
    dailyActivity,
  };
}
