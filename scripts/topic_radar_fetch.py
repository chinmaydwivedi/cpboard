#!/usr/bin/env python3
"""
Fetch solved-problem topic frequencies from:
  - Codeforces user.status API
  - LeetCode GraphQL API

Outputs JSON with per-platform counts and combined top topics.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from urllib import request


CODEFORCES_API = "https://codeforces.com/api/user.status"
LEETCODE_GRAPHQL = "https://leetcode.com/graphql"


def normalize_tag(tag: str) -> str:
    return " ".join(tag.strip().lower().split())


def title_case(tag: str) -> str:
    acronyms = {"dp", "dfs", "bfs", "dsu", "fft", "lca", "mst", "bit", "sql"}
    out = []
    for part in tag.split():
        subs = []
        for token in part.split("-"):
            if token in acronyms:
                subs.append(token.upper())
            elif token:
                subs.append(token[:1].upper() + token[1:])
            else:
                subs.append(token)
        out.append("-".join(subs))
    return " ".join(out)


def http_json(url: str, method: str = "GET", body: dict | None = None, headers: dict | None = None) -> dict:
    data = None
    final_headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    }
    if headers:
        final_headers.update(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        final_headers.setdefault("Content-Type", "application/json")
    req = request.Request(url=url, method=method, data=data, headers=final_headers)
    with request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_codeforces_topics(handle: str, max_pages: int = 5, page_size: int = 10000) -> Counter:
    counts: Counter = Counter()
    solved_keys: set[str] = set()
    start = 1

    for _ in range(max_pages):
        url = f"{CODEFORCES_API}?handle={handle}&from={start}&count={page_size}"
        payload = http_json(url)
        if payload.get("status") != "OK":
            raise RuntimeError("Codeforces API returned non-OK status")

        submissions = payload.get("result") or []
        for sub in submissions:
            if sub.get("verdict") != "OK":
                continue
            problem = sub.get("problem") or {}
            contest_id = problem.get("contestId")
            index = problem.get("index")
            name = problem.get("name") or "unknown"
            problemset = problem.get("problemsetName") or "set"
            key = f"{contest_id}-{index}" if contest_id is not None and index else f"{problemset}-{name}"
            if key in solved_keys:
                continue
            solved_keys.add(key)
            for tag in problem.get("tags") or []:
                counts[normalize_tag(str(tag))] += 1

        if len(submissions) < page_size:
            break
        start += page_size

    return counts


def fetch_leetcode_topics(username: str) -> Counter:
    query = """
    query topicCounts($username: String!) {
      matchedUser(username: $username) {
        tagProblemCounts {
          advanced { tagName problemsSolved }
          intermediate { tagName problemsSolved }
          fundamental { tagName problemsSolved }
        }
      }
    }
    """
    payload = http_json(
        LEETCODE_GRAPHQL,
        method="POST",
        body={"query": query, "variables": {"username": username}},
        headers={
            "Content-Type": "application/json",
            "Origin": "https://leetcode.com",
            "Referer": "https://leetcode.com/",
        },
    )
    if payload.get("errors"):
        raise RuntimeError(str(payload["errors"][0].get("message", "LeetCode GraphQL error")))

    matched = (payload.get("data") or {}).get("matchedUser")
    if not matched:
        return Counter()

    tag_groups = (matched.get("tagProblemCounts") or {})
    counts: Counter = Counter()
    for group in ("advanced", "intermediate", "fundamental"):
        for entry in tag_groups.get(group) or []:
            tag_name = entry.get("tagName")
            solved = int(entry.get("problemsSolved") or 0)
            if tag_name and solved > 0:
                counts[normalize_tag(str(tag_name))] += solved

    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="Build topic frequencies for Codeforces + LeetCode")
    parser.add_argument("--codeforces", required=True, help="Codeforces handle")
    parser.add_argument("--leetcode", required=True, help="LeetCode username")
    parser.add_argument("--top", type=int, default=12, help="Top N combined topics in output")
    parser.add_argument("--out", default="", help="Optional output JSON file path")
    args = parser.parse_args()

    try:
        cf_counts = fetch_codeforces_topics(args.codeforces)
        lc_counts = fetch_leetcode_topics(args.leetcode)
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    combined = Counter(cf_counts)
    combined.update(lc_counts)

    top_topics = []
    for topic, total in combined.most_common(args.top):
        top_topics.append(
            {
                "topic": title_case(topic),
                "count": int(total),
                "codeforces": int(cf_counts.get(topic, 0)),
                "leetcode": int(lc_counts.get(topic, 0)),
            }
        )

    payload = {
        "codeforces_handle": args.codeforces,
        "leetcode_username": args.leetcode,
        "codeforces": dict(sorted((title_case(k), int(v)) for k, v in cf_counts.items())),
        "leetcode": dict(sorted((title_case(k), int(v)) for k, v in lc_counts.items())),
        "combined": dict(sorted((title_case(k), int(v)) for k, v in combined.items())),
        "top_topics": top_topics,
    }

    text = json.dumps(payload, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
