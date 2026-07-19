import "server-only";

import { randomInt } from "node:crypto";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchCodeforcesApi } from "@/lib/codeforces-api";
import { syncUserPlatform } from "@/lib/platforms";
import { lockPlatformProfileTransaction } from "@/lib/platform-sync-lease";
import { claimRateLimit } from "@/lib/security";

export type OwnershipVerificationPlatform = "CODEFORCES" | "LEETCODE";

const CHALLENGE_DURATION_MS = 5 * 60 * 1_000;
const OBSERVATION_GRACE_MS = 90 * 1_000;
const MIN_START_INTERVAL_MS = 30_000;
const MIN_CHECK_INTERVAL_MS = 4_000;
const MAX_CHECK_ATTEMPTS = 30;
const MAX_PROVIDER_CACHE_ENTRIES = 200;
const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

type ChallengeProblem = {
  key: string;
  title: string;
  url: string;
};

const CODEFORCES_PROBLEMS: ChallengeProblem[] = [
  {
    key: "4:A",
    title: "Watermelon",
    url: "https://codeforces.com/problemset/problem/4/A",
  },
  {
    key: "71:A",
    title: "Way Too Long Words",
    url: "https://codeforces.com/problemset/problem/71/A",
  },
  {
    key: "158:A",
    title: "Next Round",
    url: "https://codeforces.com/problemset/problem/158/A",
  },
  {
    key: "231:A",
    title: "Team",
    url: "https://codeforces.com/problemset/problem/231/A",
  },
  {
    key: "282:A",
    title: "Bit++",
    url: "https://codeforces.com/problemset/problem/282/A",
  },
  { key: "50:A", title: "Domino piling", url: "https://codeforces.com/problemset/problem/50/A" },
  { key: "59:A", title: "Word", url: "https://codeforces.com/problemset/problem/59/A" },
  { key: "69:A", title: "Young Physicist", url: "https://codeforces.com/problemset/problem/69/A" },
  { key: "110:A", title: "Nearly Lucky Number", url: "https://codeforces.com/problemset/problem/110/A" },
  { key: "112:A", title: "Petya and Strings", url: "https://codeforces.com/problemset/problem/112/A" },
  { key: "116:A", title: "Tram", url: "https://codeforces.com/problemset/problem/116/A" },
  { key: "118:A", title: "String Task", url: "https://codeforces.com/problemset/problem/118/A" },
  { key: "122:A", title: "Lucky Division", url: "https://codeforces.com/problemset/problem/122/A" },
  { key: "136:A", title: "Presents", url: "https://codeforces.com/problemset/problem/136/A" },
  { key: "148:A", title: "Insomnia cure", url: "https://codeforces.com/problemset/problem/148/A" },
  { key: "151:A", title: "Soft Drinking", url: "https://codeforces.com/problemset/problem/151/A" },
  { key: "160:A", title: "Twins", url: "https://codeforces.com/problemset/problem/160/A" },
  { key: "200:B", title: "Drinks", url: "https://codeforces.com/problemset/problem/200/B" },
  { key: "228:A", title: "Is your horseshoe on the other hoof?", url: "https://codeforces.com/problemset/problem/228/A" },
  { key: "236:A", title: "Boy or Girl", url: "https://codeforces.com/problemset/problem/236/A" },
  { key: "263:A", title: "Beautiful Matrix", url: "https://codeforces.com/problemset/problem/263/A" },
  { key: "266:A", title: "Stones on the Table", url: "https://codeforces.com/problemset/problem/266/A" },
  { key: "266:B", title: "Queue at the School", url: "https://codeforces.com/problemset/problem/266/B" },
  { key: "271:A", title: "Beautiful Year", url: "https://codeforces.com/problemset/problem/271/A" },
  { key: "281:A", title: "Word Capitalization", url: "https://codeforces.com/problemset/problem/281/A" },
  { key: "339:A", title: "Helpful Maths", url: "https://codeforces.com/problemset/problem/339/A" },
  { key: "344:A", title: "Magnets", url: "https://codeforces.com/problemset/problem/344/A" },
  { key: "427:A", title: "Police Recruits", url: "https://codeforces.com/problemset/problem/427/A" },
  { key: "467:A", title: "George and Accommodation", url: "https://codeforces.com/problemset/problem/467/A" },
  { key: "469:A", title: "I Wanna Be the Guy", url: "https://codeforces.com/problemset/problem/469/A" },
  { key: "479:A", title: "Expression", url: "https://codeforces.com/problemset/problem/479/A" },
  { key: "486:A", title: "Calculating Function", url: "https://codeforces.com/problemset/problem/486/A" },
  { key: "520:A", title: "Pangram", url: "https://codeforces.com/problemset/problem/520/A" },
  { key: "546:A", title: "Soldier and Bananas", url: "https://codeforces.com/problemset/problem/546/A" },
  { key: "617:A", title: "Elephant", url: "https://codeforces.com/problemset/problem/617/A" },
  { key: "677:A", title: "Vanya and Fence", url: "https://codeforces.com/problemset/problem/677/A" },
  { key: "705:A", title: "Hulk", url: "https://codeforces.com/problemset/problem/705/A" },
  { key: "734:A", title: "Anton and Danik", url: "https://codeforces.com/problemset/problem/734/A" },
  { key: "785:A", title: "Anton and Polyhedrons", url: "https://codeforces.com/problemset/problem/785/A" },
  { key: "791:A", title: "Bear and Big Brother", url: "https://codeforces.com/problemset/problem/791/A" },
  { key: "977:A", title: "Wrong Subtraction", url: "https://codeforces.com/problemset/problem/977/A" },
  { key: "996:A", title: "Hit the Lottery", url: "https://codeforces.com/problemset/problem/996/A" },
  { key: "1030:A", title: "In Search of an Easy Problem", url: "https://codeforces.com/problemset/problem/1030/A" },
  { key: "1328:A", title: "Divisibility Problem", url: "https://codeforces.com/problemset/problem/1328/A" },
  { key: "1352:A", title: "Sum of Round Numbers", url: "https://codeforces.com/problemset/problem/1352/A" },
  { key: "1433:A", title: "Boring Apartments", url: "https://codeforces.com/problemset/problem/1433/A" },
];

