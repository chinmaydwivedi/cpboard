export type ChangelogHighlight = {
  id: string;
  label: "NEW" | "IMPROVED" | "FIXED";
  pageHref: string;
  pageLabel: string;
  iconSrc?: string;
  title: string;
  description: string;
};

export type ChangelogRelease = {
  id: string;
  publishedOn: string;
  headline: string;
  summary: string;
  highlights: ChangelogHighlight[];
};

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    id: "2026-04-01-potd-launch",
    publishedOn: "2026-04-01",
    headline: "POTD, Streaks, and Daily Discussion",
    summary:
      "We added a focused daily practice flow with streak tracking and lightweight community discussion.",
    highlights: [
      {
        id: "potd-page",
        label: "NEW",
        pageHref: "/potd",
        pageLabel: "POTD",
        iconSrc: "/favicon.ico",
        title: "Problem of the Day",
        description:
          "A dedicated POTD page now shows the daily problem, difficulty, and direct platform link.",
      },
      {
        id: "potd-streak",
        label: "NEW",
        pageHref: "/potd",
        pageLabel: "POTD",
        iconSrc: "/favicon.ico",
        title: "Personal Daily Streak",
        description:
          "Signed-in users can mark POTD solves and track their current and longest streak.",
      },
      {
        id: "potd-comments",
        label: "IMPROVED",
        pageHref: "/potd",
        pageLabel: "POTD",
        iconSrc: "/favicon.ico",
        title: "Discussion with Code Blocks",
        description:
          "Each POTD has comments where users can share approaches and fenced code snippets.",
      },
    ],
  },
  {
    id: "2026-04-01-privacy-profile-updates",
    publishedOn: "2026-04-01",
    headline: "New Updates to CPBoard",
    summary:
      "We shipped better privacy controls and profile updates with minimal UI changes.",
    highlights: [
      {
        id: "profile-privacy",
        label: "NEW",
        pageHref: "/profile",
        pageLabel: "Profile",
        iconSrc: "/favicon.ico",
        title: "Private Profile Details",
        description:
          "Users must be signed in to open full profile details for other members.",
      },
      {
        id: "profile-visit-counter",
        label: "IMPROVED",
        pageHref: "/profile",
        pageLabel: "Profile",
        iconSrc: "/favicon.ico",
        title: "Profile Visit Counter",
        description:
          "Each profile now shows total visits so users can track profile reach.",
      },
    ],
  },
];

export const CURRENT_CHANGELOG = CHANGELOG_RELEASES[0];

export function getActiveReleaseId(): string {
  const explicit = process.env.NEXT_PUBLIC_WHATS_NEW_RELEASE?.trim();
  if (explicit) return explicit;

  const deploySha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (deploySha) return deploySha.slice(0, 12);

  return CURRENT_CHANGELOG.id;
}
