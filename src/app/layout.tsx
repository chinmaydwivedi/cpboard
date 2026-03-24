import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let navUser: { name?: string | null; username?: string } | null = null;

  try {
    const session = await auth();
    if (session?.user?.email) {
      noStore();
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { name: true, username: true },
      });
      navUser = dbUser;
    }
  } catch {
    // auth not configured yet
  }

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <Navbar user={navUser} />
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