const LEETCODE_PROBLEMS: ChallengeProblem[] = [
  {
    key: "add-two-integers",
    title: "Add Two Integers",
    url: "https://leetcode.com/problems/add-two-integers/",
  },
  {
    key: "smallest-even-multiple",
    title: "Smallest Even Multiple",
    url: "https://leetcode.com/problems/smallest-even-multiple/",
  },
  {
    key: "find-the-maximum-achievable-number",
    title: "Find the Maximum Achievable Number",
    url: "https://leetcode.com/problems/find-the-maximum-achievable-number/",
  },
  {
    key: "convert-the-temperature",
    title: "Convert the Temperature",
    url: "https://leetcode.com/problems/convert-the-temperature/",
  },
  {
    key: "concatenation-of-array",
    title: "Concatenation of Array",
    url: "https://leetcode.com/problems/concatenation-of-array/",
  },
  { key: "palindrome-number", title: "Palindrome Number", url: "https://leetcode.com/problems/palindrome-number/" },
  { key: "majority-element", title: "Majority Element", url: "https://leetcode.com/problems/majority-element/" },
  { key: "contains-duplicate", title: "Contains Duplicate", url: "https://leetcode.com/problems/contains-duplicate/" },
  { key: "add-digits", title: "Add Digits", url: "https://leetcode.com/problems/add-digits/" },
  { key: "missing-number", title: "Missing Number", url: "https://leetcode.com/problems/missing-number/" },
  { key: "fizz-buzz", title: "Fizz Buzz", url: "https://leetcode.com/problems/fizz-buzz/" },
];

type CodeforcesUser = { handle: string };
type CodeforcesSubmission = {
  id?: number;
  creationTimeSeconds?: number;
  verdict?: string;
  problem?: { contestId?: number; index?: string };
};

type LeetcodeSubmission = {
  id?: string;
  titleSlug?: string;
  timestamp?: string | number;
};

type LeetcodeVerificationData = {
  matchedUser?: { username?: string } | null;
  recentAcSubmissionList?: LeetcodeSubmission[] | null;
};

type ProviderReadCacheEntry<T> = {
  promise: Promise<T>;
};

const codeforcesSubmissionReads = new Map<
  string,
  ProviderReadCacheEntry<CodeforcesSubmission[]>
>();
const leetcodeSubmissionReads = new Map<
  string,
  ProviderReadCacheEntry<LeetcodeVerificationData>
>();

const LEETCODE_VERIFICATION_QUERY = `
query verificationSubmissions($username: String!) {
  matchedUser(username: $username) {
    username
  }
  recentAcSubmissionList(username: $username, limit: 20) {
    id
    titleSlug
    timestamp
  }
}`;

