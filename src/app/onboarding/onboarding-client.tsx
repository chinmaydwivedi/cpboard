"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlatformVerificationDialog,
  type PlatformVerificationData,
  type VerificationPlatform,
} from "@/components/platform-verification-dialog";
import { extractHandle } from "@/lib/parse-handle";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import type { Platform } from "@prisma/client";

const platforms: { platform: Platform; label: string; placeholder: string }[] = [
  { platform: "CODEFORCES", label: "Codeforces", placeholder: "https://codeforces.com/profile/tourist" },
  { platform: "LEETCODE", label: "LeetCode", placeholder: "https://leetcode.com/u/username" },
  { platform: "ATCODER", label: "AtCoder", placeholder: "https://atcoder.jp/users/tourist" },
  { platform: "CODECHEF", label: "CodeChef", placeholder: "https://www.codechef.com/users/username" },
];

export function OnboardingClient({
  defaultUsername,
  defaultName,
  universityName,
  initialProfiles,
  ownershipVerificationRequired,
}: {
  defaultUsername: string;
  defaultName: string;
  universityName: string;
  ownershipVerificationRequired: boolean;
  initialProfiles: {
    platform: Platform;
    handle: string;
    ownershipVerified: boolean;
  }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState(defaultUsername);
  const [name, setName] = useState(defaultName);
  const [profileUrls, setProfileUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialProfiles.map((profile) => [profile.platform, profile.handle]),
    ),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifiedHandles, setVerifiedHandles] = useState<
    Partial<Record<VerificationPlatform, string>>
  >(() =>
    Object.fromEntries(
      initialProfiles
        .filter(
          (profile) =>
            profile.ownershipVerified &&
            (profile.platform === "CODEFORCES" ||
              profile.platform === "LEETCODE"),
        )
        .map((profile) => [profile.platform, profile.handle.toLowerCase()]),
    ),
  );
  const [verificationTarget, setVerificationTarget] = useState<{
    platform: VerificationPlatform;
    handle: string;
  } | null>(null);

  const handleOwnershipVerified = (
    platform: VerificationPlatform,
    data: PlatformVerificationData,
  ) => {
    setProfileUrls((previous) => ({ ...previous, [platform]: data.handle }));
    setVerifiedHandles((previous) => ({
      ...previous,
      [platform]: data.handle.toLowerCase(),
    }));
  };

  const handleSubmit = async () => {
    setError("");
    if (ownershipVerificationRequired) {
      for (const platform of ["CODEFORCES", "LEETCODE"] as const) {
        const value = profileUrls[platform]?.trim();
        if (
          value &&
          verifiedHandles[platform] !== extractHandle(platform, value).toLowerCase()
        ) {
          setError(
            `Verify your ${platform === "CODEFORCES" ? "Codeforces" : "LeetCode"} handle or clear it before continuing.`,
          );
          return;
        }
      }
    }
    setLoading(true);
    try {
      const profiles = platforms
        .filter((p) => profileUrls[p.platform]?.trim())
        .map((p) => ({ platform: p.platform, url: profileUrls[p.platform] }));

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, profiles }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <h1 className="font-heading text-2xl italic">Welcome to CPBoard</h1>
        <Badge variant="outline" className="font-mono text-[10px] mt-2">{universityName}</Badge>
      </motion.div>

      {step === 1 && (
        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="rounded-lg border border-border/60 p-6">
            <h2 className="font-semibold text-sm mb-1">Set up your profile</h2>
            <p className="text-xs text-muted-foreground mb-5">Choose a username and display name</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onboarding-username" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Username</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-mono">@</span>
                  <Input
                    id="onboarding-username"
                    placeholder="your_username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="h-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Lowercase letters, numbers, underscores. Min 3 characters.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="onboarding-name" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Display Name</Label>
                <Input id="onboarding-name" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
              </div>

              <Button className="w-full h-9 text-sm font-medium" onClick={() => {
                if (username.length < 3) { setError("Username must be at least 3 characters"); return; }
                setError(""); setStep(2);
              }}>
                Continue <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              {error && (
                <div
                  className="flex items-center gap-2 text-sm text-destructive"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {error}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="rounded-lg border border-border/60 p-6">
            <h2 className="font-semibold text-sm mb-1">Link your profiles</h2>
            <p className="text-xs text-muted-foreground mb-5">
              {ownershipVerificationRequired
                ? "Paste URLs or handles. Codeforces and LeetCode need a quick ownership check."
                : "Paste profile URLs or handles. Your existing account keeps the direct link and sync flow."}
            </p>

            <div className="space-y-4">
              {platforms.map((p) => {
                const ownershipPlatform =
                  p.platform === "CODEFORCES" || p.platform === "LEETCODE";
                const requiresOwnershipCheck =
                  ownershipPlatform && ownershipVerificationRequired;
                const value = profileUrls[p.platform] || "";
                const normalizedValue = value.trim()
                  ? extractHandle(p.platform, value).toLowerCase()
                  : "";
                const verified = requiresOwnershipCheck
                  ? verifiedHandles[p.platform as VerificationPlatform] === normalizedValue &&
                    Boolean(normalizedValue)
                  : false;
                const inputId = `onboarding-${p.platform.toLowerCase()}`;

                return (
                  <div key={p.platform} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor={inputId} className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {p.label}
                      </Label>
                      {requiresOwnershipCheck && value.trim() && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {verified ? (
                            <CheckCircle2 className="size-3 text-primary" aria-hidden="true" />
                          ) : (
                            <ShieldCheck className="size-3" aria-hidden="true" />
                          )}
                          {verified ? "Verified" : "Verification required"}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id={inputId}
                        placeholder={p.placeholder}
                        value={value}
                        onChange={(e) =>
                          setProfileUrls((prev) => ({
                            ...prev,
                            [p.platform]: e.target.value,
                          }))
                        }
                        className="h-9 text-sm"
                      />
                      {requiresOwnershipCheck && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 px-3 text-xs"
                          disabled={!value.trim() || verified}
                          onClick={() =>
                            setVerificationTarget({
                              platform: p.platform as VerificationPlatform,
                              handle: value,
                            })
                          }
                        >
                          {verified ? (
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                          ) : (
                            <ShieldCheck className="size-3" aria-hidden="true" />
                          )}
                          {verified ? "Done" : "Verify"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-9 text-sm font-medium">
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
                </Button>
                <Button className="flex-1 h-9 text-sm font-medium" onClick={handleSubmit} disabled={loading}>
                  {loading ? "Syncing..." : "Finish Setup"}
                </Button>
              </div>
              {error && (
                <div
                  className="flex items-center gap-2 text-sm text-destructive"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {error}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center">You can change these later from your dashboard.</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex justify-center gap-2 mt-6">
        <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
        <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
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
    </div>
  );
}
