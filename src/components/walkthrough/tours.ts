import type { DriveStep } from "driver.js";

export type TourId = "home" | "leaderboard" | "universityBoard" | "cpRankings" | "dashboard" | "publicProfile";

const SEL = (name: string) => `[data-tour="${name}"]`;

const navStep: DriveStep = {
  element: SEL("site-header"),
  popover: {
    title: "Site navigation",
    description:
      "Open Leaderboard, CP Rankings (Codeforces-focused), and Dashboard (when signed in). Use the theme toggle and account menu on the right.",
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
          "Sort by rank, totals, per-platform solved counts, or best rating. Click a user to open their public profile.",
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
};

export function tourIdForPathname(pathname: string): TourId | null {
  if (pathname === "/") return "home";
  if (pathname === "/leaderboard") return "leaderboard";
  if (/^\/leaderboard\/[^/]+$/.test(pathname)) return "universityBoard";
  if (pathname === "/cp-rankings") return "cpRankings";
  if (pathname === "/dashboard") return "dashboard";
  if (/^\/u\/[^/]+$/.test(pathname)) return "publicProfile";
  return null;
}
