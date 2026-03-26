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

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
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
    const res = await fetch(
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${pageSize}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Codeforces user.status failed (${res.status})`);

    const payload = await res.json();
    if (payload.status !== "OK") throw new Error("Codeforces API returned non-OK status");

    const submissions: CFSubmission[] = payload.result || [];
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
  const counts: TopicMap = {};
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { username } }),
  });

  if (!res.ok) throw new Error(`LeetCode GraphQL failed (${res.status})`);
  const payload = await res.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message || "LeetCode GraphQL error");

  const tagGroups = payload.data?.matchedUser?.tagProblemCounts;
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

export async function fetchCombinedTopicRadar(opts: {
  codeforcesHandle?: string | null;
  leetcodeUsername?: string | null;
  topN?: number;
}): Promise<TopicRadarPoint[]> {
  const { codeforcesHandle, leetcodeUsername, topN = 12 } = opts;

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