export class PlatformVerificationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "PlatformVerificationError";
  }
}

export function isOwnershipVerificationPlatform(
  platform: Platform,
): platform is OwnershipVerificationPlatform {
  return platform === "CODEFORCES" || platform === "LEETCODE";
}

function coalesceProviderRead<T>(
  cache: Map<string, ProviderReadCacheEntry<T>>,
  key: string,
  loader: () => Promise<T>,
) {
  const existing = cache.get(key);
  if (existing) return existing.promise;

  const promise = loader();
  if (cache.size >= MAX_PROVIDER_CACHE_ENTRIES) return promise;

  // Coalesce only callers that overlap the same in-flight request. Completed
  // reads are never cached, so the next allowed manual check is fresh.
  const entry: ProviderReadCacheEntry<T> = { promise };
  cache.set(key, entry);
  void promise.then(
    () => {
      if (cache.get(key) === entry) cache.delete(key);
    },
    () => {
      if (cache.get(key) === entry) cache.delete(key);
    },
  );
  return promise;
}

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
}

function chooseProblem(
  platform: OwnershipVerificationPlatform,
  usedProblemKeys: Set<string>,
) {
  const problems =
    platform === "CODEFORCES" ? CODEFORCES_PROBLEMS : LEETCODE_PROBLEMS;
  const available = problems.filter(
    (problem) => !usedProblemKeys.has(problem.key),
  );
  if (available.length === 0) {
    throw new PlatformVerificationError(
      "Too many verification attempts are active for this handle. Try again shortly.",
      "CHALLENGE_CAPACITY_REACHED",
      429,
    );
  }
  return available[randomInt(available.length)];
}

function parseStrictHandle(
  platform: OwnershipVerificationPlatform,
  rawInput: string,
) {
  const input = rawInput.trim();
  if (!input || input.length > 200) {
    throw new PlatformVerificationError(
      "Enter a valid handle or profile URL",
      "INVALID_HANDLE",
      400,
    );
  }

  let handle = input;
  if (input.includes("/") || /^https?:/i.test(input)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
      throw new PlatformVerificationError(
        "Enter a valid profile URL",
        "INVALID_HANDLE",
        400,
      );
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (platform === "CODEFORCES") {
      if (hostname !== "codeforces.com") {
        throw new PlatformVerificationError(
          "Use a codeforces.com profile URL",
          "INVALID_HANDLE",
          400,
        );
      }
      const match = url.pathname.match(
        /^\/(?:profile|contests\/with)\/([^/]+)\/?$/i,
      );
      if (!match) {
        throw new PlatformVerificationError(
          "Use a Codeforces profile URL or handle",
          "INVALID_HANDLE",
          400,
        );
      }
      handle = decodeURIComponent(match[1]);
    } else {
      if (hostname !== "leetcode.com") {
        throw new PlatformVerificationError(
          "Use a leetcode.com profile URL",
          "INVALID_HANDLE",
          400,
        );
      }
      const modernMatch = url.pathname.match(/^\/u\/([^/]+)\/?$/i);
      const legacyMatch = url.pathname.match(/^\/([^/]+)\/?$/i);
      const match = modernMatch || legacyMatch;
      if (!match || match[1].toLowerCase() === "problems") {
        throw new PlatformVerificationError(
          "Use a LeetCode profile URL or username",
          "INVALID_HANDLE",
          400,
        );
      }
      handle = decodeURIComponent(match[1]);
    }
  }

  const valid =
    platform === "CODEFORCES"
      ? /^[A-Za-z0-9_.-]{3,24}$/.test(handle)
      : /^[A-Za-z0-9_-]{1,30}$/.test(handle);
  if (!valid) {
    throw new PlatformVerificationError(
      `That does not look like a valid ${platform === "CODEFORCES" ? "Codeforces" : "LeetCode"} handle`,
      "INVALID_HANDLE",
      400,
    );
  }

  return handle;
}

