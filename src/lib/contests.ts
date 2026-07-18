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
export async function getUpcomingContestFeed({
  fresh = false,
}: { fresh?: boolean } = {}): Promise<ContestFeedResult> {
  try {
    const requestedAt = new Date();
    const queryStart = fresh
      ? requestedAt
      : new Date(Math.floor(requestedAt.getTime() / 1_800_000) * 1_800_000);
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
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 1800 } }),
    });

    if (!response.ok) {
      if (fresh) {
        console.warn("Contest refresh failed", response.status);
      }
      return { contests: [], available: false };
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      if (fresh) console.warn("Contest refresh returned an invalid payload");
      return { contests: [], available: false };
    }
    const rows = payload.filter(isContestRow);
    if (payload.length > 0 && rows.length === 0) {
      if (fresh) console.warn("Contest refresh returned no valid rows");
      return { contests: [], available: false };
    }

    const contests = rows
      .filter(
        (contest) =>
          SUPPORTED_PLATFORMS.has(contest.platform) &&
          Number.isFinite(new Date(contest.start_time).getTime()) &&
          Number.isFinite(new Date(contest.end_time).getTime()) &&
          new Date(contest.end_time).getTime() >
            new Date(contest.start_time).getTime() &&
          new Date(contest.start_time).getTime() >= requestedAt.getTime(),
      )
      .map((contest) => ({
        id: contest.id,
        title: contest.title.trim(),
        url: contest.url,
        platform: contest.platform,
        startTime: contest.start_time,
        endTime: contest.end_time,
        durationSeconds: contest.duration_seconds,
      }))
      .filter(
        (contest, index, all) =>
          all.findIndex((candidate) => candidate.id === contest.id) === index,
      );
    return { contests, available: true };
  } catch (error) {
    if (fresh) console.error("Contest refresh failed", error);
    return { contests: [], available: false };
  }
}

export async function getUpcomingContests(
  options: { fresh?: boolean } = {},
): Promise<Contest[]> {
  return (await getUpcomingContestFeed(options)).contests;
}
