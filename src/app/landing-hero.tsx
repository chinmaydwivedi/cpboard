"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/animated-counter";
import { Link2, Trophy, BarChart3, Zap, ArrowRight } from "lucide-react";

const features = [
  {
    title: "Multi-Platform Tracking",
    description: "Link your Codeforces, LeetCode, AtCoder, and CodeChef profiles in one place.",
    icon: Link2,
  },
  {
    title: "University Leaderboards",
    description: "Compete with peers. See who's solving the most across your university.",
    icon: Trophy,
  },
  {
    title: "Activity Heatmaps",
    description: "Visualize your coding consistency with cross-platform contribution grids.",
    icon: BarChart3,
  },
  {
    title: "CP Rankings",
    description: "Paginated Codeforces ratings with full-board statistics and rank distribution.",
    icon: Zap,
  },
];

export function LandingHero({
  stats,
  isLoggedIn,
}: {
  stats: { users: number; universities: number; profiles: number; totalSolved: number };
  isLoggedIn: boolean;
}) {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 dark:opacity-40"
          style={{ backgroundImage: "url(/bg/hero-red.png)" }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-background/60 via-background/80 to-background dark:from-background/40 dark:via-background/70 dark:to-background" />

        <div className="relative mx-auto max-w-5xl px-5 pt-24 sm:pt-32 pb-20 text-center">
          <motion.div
            data-tour="home-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">
              Open for all universities
            </p>

            <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl italic tracking-tight leading-[1.05]">
              Your university&apos;s
              <br />
              competitive programming
              <br />
              <span className="text-primary">leaderboard.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground leading-relaxed">
              Track progress across Codeforces, LeetCode, AtCoder and CodeChef.
              Compete with peers. Rise through the ranks.
            </p>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href={isLoggedIn ? "/leaderboard" : "/login"}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/leaderboard"
                className="rounded-lg border border-border/60 px-5 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
              >
                View Leaderboard
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mx-auto mt-20 max-w-lg grid grid-cols-4 gap-6"
            data-tour="home-stats"
          >
            {[
              { label: "Users", value: stats.users },
              { label: "Universities", value: stats.universities },
              { label: "Profiles", value: stats.profiles },
              { label: "Solved", value: stats.totalSolved },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <AnimatedCounter
                  value={stat.value}
                  className="block text-2xl font-bold font-mono text-foreground"
                />
                <p className="mt-1 text-[11px] text-muted-foreground font-medium">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-tour="home-features">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.06 }}
                className="rounded-lg border border-border/40 p-5 hover:border-primary/30 transition-colors"
              >
                <Icon className="h-5 w-5 text-primary mb-3" strokeWidth={1.5} />
                <h3 className="font-semibold text-sm">{feature.title}</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-25"
          style={{ backgroundImage: "url(/bg/hero-mono.png)" }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-background via-background/70 to-background dark:from-background dark:via-background/60 dark:to-background" />
        <div className="relative mx-auto max-w-5xl px-5 py-20">
          <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm p-10 text-center" data-tour="home-cta">
            <h2 className="font-heading text-2xl italic">Ready to compete?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLoggedIn
                ? "Jump to your dashboard to track progress and sync your latest stats."
                : "Sign in with your university email to join the leaderboard."}
            </p>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isLoggedIn ? "Go to Dashboard" : "Join Now"} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
