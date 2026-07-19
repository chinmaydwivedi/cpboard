import { unstable_cache } from "next/cache";

export type Contest = {
  id: string;
  title: string;
  url: string;
  platform: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
};

export type ContestFeedResult = {
  contests: Contest[];
  available: boolean;
};

type ContestRow = {
  id: string;
  title: string;
  url: string;
  platform: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
};

const MAX_CONTEST_TITLE_LENGTH = 180;
const MAX_CONTEST_URL_LENGTH = 1_000;
const MAX_CONTEST_DURATION_SECONDS = 31 * 24 * 60 * 60;

const SUPPORTED_PLATFORMS = new Set([
  "codeforces.com",
  "leetcode.com",
  "atcoder.jp",
  "codechef.com",
]);

function isOfficialContestUrl(value: string, platform: string) {
  if (value.length > MAX_CONTEST_URL_LENGTH) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (hostname === platform || hostname.endsWith(`.${platform}`))
    );
  } catch {
    return false;
  }
}

function isContestRow(value: unknown): value is ContestRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ContestRow>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    row.id.length <= 255 &&
    typeof row.title === "string" &&
    row.title.trim().length > 0 &&
    row.title.trim().length <= MAX_CONTEST_TITLE_LENGTH &&
    typeof row.url === "string" &&
    typeof row.platform === "string" &&
    SUPPORTED_PLATFORMS.has(row.platform) &&
    isOfficialContestUrl(row.url, row.platform) &&
    typeof row.start_time === "string" &&
    typeof row.end_time === "string" &&
    typeof row.duration_seconds === "number" &&
    Number.isFinite(row.duration_seconds) &&
    row.duration_seconds >= 0 &&
    row.duration_seconds <= MAX_CONTEST_DURATION_SECONDS
  );
}

const CONTESTS_API = "https://wbtxzfzazqbmqrwdehwm.supabase.co/rest/v1/contests";
const CONTESTS_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndidHh6ZnphenFibXFyd2RlaHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3OTE5MDgsImV4cCI6MjA4MTM2NzkwOH0.orAbLkg-K5IVoHwG-PKYwNroA_JpB4zV7iNjVqExXqQ";
const CONTEST_CACHE_SECONDS = 30 * 60;

async function requestContestSnapshot(): Promise<Contest[]> {
  const requestedAt = new Date();
  const queryStart = new Date(
    Math.floor(requestedAt.getTime() / 1_800_000) * 1_800_000,
  );
  const until = new Date(queryStart.getTime() + 60 * 24 * 60 * 60 * 1000);
  const query = new URLSearchParams({
    select: "id,title,url,platform,start_time,end_time,duration_seconds",
    start_time: `gte.${queryStart.toISOString()}`,
    and: `(start_time.lte.${until.toISOString()})`,
    order: "start_time.asc",
    limit: "300",
  });
  const response = await fetch(`${CONTESTS_API}?${query}`, {
    headers: { apikey: CONTESTS_API_KEY },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Contest provider returned an unsuccessful response");
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Contest provider returned an invalid payload");
  }

  const rows = payload.filter(isContestRow);
  if (rows.length !== payload.length) {
    throw new Error("Contest provider returned invalid contest data");
  }

  const contests = rows.map((contest) => {
    const startTime = new Date(contest.start_time).getTime();
    const endTime = new Date(contest.end_time).getTime();
    if (
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime <= startTime
    ) {
      throw new Error("Contest provider returned invalid schedule data");
    }
    return {
      id: contest.id,
      title: contest.title.trim(),
      url: contest.url,
      platform: contest.platform,
      startTime: contest.start_time,
      endTime: contest.end_time,
      durationSeconds: contest.duration_seconds,
    };
  });

  return contests.filter(
    (contest, index, all) =>
      all.findIndex((candidate) => candidate.id === contest.id) === index,
  );
}

const getCachedContestSnapshot = unstable_cache(
  requestContestSnapshot,
  ["upcoming-contest-feed-v2"],
  { revalidate: CONTEST_CACHE_SECONDS },
);

function onlyUpcomingContests(contests: Contest[]) {
  const now = Date.now();
  return contests.filter(
    (contest) => new Date(contest.startTime).getTime() >= now,
  );
}

export async function getUpcomingContestFeed({
  fresh = false,
}: { fresh?: boolean } = {}): Promise<ContestFeedResult> {
  try {
    const contests = fresh
      ? await requestContestSnapshot()
      : await getCachedContestSnapshot();
    return { contests: onlyUpcomingContests(contests), available: true };
  } catch {
    if (fresh) console.warn("Contest refresh is temporarily unavailable");
    return { contests: [], available: false };
  }
}

export async function getUpcomingContests(
  options: { fresh?: boolean } = {},
): Promise<Contest[]> {
  const feed = await getUpcomingContestFeed(options);
  if (!feed.available) {
    throw new Error("Contest schedule is temporarily unavailable");
  }
  return feed.contests;
}
