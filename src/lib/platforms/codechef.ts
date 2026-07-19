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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOptionalCount(value: unknown) {
  return value == null || parseCount(value) !== null;
}

function parseCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!/^\d+$/.test(normalized)) return null;
    const n = Number(normalized);
    return Number.isSafeInteger(n) ? n : null;
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

  const payload: unknown = await res.json();
  if (!isRecord(payload)) {
    throw new Error("CodeChef API returned invalid data");
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    throw new Error("CodeChef API failed");
  }
  if (
    typeof payload.username !== "string" ||
    payload.username.trim().length === 0 ||
    payload.username.toLowerCase() !== handle.toLowerCase() ||
    (payload.rating != null &&
      (typeof payload.rating !== "string" ||
        !/^[0-9,\s]*$/.test(payload.rating))) ||
    (payload.stars != null &&
      (!Number.isSafeInteger(payload.stars) ||
        Number(payload.stars) < 0 ||
        Number(payload.stars) > 7)) ||
    (payload.globalRank != null &&
      (!Number.isSafeInteger(payload.globalRank) ||
        Number(payload.globalRank) < 1)) ||
    (payload.participation != null &&
      (!Number.isSafeInteger(payload.participation) ||
        Number(payload.participation) < 0)) ||
    !isOptionalCount(payload.problemsSolved) ||
    !isOptionalCount(payload.problems_solved) ||
    !isOptionalCount(payload.fullySolved) ||
    !isOptionalCount(payload.fully_solved)
  ) {
    throw new Error("CodeChef API returned invalid data");
  }
  const data = payload as CodeChefAPIResponse & { username: string };

  const rating = parseInt((data.rating || "0").replace(/,/g, ""), 10) || 0;
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
