import type { DriveStep } from "driver.js";

export type TourId =
  | "home"
  | "leaderboard"
  | "universityBoard"
  | "cpRankings"
  | "contests"
  | "icpc"
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
      "Open Leaderboard, CP Rankings, Contests, the ICPC guide, and your Dashboard. On the right, use Sync All, page tours, and What’s New/Changelog.",
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
      element: SEL("lb-weekly-spotlight"),
      popover: {
        title: "Weekly standout",
        description:
          "The most active problem solver for the current week gets a spotlight based on synced submission activity.",
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
      element: SEL("cp-podium"),
      popover: {
        title: "Top three",
        description:
          "The highest-rated Codeforces users are featured on a live gold, silver, and bronze podium.",
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
  contests: [
    navStep,
    {
      element: SEL("contests-header"),
      popover: {
        title: "Contest calendar",
        description: "See upcoming competitive programming contests in your local time zone.",
        side: "bottom",
      },
    },
    {
      element: SEL("contests-filters"),
      popover: {
        title: "Platform filters",
        description: "Show or hide platforms to focus your schedule.",
        side: "bottom",
      },
    },
    {
      element: SEL("contests-list"),
      popover: {
        title: "Upcoming contests",
        description: "Check start times and durations, open the contest, or add it to Google Calendar.",
        side: "top",
      },
    },
  ],
  icpc: [
    navStep,
    {
      element: SEL("icpc-header"),
      popover: {
        title: "ICPC guide",
        description:
          "Everything an Indian college team needs for ICPC: how it works, how to qualify, and how to prepare.",
        side: "bottom",
      },
    },
    {
      element: SEL("icpc-next"),
      popover: {
        title: "Up next",
        description: "The next stage of the current season, with a quick way to add it to your calendar.",
        side: "bottom",
      },
    },
    {
      element: SEL("icpc-road"),
      popover: {
        title: "Road to the World Finals",
        description:
          "Every stage from team registration to the World Finals. Finished stages are ticked off automatically.",
        side: "top",
      },
    },
    {
      element: SEL("icpc-regionals"),
      popover: {
        title: "Indian regionals",
        description: "Dates, hosts, onsite seats, fees and selection rules for each Indian regional site.",
        side: "top",
      },
    },
    {
      element: SEL("icpc-format"),
      popover: {
        title: "Contest format",
        description: "How scoring, penalty time, the frozen scoreboard and the team notebook work.",
        side: "top",
      },
    },
    {
      element: SEL("icpc-prepare"),
      popover: {
        title: "How to prepare",
        description: "A year-by-year plan, plus the CPBoard pages that help you track it.",
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
        description:
          "Your avatar, name, username, university and join date. Edit inline, change your photo, or copy your public profile link to share.",
        side: "bottom",
      },
    },
    {
      element: SEL("dash-stats"),
      popover: {
        title: "Totals",
        description:
          "Problems solved across platforms, your LeetCode rating, how many people viewed your profile, and which platforms are linked.",
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
      element: SEL("dash-recommendations"),
      popover: {
        title: "Personalized practice",
        description:
          "Your least-practiced topics become actionable Codeforces and LeetCode practice recommendations at a rating-matched difficulty.",
        side: "top",
      },
    },
    {
      element: SEL("dash-platforms"),
      popover: {
        title: "Platforms",
        description:
          "New CPBoard accounts use a five-minute Codeforces or LeetCode submission challenge before the first sync or a handle change. Pre-existing accounts keep direct linking, and linked profiles refresh normally.",
        side: "top",
      },
    },
    {
      element: SEL("dash-notifications"),
      popover: {
        title: "Browser notifications",
        description:
          "Enable this browser for global leader changes and contest reminders. Alert preferences follow your account, while each browser is connected separately.",
        side: "top",
      },
    },
    {
      element: SEL("dash-support"),
      popover: {
        title: "Support",
        description: "Need account help or a profile review? Email support from here.",
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
          "Each card shows solved counts, ratings and contests, with a link to the profile on that platform.",
        side: "top",
      },
    },
    {
      element: SEL("profile-support"),
      popover: {
        title: "Report a problem",
        description: "Something looks wrong on this profile? Request a review from support.",
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
  if (pathname === "/contests") return "contests";
  if (pathname === "/icpc") return "icpc";
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/admin/daily-practice") return "adminDailyPractice";
  if (/^\/u\/[^/]+$/.test(pathname)) return "publicProfile";
  return null;
}
