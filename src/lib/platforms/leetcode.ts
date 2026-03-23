import type { PlatformData } from "@/types";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const USER_PROFILE_QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      ranking
      realName
    }
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
  userContestRanking(username: $username) {
    rating
    globalRanking
    attendedContestsCount
  }
}`;

const CALENDAR_QUERY = `
query getUserCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) {
      submissionCalendar
    }
  }
}`;

export async function fetchLeetcodeData(handle: string): Promise<PlatformData> {
  const profileRes = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: USER_PROFILE_QUERY,
      variables: { username: handle },
    }),
    next: { revalidate: 3600 },
  });

  if (!profileRes.ok) throw new Error(`LeetCode profile fetch failed: ${profileRes.status}`);

  const profileData = await profileRes.json();
  const user = profileData.data?.matchedUser;

  if (!user) throw new Error("LeetCode user not found");

  const acStats = user.submitStatsGlobal?.acSubmissionNum || [];
  const totalSolved = acStats.find(
    (s: { difficulty: string; count: number }) => s.difficulty === "All"
  )?.count || 0;

  const contestInfo = profileData.data?.userContestRanking;
  const rating = Math.round(contestInfo?.rating || 0);
  const contestsCount = contestInfo?.attendedContestsCount || 0;

  const calendarRes = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: CALENDAR_QUERY,
      variables: { username: handle },
    }),
    next: { revalidate: 3600 },
  });

  const dailyActivity: Record<string, number> = {};

  if (calendarRes.ok) {
    const calData = await calendarRes.json();
    const calendarJson =
      calData.data?.matchedUser?.userCalendar?.submissionCalendar;

    if (calendarJson) {
      try {
        const parsed = JSON.parse(calendarJson) as Record<string, number>;
        for (const [timestamp, count] of Object.entries(parsed)) {
          const date = new Date(parseInt(timestamp) * 1000);
          const dateStr = date.toISOString().split("T")[0];
          dailyActivity[dateStr] = count;
        }
      } catch {
        // calendar parse error, ignore
      }
    }
  }

  return {
    handle,
    rating,
    maxRating: rating,
    problemsSolved: totalSolved,
    rank: contestInfo?.globalRanking?.toString() || null,
    contestsCount,
    dailyActivity,
  };
}
