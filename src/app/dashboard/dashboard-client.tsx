"use client";

import { useState, useRef, useCallback } from "react";
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
import {
  RefreshCw, CheckCircle2, LogOut, Trash2, AlertTriangle,
  Pencil, Camera, X, Check, User as UserIcon,
} from "lucide-react";

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

function resizeImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h) { h = (h / w) * maxDim; w = maxDim; }
        else { w = (w / h) * maxDim; h = maxDim; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
    avatarUrl: string | null;
    university: { name: string; shortName: string };
  };
  profiles: ProfileData[];
  heatmapData: HeatmapData;
  recentSyncs: SyncLogEntry[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [handles, setHandles] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) map[p.platform] = p.handle;
    return map;
  });
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [currentProfiles, setCurrentProfiles] = useState(profiles);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name || "");
  const [editUsername, setEditUsername] = useState(user.username);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentName, setCurrentName] = useState(user.name || "");
  const [currentUsername, setCurrentUsername] = useState(user.username);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const totalSolved = currentProfiles.reduce((s, p) => s + p.problemsSolved, 0);

  const bestRating = currentProfiles.length ? Math.max(...currentProfiles.map((p) => p.maxRating)) : 0;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: editUsername, name: editName }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Update failed"); setSavingProfile(false); return; }
      setCurrentName(data.name || "");
      setCurrentUsername(data.username);
      setEditingProfile(false);
      toast.success("Profile updated");
      router.refresh();
    } catch { toast.error("Network error"); }
    finally { setSavingProfile(false); }
  };

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImage(file, 256, 0.8);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Upload failed"); return; }
      setAvatarUrl(data.avatarUrl);
      toast.success("Avatar updated");
      router.refresh();
    } catch { toast.error("Upload failed"); }
    finally { setUploadingAvatar(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }, [router]);

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to remove avatar"); return; }
      setAvatarUrl(null);
      toast.success("Avatar removed");
      router.refresh();
    } catch { toast.error("Network error"); }
    finally { setUploadingAvatar(false); }
  };

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
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      <div className="flex items-center justify-between mb-8" data-tour="dash-profile">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                (currentName || currentUsername)[0].toUpperCase()
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              <Camera className="h-4 w-4 text-white" />
            </button>
          </div>
          <div>
            {!editingProfile ? (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight">{currentName || currentUsername}</h1>
                  <button onClick={() => { setEditingProfile(true); setEditName(currentName); setEditUsername(currentUsername); }} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  @{currentUsername} · <Badge variant="outline" className="font-mono text-[10px]">{user.university.shortName}</Badge>
                </p>
                {avatarUrl && (
                  <button onClick={handleRemoveAvatar} disabled={uploadingAvatar} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                    Remove photo
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Display name"
                    className="h-8 text-[13px] w-40"
                  />
                  <Input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    placeholder="Username"
                    className="h-8 text-[13px] w-36 font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="default" onClick={handleSaveProfile} disabled={savingProfile} className="h-7 px-2.5 text-[12px] gap-1">
                    <Check className="h-3 w-3" /> {savingProfile ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingProfile(false)} className="h-7 px-2.5 text-[12px] gap-1">
                    <X className="h-3 w-3" /> Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })} className="text-[13px] gap-1.5">
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-6" data-tour="dash-stats">
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

      <div className="mb-6" data-tour="dash-heatmap">
        <Heatmap data={heatmapData} />
      </div>

      <p className="text-[11px] text-muted-foreground font-medium mb-3">Platforms</p>
      <div className="grid gap-3 sm:grid-cols-2 mb-8" data-tour="dash-platforms">
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

      <div className="rounded-lg border border-destructive/20 p-5" data-tour="dash-danger">
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
