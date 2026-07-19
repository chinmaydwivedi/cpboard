"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heatmap } from "@/components/heatmap";
import { TopicRadarChart } from "@/components/topic-radar-chart";
import { TopicRecommendations } from "@/components/topic-recommendations";
import {
  PlatformVerificationDialog,
  type PlatformVerificationData,
  type VerificationPlatform,
} from "@/components/platform-verification-dialog";
import {
  NotificationSettings,
  type NotificationPreferences,
} from "@/components/notification-settings";
import { PLATFORM_LABELS } from "@/types";
import type { HeatmapData } from "@/types";
import type { TopicRadarPoint } from "@/lib/topic-radar";
import type { Platform } from "@prisma/client";
import { extractHandle } from "@/lib/parse-handle";
import { toast } from "sonner";
import {
  RefreshCw, CheckCircle2, LogOut, Trash2, AlertTriangle,
  Pencil, Camera, X, Check, ShieldCheck,
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
  verifiedAt: string | null;
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

function formatRetryDelay(totalSeconds: number) {
  const seconds = Math.max(1, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

export function DashboardClient({
  user,
  profiles,
  heatmapData,
  todayIso,
  topicRadar,
  topicHandles,
  vapidPublicKey,
  notificationPreferences,
  ownershipVerificationRequired,
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
  todayIso: string;
  topicRadar: TopicRadarPoint[];
  topicHandles: { codeforces: string | null; leetcode: string | null };
  vapidPublicKey: string | null;
  notificationPreferences: NotificationPreferences;
  ownershipVerificationRequired: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncInFlightRef = useRef(new Set<Platform>());
  const [handles, setHandles] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) map[p.platform] = p.handle;
    return map;
  });
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncRetryUntil, setSyncRetryUntil] = useState<
    Partial<Record<Platform, number>>
  >({});
  const [syncRetryClock, setSyncRetryClock] = useState(0);
  const [verificationTarget, setVerificationTarget] = useState<{
    platform: VerificationPlatform;
    handle: string;
  } | null>(null);
  const [currentProfiles, setCurrentProfiles] = useState(profiles);
  const previousProfilesRef = useRef(profiles);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingPlatform, setRemovingPlatform] = useState<Platform | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name || "");
  const [editUsername, setEditUsername] = useState(user.username);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentName, setCurrentName] = useState(user.name || "");
  const [currentUsername, setCurrentUsername] = useState(user.username);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const previousByPlatform = new Map(
      previousProfilesRef.current.map((profile) => [profile.platform, profile]),
    );

    setCurrentProfiles(profiles);
    setHandles((current) => {
      const next = { ...current };
      for (const profile of profiles) {
        const previousHandle = previousByPlatform.get(profile.platform)?.handle;
        if (!current[profile.platform] || current[profile.platform] === previousHandle) {
          next[profile.platform] = profile.handle;
        }
      }
      return next;
    });
    previousProfilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    const hasActiveRetry = Object.values(syncRetryUntil).some(
      (deadline) => deadline != null && deadline > Date.now(),
    );
    if (!hasActiveRetry) return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      setSyncRetryClock(now);
      setSyncRetryUntil((current) => {
        let changed = false;
        const next = { ...current };
        for (const platform of ALL_PLATFORMS) {
          const deadline = next[platform];
          if (deadline != null && deadline <= now) {
            delete next[platform];
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [syncRetryUntil]);

  const verifiedProfiles = currentProfiles.filter((profile) => profile.verified);
  const totalSolved = verifiedProfiles.reduce(
    (sum, profile) => sum + profile.problemsSolved,
    0,
  );

  const leetcodeProfile = verifiedProfiles.find(
    (profile) => profile.platform === "LEETCODE",
  );
  const leetcodeRating = leetcodeProfile?.rating || leetcodeProfile?.maxRating || 0;
  const codeforcesRating =
    verifiedProfiles.find((profile) => profile.platform === "CODEFORCES")
      ?.rating || 0;

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
    } catch { toast.error("Upload failed"); }
    finally { setUploadingAvatar(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }, []);

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to remove avatar"); return; }
      setAvatarUrl(null);
      toast.success("Avatar removed");
    } catch { toast.error("Network error"); }
    finally { setUploadingAvatar(false); }
  };

  const handleSync = async (platform: Platform) => {
    if (syncInFlightRef.current.has(platform)) return;
    const retryDeadline = syncRetryUntil[platform];
    if (retryDeadline != null && retryDeadline > Date.now()) {
      toast.message(
        `Try ${PLATFORM_LABELS[platform]} again in ${formatRetryDelay(
          (retryDeadline - Date.now()) / 1_000,
        )}`,
      );
      return;
    }
    const handle = handles[platform]?.trim();
    if (!handle) { toast.error("Enter a handle first"); return; }
    const existingProfile = currentProfiles.find(
      (profile) => profile.platform === platform,
    );
    syncInFlightRef.current.add(platform);
    setSyncing((prev) => ({ ...prev, [platform]: true }));
    try {
      const res = await fetch("/api/platforms/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle }),
      });
      const data = await res.json();
      if (!res.ok) {
        const retryAfter = Number.parseInt(
          res.headers.get("Retry-After") ?? "",
          10,
        );
        if (res.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
          const boundedRetryAfter = Math.min(24 * 60 * 60, retryAfter);
          const now = Date.now();
          setSyncRetryClock(now);
          setSyncRetryUntil((current) => ({
            ...current,
            [platform]: now + boundedRetryAfter * 1_000,
          }));
          toast.error(data.error || "Sync is temporarily unavailable", {
            description: `Try again in ${formatRetryDelay(boundedRetryAfter)}.`,
          });
        } else {
          toast.error(data.error || "Sync failed");
        }
        return;
      }
      toast.success(`${PLATFORM_LABELS[platform]} synced`);
      setSyncRetryUntil((current) => {
        if (current[platform] == null) return current;
        const next = { ...current };
        delete next[platform];
        return next;
      });
      setCurrentProfiles((prev) => {
        const idx = prev.findIndex((p) => p.platform === platform);
        const syncedHandle = data?.data?.handle || handle;
        const updated: ProfileData = {
          platform,
          handle: syncedHandle,
          rating: data.data.rating,
          maxRating: data.data.maxRating,
          problemsSolved: data.data.problemsSolved, rank: data.data.rank,
          contestsCount: data.data.contestsCount || 0,
          lastSynced: new Date().toISOString(),
          verified: true,
          verifiedAt: existingProfile?.verifiedAt ?? null,
        };
        if (idx >= 0) { const c = [...prev]; c[idx] = updated; return c; }
        return [...prev, updated];
      });
      setHandles((prev) => ({ ...prev, [platform]: data?.data?.handle || handle }));
      router.refresh();
    } catch { toast.error("Network error"); }
    finally {
      syncInFlightRef.current.delete(platform);
      setSyncing((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const handlePlatformAction = (platform: Platform, profile?: ProfileData) => {
    const handle = handles[platform]?.trim();
    if (!handle) {
      toast.error("Enter a handle first");
      return;
    }

    if (
      ownershipVerificationRequired &&
      (platform === "CODEFORCES" || platform === "LEETCODE")
    ) {
      const parsedHandle = extractHandle(platform, handle).toLowerCase();
      const isVerifiedHandle =
        Boolean(profile?.verified) &&
        Boolean(profile?.verifiedAt) &&
        profile?.handle.toLowerCase() === parsedHandle;
      if (!isVerifiedHandle) {
        setVerificationTarget({ platform, handle });
        return;
      }
    }

    void handleSync(platform);
  };

  const handleOwnershipVerified = (
    platform: VerificationPlatform,
    data: PlatformVerificationData,
  ) => {
    const verifiedAt = new Date().toISOString();
    setCurrentProfiles((previous) => {
      const updated: ProfileData = {
        platform,
        handle: data.handle,
        rating: data.rating,
        maxRating: data.maxRating,
        problemsSolved: data.problemsSolved,
        rank: data.rank,
        contestsCount: data.contestsCount,
        lastSynced: data.statsPending ? null : verifiedAt,
        verified: true,
        verifiedAt,
      };
      const index = previous.findIndex((profile) => profile.platform === platform);
      if (index < 0) return [...previous, updated];
      const next = [...previous];
      next[index] = updated;
      return next;
    });
    setHandles((previous) => ({ ...previous, [platform]: data.handle }));
    toast.success(`${PLATFORM_LABELS[platform]} ownership verified`);
    router.refresh();
  };

  const handleRemovePlatform = async (platform: Platform) => {
    if (
      !confirm(
        `Remove your ${PLATFORM_LABELS[platform]} profile from CPBoard?`,
      )
    ) {
      return;
    }

    setRemovingPlatform(platform);
    try {
      const response = await fetch("/api/platforms/sync", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error || "Failed to remove profile");
        return;
      }
      setCurrentProfiles((previous) =>
        previous.filter((profile) => profile.platform !== platform),
      );
      setHandles((previous) => {
        const next = { ...previous };
        delete next[platform];
        return next;
      });
      toast.success(`${PLATFORM_LABELS[platform]} profile removed`);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setRemovingPlatform(null);
    }
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

  const heatmapSection = useMemo(
    () => <Heatmap data={heatmapData} todayIso={todayIso} />,
    [heatmapData, todayIso],
  );
  const radarSection = useMemo(
    () => (
      <TopicRadarChart
        data={topicRadar}
        codeforcesHandle={topicHandles.codeforces}
        leetcodeHandle={topicHandles.leetcode}
      />
    ),
    [topicHandles.codeforces, topicHandles.leetcode, topicRadar],
  );
  const recommendationsSection = useMemo(
    () => (
      <TopicRecommendations
        topics={topicRadar}
        codeforcesRating={codeforcesRating}
      />
    ),
    [codeforcesRating, topicRadar],
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      <div
        className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        data-tour="dash-profile"
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="relative group">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {avatarUrl ? (
                <NextImage
                  src={avatarUrl}
                  alt={`${currentName || currentUsername}'s avatar`}
                  fill
                  sizes="56px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                (currentName || currentUsername)[0].toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Change profile photo"
              title="Change profile photo"
              className="absolute -bottom-1 -right-1 flex size-7 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-w-0">
            {!editingProfile ? (
              <>
                <div className="flex min-w-0 items-center gap-1.5">
                  <h1 className="min-w-0 break-words text-xl font-bold tracking-tight">
                    {currentName || currentUsername}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(true);
                      setEditName(currentName);
                      setEditUsername(currentUsername);
                    }}
                    aria-label="Edit profile name and username"
                    title="Edit profile"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                  @{currentUsername} · <Badge variant="outline" className="font-mono text-[10px]">{user.university.shortName}</Badge>
                </p>
                {avatarUrl && (
                  <button onClick={handleRemoveAvatar} disabled={uploadingAvatar} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                    Remove photo
                  </button>
                )}
              </>
            ) : (
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Display name"
                    aria-label="Display name"
                    className="h-8 w-full text-[13px] sm:w-40"
                  />
                  <Input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    placeholder="Username"
                    aria-label="Username"
                    className="h-8 w-full font-mono text-[13px] sm:w-36"
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full gap-1.5 text-[13px] sm:w-auto"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-6" data-tour="dash-stats">
        {[
          { label: "Problems Solved", value: totalSolved.toString() },
          { label: "LC Rating", value: leetcodeRating > 0 ? leetcodeRating.toString() : "—" },
          { label: "Platforms", value: `${verifiedProfiles.length}/4` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border/40 p-4">
            <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
            <p className="text-2xl font-bold font-mono mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6" data-tour="dash-heatmap">
        {heatmapSection}
      </div>

      <div className="mb-6" data-tour="dash-topic-radar">
        {radarSection}
      </div>

      <div className="mb-6">
        {recommendationsSection}
      </div>

      <p className="text-[11px] text-muted-foreground font-medium mb-3">Platforms</p>
      <div className="grid gap-3 sm:grid-cols-2 mb-8" data-tour="dash-platforms">
        {ALL_PLATFORMS.map((platform) => {
          const profile = currentProfiles.find((p) => p.platform === platform);
          const ownershipPlatform =
            platform === "CODEFORCES" || platform === "LEETCODE";
          const requiresOwnershipCheck =
            ownershipPlatform && ownershipVerificationRequired;
          const enteredHandle = handles[platform]?.trim() || "";
          const enteredCanonical = enteredHandle
            ? extractHandle(platform, enteredHandle).toLowerCase()
            : "";
          const ownershipVerified =
            ownershipPlatform &&
            Boolean(profile?.verified) &&
            Boolean(profile?.verifiedAt) &&
            profile?.handle.toLowerCase() === enteredCanonical;
          const needsVerification =
            requiresOwnershipCheck && !ownershipVerified;
          const retrySeconds = Math.max(
            0,
            Math.ceil(
              ((syncRetryUntil[platform] ?? 0) - syncRetryClock) / 1_000,
            ),
          );
          const waitingToRetry = !needsVerification && retrySeconds > 0;
          const actionLabel = waitingToRetry
            ? `Retry in ${formatRetryDelay(retrySeconds)}`
            : needsVerification
              ? profile?.verifiedAt
                ? "Verify new handle"
                : "Verify handle"
              : "Sync stats";
          return (
            <div key={platform} className={`rounded-lg border p-4 ${platformColor[platform]}`}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className={`text-sm font-semibold ${platformAccent[platform]}`}>
                  {PLATFORM_LABELS[platform]}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="gap-1 font-mono text-[9px] text-muted-foreground"
                  >
                    {requiresOwnershipCheck && ownershipVerified ? (
                      <CheckCircle2 className="size-3 text-primary" aria-hidden="true" />
                    ) : requiresOwnershipCheck ? (
                      <ShieldCheck className="size-3" aria-hidden="true" />
                    ) : profile ? (
                      <CheckCircle2 className="size-3 text-primary" aria-hidden="true" />
                    ) : null}
                    {requiresOwnershipCheck && ownershipVerified
                      ? "Verified"
                      : requiresOwnershipCheck
                        ? "Verification needed"
                        : profile
                          ? "Linked"
                          : "Not linked"}
                  </Badge>
                  {profile && (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${PLATFORM_LABELS[platform]} profile`}
                      title={`Remove ${PLATFORM_LABELS[platform]} profile`}
                      disabled={
                        removingPlatform === platform || Boolean(syncing[platform])
                      }
                      onClick={() => void handleRemovePlatform(platform)}
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <Input
                  id={`platform-handle-${platform.toLowerCase()}`}
                  aria-label={`${PLATFORM_LABELS[platform]} handle or profile URL`}
                  placeholder="Handle or profile URL"
                  value={handles[platform] || ""}
                  onChange={(e) => setHandles((p) => ({ ...p, [platform]: e.target.value }))}
                  className="h-8 text-[13px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePlatformAction(platform, profile)}
                  disabled={
                    syncing[platform] ||
                    removingPlatform === platform ||
                    waitingToRetry
                  }
                  aria-label={`${actionLabel} for ${PLATFORM_LABELS[platform]}`}
                  title={waitingToRetry ? actionLabel : undefined}
                  className="h-8 gap-1.5 px-3 sm:min-w-20"
                >
                  {needsVerification ? (
                    <ShieldCheck className="size-3" aria-hidden="true" />
                  ) : (
                    <RefreshCw
                      className={`size-3 ${syncing[platform] ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`text-[11px] ${
                      waitingToRetry ? "inline" : "hidden sm:inline"
                    }`}
                  >
                    {waitingToRetry
                      ? `Retry ${
                          retrySeconds >= 60
                            ? `${Math.ceil(retrySeconds / 60)}m`
                            : `${retrySeconds}s`
                        }`
                      : needsVerification
                        ? "Verify"
                        : "Sync"}
                  </span>
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

      {verificationTarget && (
        <PlatformVerificationDialog
          open
          onOpenChange={(open) => {
            if (!open) setVerificationTarget(null);
          }}
          platform={verificationTarget.platform}
          handle={verificationTarget.handle}
          onVerified={(data) =>
            handleOwnershipVerified(verificationTarget.platform, data)
          }
        />
      )}

      <NotificationSettings
        vapidPublicKey={vapidPublicKey}
        initialPreferences={notificationPreferences}
      />

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
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-destructive font-medium">Are you sure?</p>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full sm:w-auto"
            >
              {deleting ? "Deleting..." : "Yes, delete my account"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
