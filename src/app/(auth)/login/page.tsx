"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("Please enter a valid university email address");
      return;
    }

    setLoading(true);
    try {
      const domainCheck = await fetch("/api/auth/check-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const domainData = await domainCheck.json();
      if (domainCheck.status === 429) {
        setError("Too many sign-in attempts. Please wait and try again.");
        setLoading(false);
        return;
      }
      if (!domainData.valid) {
        setError("Your university is not registered yet. Contact the admin to add it.");
        setLoading(false);
        return;
      }

      const result = await signIn("nodemailer", { email, redirect: false });
      if (result?.status === 429) {
        setError("Too many sign-in emails were requested. Please wait before retrying.");
      } else if (result?.error) {
        setError("Failed to send email. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="relative min-h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-20" style={{ backgroundImage: "url(/bg/hero-mono.png)" }} />
        <div className="absolute inset-0 bg-linear-to-b from-background/80 to-background dark:from-background/60 dark:to-background" />
        <div className="relative mx-auto max-w-sm px-5">
          <div className="rounded-lg border border-border/40 bg-card/90 backdrop-blur-sm p-8 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-heading text-xl italic">Check your email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a sign-in link to <strong className="text-foreground">{email}</strong>.
            </p>
            <div className="mt-4 rounded-md bg-secondary/50 border border-border/40 p-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Not seeing it?</strong> Check your spam or junk folder. Look for a message about signing in to CPBoard; the sender name is often <span className="text-foreground/90">CPBoard</span>.
              </p>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              <button onClick={() => setSent(false)} className="text-primary font-medium hover:underline">
                Send again
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[60vh] flex items-center justify-center">
      <div className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-20" style={{ backgroundImage: "url(/bg/hero-mono.png)" }} />
      <div className="absolute inset-0 bg-linear-to-b from-background/80 to-background dark:from-background/60 dark:to-background" />
      <div className="relative mx-auto max-w-sm px-5 w-full">
        <div className="rounded-lg border border-border/40 bg-card/90 backdrop-blur-sm p-8">
          <div className="text-center mb-6">
            <h1 className="font-heading text-xl italic">Sign in to CPBoard</h1>
            <p className="text-sm text-muted-foreground mt-1">Use your university email</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                University Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 text-sm"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-10 text-sm font-medium" disabled={loading}>
              {loading ? "Sending..." : "Send Magic Link"}
              {!loading && <ArrowRight className="ml-1.5 h-3.5 w-3.5" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-[11px] text-muted-foreground leading-relaxed">
            We verify your university through your email domain.
            Only registered universities are accepted.
          </p>
        </div>
      </div>
    </div>
  );
}
