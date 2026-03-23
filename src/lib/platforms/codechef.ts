import type { PlatformData } from "@/types";

const API_BASE = "https://cp-rating-api.vercel.app";

type CodeChefResponse = {
  success: boolean;
  profile?: string;
  currentRating?: number;
  highestRating?: number;
  globalRank?: number;
  countryRank?: number;
  stars?: string;
  problemsSolved?: number;
  contestsParticipated?: number;
};

export async function fetchCodechefData(handle: string): Promise<PlatformData> {
  const res = await fetch(`${API_BASE}/codechef/${encodeURIComponent(handle)}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`CodeChef API failed: ${res.status}`);

  const data: CodeChefResponse = await res.json();

  if (!data.success && !data.currentRating) {
    throw new Error("CodeChef user not found");
  }

  return {
    handle,
    rating: data.currentRating || 0,
    maxRating: data.highestRating || data.currentRating || 0,
    problemsSolved: data.problemsSolved || 0,
    rank: data.stars || (data.globalRank ? `#${data.globalRank}` : null),
    contestsCount: data.contestsParticipated || 0,
    dailyActivity: {},
  };
}
