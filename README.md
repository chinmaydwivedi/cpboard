# CPBoard — University Competitive Programming Leaderboard

A multi-university competitive programming leaderboard that aggregates profiles from **Codeforces**, **LeetCode**, **AtCoder**, and **CodeChef**. Students verify via their university email, link their CP handles, and compete on unified leaderboards with cross-platform heatmaps and ratings.

## Features

- **Multi-platform tracking** — Link Codeforces, LeetCode, AtCoder, and CodeChef profiles
- **Handle ownership verification** — Five-minute submission challenges protect Codeforces and LeetCode links for accounts created after the rollout; pre-existing accounts remain exempt
- **University leaderboards** — Per-university and global rankings by problems solved and ratings
- **Cross-platform heatmap** — GitHub-style contribution grid aggregating activity across all platforms
- **CP Rankings** — Live Codeforces podium, full-board statistics, rating distribution, and paginated rankings
- **Contest calendar** — Upcoming Codeforces, LeetCode, AtCoder, and CodeChef rounds with local times and calendar export
- **Browser notifications** — Opt-in alerts when the global leader changes and when contests are approaching, with per-account preferences
- **Personalized practice** — Topic-wise Codeforces and LeetCode recommendations based on profile activity
- **Weekly standout** — Cross-platform recognition based on accepted/newly solved activity each week
- **University email verification** — Students sign in with magic links sent to a registered university email domain
- **Multi-university support** — Admin-configurable email domains for any university
- **Scheduled updates** — Provider-isolated lanes run every ten minutes and refresh each healthy profile on a 12-hour eligibility cycle
- **Optimized update pipeline** — Parallel provider lanes, durable leases, bulk activity writes, precise cache invalidation, and deferred telemetry
- **Defense in depth** — CSP, same-origin mutation checks, distributed abuse limits, bounded uploads, isolated job secrets, and automated security gates

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Components) |
| Database | PostgreSQL (Neon serverless) + Prisma ORM |
| Auth | NextAuth.js v5 + patched SMTP mailer (email magic links) |
| UI | Tailwind CSS v4 + shadcn/ui + Framer Motion |
| Charts | Recharts |
| Deployment | Vercel + GitHub Actions schedules |

