import type { PlatformData } from "@/types";
import { acquireProviderRequestSlot } from "@/lib/provider-request-queue";
import { ProviderProfileNotFoundError } from "./errors";

const KENKOOOO_API = "https://kenkoooo.com/atcoder/atcoder-api";
const ATCODER_BASE = "https://atcoder.jp";
const SUBMISSION_REQUEST_SPACING_MS = 1_100;
const PROVIDER_DEADLINE_MS = 40_000;
const MAX_SUBMISSION_PAGES = 40;
const ACTIVITY_RETENTION_DAYS = 370;

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

type AtCoderAcceptedCount = {
  count?: number;
};

type VerifiedAtCoderProfile = {
  canonicalHandle: string;
  html: string;
  exists: true;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAtCoderHistoryEntry(value: unknown): value is AtCoderHistoryEntry {
  return (
    isRecord(value) &&
    typeof value.IsRated === "boolean" &&
    typeof value.NewRating === "number" &&
    Number.isFinite(value.NewRating) &&
    value.NewRating >= 0
  );
}

function isAtCoderSubmission(
  value: unknown,
  handle: string,
): value is AtCoderSubmission {
  const latestReasonableTimestamp = Math.floor(
    (Date.now() + 24 * 60 * 60 * 1_000) / 1_000,
  );
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.id) &&
    Number(value.id) > 0 &&
    Number.isSafeInteger(value.epoch_second) &&
    Number(value.epoch_second) > 0 &&
    Number(value.epoch_second) <= latestReasonableTimestamp &&
    typeof value.problem_id === "string" &&
    value.problem_id.length > 0 &&
    typeof value.contest_id === "string" &&
    value.contest_id.length > 0 &&
    typeof value.user_id === "string" &&
    value.user_id.toLowerCase() === handle.toLowerCase() &&
    typeof value.result === "string"
  );
}

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

