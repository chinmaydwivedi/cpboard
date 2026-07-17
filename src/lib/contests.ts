export type Contest = {
  id: string;
  title: string;
  url: string;
  platform: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
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

const CONTESTS_API = "https://wbtxzfzazqbmqrwdehwm.supabase.co/rest/v1/contests";
const CONTESTS_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndidHh6ZnphenFibXFyd2RlaHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3OTE5MDgsImV4cCI6MjA4MTM2NzkwOH0.orAbLkg-K5IVoHwG-PKYwNroA_JpB4zV7iNjVqExXqQ";
const SUPPORTED_PLATFORMS = new Set([
  "codeforces.com",
  "leetcode.com",
  "atcoder.jp",
  "codechef.com",
]);

export async function getUpcomingContests(): Promise<Contest[]> {
  try {
    const now = new Date();
    const until = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({
      select: "id,title,url,platform,start_time,end_time,duration_seconds",
      start_time: `gte.${now.toISOString()}`,
      and: `(start_time.lte.${until.toISOString()})`,
      order: "start_time.asc",
      limit: "300",
    });
    const response = await fetch(`${CONTESTS_API}?${query}`, {
      headers: { apikey: CONTESTS_API_KEY },
      next: { revalidate: 1800 },
    });

    if (!response.ok) return [];
    const rows = (await response.json()) as ContestRow[];

    return rows
      .filter((contest) => SUPPORTED_PLATFORMS.has(contest.platform))
      .map((contest) => ({
        id: contest.id,
        title: contest.title,
        url: contest.url,
        platform: contest.platform,
        startTime: contest.start_time,
        endTime: contest.end_time,
        durationSeconds: contest.duration_seconds,
      }));
  } catch {
    return [];
  }
}
