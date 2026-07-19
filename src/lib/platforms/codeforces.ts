import type { PlatformData } from "@/types";
import { fetchCodeforcesApi } from "@/lib/codeforces-api";
import { ProviderProfileNotFoundError } from "./errors";

type CFSubmission = {
  id: number;
  creationTimeSeconds: number;
  problem: { contestId?: number; index: string; name: string };
  verdict?: string | null;
};

type CFUser = {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  contribution?: number;
  avatar?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCodeforcesSubmission(value: unknown): value is CFSubmission {
  if (!isRecord(value) || !isRecord(value.problem)) return false;
  const latestReasonableTimestamp = Math.floor(
    (Date.now() + 24 * 60 * 60 * 1_000) / 1_000,
  );
  return (
    Number.isSafeInteger(value.id) &&
    Number(value.id) > 0 &&
    Number.isSafeInteger(value.creationTimeSeconds) &&
    Number(value.creationTimeSeconds) > 0 &&
    Number(value.creationTimeSeconds) <= latestReasonableTimestamp &&
    (value.verdict == null || typeof value.verdict === "string") &&
    (value.problem.contestId == null ||
      (Number.isSafeInteger(value.problem.contestId) &&
        Number(value.problem.contestId) > 0)) &&
    typeof value.problem.index === "string" &&
    value.problem.index.length > 0 &&
    typeof value.problem.name === "string" &&
    value.problem.name.length > 0
  );
}

function isCodeforcesUser(value: unknown): value is CFUser {
  if (!isRecord(value)) return false;
  return (
    typeof value.handle === "string" &&
    value.handle.trim().length > 0 &&
    (value.rating == null ||
      (typeof value.rating === "number" &&
        Number.isFinite(value.rating) &&
        value.rating >= 0)) &&
    (value.maxRating == null ||
      (typeof value.maxRating === "number" &&
        Number.isFinite(value.maxRating) &&
        value.maxRating >= 0)) &&
    (value.rank == null || typeof value.rank === "string")
  );
}

function rethrowMalformedRatingHistory(error: unknown): never | unknown[] {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    error instanceof SyntaxError ||
    message.includes("invalid data") ||
    message.includes("unexpected token")
  ) {
    throw error;
  }
  return [];
}

export async function fetchCodeforcesData(
  handle: string,
  deadlineAt?: number,
): Promise<PlatformData> {
  let users: CFUser[];
  try {
    users = await fetchCodeforcesApi<CFUser[]>(
      "user.info",
      { handles: handle },
      15_000,
      deadlineAt,
    );
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
  if (!Array.isArray(users)) {
    throw new Error("Codeforces user.info returned invalid data");
  }
  if (users.length === 0) {
    throw new ProviderProfileNotFoundError();
  }
  if (!isCodeforcesUser(users[0])) {
    throw new Error("Codeforces user.info returned invalid data");
  }
  if (users[0].handle.toLowerCase() !== handle.toLowerCase()) {
    throw new Error("Codeforces user.info returned invalid data");
  }

  const [submissions, ratingHistory] = await Promise.all([
    fetchCodeforcesApi<CFSubmission[]>(
      "user.status",
      { handle, from: 1, count: 10_000 },
      15_000,
      deadlineAt,
    ),
    fetchCodeforcesApi<unknown>(
      "user.rating",
      { handle },
      15_000,
      deadlineAt,
    )
      .then((history) => {
        if (!Array.isArray(history)) {
          throw new Error("Codeforces user.rating returned invalid data");
        }
        return history;
      })
      .catch(rethrowMalformedRatingHistory),
  ]);

  if (
    !Array.isArray(submissions) ||
    !submissions.every(isCodeforcesSubmission)
  ) {
    throw new Error("Codeforces user.status returned invalid data");
  }

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