async function fetchLeetcodeVerificationData(
  username: string,
): Promise<LeetcodeVerificationData> {
  const response = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "CPBoard/1.0",
      Origin: "https://leetcode.com",
      Referer: "https://leetcode.com/",
    },
    body: JSON.stringify({
      query: LEETCODE_VERIFICATION_QUERY,
      variables: { username },
    }),
  });

  if (!response.ok) {
    throw new PlatformVerificationError(
      "LeetCode verification is temporarily unavailable",
      "PROVIDER_UNAVAILABLE",
      503,
    );
  }

  const payload = (await response.json()) as {
    data?: LeetcodeVerificationData;
    errors?: { message?: string }[];
  };
  if (!payload.data) {
    throw new PlatformVerificationError(
      payload.errors?.[0]?.message ||
        "LeetCode verification is temporarily unavailable",
      "PROVIDER_UNAVAILABLE",
      503,
    );
  }
  if (payload.errors?.length) {
    const message = payload.errors[0]?.message || "";
    if (
      !payload.data.matchedUser &&
      /does not exist|not found|unable to find/i.test(message)
    ) {
      return payload.data;
    }
    throw new PlatformVerificationError(
      message || "LeetCode verification is temporarily unavailable",
      "PROVIDER_UNAVAILABLE",
      503,
    );
  }
  return payload.data;
}

async function getCanonicalHandleAndBaseline(
  platform: OwnershipVerificationPlatform,
  rawHandle: string,
) {
  const candidate = parseStrictHandle(platform, rawHandle);

  if (platform === "CODEFORCES") {
    try {
      const users = await fetchCodeforcesApi<CodeforcesUser[]>("user.info", {
        handles: candidate,
        checkHistoricHandles: true,
      });
      if (!users[0]?.handle) {
        throw new PlatformVerificationError(
          "Codeforces user not found",
          "HANDLE_NOT_FOUND",
          404,
        );
      }
      const submissions = await fetchCodeforcesApi<CodeforcesSubmission[]>(
        "user.status",
        { handle: users[0].handle, from: 1, count: 20 },
      );
      return {
        handle: users[0].handle,
        baselineSubmissionIds: submissions
          .map((submission) => submission.id)
          .filter((id): id is number => Number.isFinite(id))
          .map(String),
      };
    } catch (error) {
      if (error instanceof PlatformVerificationError) throw error;
      const message = error instanceof Error ? error.message : "";
      if (/not found/i.test(message)) {
        throw new PlatformVerificationError(
          "Codeforces user not found",
          "HANDLE_NOT_FOUND",
          404,
        );
      }
      throw new PlatformVerificationError(
        "Codeforces verification is temporarily unavailable",
        "PROVIDER_UNAVAILABLE",
        503,
      );
    }
  }

  const data = await fetchLeetcodeVerificationData(candidate);
  const canonicalHandle = data.matchedUser?.username;
  if (!canonicalHandle) {
    throw new PlatformVerificationError(
      "LeetCode user not found",
      "HANDLE_NOT_FOUND",
      404,
    );
  }
  return {
    handle: canonicalHandle,
    baselineSubmissionIds: (data.recentAcSubmissionList || [])
      .map((submission) => submission.id)
      .filter((id): id is string => Boolean(id)),
  };
}

async function assertHandleIsAvailable(
  userId: string,
  platform: OwnershipVerificationPlatform,
  handle: string,
) {
  const normalizedHandle = normalizeHandle(handle);
  const claimed = await prisma.platformProfile.findFirst({
    where: {
      userId: { not: userId },
      platform,
      OR: [
        { ownershipKey: `${platform}:${normalizedHandle}` },
        {
          verifiedAt: { not: null },
          handle: { equals: handle, mode: "insensitive" },
        },
      ],
    },
    select: { id: true },
  });
  if (claimed) {
    throw new PlatformVerificationError(
      "This handle is already linked to another CPBoard account",
      "HANDLE_ALREADY_CLAIMED",
      409,
    );
  }
}

function toChallengeResponse(challenge: {
  platform: Platform;
  handle: string;
  problemTitle: string;
  problemUrl: string;
  expiresAt: Date;
  requiredVerdict: string | null;
}) {
  const codeforces = challenge.platform === "CODEFORCES";
  return {
    platform: challenge.platform as OwnershipVerificationPlatform,
    handle: challenge.handle,
    problemTitle: challenge.problemTitle,
    problemUrl: challenge.problemUrl,
    instruction: codeforces
      ? "Submit intentionally non-compiling code to this problem and wait for the Compilation error verdict."
      : "Submit or resubmit an Accepted solution to this beginner problem.",
    serverNow: new Date().toISOString(),
    expiresAt: challenge.expiresAt.toISOString(),
    checkUntil: new Date(
      challenge.expiresAt.getTime() + OBSERVATION_GRACE_MS,
    ).toISOString(),
    requiredVerdict:
      challenge.requiredVerdict ||
      (codeforces ? "COMPILATION_ERROR" : "ACCEPTED"),
  };
}

