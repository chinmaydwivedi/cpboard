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
    id: "2026-07-17-contests-and-personalization",
    publishedOn: "2026-07-17",
    headline: "Contests, Smarter Practice, and Weekly Recognition",
    summary:
      "CPBoard now helps you plan upcoming rounds, choose what to practice next, and celebrate the most active solver each week.",
    highlights: [
      {
        id: "contest-calendar",
        label: "NEW",
        pageHref: "/contests",
        pageLabel: "Contests",
        iconSrc: "/favicon.ico",
        title: "Cross-Platform Contest Calendar",
        description:
          "Browse upcoming Codeforces, LeetCode, AtCoder, and CodeChef contests in local time, filter platforms, and add rounds to Google Calendar.",
      },
      {
        id: "topic-recommendations",
        label: "NEW",
        pageHref: "/dashboard",
        pageLabel: "Dashboard",
        iconSrc: "/favicon.ico",
        title: "Personalized Topic Practice",
        description:
          "Your least-practiced radar topics now produce rating-matched Codeforces and LeetCode practice recommendations.",
      },
      {
        id: "weekly-standout",
        label: "NEW",
        pageHref: "/leaderboard",
        pageLabel: "Leaderboard",
        iconSrc: "/favicon.ico",
        title: "Weekly Standout",
        description:
          "The most active solver gets a weekly spotlight with activity combined across every synced platform and refreshed twice daily.",
      },
      {
        id: "cp-rankings-pagination",
        label: "IMPROVED",
        pageHref: "/cp-rankings",
        pageLabel: "CP Rankings",
        iconSrc: "/favicon.ico",
        title: "Paginated CP Rankings",
        description:
          "Codeforces rankings now load ten users per page while preserving global ranks, full-board statistics, and stable ordering.",
      },
      {
        id: "snippex-reference",
        label: "NEW",
        pageHref: "/contests",
        pageLabel: "Contests",
        iconSrc: "/favicon.ico",
        title: "CP Snippet Reference",
        description:
          "A new Snippex shortcut puts copy-ready C++ templates and competitive programming references beside the contest schedule.",
      },
      {
        id: "potd-paused",
        label: "IMPROVED",
        pageHref: "/contests",
        pageLabel: "Navigation",
        iconSrc: "/favicon.ico",
        title: "Contest-Focused Navigation",
        description:
          "POTD is paused for now, and its public navigation and routes have been replaced by the contest calendar.",
      },
    ],
  },
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
