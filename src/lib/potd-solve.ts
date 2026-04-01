import type { ProblemPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computePotdStreak, dateToDateKey, getIstDateKey } from "@/lib/potd";

const CODEFORCES_API = "https://codeforces.com/api";
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
    if (!url.hostname.includes("leetcode.com")) return null;
    const match = url.pathname.match(/\/problems\/([^/]+)/i);
    if (!match) return null;
    const slug = decodeURIComponent(match[1]).trim().toLowerCase();
    return slug || null;
  } catch {
    return null;
  }
}

function extractCodeforcesProblemRef(problemUrl: string): CodeforcesProblemRef | null {
  try {
    const url = new URL(problemUrl);
    if (!url.hostname.includes("codeforces.com")) return null;

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

      if (!Number.isFinite(contestId) || contestId <= 0 || !index) continue;
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
      "User-Agent": "CPBoard/1.0 (+https://cpboard.vercel.app)",
    },
    body: JSON.stringify({
      query: RECENT_AC_SUBMISSIONS_QUERY,
      variables: { username: handle },
    }),
    cache: "no-store",
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
  const response = await fetch(
    `${CODEFORCES_API}/user.status?handle=${encodeURIComponent(
      handle
    )}&from=1&count=10000`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "CPBoard/1.0 (+https://cpboard.vercel.app)",
      },
    }
  );

  if (!response.ok) return false;

  const payload = await response.json();
  if (payload?.status !== "OK" || !Array.isArray(payload?.result)) return false;

  return (payload.result as CodeforcesSubmission[]).some((submission) => {
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
    },
    create: {
      problemId: args.problemId,
      userId: args.userId,
      solvedDate: args.solvedDate,
    },
  });

  const solvedDates = await prisma.potdSolve.findMany({
    where: { userId: args.userId },
    select: { solvedDate: true },
    orderBy: { solvedDate: "asc" },
  });

  return computePotdStreak(
    solvedDates.map((entry) => dateToDateKey(entry.solvedDate)),
    getIstDateKey()
  );
}