async function acquireVerificationStartLease(
  userId: string,
  platform: OwnershipVerificationPlatform,
) {
  const acquired = await prisma.$queryRaw<Array<{ userId: string }>>`
    INSERT INTO "PlatformVerificationStartLease" (
      "userId",
      "platform",
      "lastStartedAt"
    )
    VALUES (
      ${userId},
      CAST(${platform} AS "Platform"),
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "platform") DO UPDATE
      SET "lastStartedAt" = EXCLUDED."lastStartedAt"
      WHERE "PlatformVerificationStartLease"."lastStartedAt"
        <= CURRENT_TIMESTAMP - (
          CAST(${MIN_START_INTERVAL_MS} AS double precision)
          * INTERVAL '1 millisecond'
        )
    RETURNING "userId"
  `;

  if (acquired.length === 0) {
    throw new PlatformVerificationError(
      "Wait a few seconds before starting another challenge",
      "START_TOO_SOON",
      429,
      Math.ceil(MIN_START_INTERVAL_MS / 1_000),
    );
  }
}

export async function startPlatformVerification(args: {
  userId: string;
  platform: OwnershipVerificationPlatform;
  rawHandle: string;
}) {
  const parsedCandidate = parseStrictHandle(args.platform, args.rawHandle);
  const normalizedCandidate = normalizeHandle(parsedCandidate);
  const [recentChallenge, candidateClaim] = await Promise.all([
    prisma.platformVerificationChallenge.findUnique({
      where: {
        userId_platform: { userId: args.userId, platform: args.platform },
      },
      select: {
        platform: true,
        handle: true,
        normalizedHandle: true,
        problemTitle: true,
        problemUrl: true,
        requiredVerdict: true,
        expiresAt: true,
        verifiedAt: true,
      },
    }),
    prisma.platformProfile.findUnique({
      where: {
        ownershipKey: `${args.platform}:${normalizedCandidate}`,
      },
      select: { userId: true },
    }),
  ]);

  if (candidateClaim) {
    if (candidateClaim.userId === args.userId) {
      throw new PlatformVerificationError(
        "This handle is already ownership verified",
        "ALREADY_VERIFIED",
        409,
      );
    }
    throw new PlatformVerificationError(
      "This handle is already linked to another CPBoard account",
      "HANDLE_ALREADY_CLAIMED",
      409,
    );
  }

  if (
    recentChallenge &&
    !recentChallenge.verifiedAt &&
    recentChallenge.normalizedHandle === normalizedCandidate &&
    Date.now() <
      recentChallenge.expiresAt.getTime() + OBSERVATION_GRACE_MS
  ) {
    return toChallengeResponse(recentChallenge);
  }

  const attemptLimit = await claimRateLimit({
    scope: "platform-verification-start",
    identifier: `${args.userId}:${args.platform}`,
    limit: 10,
    windowMs: 60 * 60 * 1_000,
  });
  if (!attemptLimit.allowed) {
    throw new PlatformVerificationError(
      "Too many verification challenges. Try again later.",
      "START_RATE_LIMITED",
      429,
      attemptLimit.retryAfter,
    );
  }

  await acquireVerificationStartLease(args.userId, args.platform);

  const [{ handle, baselineSubmissionIds }, existingProfile] =
    await Promise.all([
      getCanonicalHandleAndBaseline(args.platform, args.rawHandle),
      prisma.platformProfile.findUnique({
        where: {
          userId_platform: { userId: args.userId, platform: args.platform },
        },
        select: { handle: true, verifiedAt: true },
      }),
    ]);
  const normalizedHandle = normalizeHandle(handle);

  if (
    existingProfile?.verifiedAt &&
    normalizeHandle(existingProfile.handle) === normalizedHandle
  ) {
    throw new PlatformVerificationError(
      "This handle is already ownership verified",
      "ALREADY_VERIFIED",
      409,
    );
  }

  await assertHandleIsAvailable(args.userId, args.platform, handle);

  const allocationNow = new Date();
  const inactiveChallengeCutoff = new Date(
    allocationNow.getTime() - OBSERVATION_GRACE_MS,
  );
  // Release only the problem allocation here. The challenge row stays in
  // place so a provider check that began just before the grace deadline can
  // still finish and claim it safely.
  await prisma.platformVerificationChallenge.updateMany({
    where: {
      platform: args.platform,
      normalizedHandle,
      verifiedAt: null,
      allocationKey: { not: null },
      expiresAt: { lt: inactiveChallengeCutoff },
    },
    data: { allocationKey: null },
  });
  const requiredVerdict =
    args.platform === "CODEFORCES" ? "COMPILATION_ERROR" : "ACCEPTED";

  let challenge:
    | {
        platform: Platform;
        handle: string;
        problemTitle: string;
        problemUrl: string;
        requiredVerdict: string | null;
        expiresAt: Date;
      }
    | undefined;

  for (let allocationAttempt = 0; allocationAttempt < 4; allocationAttempt++) {
    const activeChallenges =
      await prisma.platformVerificationChallenge.findMany({
        where: {
          platform: args.platform,
          normalizedHandle,
          verifiedAt: null,
          expiresAt: { gte: inactiveChallengeCutoff },
          userId: { not: args.userId },
        },
        select: { problemKey: true },
      });
    const problem = chooseProblem(
      args.platform,
      new Set(activeChallenges.map((active) => active.problemKey)),
    );
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_DURATION_MS);

    try {
      challenge = await prisma.platformVerificationChallenge.upsert({
        where: {
          userId_platform: { userId: args.userId, platform: args.platform },
        },
        create: {
          userId: args.userId,
          platform: args.platform,
          handle,
          normalizedHandle,
          allocationKey: `${args.platform}:${normalizedHandle}:${problem.key}`,
          problemKey: problem.key,
          problemTitle: problem.title,
          problemUrl: problem.url,
          requiredVerdict,
          baselineSubmissionIds,
          issuedAt,
          expiresAt,
        },
        update: {
          handle,
          normalizedHandle,
          allocationKey: `${args.platform}:${normalizedHandle}:${problem.key}`,
          problemKey: problem.key,
          problemTitle: problem.title,
          problemUrl: problem.url,
          requiredVerdict,
          baselineSubmissionIds,
          issuedAt,
          expiresAt,
          attempts: 0,
          lastCheckedAt: null,
          verifiedAt: null,
        },
      });
      break;
    } catch (error) {
      const allocationCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!allocationCollision) throw error;
    }
  }

  if (!challenge) {
    throw new PlatformVerificationError(
      "Could not allocate a verification problem. Try again shortly.",
      "CHALLENGE_ALLOCATION_BUSY",
      503,
      5,
    );
  }

  return toChallengeResponse(challenge);
}

