import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { CSPProvider } from "@base-ui/react/csp-provider";
import { Geist, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { isAllowlistedAdminEmail, isPotdAdminEmail } from "@/lib/admin";
import { getActiveReleaseId } from "@/lib/changelog";
import { getCurrentSession } from "@/lib/session";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { WhatsNewModal } from "@/components/whats-new";
import { Toaster } from "@/components/ui/sonner";
import { WalkthroughHost } from "@/components/walkthrough/walkthrough-host";
import { Logo } from "@/components/logo";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CPBoard — University Competitive Programming Leaderboard",
    template: "%s — CPBoard",
  },
  description:
    "Track your competitive programming progress across Codeforces, LeetCode, AtCoder, and CodeChef. Compete on your university's leaderboard.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CPBoard",
    statusBarStyle: "black-translucent",
  },
};

const FOOTER_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/cp-rankings", label: "CP Rankings" },
  { href: "/contests", label: "Contests" },
  { href: "/icpc", label: "ICPC" },
  { href: "/changelog", label: "Changelog" },
];

async function UserAwareHeader() {
  try {
    const session = await getCurrentSession();
    if (session?.user?.email && session.user.id) {
      const isAdmin =
        session.role === "ADMIN" || isAllowlistedAdminEmail(session.user.email);
      const navUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        username: session.username,
        isAdmin,
        isPotdAdmin: !isAdmin && isPotdAdminEmail(session.user.email),
      };
      return (
        <>
          <Navbar user={navUser} />
          <AnalyticsTracker
            user={{
              id: navUser.id,
            }}
          />
        </>
      );
    }
  } catch {
    // auth not configured yet
  }

  return (
    <>
      <Navbar user={null} />
      <AnalyticsTracker user={null} />
    </>
  );
}

function HeaderFallback() {
  return <Navbar user={null} />;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeReleaseId = getActiveReleaseId();
  // Base UI injects small <style> tags (e.g. hidden scrollbars in select lists);
  // the per-request nonce from src/proxy.ts lets the CSP allow them.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${geist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <CSPProvider nonce={nonce}>
          <ThemeProvider>
            <TooltipProvider>
              <Suspense fallback={<HeaderFallback />}>
                <UserAwareHeader />
              </Suspense>
              <WhatsNewModal releaseId={activeReleaseId} />
              <WalkthroughHost />
              <main className="flex-1">{children}</main>
              <footer className="mt-12 border-t border-border/40 py-8">
                <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 sm:flex-row sm:items-center sm:justify-between">
                  <Link href="/" aria-label="CPBoard home" className="w-fit opacity-90 transition-opacity hover:opacity-100">
                    <Logo markClassName="size-6" />
                  </Link>
                  <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
                    {FOOTER_LINKS.map((link) => (
                      <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    &copy; {new Date().getFullYear()} CPBoard
                  </span>
                </div>
              </footer>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </CSPProvider>
      </body>
    </html>
  );
}
