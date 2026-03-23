import type { Platform } from "@prisma/client";

const patterns: Record<Platform, RegExp[]> = {
  CODEFORCES: [
    /codeforces\.com\/profile\/([^/?#]+)/i,
    /codeforces\.com\/contests\/with\/([^/?#]+)/i,
  ],
  LEETCODE: [
    /leetcode\.com\/u\/([^/?#]+)/i,
    /leetcode\.com\/([^/?#]+)\/?$/i,
  ],
  ATCODER: [
    /atcoder\.jp\/users\/([^/?#]+)/i,
  ],
  CODECHEF: [
    /codechef\.com\/users\/([^/?#]+)/i,
  ],
};

export function extractHandle(platform: Platform, input: string): string {
  const trimmed = input.trim();

  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    return trimmed;
  }

  for (const regex of patterns[platform]) {
    const match = trimmed.match(regex);
    if (match?.[1]) {
      return match[1];
    }
  }

  const lastSegment = trimmed.replace(/\/+$/, "").split("/").pop();
  return lastSegment || trimmed;
}

export function getProfileUrl(platform: Platform, handle: string): string {
  switch (platform) {
    case "CODEFORCES":
      return `https://codeforces.com/profile/${handle}`;
    case "LEETCODE":
      return `https://leetcode.com/u/${handle}`;
    case "ATCODER":
      return `https://atcoder.jp/users/${handle}`;
    case "CODECHEF":
      return `https://www.codechef.com/users/${handle}`;
  }
}
