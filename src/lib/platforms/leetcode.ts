import type { PlatformData } from "@/types";
import { ProviderProfileNotFoundError } from "./errors";

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

const RECENT_ACCEPTED_QUERY = `
query getRecentAccepted($username: String!, $limit: Int) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    titleSlug
    timestamp
  }
}`;

type RecentAcceptedSubmission = {
  titleSlug?: string;
  timestamp?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const MISSING_USER_MESSAGES = new Set([
  "that user does not exist.",
  "user matching query does not exist.",
]);

function isMissingUserGraphQLError(value: unknown) {
  if (!isRecord(value) || typeof value.message !== "string") return false;
  if (!MISSING_USER_MESSAGES.has(value.message.trim().toLowerCase())) {
    return false;
  }

  return (
    Array.isArray(value.path) &&
    (value.path[0] === "matchedUser" ||
      value.path[0] === "userContestRanking")
  );
}

export async function fetchLeetcodeData(handle: string): Promise<PlatformData> {
  const signal = AbortSignal.timeout(15_000);
  const [profileRes, calendarRes, recentAcceptedRes] = await Promise.all([
    fetch(LEETCODE_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: USER_PROFILE_QUERY,
        variables: { username: handle },
      }),
      cache: "no-store",
      signal,
    }),
    fetch(LEETCODE_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: CALENDAR_QUERY,
        variables: { username: handle },
      }),
      cache: "no-store",
      signal,
    }),
    fetch(LEETCODE_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: RECENT_ACCEPTED_QUERY,
        variables: { username: handle, limit: 100 },
      }),
      cache: "no-store",
      signal,
    }).catch(() => null),
  ]);

  if (!profileRes.ok) throw new Error(`LeetCode profile fetch failed: ${profileRes.status}`);

  const profilePayload: unknown = await profileRes.json();
  if (!isRecord(profilePayload)) {
    throw new Error("LeetCode profile returned invalid data");
  }
  if (profilePayload.errors != null && !Array.isArray(profilePayload.errors)) {
    throw new Error("LeetCode profile returned invalid data");
  }
  const graphQLErrors = profilePayload.errors ?? [];
  const profileData = profilePayload.data;
  if (
    !isRecord(profileData) ||
    !("matchedUser" in profileData) ||
    !("userContestRanking" in profileData)
  ) {
    throw new Error("LeetCode profile returned invalid data");
  }

  const user = profileData.matchedUser;
  if (user === null) {
    if (
      graphQLErrors.length === 0 ||
      graphQLErrors.every(isMissingUserGraphQLError)
    ) {
      throw new ProviderProfileNotFoundError();
    }
    throw new Error("LeetCode profile API failed");
  }
  if (graphQLErrors.length > 0) {
    throw new Error("LeetCode profile API failed");
  }
  if (
    !isRecord(user) ||
    typeof user.username !== "string" ||
    user.username.toLowerCase() !== handle.toLowerCase()
  ) {
    throw new Error("LeetCode profile returned invalid data");
  }

  const submitStats = user.submitStatsGlobal;
  if (!isRecord(submitStats) || !Array.isArray(submitStats.acSubmissionNum)) {
    throw new Error("LeetCode profile returned invalid data");
  }
  const totalStat = submitStats.acSubmissionNum.find(
    (stat) => isRecord(stat) && stat.difficulty === "All",
  );
  if (
    !isRecord(totalStat) ||
    !Number.isSafeInteger(totalStat.count) ||
    Number(totalStat.count) < 0
  ) {
    throw new Error("LeetCode profile returned invalid data");
  }
  const totalSolved = Number(totalStat.count);

  const contestInfo = profileData.userContestRanking;
  if (contestInfo !== null && !isRecord(contestInfo)) {
    throw new Error("LeetCode profile returned invalid data");
  }
  const rawRating = contestInfo?.rating;
  const rawContestsCount = contestInfo?.attendedContestsCount;
  if (
    (rawRating != null &&
      (typeof rawRating !== "number" || !Number.isFinite(rawRating))) ||
    (rawContestsCount != null &&
      (!Number.isSafeInteger(rawContestsCount) ||
        Number(rawContestsCount) < 0))
  ) {
    throw new Error("LeetCode profile returned invalid data");
  }
  const rating = Math.round(Number(rawRating ?? 0));
  const contestsCount = Number(rawContestsCount ?? 0);

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

  // LeetCode's calendar counts every attempt. Replace the current rolling
  // week with recent accepted problems so wrong answers and repeated attempts
  // do not inflate the weekly standout. The public API caps this list, making
  // the result a conservative count for unusually active users.
  const recentCutoff = new Date();
  recentCutoff.setUTCHours(0, 0, 0, 0);
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - 7);
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(recentCutoff);
    date.setUTCDate(date.getUTCDate() + offset);
    dailyActivity[date.toISOString().slice(0, 10)] = 0;
  }

  if (recentAcceptedRes?.ok) {
    const recentPayload = await recentAcceptedRes.json().catch(() => null);
    const recent = recentPayload?.data?.recentAcSubmissionList;
    if (Array.isArray(recent)) {
      const seenProblems = new Set<string>();
      for (const submission of recent as RecentAcceptedSubmission[]) {
        const slug = submission.titleSlug?.trim().toLowerCase();
        const timestamp = Number(submission.timestamp);
        if (!slug || seenProblems.has(slug) || !Number.isFinite(timestamp)) {
          continue;
        }
        const acceptedAt = new Date(timestamp * 1000);
        if (acceptedAt < recentCutoff) continue;
        seenProblems.add(slug);
        const dateStr = acceptedAt.toISOString().slice(0, 10);
        dailyActivity[dateStr] = (dailyActivity[dateStr] || 0) + 1;
      }
    }
  }

  return {
    handle,
    rating,
    maxRating: rating,
    problemsSolved: totalSolved,
    rank:
      typeof contestInfo?.globalRanking === "number" &&
      Number.isFinite(contestInfo.globalRanking)
        ? contestInfo.globalRanking.toString()
        : null,
    contestsCount,
    dailyActivity,
  };
}
