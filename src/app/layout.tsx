import type { Metadata } from "next";
import { Suspense } from "react";
import { Space_Grotesk, JetBrains_Mono, Instrument_Serif } from "next/font/google";
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
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CPBoard — University Competitive Programming Leaderboard",
  description:
    "Track your competitive programming progress across Codeforces, LeetCode, AtCoder, and CodeChef. Compete on your university's leaderboard.",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    title: "CPBoard",
    statusBarStyle: "black-translucent",
  },
};

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeReleaseId = getActiveReleaseId();

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <Suspense fallback={<HeaderFallback />}>
              <UserAwareHeader />
            </Suspense>
            <WhatsNewModal releaseId={activeReleaseId} />
            <WalkthroughHost />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border/40 py-6 mt-12">
              <div className="mx-auto max-w-5xl px-5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-medium">CPBoard</span>
                <span>&copy; {new Date().getFullYear()}</span>
              </div>
            </footer>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
