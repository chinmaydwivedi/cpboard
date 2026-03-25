"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heatmap } from "@/components/heatmap";
import { PlatformBadge } from "@/components/platform-badge";
import { getCodeforcesRankColor, getCodeforcesRankTitle } from "@/lib/scoring";
import { PLATFORM_LABELS } from "@/types";
import type { HeatmapData } from "@/types";
import type { Platform } from "@prisma/client";
import { ExternalLink, AlertTriangle, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  todayIso: string;
  supportEmail: string;
  isOwner: boolean;
};

const platformLinks: Record<Platform, (handle: string) => string> = {
  CODEFORCES: (h) => `https://codeforces.com/profile/${h}`,
  LEETCODE: (h) => `https://leetcode.com/u/${h}`,
  ATCODER: (h) => `https://atcoder.jp/users/${h}`,
  CODECHEF: (h) => `https://www.codechef.com/users/${h}`,
};

const platformColor: Record<Platform, string> = {
  CODEFORCES: "border-blue-500/20 bg-blue-500/5",
  LEETCODE: "border-amber-500/20 bg-amber-500/5",
  ATCODER: "border-cyan-500/20 bg-cyan-500/5",
  CODECHEF: "border-orange-500/20 bg-orange-500/5",
};

export function ProfileClient({
  user,
  profiles,
  heatmapData,
  totalSolved,
  todayIso,
  supportEmail,
  isOwner,
}: ProfileProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingPlatform, setRemovingPlatform] = useState<Platform | null>(null);
  const bestRating = profiles.length > 0 ? Math.max(...profiles.map((p) => p.maxRating)) : 0;

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete account");
        setDeleting(false);
        return;
      }
      toast.success("Account deleted");
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("Network error");
      setDeleting(false);
    } finally {
      router.refresh();
    }
  };

  const handleRemovePlatform = async (platform: Platform) => {
    if (!confirm(`Remove your ${PLATFORM_LABELS[platform]} profile from CPBoard?`)) return;
    setRemovingPlatform(platform);
    try {
      const res = await fetch("/api/platforms/sync", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to remove profile");
        return;
      }
      toast.success(`${PLATFORM_LABELS[platform]} profile removed`);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setRemovingPlatform(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-start gap-4"
        data-tour="profile-header"
      >
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0 overflow-hidden">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name || user.username} className="h-full w-full object-cover" />
          ) : (
            (user.name || user.username)[0].toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold">{user.name || user.username}</h1>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">{user.university.shortName}</Badge>
            <span className="text-[11px] text-muted-foreground">
              Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-[11px] text-muted-foreground font-medium">Total Solved</p>
          <p className="text-2xl font-bold font-mono text-primary mt-1">{totalSolved}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-[11px] text-muted-foreground font-medium">Best Rating</p>
          <p className="text-2xl font-bold font-mono mt-1">
            {bestRating > 0 ? <span style={{ color: getCodeforcesRankColor(bestRating) }}>{bestRating}</span> : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-[11px] text-muted-foreground font-medium">Platforms</p>
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

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        <div className="rounded-lg border border-border/60 p-4" data-tour="profile-support">
          <div className="flex items-center gap-2 mb-1.5">
            <Mail className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Need support or profile review?</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            For account help, feedback, or profile review requests, please email support and include your username for faster assistance.
          </p>
          <a
            href={`mailto:${supportEmail}?subject=CPBoard%20Support%20Request`}
            className="inline-flex mt-3 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            {supportEmail} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {isOwner && (
          <div className="rounded-lg border border-destructive/20 p-4" data-tour="profile-danger">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">Danger Zone</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Permanently remove your account and all related data. This action cannot be undone.
            </p>
            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Account
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Yes, delete my account"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch" data-tour="profile-platforms">
        {profiles.map((profile) => (
          <motion.div
            key={profile.platform}
            className="h-full min-h-0"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={`flex h-full flex-col rounded-lg border p-4 ${platformColor[profile.platform]}`}>
              <div className="flex items-center justify-between shrink-0 mb-3">
                <PlatformBadge platform={profile.platform} />
                <div className="flex items-center gap-2">
                  <a
                    href={platformLinks[profile.platform](profile.handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    @{profile.handle} <ExternalLink className="h-3 w-3" />
                  </a>
                  {isOwner && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemovePlatform(profile.platform)}
                      disabled={removingPlatform === profile.platform}
                    >
                      {removingPlatform === profile.platform ? "Removing..." : "Remove"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1 content-start">
                <div>
                  <p className="text-[10px] text-muted-foreground">Solved</p>
                  <p className="text-lg font-mono font-bold">{profile.problemsSolved}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Rating</p>
                  <p className="text-lg font-mono font-bold">
                    {profile.rating > 0 ? (
                      <span style={{ color: profile.platform === "CODEFORCES" ? getCodeforcesRankColor(profile.rating) : undefined }}>
                        {profile.rating}
                      </span>
                    ) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Max Rating</p>
                  <p className="text-lg font-mono font-bold">{profile.maxRating > 0 ? profile.maxRating : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Contests</p>
                  <p className="text-lg font-mono font-bold">{profile.contestsCount}</p>
                </div>
              </div>
              <div className="mt-3 flex min-h-11 shrink-0 items-center border-t border-border/30 pt-3">
                {profile.platform === "CODEFORCES" && profile.rating > 0 ? (
                  <span className="text-xs font-medium" style={{ color: getCodeforcesRankColor(profile.rating) }}>
                    {getCodeforcesRankTitle(profile.rating)}
                  </span>
                ) : null}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
