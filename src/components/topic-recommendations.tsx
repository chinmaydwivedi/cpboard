import { ArrowUpRight, Lightbulb, Target } from "lucide-react";
import type { TopicRadarPoint } from "@/lib/topic-radar";
import { Badge } from "@/components/ui/badge";

const LEETCODE_SLUGS: Record<string, string> = {
  "Hash Table": "hash-table",
  "Binary Search": "binary-search",
  "Depth First Search": "depth-first-search",
  "Breadth First Search": "breadth-first-search",
  "Dynamic Programming": "dynamic-programming",
  DP: "dynamic-programming",
  "Two Pointers": "two-pointers",
  "Prefix Sum": "prefix-sum",
  "Sliding Window": "sliding-window",
  "Bit Manipulation": "bit-manipulation",
  "Number Theory": "number-theory",
};

function difficultyBand(rating: number) {
  if (rating <= 0) return { label: "Beginner", range: "800–1000" };
  const lower = Math.max(800, Math.floor((rating - 200) / 100) * 100);
  const upper = Math.max(lower + 200, Math.ceil((rating + 100) / 100) * 100);
  return { label: "Rating matched", range: `${lower}–${upper}` };
}

function codeforcesTag(topic: string) {
  const aliases: Record<string, string> = {
    DP: "dp",
    "Hash Table": "hashing",
    "Depth First Search": "dfs and similar",
    "Breadth First Search": "graphs",
    "Binary Search": "binary search",
    "Number Theory": "number theory",
    "Two Pointers": "two pointers",
    "Bit Manipulation": "bitmasks",
  };
  return aliases[topic] ?? topic.toLowerCase();
}

export function TopicRecommendations({
  topics,
  codeforcesRating,
}: {
  topics: TopicRadarPoint[];
  codeforcesRating: number;
}) {
  const recommendations = [...topics]
    .sort((a, b) => a.count - b.count || a.topic.localeCompare(b.topic))
    .slice(0, 3);
  const difficulty = difficultyBand(codeforcesRating);

  return (
    <section
      className="overflow-hidden rounded-lg border border-border/80 bg-card/60"
      data-tour="dash-recommendations"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Recommended next</h2>
            <Badge variant="outline" className="text-[10px]">Example</Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Based on your least-practiced topics across Codeforces and LeetCode.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Suggested difficulty
          </p>
          <p className="mt-0.5 font-mono text-xs font-medium">
            {difficulty.range} · {difficulty.label}
          </p>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="divide-y divide-border/40">
          {recommendations.map((topic, index) => {
            const cfUrl = `https://codeforces.com/problemset?tags=${encodeURIComponent(codeforcesTag(topic.topic))}`;
            const leetcodeSlug = LEETCODE_SLUGS[topic.topic];
            return (
              <article
                key={topic.topic}
                className="grid gap-3 px-4 py-3.5 sm:grid-cols-[32px_1fr_auto] sm:items-center"
              >
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 font-mono text-[11px] font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium">Practice {topic.topic}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {topic.count} solved
                    </Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Lightbulb className="size-3" />
                    Solve 3–5 problems here to balance your topic coverage.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={cfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-secondary"
                  >
                    Codeforces <ArrowUpRight className="size-3" />
                  </a>
                  {leetcodeSlug && (
                    <a
                      href={`https://leetcode.com/tag/${leetcodeSlug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-secondary"
                    >
                      LeetCode <ArrowUpRight className="size-3" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium">Not enough topic data yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Link and sync Codeforces or LeetCode to unlock recommendations.
          </p>
        </div>
      )}
    </section>
  );
}
