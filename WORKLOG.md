# CPBoard worklog

A running log of in-progress work, so anyone (human or AI) picking this up knows
what was asked, what is done, what is left, and why things were decided.
**Update this file whenever you finish or change a task.**

---

## Current effort: ICPC page, dashboard/profile merge, new logo, UI polish

- **Branch:** `feature/icpc-page-dashboard-merge` (cut from `main` at `728f99b`)
- **Started:** 2026-09-29
- **Owner request (verbatim intent):**
  1. Pull latest changes first.
  2. Add an **ICPC** page next to Leaderboard / CP Rankings / Contests / Dashboard,
     with everything an Indian college student needs to know about ICPC.
  3. **Merge the Dashboard and Profile pages** (they show the same info).
  4. Replace the logo with a better one.
  5. Keep every UI change coherent with the existing look, be consistent
     everywhere, and make subtle polish changes (fonts etc.).
  6. Keep this worklog up to date.

### Status

| # | Task | Status |
|---|------|--------|
| 1 | Pull `main`, branch off | Done |
| 2 | ICPC page (`/icpc`) + nav/footer links + tour + tests | Done |
| 3 | Merge `/profile` + own `/u/[username]` into `/dashboard` | Done — tested against a real local Postgres (see Testing) |
| 4 | New logo (mark + favicon + PWA icons + navbar/footer) | Done |
| 5 | Font + consistency polish (shared page header, card borders, footer, rank colours) | Done |
| 6 | Changelog entry in `src/lib/changelog.ts` for the release | Done |
| 7 | Typecheck, lint, tests, build, browser tests | Done — all pass (43 unit tests + DB-backed browser checks) |
| 8 | Commit + push branch | Done (2026-09-29) — **not merged; not live until merged to `main`** |
| 9 | Open PR | Done — [#54](https://github.com/chinmaydwivedi/cpboard/pull/54); all CI checks pass (build, lint, typecheck, tests, audit, CodeQL) |
| 10 | Merge #54 to `main` (deploys to production) | Not done — waiting for the owner |

### Decisions (and why)

- **Logo:** code brackets `< >` around a 2-1-3 podium with a red "champion" dot.
  Says both "code" and "leaderboard". Source SVG: `src/app/icon.svg` (also copied
  to `public/cpboard-app-icon.svg`). In-app version is `src/components/logo.tsx`
  (uses theme CSS variables). The 16px favicon layer uses a simpler podium-only
  version because the brackets blur at that size. PNGs were rendered with
  `rsvg-convert`; maskable icons keep the mark inside the 72% safe zone.
- **Favicons via file conventions:** `src/app/favicon.ico` (16/32/48),
  `src/app/icon.svg`, `src/app/apple-icon.png`; removed `metadata.icons` from
  the root layout so the files drive the `<link>` tags.
- **Fonts:** body/UI switched from Space Grotesk to **Geist** (crisper at the
  11–13px sizes used everywhere). Kept Instrument Serif (display) and JetBrains
  Mono (numbers). Renamed the mono CSS variable from the misleading
  `--font-geist-mono` to `--font-jetbrains-mono`. To revert the body font,
  swap `Geist` back to `Space_Grotesk` in `src/app/layout.tsx`.
- **Page titles:** new `src/components/page-header.tsx` (mono eyebrow + serif
  italic title + muted description) used on Leaderboard, University board,
  CP Rankings, Contests, ICPC, Changelog, Admin, Daily Practice Admin — matches
  the landing/login/onboarding serif headings. University board container fixed
  from `max-w-6xl px-4` to the standard `max-w-5xl px-5`.
- **Navbar:** logo mark added; ICPC link added; layout changed from absolutely
  centred links to a `1fr auto 1fr` grid so five links cannot overlap the
  account controls at `lg`; link icons show from `xl` up.
- **ICPC page:** all season facts live in `src/lib/icpc.ts` (with sources and a
  `verifiedOn` date). The timeline marks stages Done / Up next / Happening now
  from today's date at request time. Facts verified on 2026-09-29 from
  indiaicpc.in, amritaicpc.in, kanpur.indiaicpc.in and aryanc403's 2026 guide.
  `asiawest.icpc.global` did not resolve, so it is not linked.
- **Dashboard/profile merge:** `/dashboard` is now the one page for *you*. It
  gained everything the profile page had (join date, profile visits, contests
  count, Codeforces rank title, link to each platform profile, support card)
  plus a **Share profile** button that copies `/u/<username>`. `/profile` now
  redirects to `/dashboard`, and visiting your *own* `/u/<username>` redirects
  to `/dashboard` too. `/u/<username>` stays as the read-only public view for
  other people (leaderboard and CP Rankings link to it), so its owner-only
  controls (delete account, remove platform) were removed from
  `profile-client.tsx`. The navbar account menu lost its duplicate "Profile"
  item. Shared pieces moved to `src/lib/site.ts` (`SUPPORT_EMAIL`) and
  `src/lib/platform-styles.ts` (platform card colours); both pages now use the
  existing `getProfileUrl` from `src/lib/parse-handle.ts`.
- **Tours:** added an `icpc` tour, updated the dashboard/public-profile steps,
  and bumped `WALKTHROUGH_VERSION` to `v4` so people see the new steps.
- **Consistency pass:** card/panel borders standardised on `border-border/60`
  (panels also `bg-card/50`); dividers stay `/40`. Logo mark added to the
  sign-in card and onboarding. Headings get `text-wrap: balance`, paragraphs
  `pretty`; primary-tinted text selection; themed scrollbar colour.
- **Codeforces rank colours** (`getCodeforcesRankColor` in `src/lib/scoring.ts`):
  same hues, lifted so each has at least 5:1 contrast on the dark background
  (official Expert blue `#0000ff` was about 2.3:1 and hard to read). Affects
  CP Rankings, the rating chart, dashboard and profiles.
- **Proxy:** `/icon.svg` and `/apple-icon.png` added to the static-path
  exclusions in `src/proxy.ts`.
- **Dropdown labels (pre-existing bug, fixed):** Base UI `Select` shows the raw
  value in the trigger unless the root gets an `items` label map, so the
  leaderboard filter read "all", the reminder picker "30" and the admin picker
  "CODEFORCES". Each `Select` now passes `items`.
- **Page titles:** university board (`<SHORTNAME> Leaderboard`, from the URL
  like public profiles), sign-in (via `src/app/(auth)/login/layout.tsx`, since
  the page is a client component), check-email, onboarding, admin and daily
  practice admin no longer fall back to the generic site title.
- **Vercel previews are off by design:** `vercel.json` has
  `"ignoreCommand": "test \"$VERCEL_ENV\" = \"preview\""`, added on
  2026-07-19, so branch pushes never build a preview. The 11 failed preview
  deployments on GitHub are all from 2026-07-19, before that change (mostly
  Dependabot major-version bumps), and can be ignored. Production deploys from
  `main` succeed (last checked: `728f99b`, 2026-09-25).

### Left to do / follow-ups

- **Merge to go live:** the branch is pushed but not merged. Merging to
  `main` deploys to production (there are no preview deploys, see above).
  After it's live, sign in once and check the dashboard, *Share profile*, and
  that `/profile` lands on `/dashboard`.
- **Not testable locally:** the contest-reminder dropdown is disabled without
  VAPID push keys, so changing it was not exercised (its label was checked).
- **Pre-existing warning (not from this work):** Recharts logs "width(-1) and
  height(-1) of chart should be greater than 0" once on `/cp-rankings` while
  the chart mounts; the chart renders fine.
- **ICPC season upkeep** (`src/lib/icpc.ts`): add Amritapuri's onsite fee when
  published; confirm the Asia West Championship dates/sites on an official
  page; add the World Finals 2027 date/venue once announced; roll the whole
  file over for the 2027–28 season (bump `verifiedOn`).
- **Optional ideas, not requested:** a "preview my public profile" toggle on
  the dashboard (owners can no longer see `/u/<self>`); an ICPC card on the
  landing page features grid; a `sitemap.ts` including `/icpc`.

### Testing (how it was verified, 2026-09-29)

- `npm run typecheck`, `npm run lint`, `npm test` (43 tests, incl.
  `src/lib/__tests__/icpc.test.ts`), `npm run build` — all pass.
- **Real database, no Docker needed:** installed `embedded-postgres` in a
  scratch folder *outside the repo*, started it on port 55432, then
  `DATABASE_URL=postgresql://cpboard:cpboard@127.0.0.1:55432/cpboard npx prisma migrate deploy`
  and `npx tsx prisma/seed.ts`. A fixture script added users, verified
  platform profiles, activity, an admin (`role: ADMIN`), a not-onboarded user,
  and `Session` rows. Auth uses **database sessions**, so a browser is signed
  in by setting the cookie `authjs.session-token=<sessionToken>` (http,
  non-`__Secure-` name in dev).
- Browser checks ran in headless Chrome over the DevTools protocol (trusted
  mouse input for Base UI menus; localStorage seeded to hide the What's New
  modal and tour nudges). Verified: every public page renders without console
  errors or hydration warnings; `/profile` and your own `/u/<you>` redirect to
  `/dashboard`; another user's `/u/<name>` renders read-only and its view
  count increments once per viewer per hour; the account menu shows only
  Dashboard / Sign Out (+ Admin for admins); navbar has no overlap at 1024px
  and no horizontal scroll at 390px; all tour targets exist; favicons, apple
  icon and PWA icons are served; leaderboard university filter works.
- Production mode (`next start`) was also checked with curl: pages, redirects
  (Next streams them as a meta refresh because the root layout suspends),
  icon routes and security headers.

---

## Conventions to follow (read before editing)

- This repo uses **Next.js 16** (see `AGENTS.md`): read
  `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Page shell: `mx-auto max-w-5xl px-5 py-8`.
- Cards: `rounded-lg border border-border/60 p-4`; labels `text-[11px] font-medium
  text-muted-foreground`; numbers `font-mono font-bold`.
- Platform colors: Codeforces blue, LeetCode amber, AtCoder cyan, CodeChef orange.
- Every page section that a tour points at has a `data-tour="..."` attribute, and
  tours live in `src/components/walkthrough/tours.ts`.
- Verify with `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
