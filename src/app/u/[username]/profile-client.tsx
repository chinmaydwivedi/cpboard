"use client";

import NextImage from "next/image";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Heatmap } from "@/components/heatmap";
import { PlatformBadge } from "@/components/platform-badge";
import { getProfileUrl } from "@/lib/parse-handle";
import { PLATFORM_CARD_CLASS } from "@/lib/platform-styles";
import { getCodeforcesRankColor, getCodeforcesRankTitle } from "@/lib/scoring";
import type { HeatmapData } from "@/types";
import type { Platform } from "@prisma/client";
import { ExternalLink, Mail } from "lucide-react";

type ProfileProps = {
  user: {
    username: string;
    name: string | null;
    avatarUrl: string | null;
    university: { name: string; shortName: string };
    createdAt: string;
  };
  profiles: {
    platform: Platform;
    handle: string;
    rating: number;
    maxRating: number;
    problemsSolved: number;
    rank: string | null;
    contestsCount: number;
  }[];
  heatmapData: HeatmapData;
  totalSolved: number;
  profileVisits: number;
  todayIso: string;
  supportEmail: string;
};

/** Public, read-only profile. Owners are redirected to /dashboard instead. */
export function ProfileClient({
  user,
  profiles,
  heatmapData,
  totalSolved,
  profileVisits,
  todayIso,
  supportEmail,
}: ProfileProps) {
  const leetcodeProfile = profiles.find((p) => p.platform === "LEETCODE");
  const leetcodeRating = leetcodeProfile?.rating || leetcodeProfile?.maxRating || 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-3 sm:gap-4"
        data-tour="profile-header"
      >
        <div className="relative h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0 overflow-hidden">
          {user.avatarUrl ? (
            <NextImage
              src={user.avatarUrl}
              alt={user.name || user.username}
              fill
              sizes="64px"
              unoptimized
              className="object-cover"
            />
          ) : (
            (user.name || user.username)[0].toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <h1 className="wrap-break-word font-heading text-3xl leading-tight tracking-tight italic">
            {user.name || user.username}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>@{user.username}</span>
            <Badge variant="outline" className="font-mono text-[10px]">{user.university.shortName}</Badge>
            <span className="text-[11px]">
              Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
            </span>
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-[11px] text-muted-foreground font-medium">Problems Solved</p>
          <p className="text-2xl font-bold font-mono text-primary mt-1">{totalSolved}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-[11px] text-muted-foreground font-medium">LC Rating</p>
          <p className="text-2xl font-bold font-mono mt-1">
            {leetcodeRating > 0 ? <span style={{ color: getCodeforcesRankColor(leetcodeRating) }}>{leetcodeRating}</span> : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-[11px] text-muted-foreground font-medium">Profile Visits</p>
          <p className="text-2xl font-bold font-mono mt-1">{profileVisits}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-[11px] text-muted-foreground font-medium">
            Platforms <span className="font-mono">{profiles.length}/4</span>
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profiles.map((p) => (
              <PlatformBadge key={p.platform} platform={p.platform} />
            ))}
            {profiles.length === 0 && <span className="text-sm text-muted-foreground">None linked</span>}
          </div>
        </div>
      </div>

      <div className="mb-6" data-tour="profile-heatmap">
        <Heatmap data={heatmapData} todayIso={todayIso} />
      </div>

      <p className="text-[11px] text-muted-foreground font-medium mb-3">Platforms</p>
      <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch mb-6" data-tour="profile-platforms">
        {profiles.map((profile) => (
          <motion.div
            key={profile.platform}
            className="h-full min-h-0"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={`flex h-full flex-col rounded-lg border p-4 ${PLATFORM_CARD_CLASS[profile.platform]}`}>
              <div className="flex items-center justify-between shrink-0 mb-3">
                <PlatformBadge platform={profile.platform} />
                <a
                  href={getProfileUrl(profile.platform, profile.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="truncate">@{profile.handle}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <div className="grid grid-cols-4 gap-3 flex-1 content-start">
                <div>
                  <p className="text-[10px] text-muted-foreground">Solved</p>
                  <p className="text-sm font-mono font-bold">{profile.problemsSolved}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Rating</p>
                  <p className="text-sm font-mono font-bold">
                    {profile.rating > 0 ? (
                      <span style={{ color: profile.platform === "CODEFORCES" ? getCodeforcesRankColor(profile.rating) : undefined }}>
                        {profile.rating}
                      </span>
                    ) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Max</p>
                  <p className="text-sm font-mono font-bold">{profile.maxRating > 0 ? profile.maxRating : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Contests</p>
                  <p className="text-sm font-mono font-bold">{profile.contestsCount}</p>
                </div>
              </div>
              {profile.platform === "CODEFORCES" && profile.rating > 0 && (
                <div className="mt-3 border-t border-border/30 pt-3">
                  <span className="text-xs font-medium" style={{ color: getCodeforcesRankColor(profile.rating) }}>
                    {getCodeforcesRankTitle(profile.rating)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {profiles.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground sm:col-span-2">
            No verified platforms yet.
          </div>
        )}
      </div>

      <a
        href={`mailto:${supportEmail}?subject=CPBoard%20Profile%20Review%20(%40${user.username})`}
        className="group flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-secondary/30"
        data-tour="profile-support"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Mail className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Something wrong with this profile?</span>
          <span className="block text-xs text-muted-foreground">
            Email {supportEmail} to request a profile review.
          </span>
        </span>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </a>
    </div>
  );
}
