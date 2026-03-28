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

async function fetchCodechefSolvedCountFromProfile(handle: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, {
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/Total Problems Solved:\s*([0-9,]+)/i);
    if (!match?.[1]) return null;
    const parsed = parseInt(match[1].replace(/,/g, ""), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
  } catch {
    return null;
  }
}

export async function fetchCodechefData(handle: string): Promise<PlatformData> {
  const res = await fetch(`${API_BASE}/codechef/${encodeURIComponent(handle)}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`CodeChef API failed: ${res.status}`);

  const data: CodeChefAPIResponse = await res.json();

  if (!data.username && !data.rating) {
    throw new Error("CodeChef user not found");
  }

  const rating = parseInt(data.rating || "0", 10) || 0;
  const stars = data.stars ? `${data.stars}★` : null;
  const apiSolved = parseCount(data.problemsSolved);
  const profileSolved = apiSolved == null ? await fetchCodechefSolvedCountFromProfile(handle) : null;
  const problemsSolved = apiSolved ?? profileSolved ?? 0;

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
