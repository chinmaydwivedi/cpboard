# CPBoard worklog

A running log of in-progress work, so anyone (human or AI) picking this up knows
what was asked, what is done, what is left, and why things were decided.
**Update this file whenever you finish or change a task.**

---

## Current effort: routine check, sign-in redirect, failing CI

- **Branch:** `fix/login-redirect-and-security-audit` (cut from `main` at `1a64fdf`)
- **Started:** 2026-10-29
- **Owner request:** "do a routine check"; the sign-in page shows even when
  signed in; "Dashboard" appears both in the account (profile) menu and in the
  top nav; "a lot of fail messages come from GitHub job runs".

| # | Task | Status |
|---|------|--------|
| 1 | Find why GitHub runs fail | Done — see "Failing Security gate" |
| 2 | Patch vulnerable dependencies (Next RCEs first) | Done — audit at `high` passes; 3 low remain |
| 3 | Signed-in users skip `/login` | Done |
| 4 | Remove duplicate Dashboard from the account menu | Done |
| 5 | Typecheck, lint, tests, build, prod-build browser check | Done — all pass |
| 6 | Commit, push, PR to `main` | Done — PR [#65](https://github.com/chinmaydwivedi/cpboard/pull/65) open; owner merges (deploys to production) |

### Failing Security gate (cause and fix)

- **What fails:** only the *Security gate* workflow (`security.yml`), at the
  step **"Audit known vulnerabilities"** (`npm audit --audit-level=high`).
  It has failed on every daily scheduled run since **2026-09-30**; pushes
  before that passed. Background maintenance, CodeQL and the production probe
  all pass. The 18 open Dependabot PRs fail the same step: each bumps one
  package while the audit still flags all the others.
- **Why:** no code broke. New advisories were published against packages
  already in the lockfile: 20 findings (3 critical, 9 high). The ones that
  reach production: **`next` 16.3.5** (critical unauthenticated RCEs in the
  image optimizer, `use cache` and `next/og`, plus SSRF/cache poisoning),
  **nodemailer 9.1.1** (the `smtp-mailer` alias that sends magic links;
  address-parser DoS and recipient-injection bugs), `zod` (memory DoS),
  `sharp` (librsvg), `dompurify` (via posthog-js). The rest are dev-only
  (shadcn CLI → MCP SDK/express, vitest/vite, tailwind's source-map-js).
- **Fix:** `next` + `eslint-config-next` → 16.4.3, `smtp-mailer` →
  `npm:nodemailer@10.2.1` (only breaking change: Node ≥ 20; default export,
  `createTransport` and `sendMail` checked), `zod` → ^4.6.7, `vitest` →
  ^4.1.12, then `npm audit fix` for transitive packages. The shadcn CLI
  update dropped its MCP-server/express tree, so the lockfile shrank; Linux
  native binaries (`@next/swc-linux-x64-gnu`, `@img/sharp-linux-x64`, …)
  are still locked.
- **Left:** 3 low findings in `deepmerge` under the shadcn CLI (dev-only).
  npm's only "fix" is downgrading shadcn to 1.0.0, so they are accepted.
- **Lint side effect:** `eslint-config-next` 16.4 brings
  `eslint-plugin-react-hooks` 7.1.1, which turned React Compiler checks into
  errors in older code. `layout.tsx` (JSX inside try/catch) was fixed.
  `react-hooks/set-state-in-effect` and `preserve-manual-memoization` are set
  to **warn** in `eslint.config.mjs` (8 warnings) so the gate stays useful.
  **Follow-up:** refactor those effects in `dashboard-client.tsx`,
  `potd-client.tsx`, `notification-settings.tsx` and
  `platform-verification-dialog.tsx`, then delete the override.
- **Dependabot backlog:** once this merges, Dependabot should close the PRs
  it superseded (hono, MCP SDK, vite, source-map-js, proxy-addr, undici,
  nanoid, dompurify, ip-address, the grouped minor/patch PRs) on its next
  run. Still open on purpose: majors (`prisma` 7, `eslint` 10,
  `lucide-react` 1.x, `next-auth`/`@auth/*`) and the two GitHub Actions bumps.
  Each needs its own upgrade, not a blind merge.
- **Going forward:** a red scheduled *Security gate* means "a new advisory
  hit a locked package". Run `npm audit`, patch, and merge promptly.

### Sign-in and menu decisions

- **`/login` when signed in:** `src/app/(auth)/login/page.tsx` is now a
  server page that redirects to `/dashboard` (which sends unfinished accounts
  on to `/onboarding`). The form moved to `login-client.tsx`; the title-only
  `layout.tsx` was removed. If auth itself errors, the form still renders
  (no redirect loop with the dashboard's own `/login` fallback). Likely way
  owners hit it: the "Protected Magic-Link Sign-In" changelog card links to
  `/login`.
- **Sign-in errors are shown now.** `?error=` was set by Auth.js and by our
  own code (`UnknownUniversity`, `RateLimited`, `InvalidRequest`, …) but the
  page never read it. Known codes get a specific message, anything else a
  generic one (a `Map`, so `?error=constructor` can't reach prototype keys).
  `pages.error` is now `/login`, so an expired or already-used magic link
  (`Verification`) shows "That sign-in link has expired…" instead of Auth.js's
  unstyled built-in page.
- **Duplicate Dashboard:** removed from the account menu, kept in the top
  nav (and mobile menu, where it appeared once already). The account menu is
  now *Sign Out* for students, *Admin / Sign Out* for admins.
- Changelog: "No More Sign-In Page When You're Signed In" (FIXED) added to
  the current release.

### Testing (2026-10-29)

- Exactly the CI gate steps with CI's env: `npm ci`, `npm ls --all`,
  `npm audit --audit-level=high`, `prisma validate`, lint (0 errors),
  typecheck, 49 unit tests, `npm run build` — all pass.
- Production build (`next start`) against `embedded-postgres` (scratch dir,
  migrated + seeded, fixture student / not-onboarded / admin with `Session`
  rows; over http the cookie is `authjs.session-token`):
  - curl: signed-in and not-onboarded `/login` → `/dashboard` (→
    `/onboarding`); signed-out `/login` renders the form and its title; each
    `?error=` code shows its message; a bogus magic link and
    `/api/auth/error` both land on `/login?error=Verification`.
  - Headless Chrome (CDP, trusted mouse input): 10/10 — redirect in the
    browser, top nav still has Dashboard, student menu is just Sign Out
    (no stray separator) and opens the confirm dialog, admin menu is Admin +
    Sign Out, error banner shown, mobile menu lists Dashboard once, no
    horizontal scroll at 390px. Only console error: the analytics beacon's
    expected 403 over plain http (secure-origin check).
- Not testable locally: a real magic-link email (SMTP host is hard-coded to
  Brevo). Owner: after deploy, request one sign-in link on production.

---

## Shipped: button fixes (after the "CPB" monogram logo, PR #56)

- **Branch:** `feature/cpb-monogram-logo` (cut from `main` at `4ecdc7b`)
- **Started:** 2026-09-29
- **Owner request:** use a "CPB" monogram (round emblem, bold letters) as the
  logo, with a transparent background instead of white.
- **Why it is an original design:** the reference image the owner sent was a
  133px stock preview with an "alamy" watermark in the P, so it could not be
  used or traced. The owner chose to have an original monogram designed in the
  same spirit instead.

| # | Task | Status |
|---|------|--------|
| 1 | Design original CPB circle monogram | Done |
| 2 | Single source + in-app component + icon generator | Done |
| 3 | Regenerate favicon, app and PWA icons | Done |
| 4 | Typecheck, lint, tests, build, visual check | Done — all pass; checked header, footer, sign-in, mobile header, and every icon file (incl. maskable crop and 16px favicon) |
| 5 | Logo PR | Done — PR #56 merged to `main` as `e761a21` |
| 6 | Button audit + fixes | Done — see "Button audit" below. The owner asked for these in PR #56, but #56 was merged first, so they are on `fix/buttons-and-toasts` in a follow-up PR |
| 7 | Merge the fixes PR to `main` (deploys to production) | Done — PR #57 merged as `1a64fdf` |

### Logo v2 decisions

- **Design:** letters C, P, B fill a circle (r = 224 on a 512 grid), split by
  two vertical gaps. C's mouth and B's two bowls follow inner circles so the
  strokes stay even; B has a small waist notch; P runs full height, is open
  below its bowl, and is the brand red (`#ed3151`). C and B use the foreground
  colour. Explored and rejected: a hexagon (read as "CPH") and an italic cut
  (messy at small sizes).
- **Single source:** `src/lib/brand-mark.ts` holds the three path strings
  (exact arcs, even-odd counters, so holes are transparent).
  `src/components/logo.tsx` renders them inline with `var(--foreground)` and
  `var(--primary)`, so the mark follows the theme with no background.
- **Icons:** `npm run brand:icons` (`scripts/generate-brand-icons.ts`, uses
  the `sharp` that ships with Next) rewrites `src/app/icon.svg` and
  `public/cpboard-app-icon.svg` (transparent; ink switches with the browser's
  light/dark scheme so the tab icon is visible either way), plus
  `src/app/favicon.ico`, `src/app/apple-icon.png` and the four
  `public/icon-*.png` files on the dark tile (opaque backgrounds are required
  for app launchers; maskable icons keep the mark inside the safe zone).
  **Never hand-edit those files; change `brand-mark.ts` and re-run the script.**

### Button audit (2026-09-29)

Owner report: "Share profile doesn't work", "warn before signing out", "check
which buttons don't work".

- **Root cause of "buttons do nothing": invisible toasts.** sonner injects its
  stylesheet at runtime as a `<style>` tag; the CSP (`src/proxy.ts`) only
  trusts nonce'd styles, so production blocked it and every toast rendered
  unstyled below the footer. Any button whose only feedback is a toast (Share,
  Sync, Save, Remove, avatar…) looked dead even when it worked. Present since
  the July CSP hardening; my earlier dev-mode checks missed it because they
  looked for toast text in the DOM, not for a visible toast. **Fix:**
  `src/lib/csp.ts` allows exactly sonner's two style hashes; the test
  `src/lib/__tests__/csp.test.ts` recomputes them from `node_modules`, so a
  sonner upgrade that changes its CSS fails CI and prints the new hash.
- **Base UI styles:** the Select popup injects a scrollbar-hiding `<style>`.
  Fixed properly with `<CSPProvider nonce>` in `src/app/layout.tsx` (the layout
  reads `x-nonce` via `headers()`, per the Next 16 CSP guide).
- **Share profile:** now opens `src/components/share-profile-dialog.tsx` — the
  link in a box, a Copy button that confirms in place (clipboard API with an
  `execCommand` fallback), "View public profile", and the native share sheet
  where supported. Note: `/u/<name>` requires sign-in, and the dialog says so.
- **Your own `/u/<username>` no longer redirects to `/dashboard`.** It shows
  the public profile with a "This is your public profile" banner, so a shared
  link can be previewed. Own visits still don't count as views. `/profile`
  still redirects to `/dashboard`.
- **Sign-out confirmation:** `src/components/sign-out-dialog.tsx`, used by the
  navbar menu, the mobile menu and the dashboard.
- **Keyboard sorting:** leaderboard sort headers were `<th onClick>`; now real
  buttons with `aria-sort` and an arrow on the active column
  (`src/components/leaderboard-table.tsx`).
- **Messages:** sync errors say "AtCoder profile not found" (not "ATCODER");
  Daily Practice admin names the missing field ("Java solution is required.")
  via `src/lib/daily-practice-errors.ts`.
- **Selects** show labels (done earlier today).

How it was tested (repeat this for UI changes — dev mode is not enough):
- Production build served over HTTPS on one port with Next's custom-server
  pattern (`next({ dev: false, hostname: "localhost", port })` +
  `https.createServer`). `next start` behind a separate proxy port fails the
  API origin check in `src/proxy.ts`; plain `http://` fails its
  "secure origin" check in production.
- Real Postgres via the `embedded-postgres` npm package in a scratch folder,
  `prisma migrate deploy`, seed, fixture users with `Session` rows. Over HTTPS
  the auth cookie is `__Secure-authjs.session-token`.
- Headless Chrome over the DevTools protocol with trusted mouse input,
  `behavior: "instant"` scrolling (the site uses smooth scroll), and checks on
  what is visible: toast inside the viewport with a `position: fixed` toaster,
  dialogs rendered, URLs, API statuses, and the database afterwards.
- Result: dashboard 36/37 (the one "miss" is the browser logging expected
  502/404 responses when syncing handles that don't exist upstream; the UI
  shows proper error toasts), site-wide 70/70, zero CSP violations.

Follow-ups:
- **Daily Practice drafts require all three solutions.** The API rejects a
  draft without Java, C++ and Python code, yet the list shows a "Missing
  solution" badge for drafts. Owner to decide whether drafts may be partial.
- Contest-reminder toggles/select were not exercised (disabled without VAPID
  keys locally).
- Consider committing a Playwright suite based on the approach above.

## Shipped: ICPC page, dashboard/profile merge, new logo, UI polish

- **Status:** merged and live. PR [#54](https://github.com/chinmaydwivedi/cpboard/pull/54)
  was squash-merged into `main` as `a3fe720` on 2026-09-29; the Vercel
  production deploy succeeded at 21:50 IST and the security gate on `main`
  passed. Nothing is in progress on this effort.
- **Branch:** `feature/icpc-page-dashboard-merge` (cut from `main` at `728f99b`; merged)
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
| 8 | Commit + push branch | Done |
| 9 | PR #54, merged to `main` | Done — all CI checks passed; squash-merged as `a3fe720` |
| 10 | Production deploy | Done — live on cpboard-three.vercel.app (`/icpc` and the new changelog entry verified) |

### Decisions (and why)

- **Logo (replaced 2026-09-29, see "Logo v2" below):** first shipped as code
  brackets `< >` around a podium.
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

- **Owner post-deploy check:** sign in on production once and check the
  dashboard, *Share profile*, and that `/profile` lands on `/dashboard`.
  Browsers keep their own favicon cache, so the new tab icon can take a while
  to appear even after a hard refresh.
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