function baselineIdSet(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return new Set<string>();
  return new Set(value.filter((item): item is string => typeof item === "string"));
}

function submissionIsInsideChallenge(
  timestampSeconds: number | undefined,
  issuedAt: Date,
  expiresAt: Date,
) {
  if (!Number.isFinite(timestampSeconds)) return false;
  const submittedAt = Number(timestampSeconds) * 1_000;
  return (
    submittedAt >= issuedAt.getTime() - 2_000 &&
    submittedAt <= expiresAt.getTime()
  );
}

async function findChallengeSubmission(
  challenge: {
    platform: Platform;
    handle: string;
    problemKey: string;
    requiredVerdict: string | null;
    baselineSubmissionIds: Prisma.JsonValue;
    issuedAt: Date;
    expiresAt: Date;
  },
) {
  const baseline = baselineIdSet(challenge.baselineSubmissionIds);

  if (challenge.platform === "CODEFORCES") {
    let submissions: CodeforcesSubmission[];
    try {
      submissions = await coalesceProviderRead(
        codeforcesSubmissionReads,
        normalizeHandle(challenge.handle),
        () =>
          fetchCodeforcesApi<CodeforcesSubmission[]>("user.status", {
            handle: challenge.handle,
            from: 1,
            count: 50,
          }),
      );
    } catch {
      throw new PlatformVerificationError(
        "Codeforces verification is temporarily unavailable",
        "PROVIDER_UNAVAILABLE",
        503,
      );
    }

    const [contestIdText, expectedIndex] = challenge.problemKey.split(":");
    const contestId = Number(contestIdText);
    const matchingSubmissions = submissions.filter((submission) => {
      const id = submission.id == null ? "" : String(submission.id);
      return (
        id &&
        !baseline.has(id) &&
        submission.problem?.contestId === contestId &&
        submission.problem?.index?.toUpperCase() === expectedIndex &&
        submissionIsInsideChallenge(
          submission.creationTimeSeconds,
          challenge.issuedAt,
          challenge.expiresAt,
        )
      );
    });

    if (
      matchingSubmissions.some(
        (submission) => submission.verdict === challenge.requiredVerdict,
      )
    ) {
      return { matched: true as const };
    }
    const matchingSubmission = matchingSubmissions[0];
    if (matchingSubmission) {
      return {
        matched: false as const,
        message:
          !matchingSubmission.verdict || matchingSubmission.verdict === "TESTING"
            ? "Submission found. Codeforces is still judging it."
            : `Submission found with ${matchingSubmission.verdict.replaceAll("_", " ").toLowerCase()}. Submit code that produces a Compilation error.`,
      };
    }
    return {
      matched: false as const,
      message: "No new matching Codeforces submission yet.",
    };
  }

  let data: LeetcodeVerificationData;
  try {
    data = await coalesceProviderRead(
      leetcodeSubmissionReads,
      normalizeHandle(challenge.handle),
      () => fetchLeetcodeVerificationData(challenge.handle),
    );
  } catch (error) {
    if (error instanceof PlatformVerificationError) throw error;
    throw new PlatformVerificationError(
      "LeetCode verification is temporarily unavailable",
      "PROVIDER_UNAVAILABLE",
      503,
    );
  }

  const matched = (data.recentAcSubmissionList || []).some((submission) => {
    const id = submission.id || "";
    return (
      id &&
      !baseline.has(id) &&
      submission.titleSlug?.toLowerCase() === challenge.problemKey &&
      submissionIsInsideChallenge(
        Number(submission.timestamp),
        challenge.issuedAt,
        challenge.expiresAt,
      )
    );
  });
  return matched
    ? { matched: true as const }
    : {
        matched: false as const,
        message: "No new Accepted LeetCode submission for this problem yet.",
      };
}

