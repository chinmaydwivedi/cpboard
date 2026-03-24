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
  contests?: unknown[];
};

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

  return {
    handle,
    rating,
    maxRating: rating,
    problemsSolved: 0,
    rank: stars || (data.globalRank ? `#${data.globalRank}` : null),
    contestsCount: data.participation || 0,
    dailyActivity: {},
  };
}
