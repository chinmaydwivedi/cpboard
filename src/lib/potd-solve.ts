import type { ProblemPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computePotdStreak, dateToDateKey, getIstDateKey } from "@/lib/potd";
import { fetchCodeforcesApi } from "@/lib/codeforces-api";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const RECENT_AC_SUBMISSIONS_QUERY = `
query recentAcSubmissions($username: String!) {
  recentAcSubmissionList(username: $username) {
    id
    titleSlug
    timestamp
  }
}`;

type CodeforcesSubmission = {
  creationTimeSeconds?: number;
  verdict?: string;
  problem?: {
    contestId?: number;
    index?: string;
  };
};

type LeetcodeAcceptedSubmission = {
  titleSlug?: string;
  timestamp?: string | number;
};

type CodeforcesProblemRef = {
  contestId: number;
  index: string;
};

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
});

function extractLeetcodeSlugFromUrl(problemUrl: string): string | null {
  try {
    const url = new URL(problemUrl);
    if (
      url.protocol !== "https:" ||
      !["leetcode.com", "www.leetcode.com"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    ) {
      return null;
    }
    const match = url.pathname.match(/\/problems\/([^/]+)/i);
    if (!match) return null;
    const slug = decodeURIComponent(match[1]).trim().toLowerCase();
    return /^[a-z0-9-]{1,100}$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

function extractCodeforcesProblemRef(problemUrl: string): CodeforcesProblemRef | null {
  try {
    const url = new URL(problemUrl);
    if (
      url.protocol !== "https:" ||
      !["codeforces.com", "www.codeforces.com"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const patterns = [
      /\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i,
      /\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i,
      /\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.pathname.match(pattern);
      if (!match) continue;

      const contestId = Number(match[1]);
      const index = match[2].trim().toUpperCase();

      if (
        !Number.isSafeInteger(contestId) ||
        contestId <= 0 ||
        !/^[A-Z0-9]{1,10}$/.test(index)
      ) {
        continue;
      }
      return { contestId, index };
    }

    return null;
  } catch {
    return null;
  }
}

async function hasAcceptedLeetcodeSubmission(
  handle: string,
  titleSlug: string,
  verifyDateKey: string
): Promise<boolean> {
  const response = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "CPBoard/1.0",
    },
    body: JSON.stringify({
      query: RECENT_AC_SUBMISSIONS_QUERY,
      variables: { username: handle },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) return false;

  const payload = await response.json();
  const list = payload?.data?.recentAcSubmissionList;
  if (!Array.isArray(list)) return false;

  return (list as LeetcodeAcceptedSubmission[]).some((item) => {
    const slug = item?.titleSlug?.toLowerCase?.();
    const timestampValue = Number(item?.timestamp ?? NaN);
    if (!Number.isFinite(timestampValue) || timestampValue <= 0) return false;
    const submittedDateKey = IST_DATE_FORMATTER.format(
      new Date(timestampValue * 1000)
    );
    return slug === titleSlug && submittedDateKey === verifyDateKey;
  });
}

async function hasAcceptedCodeforcesSubmission(
  handle: string,
  target: CodeforcesProblemRef,
  verifyDateKey: string
): Promise<boolean> {
  const submissions = await fetchCodeforcesApi<CodeforcesSubmission[]>(
    "user.status",
    { handle, from: 1, count: 1_000 },
  );

  return submissions.some((submission) => {
    if (submission.verdict !== "OK") return false;
    const contestId = submission.problem?.contestId;
    const index = submission.problem?.index?.toUpperCase();
    const submittedAt = submission.creationTimeSeconds;
    if (!submittedAt || !Number.isFinite(submittedAt)) return false;
    const submittedDateKey = IST_DATE_FORMATTER.format(
      new Date(submittedAt * 1000)
    );
    return (
      contestId === target.contestId &&
      index === target.index &&
      submittedDateKey === verifyDateKey
    );
  });
}

export async function verifyPotdSolvedFromExternal(args: {
  platform: ProblemPlatform;
  problemUrl: string;
  leetcodeHandle: string | null;
  codeforcesHandle: string | null;
  verifyDateKey?: string;
}): Promise<
  | { verified: true; source: "LEETCODE" | "CODEFORCES" }
  | { verified: false; reason: string }
> {
  const verifyDateKey = args.verifyDateKey ?? getIstDateKey();

  if (args.platform === "LEETCODE" && args.leetcodeHandle) {
    const slug = extractLeetcodeSlugFromUrl(args.problemUrl);
    if (!slug) {
      return {
        verified: false,
        reason: "POTD URL does not look like a valid LeetCode problem link.",
      };
    }
    try {
      const matched = await hasAcceptedLeetcodeSubmission(
        args.leetcodeHandle,
        slug,
        verifyDateKey
      );
      return matched
        ? { verified: true, source: "LEETCODE" }
        : {
            verified: false,
            reason:
              "No accepted LeetCode submission found for this POTD on its date (IST).",
          };
    } catch {
      return {
        verified: false,
        reason: "Could not verify LeetCode submissions right now. Try again.",
      };
    }
  }

  if (args.platform === "CODEFORCES" && args.codeforcesHandle) {
    const problemRef = extractCodeforcesProblemRef(args.problemUrl);
    if (!problemRef) {
      return {
        verified: false,
        reason: "POTD URL does not look like a valid Codeforces problem link.",
      };
    }
    try {
      const matched = await hasAcceptedCodeforcesSubmission(
        args.codeforcesHandle,
        problemRef,
        verifyDateKey
      );
      return matched
        ? { verified: true, source: "CODEFORCES" }
        : {
            verified: false,
            reason:
              "No accepted Codeforces submission found for this POTD on its date (IST).",
          };
    } catch {
      return {
        verified: false,
        reason: "Could not verify Codeforces submissions right now. Try again.",
      };
    }
  }

  if (args.platform === "LEETCODE") {
    return {
      verified: false,
      reason: "Link your LeetCode handle in Dashboard first.",
    };
  }

  if (args.platform === "CODEFORCES") {
    return {
      verified: false,
      reason: "Link your Codeforces handle in Dashboard first.",
    };
  }

  return {
    verified: false,
    reason:
      "External verification is currently available only for LeetCode and Codeforces POTD.",
  };
}

export async function upsertPotdSolveAndGetStreak(args: {
  userId: string;
  problemId: string;
  solvedDate: Date;
}) {
  await prisma.potdSolve.upsert({
    where: {
      problemId_userId: {
        problemId: args.problemId,
        userId: args.userId,
      },
    },
    update: {
      solvedAt: new Date(),
      isVerified: true,
    },
    create: {
      problemId: args.problemId,
      userId: args.userId,
      solvedDate: args.solvedDate,
      isVerified: true,
    },
  });

  return getPotdStreak(args.userId);
}

export async function getPotdStreak(userId: string) {
  const solvedDates = await prisma.potdSolve.findMany({
    where: { userId, isVerified: true },
    select: { solvedDate: true },
    orderBy: { solvedDate: "asc" },
  });

  return computePotdStreak(
    solvedDates.map((entry) => dateToDateKey(entry.solvedDate)),
    getIstDateKey()
  );
}