## Getting Started

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- PostgreSQL database (recommended: [Neon](https://neon.tech) for free serverless Postgres)
- SMTP credentials (Brevo is configured by default) for magic-link emails

### 1. Clone

```bash
git clone <your-repo-url>
cd cpboard
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Unpooled owner connection used only by local or isolated migration tooling; never expose it to the application runtime |
| `AUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `SMTP_USER` | SMTP username for magic-link email |
| `SMTP_PASSWORD` | SMTP password for magic-link email |
| `EMAIL_FROM` | Sender email for magic links |
| `PLATFORM_SYNC_CRON_SECRET` | Random secret used only by the provider refresh job |
| `NOTIFICATION_CRON_SECRET` | Different random secret used only by the notification job |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key used by the browser to subscribe to push alerts |
| `VAPID_PRIVATE_KEY` | Private VAPID key used only by the server to send push alerts |
| `VAPID_SUBJECT` | Contact URI for the push sender, such as `mailto:admin@example.com` |
| `NEXT_PUBLIC_WHATS_NEW_RELEASE` | Optional release-ID override for the What’s New prompt; normally leave blank |

### 3. Install Dependencies

Prisma reads the database URL while its client is generated during install, so
create `.env` first as shown above.

```bash
npm ci
```

### 4. Configure Browser Notifications

Generate a VAPID key pair once for each environment:

```bash
npx web-push generate-vapid-keys
```

Add the generated public and private keys to the matching environment variables above, and set `VAPID_SUBJECT` to a valid `mailto:` or `https:` contact URI. Never expose `VAPID_PRIVATE_KEY` to the browser or commit it to source control.

Notifications are opt-in. Each browser must be enabled separately from the Dashboard, while alert types and contest lead time follow the signed-in account. Contest reminders are checked every ten minutes, so the selected 15, 30, or 60 minute lead time is approximate. Web Push requires HTTPS in production; `localhost` is supported for local development. On iOS, users must add CPBoard to the Home Screen before enabling notifications.

The notification worker retries temporary delivery failures, removes expired browser subscriptions, suppresses duplicate alerts, and ignores contest reminders that arrive after a contest starts. If a contest is rescheduled, its new start time can produce a corrected reminder.

### 5. Set Up Database

```bash
npx prisma migrate deploy
```

### 6. Seed Initial University

To add your university, either use the admin panel or run:

```bash
npx prisma db seed
```

Or manually via Prisma Studio:

```bash
npx prisma studio
```

Add a `University` record with:
- `name`: "PES University"
- `shortName`: "PESU"
- `emailDomain`: "pesu.pes.edu"

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── (auth)/login/               # Email magic link sign-in
│   ├── dashboard/                  # Personal dashboard + profile linking
│   ├── leaderboard/                # Global & per-university leaderboards
│   ├── cp-rankings/                # Codeforces ratings section
│   ├── contests/                   # Cross-platform contest calendar
│   ├── u/[username]/               # Public user profiles
│   ├── admin/                      # University management
│   └── api/                        # Auth, sync, notification, and cron routes
├── components/
│   ├── heatmap.tsx                 # Cross-platform activity heatmap
│   ├── leaderboard-table.tsx       # Sortable leaderboard with animations
│   ├── notification-settings.tsx   # Per-browser push setup and account preferences
│   ├── platform-verification-dialog.tsx # CF/LC ownership challenge flow
│   ├── rating-chart.tsx            # CF rating distribution chart
│   ├── topic-recommendations.tsx   # Personalized topic practice suggestions
│   └── navbar.tsx                  # Top navigation bar
├── lib/
│   ├── platforms/                  # CF, LC, AC, CC API fetchers
│   ├── auth.ts                     # NextAuth configuration
│   ├── cache-tags.ts               # Shared cache invalidation keys
│   ├── codeforces-api.ts            # Shared official-API rate-limit queue
│   ├── platform-verification.ts     # Submission challenge issuance and checks
│   ├── push-notifications.ts       # Push delivery, contest reminders, and leader alerts
│   ├── scoring.ts                  # Leaderboard scoring logic
│   ├── session.ts                  # Request-scoped session deduplication
│   └── prisma.ts                   # Database client
└── types/                          # TypeScript type definitions
```

## Deployment (Vercel)

1. Push to GitHub
2. Import into [Vercel](https://vercel.com)
3. Add the database, auth, SMTP, two cron secrets, and three VAPID variables from `.env.example` to Vercel project settings. Use a least-privilege pooled Neon role for `DATABASE_URL`. Do **not** add `DIRECT_URL` or any owner credential to Vercel
4. Add a Neon PostgreSQL database (or any Postgres)
5. Keep the production build command as `npm run build`
6. Store the owner/unpooled URL only as the `CPBOARD_MIGRATION_DATABASE_URL` secret in the protected GitHub `production` environment. Before promotion, create a Neon restore point and manually run the **Production database migration** workflow; its install step never receives the owner credential
7. Copy `PLATFORM_SYNC_CRON_SECRET` to the Actions secret `CPBOARD_PLATFORM_SYNC_SECRET`, copy `NOTIFICATION_CRON_SECRET` to `CPBOARD_NOTIFICATION_CRON_SECRET`, and set `CPBOARD_PRODUCTION_URL` to the stable production origin without a trailing slash
8. The maintenance workflow starts all four provider lanes in parallel every ten minutes, then runs notifications against the newly refreshed scores. The separate platform workflow is a manual recovery path

The schedule lives in GitHub Actions because this project currently deploys on Vercel Hobby, whose cron jobs cannot run every ten minutes. Codeforces, LeetCode, AtCoder, and CodeChef use independent Vercel invocations and database job leases, so a slow lane cannot block the others. Each successful profile becomes eligible again after 12 hours; failures use bounded backoff. The workflow then refreshes contests, sends due reminders, and checks for a new global leader. Aggregate health checks fail visibly when a provider lane is unhealthy.

`vercel.json` pins server functions to Singapore (`sin1`) to match the current Neon `ap-southeast-1` database. Change both together if the database moves regions.

Preview deployments are intentionally skipped because this project does not yet have an isolated preview database. Do not attach production database credentials to preview branches; create a separate Neon branch and least-privilege preview role before enabling Vercel previews.

After deployment, sign in on an HTTPS browser, enable notifications from the Dashboard, and use **Send test** to verify the complete production delivery path. Browser permission and subscriptions are device-specific; alert-type preferences belong to the signed-in account.

## Update and Performance Model

- User-triggered platform syncs always request fresh upstream data and apply activity history in one database transaction.
- “Sync all” uses bounded concurrency plus database-backed per-profile leases, so parallel clicks and serverless instances cannot create an uncontrolled request burst.
- Landing stats, global rankings, CP rankings, and topic radar results use explicit caches. Successful syncs invalidate only the affected data, while cron refreshes use stale-while-revalidate behavior.
- Slow upstream requests have deadlines so one provider cannot hold an entire sync or scheduled invocation open indefinitely.
- Analytics, profile-view counters, tours, and large chart libraries stay outside the critical response or initial JavaScript path where possible.
- Codeforces work uses both a bounded in-process queue and a Neon-backed request lease. Sync, verification, POTD, and recommendation requests therefore respect the provider spacing across serverless instances.
- Failed scheduled syncs receive exponential backoff, while successful profiles rotate on a 12-hour eligibility window so one broken handle cannot starve the rest of the queue.
- Lease tokens fence every provider write: a disconnected or replaced handle cannot be overwritten when an older network response arrives late.
- AtCoder and Codeforces requests use shared Neon-backed pacing, so independent serverless instances still respect upstream limits.

## Security Model

- API mutations reject cross-site browser requests, API responses are non-cacheable, and production pages send an enforced CSP plus HSTS, frame, MIME, referrer, permissions, opener, and resource-policy headers.
- Magic-link and domain checks use atomic Neon-backed per-IP and per-address limits. University domains are exact matches; explicitly trusted aliases live in `UniversityEmailDomain`.
- Cron routes accept POST only, use separate secrets, compare credentials in constant time, and expose aggregate results without user IDs or raw provider errors.
- Avatar data is restricted to validated PNG, JPEG, or WebP images up to 64KB and safe dimensions. External verification work has deadlines, replay checks, cooldowns, and bounded provider reads.
- Push delivery revalidates every stored endpoint against known browser push services before making a request, and housekeeping removes unsafe legacy rows plus expired operational data. The same job continuously asserts that the runtime Neon role is not an owner and has no object-creation privileges.
- Shared POTD author relations use `SET NULL`, so ordinary account deletion preserves community content. Admin accounts must be reassigned before deletion.
- `.github/workflows/security.yml` performs locked installs, dependency-tree and high-severity audit checks, Prisma validation, lint, type checking, and a production build. Its separate daily passive probe verifies production headers and API boundaries; Dependabot and the private disclosure policy in `SECURITY.md` complete the maintenance loop.
- No application can be guaranteed immune to every attack. Rotate exposed credentials immediately, keep Neon owner credentials out of runtime functions, review security alerts, and restore-test backups regularly.

## Handle Ownership Verification

- New CPBoard accounts linking or changing a **Codeforces** handle receive a random beginner problem. The user submits intentionally non-compiling code, and CPBoard checks for a new public `COMPILATION_ERROR` submission during the five-minute window.
- New CPBoard accounts linking or changing a **LeetCode** handle receive a beginner-friendly free problem. The user solves or resubmits it, and CPBoard checks for a new public Accepted submission during the same window.
- Challenges record the recent submission IDs present at the start, so an older solve cannot be replayed. Pending candidates stay outside `PlatformProfile`, rankings, heatmaps, and public profiles until verification succeeds.
- Concurrent checks for the same unclaimed handle receive different problems, so another user cannot reserve the handle and block its real owner. The first valid proof claims it atomically.
- CPBoard checks only public submission metadata: account handle, submission ID, assigned problem, verdict, and timestamp. It does not fetch or store source code.
- Every account registered before this rollout is marked exempt and keeps direct Codeforces/LeetCode link and sync actions. Accounts created afterward must pass the challenge before a protected link enters public rankings, heatmaps, recommendations, POTD checks, or background syncs.

## Platform APIs Used

| Platform | API | Rate Limit |
|----------|-----|-----------|
| Codeforces | [Official API](https://codeforces.com/apiHelp) — `user.info`, `user.status`, `user.rating` | 1 req/2s |
| LeetCode | GraphQL at `leetcode.com/graphql` — `matchedUser`, `recentAcSubmissionList`, `userContestRanking`, `userCalendar` | Undocumented; requests use deadlines and user-triggered checks |
| AtCoder | [Kenkoooo API](https://github.com/kenkoooo/AtCoderProblems) — `v3/user/ac_rank` plus retained `v3/user/submissions` activity | Shared pacing of at least 1.1s between requests |
| CodeChef | [CP Rating API](https://cp-rating-api.vercel.app) — `/codechef/{username}` | Generous |

## License

MIT