async function claimVerifiedHandle(
  challenge: {
    id: string;
    userId: string;
    platform: Platform;
    handle: string;
    normalizedHandle: string;
    issuedAt: Date;
  },
  verifiedAt: Date,
) {
  return prisma.$transaction(async (tx) => {
    await lockPlatformProfileTransaction(
      tx,
      challenge.userId,
      challenge.platform,
    );
    const existingProfile = await tx.platformProfile.findUnique({
      where: {
        userId_platform: {
          userId: challenge.userId,
          platform: challenge.platform,
        },
      },
      select: { handle: true },
    });
    const sameHandle =
      existingProfile?.handle.trim().toLowerCase() ===
      challenge.normalizedHandle;

    const challengeUpdate = await tx.platformVerificationChallenge.updateMany({
      where: {
        id: challenge.id,
        userId: challenge.userId,
        platform: challenge.platform,
        normalizedHandle: challenge.normalizedHandle,
        issuedAt: challenge.issuedAt,
        verifiedAt: null,
      },
      data: { verifiedAt, allocationKey: null },
    });
    if (challengeUpdate.count !== 1) {
      throw new PlatformVerificationError(
        "This challenge changed. Start a fresh verification.",
        "CHALLENGE_CHANGED",
        409,
      );
    }

    const profile = await tx.platformProfile.upsert({
      where: {
        userId_platform: {
          userId: challenge.userId,
          platform: challenge.platform,
        },
      },
      create: {
        userId: challenge.userId,
        platform: challenge.platform,
        handle: challenge.handle,
        verified: true,
        verifiedAt,
        verificationMethod: "SUBMISSION_CHALLENGE",
        ownershipKey: `${challenge.platform}:${challenge.normalizedHandle}`,
      },
      update: {
        handle: challenge.handle,
        verified: true,
        verifiedAt,
        verificationMethod: "SUBMISSION_CHALLENGE",
        ownershipKey: `${challenge.platform}:${challenge.normalizedHandle}`,
        ...(sameHandle
          ? {}
          : {
              rating: 0,
              maxRating: 0,
              problemsSolved: 0,
              rank: null,
              contestsCount: 0,
              lastSynced: null,
            }),
      },
      select: {
        handle: true,
        rating: true,
        maxRating: true,
        problemsSolved: true,
        rank: true,
        contestsCount: true,
      },
    });

    if (!sameHandle) {
      await Promise.all([
        tx.dailyActivity.deleteMany({
          where: { userId: challenge.userId, platform: challenge.platform },
        }),
        tx.syncLog.deleteMany({
          where: { userId: challenge.userId, platform: challenge.platform },
        }),
        tx.platformSyncLease.deleteMany({
          where: { userId: challenge.userId, platform: challenge.platform },
        }),
      ]);
    }

    return profile;
  });
}

