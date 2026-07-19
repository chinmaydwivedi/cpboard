import type { PlatformData } from "@/types";
import { fetchCodeforcesApi } from "@/lib/codeforces-api";
import { ProviderProfileNotFoundError } from "./errors";

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
  let users: CFUser[];
  try {
    users = await fetchCodeforcesApi<CFUser[]>("user.info", {
      handles: handle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.startsWith("handles: user with handle ") &&
      message.endsWith(" not found")
    ) {
      throw new ProviderProfileNotFoundError();
    }
    throw error;
  }
  if (!users.length) {
    throw new ProviderProfileNotFoundError();
  }

  const [submissions, ratingHistory] = await Promise.all([
    fetchCodeforcesApi<CFSubmission[]>("user.status", {
      handle,
      from: 1,
      count: 10_000,
    }),
    fetchCodeforcesApi<unknown[]>("user.rating", { handle }).catch(() => []),
  ]);

  const user = users[0];

  const firstAcceptedAt = new Map<string, number>();
  const dailyActivity: Record<string, number> = {};

  for (const sub of submissions) {
    if (sub.verdict === "OK") {
      const problemKey = `${sub.problem.contestId}-${sub.problem.index}`;
      const previous = firstAcceptedAt.get(problemKey);
      if (previous === undefined || sub.creationTimeSeconds < previous) {
        firstAcceptedAt.set(problemKey, sub.creationTimeSeconds);
      }
    }
  }

  for (const acceptedAt of firstAcceptedAt.values()) {
    const dateStr = new Date(acceptedAt * 1000).toISOString().slice(0, 10);
    dailyActivity[dateStr] = (dailyActivity[dateStr] || 0) + 1;
  }

  return {
    handle: user.handle,
    rating: user.rating || 0,
    maxRating: user.maxRating || 0,
    problemsSolved: firstAcceptedAt.size,
    rank: user.rank || null,
    contestsCount: ratingHistory.length,
    dailyActivity,
  };
}
