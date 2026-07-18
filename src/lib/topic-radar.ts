import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fetchCodeforcesApi } from "@/lib/codeforces-api";

type TopicMap = Record<string, number>;

export type TopicRadarPoint = {
  topic: string;
  count: number;
  codeforces: number;
  leetcode: number;
};

type CFSubmission = {
  verdict?: string;
  id?: number;
  problem?: {
    contestId?: number;
    index?: string;
    name?: string;
    tags?: string[];
    problemsetName?: string;
  };
};

type LeetTagCount = {
  tagName: string;
  problemsSolved: number;
};

type LeetCodeTopicGroups = {
  advanced?: LeetTagCount[];
  intermediate?: LeetTagCount[];
  fundamental?: LeetTagCount[];
};

type CpRatingLeetCodeResponse = {
  topics?: LeetCodeTopicGroups;
};

const TOPIC_ALIASES: Record<string, string> = {
  strings: "string",
  sortings: "sorting",
  hashing: "hash table",
  "hash map": "hash table",
  "hash set": "hash table",
  hashset: "hash table",
  trees: "tree",
  graphs: "graph",
  "depth-first search": "depth first search",
  "breadth-first search": "breadth first search",
  "union find": "dsu",
  "union-find": "dsu",
  "disjoint set union": "dsu",
  "binary indexed tree": "bit",
};

function normalizeTag(tag: string): string {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, " ");
  return TOPIC_ALIASES[normalized] || normalized;
}

function addCount(map: TopicMap, key: string, count = 1) {
  map[key] = (map[key] || 0) + count;
}

function toDisplayTag(normalized: string): string {
  const acronyms = new Set(["dp", "dfs", "bfs", "dsu", "fft", "lca", "mst", "bit", "sql"]);
  return normalized
    .split(" ")
    .map((part) =>
      part
        .split("-")
        .map((p) => {
          if (!p) return p;
          if (acronyms.has(p)) return p.toUpperCase();
          return p[0].toUpperCase() + p.slice(1);
        })
        .join("-")
    )
    .join(" ");
}

export async function fetchCodeforcesTopicCounts(handle: string): Promise<TopicMap> {
  const counts: TopicMap = {};
  const solvedProblems = new Set<string>();
  const pageSize = 10000;
  let from = 1;

  for (let page = 0; page < 5; page++) {
    const submissions = await fetchCodeforcesApi<CFSubmission[]>(
      "user.status",
      { handle, from, count: pageSize },
      20_000,
    );
    for (const sub of submissions) {
      if (sub.verdict !== "OK") continue;
      const p = sub.problem;
      if (!p) continue;

      const key =
        p.contestId != null && p.index
          ? `${p.contestId}-${p.index}`
          : p.problemsetName && p.name
            ? `${p.problemsetName}-${p.name}`
            : `sub-${sub.id || Math.random()}`;

      if (solvedProblems.has(key)) continue;
      solvedProblems.add(key);

      for (const tag of p.tags || []) {
        addCount(counts, normalizeTag(tag), 1);
      }
    }

    if (submissions.length < pageSize) break;
    from += pageSize;
  }

  return counts;
}

export async function fetchLeetCodeTopicCounts(username: string): Promise<TopicMap> {
  const query = `
    query topicCounts($username: String!) {
      matchedUser(username: $username) {
        tagProblemCounts {
          advanced { tagName problemsSolved }
          intermediate { tagName problemsSolved }
          fundamental { tagName problemsSolved }
        }
      }
    }
  `;

  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://leetcode.com",
      Referer: "https://leetcode.com/",
    },
    body: JSON.stringify({ query, variables: { username } }),
  });

  if (!res.ok) {
    const fallback = await fetchLeetCodeTopicCountsFromCpRating(username);
    if (fallback) return fallback;
    throw new Error(`LeetCode GraphQL failed (${res.status})`);
  }

  const payload = await res.json();
  const tagGroups = payload.data?.matchedUser?.tagProblemCounts;
  const fromGraphQL = toTopicMap(tagGroups);
  if (Object.keys(fromGraphQL).length > 0) return fromGraphQL;

  if (payload.errors?.length) {
    const fallback = await fetchLeetCodeTopicCountsFromCpRating(username);
    if (fallback) return fallback;
    throw new Error(payload.errors[0].message || "LeetCode GraphQL error");
  }

  const fallback = await fetchLeetCodeTopicCountsFromCpRating(username);
  return fallback || fromGraphQL;
}

function toTopicMap(tagGroups: LeetCodeTopicGroups | null | undefined): TopicMap {
  const counts: TopicMap = {};
  if (!tagGroups) return counts;

  const allTags: LeetTagCount[] = [
    ...(tagGroups.advanced || []),
    ...(tagGroups.intermediate || []),
    ...(tagGroups.fundamental || []),
  ];
  for (const entry of allTags) {
    if (!entry?.tagName || !entry?.problemsSolved) continue;
    addCount(counts, normalizeTag(entry.tagName), Number(entry.problemsSolved) || 0);
  }
  return counts;
}

async function fetchLeetCodeTopicCountsFromCpRating(
  username: string
): Promise<TopicMap | null> {
  try {
    const res = await fetch(
      `https://cp-rating-api.vercel.app/leetcode/${encodeURIComponent(username)}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return null;
    const payload: CpRatingLeetCodeResponse = await res.json();
    const counts = toTopicMap(payload.topics);
    return Object.keys(counts).length > 0 ? counts : null;
  } catch {
    return null;
  }
}

async function buildCombinedTopicRadar(
  codeforcesHandle: string | null,
  leetcodeUsername: string | null,
  topN: number,
): Promise<TopicRadarPoint[]> {
  const emptyMap: TopicMap = {};
  const [cfCounts, lcCounts] = await Promise.all([
    codeforcesHandle
      ? fetchCodeforcesTopicCounts(codeforcesHandle).catch(() => emptyMap)
      : Promise.resolve(emptyMap),
    leetcodeUsername
      ? fetchLeetCodeTopicCounts(leetcodeUsername).catch(() => emptyMap)
      : Promise.resolve(emptyMap),
  ]);

  const keys = new Set<string>([...Object.keys(cfCounts), ...Object.keys(lcCounts)]);
  const points: TopicRadarPoint[] = [];

  for (const key of keys) {
    const cf = cfCounts[key] || 0;
    const lc = lcCounts[key] || 0;
    const count = cf + lc;
    if (count <= 0) continue;
    points.push({
      topic: toDisplayTag(key),
      count,
      codeforces: cf,
      leetcode: lc,
    });
  }

  points.sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
  return points.slice(0, topN);
}

const getCachedCombinedTopicRadar = unstable_cache(
  buildCombinedTopicRadar,
  ["combined-topic-radar-v1"],
  { revalidate: 1800, tags: [CACHE_TAGS.topicRadar] },
);

export async function fetchCombinedTopicRadar(opts: {
  codeforcesHandle?: string | null;
  leetcodeUsername?: string | null;
  topN?: number;
}): Promise<TopicRadarPoint[]> {
  return getCachedCombinedTopicRadar(
    opts.codeforcesHandle || null,
    opts.leetcodeUsername || null,
    opts.topN ?? 12,
  );
}
