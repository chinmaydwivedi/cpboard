"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heatmap } from "@/components/heatmap";
import { PLATFORM_LABELS } from "@/types";
import type { HeatmapData } from "@/types";
import type { Platform, SyncStatus } from "@prisma/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, LogOut, Trash2, AlertTriangle } from "lucide-react";

type ProfileData = {
  platform: Platform;
  handle: string;
  rating: number;
  maxRating: number;
  problemsSolved: number;
  rank: string | null;
  contestsCount: number;
  lastSynced: string | null;
  verified: boolean;
};

type SyncLogEntry = {
  platform: Platform;
  status: SyncStatus;
  error: string | null;
  syncedAt: string;
};

const ALL_PLATFORMS: Platform[] = ["CODEFORCES", "LEETCODE", "ATCODER", "CODECHEF"];

const platformColor: Record<Platform, string> = {
  CODEFORCES: "border-blue-500/20 bg-blue-500/5",
  LEETCODE: "border-amber-500/20 bg-amber-500/5",
  ATCODER: "border-cyan-500/20 bg-cyan-500/5",
  CODECHEF: "border-orange-500/20 bg-orange-500/5",
};

const platformAccent: Record<Platform, string> = {
  CODEFORCES: "text-blue-600 dark:text-blue-400",
  LEETCODE: "text-amber-600 dark:text-amber-400",
  ATCODER: "text-cyan-600 dark:text-cyan-400",
  CODECHEF: "text-orange-600 dark:text-orange-400",
};

export function DashboardClient({
  user,
  profiles,
  heatmapData,
  recentSyncs,
}: {
  user: {
    id: string;
    name: string | null;
    username: string;
    email: string;
    university: { name: string; shortName: string };
  };
  profiles: ProfileData[];
  heatmapData: HeatmapData;
  recentSyncs: SyncLogEntry[];
}) {
  const router = useRouter();
  const [handles, setHandles] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) map[p.platform] = p.handle;
    return map;
  });
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [currentProfiles, setCurrentProfiles] = useState(profiles);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalSolved = currentProfiles.reduce((s, p) => s + p.problemsSolved, 0);
  const bestRating = currentProfiles.length ? Math.max(...currentProfiles.map((p) => p.maxRating)) : 0;

  const handleSync = async (platform: Platform) => {
    const handle = handles[platform]?.trim();
    if (!handle) { toast.error("Enter a handle first"); return; }
    setSyncing((prev) => ({ ...prev, [platform]: true }));
    try {
      const res = await fetch("/api/platforms/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Sync failed"); return; }
      toast.success(`${PLATFORM_LABELS[platform]} synced`);
      setCurrentProfiles((prev) => {
        const idx = prev.findIndex((p) => p.platform === platform);
        const updated: ProfileData = {
          platform, handle, rating: data.data.rating, maxRating: data.data.maxRating,
          problemsSolved: data.data.problemsSolved, rank: data.data.rank,
          contestsCount: 0, lastSynced: new Date().toISOString(), verified: true,
        };
        if (idx >= 0) { const c = [...prev]; c[idx] = updated; return c; }
        return [...prev, updated];
      });
    } catch { toast.error("Network error"); }
    finally { setSyncing((prev) => ({ ...prev, [platform]: false })); }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete account"); setDeleting(false); return; }
      toast.success("Account deleted");
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("Network error");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user.name || user.username} · <Badge variant="outline" className="font-mono text-[10px]">{user.university.shortName}</Badge>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })} className="text-[13px] gap-1.5">
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        {[
          { label: "Problems Solved", value: totalSolved.toString() },
          { label: "Best Rating", value: bestRating > 0 ? bestRating.toString() : "—" },
          { label: "Platforms", value: `${currentProfiles.length}/4` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border/40 p-4">
            <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
            <p className="text-2xl font-bold font-mono mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border/40 p-4 mb-6">
        <p className="text-[11px] text-muted-foreground font-medium mb-3">Activity</p>
        <Heatmap data={heatmapData} />
      </div>

      <p className="text-[11px] text-muted-foreground font-medium mb-3">Platforms</p>
      <div className="grid gap-3 sm:grid-cols-2 mb-8">
        {ALL_PLATFORMS.map((platform) => {
          const profile = currentProfiles.find((p) => p.platform === platform);
          return (
            <div key={platform} className={`rounded-lg border p-4 ${platformColor[platform]}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-semibold ${platformAccent[platform]}`}>
                  {PLATFORM_LABELS[platform]}
                </span>
                {profile?.verified && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
              </div>

              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Handle or profile URL"
                  value={handles[platform] || ""}
                  onChange={(e) => setHandles((p) => ({ ...p, [platform]: e.target.value }))}
                  className="h-8 text-[13px]"
                />
                <Button size="sm" variant="outline" onClick={() => handleSync(platform)} disabled={syncing[platform]} className="h-8 px-3">
                  <RefreshCw className={`h-3 w-3 ${syncing[platform] ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {profile && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Solved</p>
                    <p className="text-sm font-bold font-mono">{profile.problemsSolved}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Rating</p>
                    <p className="text-sm font-bold font-mono">{profile.rating || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Max</p>
                    <p className="text-sm font-bold font-mono">{profile.maxRating || "—"}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-destructive/20 p-5">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm font-medium text-destructive">Danger Zone</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Account
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-xs text-destructive font-medium">Are you sure?</p>
            <Button size="sm" variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? "Deleting..." : "Yes, delete my account"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
