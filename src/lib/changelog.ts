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
    id: "2026-07-19-data-resilience-repair",
    publishedOn: "2026-07-19",
    headline: "Stable Data Through Provider Hiccups",
    summary:
      "Rankings now preserve their last successful data through temporary database or provider failures, while maintenance runs catch up more work and report transient degradation without turning one isolated profile into a site-wide incident.",
    highlights: [
      {
        id: "last-known-good-public-data",
        label: "FIXED",
        pageHref: "/leaderboard",
        pageLabel: "Rankings",
        iconSrc: "/icon-192x192.png",
        title: "Last-Known-Good Rankings",
        description:
          "Landing statistics, global rankings, university boards, and CP Rankings no longer cache database failures as real zero or empty results. Safe reads retry once, and failed revalidation keeps the last successful view available.",
      },
      {
        id: "accurate-atcoder-zero-solve-profiles",
        label: "FIXED",
        pageHref: "/dashboard",
        pageLabel: "AtCoder",
        iconSrc: "/icon-192x192.png",
        title: "Accurate Zero-Solve Accounts",
        description:
          "AtCoder account existence is now verified against the official profile page. A missing Kenkoooo accepted-count row is correctly treated as zero solved problems for a valid account instead of repeatedly marking that person as missing.",
      },
      {
        id: "maintenance-catch-up-budget",
        label: "IMPROVED",
        pageHref: "/leaderboard",
        pageLabel: "Freshness",
        iconSrc: "/icon-192x192.png",
        title: "Faster Backlog Recovery",
        description:
          "Each provider lane can process a larger, duration-bounded candidate set with provider-specific worker concurrency, shared request pacing, row locks, and leases. Codeforces reads also inherit the route deadline. Delayed scheduler invocations can therefore catch up without creating an uncontrolled provider burst.",
      },
      {
        id: "maintenance-degradation-signals",
        label: "FIXED",
        pageHref: "/changelog",
        pageLabel: "Operations",
        iconSrc: "/icon-192x192.png",
        title: "Meaningful Maintenance Alerts",
        description:
          "Scheduled runs now expose fixed, privacy-safe failure categories and durable streaks. A first isolated profile failure produces a visible warning, while a bounded confirmation slot prioritizes its next eligible retry without starving healthy profiles. Malformed responses, systemic transport failures, and repeated degradation still fail the maintenance gate.",
      },
      {
        id: "validated-provider-contracts",
        label: "IMPROVED",
        pageHref: "/dashboard",
        pageLabel: "Provider sync",
        iconSrc: "/icon-192x192.png",
        title: "Validated Provider Responses",
        description:
          "Codeforces, LeetCode, AtCoder, and CodeChef responses now validate the identity and core fields CPBoard uses before any write. Redirected profile pages, partial GraphQL errors, malformed rows, and invalid contest snapshots are rejected instead of becoming believable zero data.",
      },
      {
        id: "graceful-data-recovery",
        label: "FIXED",
        pageHref: "/",
        pageLabel: "Site-wide",
        iconSrc: "/icon-192x192.png",
        title: "Clear Recovery Instead of Blank Screens",
        description:
          "Unexpected page and root-layout failures now have in-theme recovery screens and retry actions. Contest-feed outages are distinguished from a genuinely empty calendar, including before hydration, instead of being presented as though no contests exist.",
      },
      {
        id: "restricted-browser-storage",
        label: "FIXED",
        pageHref: "/",
        pageLabel: "Browser reliability",
        iconSrc: "/icon-192x192.png",
        title: "Safe Private-Browser Preferences",
        description:
          "Theme, What’s New, and walkthrough preferences now tolerate blocked, full, or unavailable browser storage. Restricted browser modes fall back to current-tab memory instead of crashing root-level UI or ignoring dismiss actions.",
      },
    ],
  },
  {
    id: "2026-07-19-parallel-security-release",
    publishedOn: "2026-07-19",
    headline: "Faster Refreshes and Stronger Defenses",
    summary:
      "Platform updates now use provider-isolated parallel lanes with a 12-hour freshness cycle, while authentication, uploads, scheduled jobs, shared data, and the release pipeline gain layered security controls.",
    highlights: [
      {
        id: "provider-isolated-refresh-lanes",
        label: "IMPROVED",
        pageHref: "/leaderboard",
        pageLabel: "Live data",
        iconSrc: "/icon-192x192.png",
        title: "Parallel Provider Refresh Lanes",
        description:
          "Codeforces, LeetCode, AtCoder, and CodeChef now refresh independently every maintenance cycle with provider-specific concurrency. Fresh profiles become eligible every 12 hours, so a slow provider no longer holds up the others and stale queues catch up throughout the day.",
      },
      {
        id: "safe-upstream-coordination",
        label: "IMPROVED",
        pageHref: "/dashboard",
        pageLabel: "Reliability",
        iconSrc: "/icon-192x192.png",
        title: "Safe, Race-Free Syncs",
        description:
          "Shared database pacing now enforces Codeforces and AtCoder request intervals across serverless instances. Row-locked lease fencing prevents an older response from overwriting a newer handle, disconnect cooldown tombstones stop unlink/relink abuse, and failed profiles back off without blocking healthy ones.",
      },
      {
        id: "application-security-boundaries",
        label: "IMPROVED",
        pageHref: "/",
        pageLabel: "Site-wide",
        iconSrc: "/icon-192x192.png",
        title: "Layered Browser and API Protection",
        description:
          "A per-request nonce Content Security Policy, cross-site mutation checks, exact official problem-link validation, safe fixed-format operational logs, stricter browser headers, no-store API responses, constant-time job authentication, and separate job secrets reduce injection, request-forgery, caching, and credential-reuse risk.",
      },
      {
        id: "protected-sign-in-flow",
        label: "IMPROVED",
        pageHref: "/login",
        pageLabel: "Sign in",
        iconSrc: "/icon-192x192.png",
        title: "Protected Magic-Link Sign-In",
        description:
          "Distributed IP and email limits reduce sign-in spam, SMTP requires modern TLS, callback redirects are restricted to CPBoard, email HTML is escaped, and university access uses exact configured domains plus explicit aliases instead of broad suffix matching.",
      },
      {
        id: "abuse-resistant-user-actions",
        label: "FIXED",
        pageHref: "/dashboard",
        pageLabel: "Account safety",
        iconSrc: "/icon-192x192.png",
        title: "Safer Uploads and Verification",
        description:
          "Avatar uploads now accept only validated, bounded PNG, JPEG, or WebP images. Verification, comments, analytics, profile views, and notification actions use durable limits or ownership checks, while every stored push endpoint is revalidated before delivery.",
      },
      {
        id: "shared-content-preservation",
        label: "FIXED",
        pageHref: "/potd",
        pageLabel: "Practice content",
        iconSrc: "/icon-192x192.png",
        title: "Shared Practice Data Is Preserved",
        description:
          "Deleting a normal account can no longer cascade through shared practice problems and solutions created by that person. Admin accounts require reassignment, expired operational records are cleaned separately, and the job continuously verifies the runtime database role remains least-privileged.",
      },
      {
        id: "continuous-security-gate",
        label: "NEW",
        pageHref: "/changelog",
        pageLabel: "Release safety",
        iconSrc: "/icon-192x192.png",
        title: "Continuous Security Gate",
        description:
          "Every main-branch change and pull request now runs locked dependency, vulnerability, Prisma, lint, type, and production-build gates. Daily signed-package and passive production checks, Dependabot, private disclosure, and an isolated owner-credential migration workflow complete the release boundary.",
      },
      {
        id: "bounded-ranking-pagination",
        label: "FIXED",
        pageHref: "/cp-rankings",
        pageLabel: "CP Rankings",
        iconSrc: "/icon-192x192.png",
        title: "Bounded Ranking Pages",
        description:
          "CP Rankings now clamps page requests before loading page-specific cached data and redirects out-of-range links, preventing arbitrary page values from creating redundant cache and database work.",
      },
    ],
  },
  {
    id: "2026-07-19-connection-reliability",
    publishedOn: "2026-07-19",
    headline: "Reliable Connections and Alerts",
    summary:
      "Platform account retries now recover cleanly from failed syncs, while browser notification controls stay stable and preserve valid subscriptions.",
    highlights: [
      {
        id: "reliable-interactive-account-retries",
        label: "FIXED",
        pageHref: "/dashboard",
        pageLabel: "Platform accounts",
        iconSrc: "/icon-192x192.png",
        title: "Reliable Account Connections",
        description:
          "An explicit dashboard retry can now recover from a failed sync attempt after a short safety window without bypassing active work or background rate limits. Retry timing is shown directly on every screen size.",
      },
      {
        id: "stable-browser-alert-controls",
        label: "FIXED",
        pageHref: "/dashboard",
        pageLabel: "Notifications",
        iconSrc: "/icon-192x192.png",
        title: "Stable Browser Alert Controls",
        description:
          "Notification switches stay inside their tracks, rapid enable clicks are deduplicated, and reconnecting preserves valid browser subscriptions through temporary status errors and key changes.",
      },
    ],
  },
  {
    id: "2026-07-19-platform-ownership-verification",
    publishedOn: "2026-07-19",
    headline: "Verified Codeforces and LeetCode Handles",
    summary:
      "Accounts created after this rollout use a guided Codeforces and LeetCode submission challenge; every pre-existing member keeps the familiar direct link and sync flow.",
    highlights: [
      {
        id: "five-minute-ownership-challenge",
        label: "NEW",
        pageHref: "/dashboard",
        pageLabel: "Dashboard",
        iconSrc: "/icon-192x192.png",
        title: "Five-Minute Ownership Check",
        description:
          "Only new CPBoard accounts use the check. Each challenge includes an assigned beginner problem, its direct link, numbered submission steps, and a live five-minute countdown; pre-existing accounts are exempt.",
      },
      {
        id: "codeforces-submission-proof",
        label: "NEW",
        pageHref: "/dashboard",
        pageLabel: "Codeforces",
        iconSrc: "/icon-192x192.png",
        title: "Codeforces Compilation-Error Proof",
        description:
          "Open the exact problem from the challenge, submit intentionally non-compiling code, then return and check. CPBoard verifies the public submission ID, problem, verdict, and time without reading source code.",
      },
      {
        id: "leetcode-submission-proof",
        label: "NEW",
        pageHref: "/dashboard",
        pageLabel: "LeetCode",
        iconSrc: "/icon-192x192.png",
        title: "LeetCode Accepted-Submission Proof",
        description:
          "Open the linked beginner problem, solve or resubmit it, then return and check. CPBoard confirms a new Accepted submission from that username inside the challenge window.",
      },
      {
        id: "submission-replay-protection",
        label: "IMPROVED",
        pageHref: "/dashboard",
        pageLabel: "Security",
        iconSrc: "/icon-192x192.png",
        title: "Replay and Duplicate-Claim Protection",
        description:
          "Each challenge snapshots recent submissions, is bound to the signed-in user and candidate handle, and prevents newly verified handles from being claimed by a second account.",
      },
      {
        id: "safe-handle-switching",
        label: "FIXED",
        pageHref: "/dashboard",
        pageLabel: "Profiles",
        iconSrc: "/icon-192x192.png",
        title: "Safe Handle Changes",
        description:
          "For accounts using ownership checks, editing a verified handle keeps old stats intact while proof is pending. Pre-existing accounts keep direct handle updates, and duplicate claims are still blocked.",
      },
      {
        id: "coordinated-provider-updates",
        label: "IMPROVED",
        pageHref: "/dashboard",
        pageLabel: "Reliability",
        iconSrc: "/icon-192x192.png",
        title: "Coordinated Provider Updates",
        description:
          "Across app instances, sync work and provider requests are paced, overlapping work is avoided, temporary provider failures retry with bounded backoff, and scheduled runs now surface unhealthy all-failure batches.",
      },
      {
        id: "complete-public-accounts",
        label: "FIXED",
        pageHref: "/leaderboard",
        pageLabel: "Public pages",
        iconSrc: "/icon-192x192.png",
        title: "Complete Accounts in Public Results",
        description:
          "Accounts that have not finished onboarding are now excluded from public rankings, profiles, and discovery until their setup is complete.",
      },
      {
        id: "accepted-weekly-activity",
        label: "FIXED",
        pageHref: "/leaderboard",
        pageLabel: "Weekly standout",
        iconSrc: "/icon-192x192.png",
        title: "Solved-Problem Weekly Standout",
        description:
          "The weekly standout now uses accepted or newly solved activity where platform history exposes it; LeetCode stays conservative instead of guessing from incomplete history.",
      },
      {
        id: "official-contest-links",
        label: "IMPROVED",
        pageHref: "/contests",
        pageLabel: "Contests",
        iconSrc: "/icon-192x192.png",
        title: "Official Contest Destinations",
        description:
          "Calendar entries now accept only official HTTPS contest links for the supported platforms before they are shown or added to a calendar.",
      },
      {
        id: "protected-native-analytics",
        label: "IMPROVED",
        pageHref: "/",
        pageLabel: "Site-wide",
        iconSrc: "/icon-192x192.png",
        title: "Better-Protected Site Analytics",
        description:
          "CPBoard’s first-party page events now require an authenticated session and are rate-limited, keeping site insights useful without accepting unchecked event volume.",
      },
    ],
  },
  {
    id: "2026-07-18-faster-updates",
    publishedOn: "2026-07-18",
    headline: "Faster Syncs and Smoother Updates",
    summary:
      "CPBoard now refreshes data with less waiting, lighter page loads, and better-controlled background work across platforms, rankings, and notifications.",
    highlights: [
      {
        id: "bulk-platform-sync",
        label: "IMPROVED",
        pageHref: "/dashboard",
        pageLabel: "Dashboard",
        iconSrc: "/icon-192x192.png",
        title: "Much Faster Platform Syncs",
        description:
          "Platform history updates now use one short bulk transaction instead of hundreds of sequential writes, while independent provider and database work runs together.",
      },
      {
        id: "fresh-cache-invalidation",
        label: "IMPROVED",
        pageHref: "/leaderboard",
        pageLabel: "Rankings",
        iconSrc: "/icon-192x192.png",
        title: "Fast Pages Without Stale Updates",
        description:
          "Public stats and rankings are cached for speed, then precisely refreshed after a sync so new scores appear without waiting for an unrelated cache window.",
      },
      {
        id: "lighter-shared-bundle",
        label: "IMPROVED",
        pageHref: "/",
        pageLabel: "Site-wide",
        iconSrc: "/icon-192x192.png",
        title: "Lighter Initial Loading",
        description:
          "Analytics, tours, and chart libraries now load only when needed, reducing the JavaScript required for ordinary navigation.",
      },
      {
        id: "smooth-dashboard-refresh",
        label: "FIXED",
        pageHref: "/dashboard",
        pageLabel: "Dashboard",
        iconSrc: "/icon-192x192.png",
        title: "Sync Results Stay in Step",
        description:
          "Dashboard profile cards now reconcile refreshed server data while preserving unsaved handle edits, and heavy visual sections avoid rerendering during simple typing.",
      },
      {
        id: "bounded-background-work",
        label: "IMPROVED",
        pageHref: "/dashboard",
        pageLabel: "Updates",
        iconSrc: "/icon-192x192.png",
        title: "Better-Managed Background Work",
        description:
          "Sync and push tasks use bounded concurrency, upstream requests have deadlines, and non-critical analytics and counters finish after the response.",
      },
      {
        id: "instant-loading-shells",
        label: "NEW",
        pageHref: "/cp-rankings",
        pageLabel: "Navigation",
        iconSrc: "/icon-192x192.png",
        title: "Responsive Loading States",
        description:
          "CP Rankings, Contests, and profile routes now show theme-matched page skeletons immediately while fresh server data resolves.",
      },
    ],
  },
  {
    id: "2026-07-18-browser-notifications",
    publishedOn: "2026-07-18",
    headline: "Leaderboard and Contest Alerts",
    summary:
      "CPBoard can now keep you updated with quiet, opt-in browser alerts for a new global leader and contests that are about to begin.",
    highlights: [
      {
        id: "browser-notification-setup",
        label: "NEW",
        pageHref: "/dashboard",
        pageLabel: "Dashboard",
        iconSrc: "/icon-192x192.png",
        title: "Opt-In Browser Notifications",
        description:
          "Enable the current browser, send a test alert, and disconnect it from a notification panel designed to match the Dashboard.",
      },
      {
        id: "leader-change-alerts",
        label: "NEW",
        pageHref: "/leaderboard",
        pageLabel: "Leaderboard",
        iconSrc: "/icon-192x192.png",
        title: "Global Leader Change Alerts",
        description:
          "Get notified when someone takes the #1 spot on the global cross-platform leaderboard without repeated alerts for ordinary score updates.",
      },
      {
        id: "contest-reminder-alerts",
        label: "NEW",
        pageHref: "/contests",
        pageLabel: "Contests",
        iconSrc: "/icon-192x192.png",
        title: "Upcoming Contest Reminders",
        description:
          "Choose an approximate 15, 30, or 60 minute reminder for Codeforces, LeetCode, AtCoder, and CodeChef contests. Alert preferences follow your account, while each browser is enabled separately.",
      },
      {
        id: "installable-notification-shell",
        label: "NEW",
        pageHref: "/dashboard",
        pageLabel: "App",
        iconSrc: "/icon-192x192.png",
        title: "Install-Ready CPBoard",
        description:
          "A themed app icon, web app manifest, and notification worker make CPBoard installable on supported desktop and mobile browsers, including iOS Home Screen apps.",
      },
      {
        id: "notification-delivery-safeguards",
        label: "IMPROVED",
        pageHref: "/dashboard",
        pageLabel: "Notifications",
        iconSrc: "/icon-192x192.png",
        title: "Reliable, Device-Aware Delivery",
        description:
          "Per-device connections, duplicate protection, temporary-failure retries, expired-reminder checks, and automatic cleanup keep alerts timely without becoming noisy.",
      },
      {
        id: "stable-whats-new-release",
        label: "FIXED",
        pageHref: "/changelog",
        pageLabel: "Changelog",
        iconSrc: "/icon-192x192.png",
        title: "Stable What’s New Prompt",
        description:
          "The release prompt now follows the latest published changelog entry, so unrelated deployments no longer make an already-read update appear new again.",
      },
    ],
  },
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
          "Your least-practiced radar topics now surface focused Codeforces and LeetCode practice pages, paired with a suggested Codeforces rating range.",
      },
      {
        id: "weekly-standout",
        label: "NEW",
        pageHref: "/leaderboard",
        pageLabel: "Leaderboard",
        iconSrc: "/favicon.ico",
        title: "Weekly Standout",
        description:
          "The solver with the most accepted or newly solved problems gets a weekly spotlight using verified platform activity refreshed throughout the day.",
      },
      {
        id: "cp-rankings-pagination",
        label: "IMPROVED",
        pageHref: "/cp-rankings",
        pageLabel: "CP Rankings",
        iconSrc: "/favicon.ico",
        title: "CP Rankings Podium and Pagination",
        description:
          "The top three Codeforces users now get a live gold, silver, and bronze podium, while the full rankings load ten users per page with stable global ranks.",
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
          "POTD is paused for now: its navigation entry and page route lead to the contest calendar, while the underlying daily-practice data remains intact for a future return.",
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

  return CURRENT_CHANGELOG.id;
}