async function fetchAtCoderProfilePage(
  handle: string,
): Promise<VerifiedAtCoderProfile> {
  let response: Response;
  try {
    response = await fetch(
      `${ATCODER_BASE}/users/${encodeURIComponent(handle)}?lang=en`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "text/html,application/xhtml+xml",
        },
      },
    );
  } catch {
    throw new Error("AtCoder profile is temporarily unavailable");
  }

  if (response.status === 404) {
    throw new ProviderProfileNotFoundError();
  }
  if (!response.ok) {
    throw new Error("AtCoder profile is temporarily unavailable");
  }

  let html: string;
  try {
    html = await response.text();
  } catch {
    throw new Error("AtCoder profile is temporarily unavailable");
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let returnedHandle: string | null = null;
  try {
    const finalUrl = new URL(response.url);
    const pathSegments = finalUrl.pathname.split("/").filter(Boolean);
    if (
      finalUrl.hostname === "atcoder.jp" &&
      pathSegments.length === 2 &&
      pathSegments[0] === "users"
    ) {
      returnedHandle = decodeURIComponent(pathSegments[1]);
    }
  } catch {
    returnedHandle = null;
  }
  const titleHandle = html.match(
    /<title>\s*([^<]+?)\s+-\s+AtCoder\s*<\/title>/i,
  )?.[1];
  if (
    !contentType.includes("text/html") ||
    returnedHandle?.toLowerCase() !== handle.toLowerCase() ||
    titleHandle?.trim().toLowerCase() !== handle.toLowerCase()
  ) {
    throw new Error("AtCoder profile returned invalid data");
  }

  return {
    canonicalHandle: titleHandle.trim(),
    html,
    exists: true,
  };
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
  let res: Response;
  try {
    res = await fetch(`${ATCODER_BASE}/users/${encodeURIComponent(handle)}/history/json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/plain, */*",
      },
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new Error("AtCoder history returned invalid data");
  }
  if (!Array.isArray(payload) || !payload.every(isAtCoderHistoryEntry)) {
    throw new Error("AtCoder history returned invalid data");
  }
  return payload;
}

async function fetchAcceptedCount(
  handle: string,
  startedAt: number,
  profile: VerifiedAtCoderProfile,
) {
  const remainingMs = PROVIDER_DEADLINE_MS - (Date.now() - startedAt);
  if (remainingMs < 1_000) {
    throw new Error("AtCoder data fetch timed out");
  }
  await acquireProviderRequestSlot({
    key: "ATCODER_PROBLEMS_API",
    spacingMs: SUBMISSION_REQUEST_SPACING_MS,
    maxQueueWaitMs: Math.min(remainingMs, 20_000),
  });

  const fetchRemainingMs = PROVIDER_DEADLINE_MS - (Date.now() - startedAt);
  if (fetchRemainingMs < 500) {
    throw new Error("AtCoder data fetch timed out");
  }
  const response = await fetch(
    `${KENKOOOO_API}/v3/user/ac_rank?user=${encodeURIComponent(handle)}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(12_000, fetchRemainingMs)),
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/plain, */*",
      },
    },
  ).catch(() => null);
  if (response?.status === 404 && profile.exists) {
    // Kenkoooo has no ac_rank row for a valid account with zero accepted
    // problems. The official AtCoder page above is the source of truth for
    // account existence, so this provider-specific 404 means a count of zero.
    return 0;
  }
  if (!response?.ok) {
    throw new Error("AtCoder accepted count is temporarily unavailable");
  }
  const payload = (await response.json().catch(() => null)) as AtCoderAcceptedCount | null;
  if (!payload || !Number.isSafeInteger(payload.count) || (payload.count ?? -1) < 0) {
    throw new Error("AtCoder accepted count returned invalid data");
  }
  return payload.count as number;
}

async function fetchRecentSubmissions(
  handle: string,
  startedAt: number,
): Promise<AtCoderSubmission[]> {
  const all: AtCoderSubmission[] = [];
  let fromSecond = Math.floor(
    (Date.now() - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1_000) / 1_000,
  );

  for (let i = 0; i < MAX_SUBMISSION_PAGES; i++) {
    const elapsed = Date.now() - startedAt;
    const remainingMs = PROVIDER_DEADLINE_MS - elapsed;
    if (remainingMs < 1_000) {
      throw new Error("AtCoder submission history timed out");
    }
    await acquireProviderRequestSlot({
      key: "ATCODER_PROBLEMS_API",
      spacingMs: SUBMISSION_REQUEST_SPACING_MS,
      maxQueueWaitMs: Math.min(remainingMs, 45_000),
    });
    const fetchRemainingMs = PROVIDER_DEADLINE_MS - (Date.now() - startedAt);
    if (fetchRemainingMs < 500) {
      throw new Error("AtCoder submission history timed out");
    }

    let res: Response;
    try {
      res = await fetch(
        `${KENKOOOO_API}/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${fromSecond}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(Math.min(12_000, fetchRemainingMs)),
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json, text/plain, */*",
          },
        }
      );
    } catch {
      throw new Error("AtCoder submissions are temporarily unavailable");
    }

    if (!res.ok) {
      throw new Error(`AtCoder submissions failed (${res.status})`);
    }

    let batch: AtCoderSubmission[];
    try {
      const parsed = await res.json();
      if (
        !Array.isArray(parsed) ||
        !parsed.every((submission) =>
          isAtCoderSubmission(submission, handle),
        )
      ) {
        throw new Error("AtCoder submissions returned invalid data");
      }
      batch = parsed as AtCoderSubmission[];
    } catch (error) {
      if (error instanceof Error && error.message === "AtCoder submissions returned invalid data") {
        throw error;
      }
      throw new Error("AtCoder submissions returned invalid data");
    }

    if (batch.length === 0) break;

    all.push(...batch);

    if (batch.length < 500) break;
    if (i === MAX_SUBMISSION_PAGES - 1) {
      throw new Error("AtCoder submission history exceeds the safe sync window");
    }
    fromSecond = batch[batch.length - 1].epoch_second + 1;
  }

  return all;
}

export async function fetchAtcoderData(handle: string): Promise<PlatformData> {
  const startedAt = Date.now();
  // Check the official profile first. Third-party APIs legitimately return
  // 404 for users who exist but have not solved a problem yet.
  const profile = await fetchAtCoderProfilePage(handle);
  const canonicalHandle = profile.canonicalHandle;
  const [history, acceptedCount, submissions] = await Promise.all([
    fetchAtCoderHistory(canonicalHandle),
    fetchAcceptedCount(canonicalHandle, startedAt, profile),
    fetchRecentSubmissions(canonicalHandle, startedAt),
  ]);
  const profileStats = parseAtCoderProfileStats(profile.html);

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
  const contestsCount = Math.max(
    contestSet.size,
    history.length,
    profileStats.ratedMatches,
  );

  return {
    handle: canonicalHandle,
    rating,
    maxRating,
    problemsSolved: acceptedCount,
    rank: profileStats.rank,
    contestsCount,
    dailyActivity,
  };
}
