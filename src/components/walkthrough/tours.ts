import type { DriveStep } from "driver.js";

export type TourId =
  | "home"
  | "leaderboard"
  | "universityBoard"
  | "cpRankings"
  | "potd"
  | "dashboard"
  | "publicProfile"
  | "changelog"
  | "adminDailyPractice";

const SEL = (name: string) => `[data-tour="${name}"]`;

const navStep: DriveStep = {
  element: SEL("site-header"),
  popover: {
    title: "Site navigation",
    description:
      "Open Leaderboard, CP Rankings, POTD, and Dashboard (when signed in). On the right, use Sync All, page tours, and What’s New/Changelog.",
    side: "bottom",
    align: "center",
  },
};

export const TOUR_STEPS: Record<TourId, DriveStep[]> = {
  home: [
    navStep,
    {
      element: SEL("home-hero"),
      popover: {
        title: "Welcome",
        description:
          "CPBoard aggregates competitive programming stats across Codeforces, LeetCode, AtCoder, and CodeChef for your university.",
        side: "bottom",
      },
    },
    {
      element: SEL("home-stats"),
      popover: {
        title: "Community stats",
        description: "Live counts of registered users, universities, linked profiles, and total problems solved across the platform.",
        side: "top",
      },
    },
    {
      element: SEL("home-features"),
      popover: {
        title: "What you get",
        description: "Multi-platform linking, university leaderboards, activity heatmaps, and dedicated CP rating views.",
        side: "top",
      },
    },
    {
      element: SEL("home-cta"),
      popover: {
        title: "Get started",
        description:
          "Use this action to join with your university email, or jump back to your dashboard if you're already signed in.",
        side: "top",
      },
    },
  ],
  leaderboard: [
    navStep,
    {
      element: SEL("lb-header"),
      popover: {
        title: "Leaderboard",
        description:
          "Global ranking by total problems solved across all linked platforms. Higher totals rank above others.",
        side: "bottom",
      },
    },
    {
      element: SEL("lb-filters"),
      popover: {
        title: "Search and filter",
        description: "Find people by name or username. Restrict the table to one university.",
        side: "bottom",
      },
    },
    {
      element: SEL("lb-table"),
      popover: {
        title: "Rankings table",
        description:
          "Sort by rank, totals, POTD longest streak, per-platform solved counts, or best rating. Click a user to open their public profile.",
        side: "top",
      },
    },
  ],
  universityBoard: [
    navStep,
    {
      element: SEL("lb-uni-header"),
      popover: {
        title: "University view",
        description: "This page shows members from a single school, sorted by total problems solved.",
        side: "bottom",
      },
    },
    {
      element: SEL("lb-table"),
      popover: {
        title: "Members",
        description: "Same sortable table as the global board, without the university column (everyone is from this school).",
        side: "top",
      },
    },
  ],
  cpRankings: [
    navStep,
    {
      element: SEL("cp-header"),
      popover: {
        title: "CP Rankings",
        description: "Codeforces-only view: current rating, max rating, and rank titles across universities.",
        side: "bottom",
      },
    },
    {
      element: SEL("cp-summary"),
      popover: {
        title: "Summary cards",
        description: "How many rated users are tracked, the highest rating on the board, and the average rating.",
        side: "bottom",
      },
    },
    {
      element: SEL("cp-distribution"),
      popover: {
        title: "Rating distribution",
        description: "Histogram of Codeforces ratings so you can see how the community is spread across skill bands.",
        side: "top",
      },
    },
    {
      element: SEL("cp-table"),
      popover: {
        title: "Ranked list",
        description: "Sorted by current Codeforces rating. Links go to public profiles and Codeforces.",
        side: "top",
      },
    },
  ],
  potd: [
    navStep,
    {
      element: SEL("potd-header"),
      popover: {
        title: "Daily practice",
        description:
          "Problem of the Day (POTD) gives one focused problem each day with admin-written solutions.",
        side: "bottom",
      },
    },
    {
      element: SEL("potd-calendar"),
      popover: {
        title: "Completion calendar",
        description:
          "This monthly calendar adds a tick mark for completed POTDs. Click published past dates (including yesterday) to open and solve them.",
        side: "bottom",
      },
    },
    {
      element: SEL("potd-streak"),
      popover: {
        title: "Streak tracking",
        description:
          "Sign in and mark the POTD as solved to build your personal daily streak.",
        side: "bottom",
      },
    },
    {
      element: SEL("potd-problem"),
      popover: {
        title: "Problem card",
        description:
          "Open the official problem link and mark it solved after finishing.",
        side: "top",
      },
    },
    {
      element: SEL("potd-solutions"),
      popover: {
        title: "Language tabs",
        description:
          "Review Java, C++, and Python reference solutions and explanations.",
        side: "top",
      },
    },
    {
      element: SEL("potd-comments"),
      popover: {
        title: "Discussion",
        description:
          "Ask questions, compare approaches, share themed fenced code blocks, and delete your own comments when needed.",
        side: "top",
      },
    },
    {
      element: SEL("potd-archive"),
      popover: {
        title: "Archive",
        description:
          "Jump to earlier POTD entries to practice older problems and discussions.",
        side: "top",
      },
    },
  ],
  dashboard: [
    navStep,
    {
      element: SEL("dash-profile"),
      popover: {
        title: "Your profile",
        description: "Avatar, display name, username, and university badge. Edit inline or change your photo.",
        side: "bottom",
      },
    },
    {
      element: SEL("dash-stats"),
      popover: {
        title: "Totals",
        description: "Problems solved across platforms, your best rating, and how many platforms you have linked.",
        side: "bottom",
      },
    },
    {
      element: SEL("dash-heatmap"),
      popover: {
        title: "Activity heatmap",
        description: "Contribution-style grid of recent coding activity so you can spot consistency at a glance.",
        side: "top",
      },
    },
    {
      element: SEL("dash-topic-radar"),
      popover: {
        title: "Topic radar",
        description:
          "Combined Codeforces + LeetCode solved-topic frequencies, scaled with markers 5, 10, 20, 30, 100, 200, and 300 for quick comparison.",
        side: "top",
      },
    },
    {
      element: SEL("dash-platforms"),
      popover: {
        title: "Platforms",
        description: "Enter a handle or profile URL, then sync to pull rating and solved counts. Data refreshes from each site.",
        side: "top",
      },
    },
    {
      element: SEL("dash-danger"),
      popover: {
        title: "Danger zone",
        description: "Permanently delete your account here. Use only if you are sure you want to remove all data.",
        side: "top",
      },
    },
  ],
  publicProfile: [
    navStep,
    {
      element: SEL("profile-header"),
      popover: {
        title: "Profile overview",
        description: "View the user summary, username, university tag, and join date.",
        side: "bottom",
      },
    },
    {
      element: SEL("profile-heatmap"),
      popover: {
        title: "Activity heatmap",
        description: "Recent coding activity shown as a contribution-style calendar.",
        side: "top",
      },
    },
    {
      element: SEL("profile-platforms"),
      popover: {
        title: "Linked platforms",
        description:
          "Each card shows solved counts and ratings. On your own profile, you can remove a platform with the per-card Remove action.",
        side: "top",
      },
    },
    {
      element: SEL("profile-support"),
      popover: {
        title: "Support",
        description: "Need account help or a profile review? Use this support contact.",
        side: "top",
      },
    },
    {
      element: SEL("profile-danger"),
      popover: {
        title: "Account deletion",
        description: "If this is your own profile, you can permanently delete your account here.",
        side: "top",
      },
    },
  ],
  changelog: [
    navStep,
    {
      element: SEL("changelog-header"),
      popover: {
        title: "Changelog",
        description:
          "This page summarizes recent product updates so users can quickly see what changed.",
        side: "bottom",
      },
    },
    {
      element: SEL("changelog-latest"),
      popover: {
        title: "Latest release",
        description:
          "Highlights from the most recent deployment with concise, high-impact notes.",
        side: "top",
      },
    },
    {
      element: SEL("changelog-history"),
      popover: {
        title: "Release history",
        description:
          "Browse previous releases and improvements when you want full context.",
        side: "top",
      },
    },
  ],
  adminDailyPractice: [
    navStep,
    {
      element: SEL("admin-potd-header"),
      popover: {
        title: "POTD admin",
        description:
          "Manage daily practice entries from this admin-only page.",
        side: "bottom",
      },
    },
    {
      element: SEL("admin-potd-form"),
      popover: {
        title: "Create and edit",
        description:
          "Set date/platform/details and add Java, C++, and Python solutions.",
        side: "top",
      },
    },
    {
      element: SEL("admin-potd-list"),
      popover: {
        title: "Publish control",
        description:
          "Review recent entries, toggle publish state, or edit existing days.",
        side: "top",
      },
    },
  ],
};

export function tourIdForPathname(pathname: string): TourId | null {
  if (pathname === "/") return "home";
  if (pathname === "/changelog") return "changelog";
  if (pathname === "/leaderboard") return "leaderboard";
  if (/^\/leaderboard\/[^/]+$/.test(pathname)) return "universityBoard";
  if (pathname === "/cp-rankings") return "cpRankings";
  if (pathname === "/potd" || pathname === "/daily-practice") return "potd";
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/admin/daily-practice") return "adminDailyPractice";
  if (/^\/u\/[^/]+$/.test(pathname)) return "publicProfile";
  return null;
}
