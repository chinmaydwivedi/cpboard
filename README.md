# CPBoard — University Competitive Programming Leaderboard

A multi-university competitive programming leaderboard that aggregates profiles from **Codeforces**, **LeetCode**, **AtCoder**, and **CodeChef**. Students verify via their university email, link their CP handles, and compete on unified leaderboards with cross-platform heatmaps and ratings.

## Features

- **Multi-platform tracking** — Link Codeforces, LeetCode, AtCoder, and CodeChef profiles
- **University leaderboards** — Per-university and global rankings by problems solved and ratings
- **Cross-platform heatmap** — GitHub-style contribution grid aggregating activity across all platforms
- **CP Rankings** — Live Codeforces podium, full-board statistics, rating distribution, and paginated rankings
- **Contest calendar** — Upcoming Codeforces, LeetCode, AtCoder, and CodeChef rounds with local times and calendar export
- **Personalized practice** — Topic-wise Codeforces and LeetCode recommendations based on profile activity
- **Weekly standout** — Cross-platform recognition for the most active solver each week
- **University email verification** — Students sign in with magic links to their `.edu` email
- **Multi-university support** — Admin-configurable email domains for any university
- **Auto-sync** — Cron jobs refresh verified platform profiles twice daily

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Components) |
| Database | PostgreSQL (Neon serverless) + Prisma ORM |
| Auth | NextAuth.js v5 + Resend (email magic links) |
| UI | Tailwind CSS v4 + shadcn/ui + Framer Motion |
| Charts | Recharts |
| Deployment | Vercel (with Cron Jobs) |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (recommended: [Neon](https://neon.tech) for free serverless Postgres)
- [Resend](https://resend.com) account (for sending magic link emails)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd "UNIVERSITY LEADERBOARD"
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `AUTH_RESEND_KEY` | Your Resend API key |
| `EMAIL_FROM` | Sender email for magic links |
| `CRON_SECRET` | Secret for cron job auth |

### 3. Set Up Database

```bash
npx prisma migrate dev --name init
```

### 4. Seed Initial University

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

### 5. Run Development Server

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
│   └── api/                        # Auth, sync, cron routes
├── components/
│   ├── heatmap.tsx                 # Cross-platform activity heatmap
│   ├── leaderboard-table.tsx       # Sortable leaderboard with animations
│   ├── rating-chart.tsx            # CF rating distribution chart
│   ├── topic-recommendations.tsx   # Personalized topic practice suggestions
│   └── navbar.tsx                  # Top navigation bar
├── lib/
│   ├── platforms/                  # CF, LC, AC, CC API fetchers
│   ├── auth.ts                     # NextAuth configuration
│   ├── scoring.ts                  # Leaderboard scoring logic
│   └── prisma.ts                   # Database client
└── types/                          # TypeScript type definitions
```

## Deployment (Vercel)

1. Push to GitHub
2. Import into [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings
4. Add a Neon PostgreSQL database (or any Postgres)
5. Run `npx prisma migrate deploy` in the build command
6. The cron job (`/api/cron/sync-all`) runs twice daily automatically via `vercel.json`

## Platform APIs Used

| Platform | API | Rate Limit |
|----------|-----|-----------|
| Codeforces | [Official API](https://codeforces.com/apiHelp) — `user.info`, `user.status`, `user.rating` | 1 req/2s |
| LeetCode | GraphQL at `leetcode.com/graphql` — `matchedUser`, `userContestRanking`, `userCalendar` | ~2 req/s |
| AtCoder | [Kenkoooo API](https://github.com/kenkoooo/AtCoderProblems) — `v3/user/submissions` | 1 req/s |
| CodeChef | [CP Rating API](https://cp-rating-api.vercel.app) — `/codechef/{username}` | Generous |

## License

MIT
