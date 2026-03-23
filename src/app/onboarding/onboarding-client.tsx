"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
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
}: {
  defaultUsername: string;
  defaultName: string;
  universityName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState(defaultUsername);
  const [name, setName] = useState(defaultName);
  const [profileUrls, setProfileUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
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
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Username</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-mono">@</span>
                  <Input
                    placeholder="your_username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="h-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Lowercase letters, numbers, underscores. Min 3 characters.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Display Name</Label>
                <Input placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
              </div>

              <Button className="w-full h-9 text-sm font-medium" onClick={() => {
                if (username.length < 3) { setError("Username must be at least 3 characters"); return; }
                setError(""); setStep(2);
              }}>
                Continue <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
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
            <p className="text-xs text-muted-foreground mb-5">Paste URLs or handles. Skip any you don&apos;t have.</p>

            <div className="space-y-4">
              {platforms.map((p) => (
                <div key={p.platform} className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {p.label}
                  </Label>
                  <Input
                    placeholder={p.placeholder}
                    value={profileUrls[p.platform] || ""}
                    onChange={(e) => setProfileUrls((prev) => ({ ...prev, [p.platform]: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-9 text-sm font-medium">
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
                </Button>
                <Button className="flex-1 h-9 text-sm font-medium" onClick={handleSubmit} disabled={loading}>
                  {loading ? "Syncing..." : "Finish Setup"}
                </Button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
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
    </div>
  );
}