export async function checkPlatformVerification(args: {
  userId: string;
  platform: OwnershipVerificationPlatform;
}) {
  const challenge = await prisma.platformVerificationChallenge.findUnique({
    where: {
      userId_platform: { userId: args.userId, platform: args.platform },
    },
  });
  if (!challenge) {
    throw new PlatformVerificationError(
      "Start a verification challenge first",
      "CHALLENGE_NOT_FOUND",
      404,
    );
  }

  if (challenge.verifiedAt) {
    const profile = await prisma.platformProfile.findUnique({
      where: {
        userId_platform: { userId: args.userId, platform: args.platform },
      },
      select: {
        handle: true,
        rating: true,
        maxRating: true,
        problemsSolved: true,
        rank: true,
        contestsCount: true,
        lastSynced: true,
        verifiedAt: true,
      },
    });
    if (profile) {
      return {
        verified: true as const,
        newlyVerified: false as const,
        statsPending:
          !profile.lastSynced ||
          Boolean(
            profile.verifiedAt && profile.lastSynced < profile.verifiedAt,
          ),
        data: profile,
      };
    }
  }

  const now = new Date();
  if (now.getTime() > challenge.expiresAt.getTime() + OBSERVATION_GRACE_MS) {
    throw new PlatformVerificationError(
      "This challenge expired. Start a new one.",
      "CHALLENGE_EXPIRED",
      410,
    );
  }
  if (challenge.attempts >= MAX_CHECK_ATTEMPTS) {
    throw new PlatformVerificationError(
      "Too many checks for this challenge. Start a new one.",
      "TOO_MANY_ATTEMPTS",
      429,
    );
  }

  const allowedLastCheck = new Date(now.getTime() - MIN_CHECK_INTERVAL_MS);
  const checked = await prisma.platformVerificationChallenge.updateMany({
    where: {
      id: challenge.id,
      verifiedAt: null,
      attempts: { lt: MAX_CHECK_ATTEMPTS },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: allowedLastCheck } }],
    },
    data: { attempts: { increment: 1 }, lastCheckedAt: now },
  });
  if (checked.count !== 1) {
    throw new PlatformVerificationError(
      "Wait a few seconds before checking again",
      "CHECK_TOO_SOON",
      429,
      Math.ceil(MIN_CHECK_INTERVAL_MS / 1_000),
    );
  }

  let result: Awaited<ReturnType<typeof findChallengeSubmission>>;
  try {
    result = await findChallengeSubmission(challenge);
  } catch (error) {
    if (
      error instanceof PlatformVerificationError &&
      error.code === "PROVIDER_UNAVAILABLE"
    ) {
      await prisma.platformVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          issuedAt: challenge.issuedAt,
          lastCheckedAt: now,
          attempts: { gt: 0 },
          verifiedAt: null,
        },
        data: { attempts: { decrement: 1 } },
      });
    }
    throw error;
  }
  if (!result.matched) {
    return {
      verified: false as const,
      newlyVerified: false as const,
      pending: true as const,
      message: result.message,
      expiresAt: challenge.expiresAt.toISOString(),
      checkUntil: new Date(
        challenge.expiresAt.getTime() + OBSERVATION_GRACE_MS,
      ).toISOString(),
      serverNow: new Date().toISOString(),
    };
  }

  await assertHandleIsAvailable(args.userId, args.platform, challenge.handle);
  const verifiedAt = new Date();
  let claimedProfile: Awaited<ReturnType<typeof claimVerifiedHandle>>;
  try {
    claimedProfile = await claimVerifiedHandle(challenge, verifiedAt);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PlatformVerificationError(
        "This handle was linked to another CPBoard account",
        "HANDLE_ALREADY_CLAIMED",
        409,
      );
    }
    throw error;
  }

  let statsPending = false;
  try {
    const synced = await syncUserPlatform(
      args.userId,
      args.platform,
      challenge.handle,
      { minIntervalMs: 0 },
    );
    claimedProfile = {
      handle: synced.handle,
      rating: synced.rating,
      maxRating: synced.maxRating,
      problemsSolved: synced.problemsSolved,
      rank: synced.rank,
      contestsCount: synced.contestsCount,
    };
  } catch {
    statsPending = true;
  }

  return {
    verified: true as const,
    newlyVerified: true as const,
    statsPending,
    data: {
      ...claimedProfile,
      verifiedAt: verifiedAt.toISOString(),
    },
  };
}
