import type { PlatformData } from "@/types";

const API_BASE = "https://cp-rating-api.vercel.app";

type CodeChefAPIResponse = {
  username?: string;
  rating?: string;
  stars?: number;
  country?: string;
  globalRank?: number | null;
  countryRank?: number | null;
  participation?: number | null;
  problemsSolved?: number | string | null;
  partialProblems?: number | string | null;
  contests?: unknown[];
};

function parseCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") {
    const n = parseInt(value.replace(/,/g, "").trim(), 10);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  return null;
}

function parseSolvedFromProfileHtml(html: string): number | null {
  const patterns = [
    /Total Problems Solved:\s*([0-9,]+)/i,
    /Fully Solved[^0-9]*([0-9,]+)/i,
    /"problemsSolved"\s*:\s*"?([0-9,]+)"?/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseInt(match[1].replace(/,/g, ""), 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return null;
}

async function fetchCodechefSolvedCountFromProfile(handle: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseSolvedFromProfileHtml(html);
  } catch {
    return null;
  }
}

export async function fetchCodechefData(handle: string): Promise<PlatformData> {
  const res = await fetch(`${API_BASE}/codechef/${encodeURIComponent(handle)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!res.ok) throw new Error(`CodeChef API failed: ${res.status}`);

  const data: CodeChefAPIResponse = await res.json();

  if (!data.username && !data.rating) {
    throw new Error("CodeChef user not found");
  }

  const rating = parseInt(data.rating || "0", 10) || 0;
  const stars = data.stars ? `${data.stars}★` : null;
  const rawData = data as unknown as Record<string, unknown>;
  const apiSolved = Math.max(
    parseCount(rawData.problemsSolved) ?? 0,
    parseCount(rawData.problems_solved) ?? 0,
    parseCount(rawData.fullySolved) ?? 0,
    parseCount(rawData.fully_solved) ?? 0
  );
  const profileSolved =
    apiSolved <= 0 ? await fetchCodechefSolvedCountFromProfile(handle) : null;
  const problemsSolved = Math.max(apiSolved, profileSolved ?? 0);

  return {
    handle,
    rating,
    maxRating: rating,
    problemsSolved,
    rank: stars || (data.globalRank ? `#${data.globalRank}` : null),
    contestsCount: data.participation || 0,
    dailyActivity: {},
  };
}
