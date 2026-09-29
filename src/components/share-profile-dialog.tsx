"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Share2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shows the public profile link with a copy button that confirms in place, so
 * sharing works even where the clipboard API or toasts are unavailable.
 */
export function ShareProfileDialog({
  open,
  onOpenChange,
  username,
  displayName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  displayName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  // Only rendered while open, which is always client-side.
  const url =
    typeof window === "undefined" ? `/u/${username}` : `${window.location.origin}/u/${username}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers that block the async clipboard API.
      inputRef.current?.select();
      if (!document.execCommand("copy")) {
        toast.error("Couldn't copy automatically", {
          description: "Select the link and copy it manually.",
        });
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({ title: `${displayName} on CPBoard`, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Couldn't open the share sheet");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setCopied(false);
      }}
    >
      <DialogContent className="border border-border/60 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl italic">Share your profile</DialogTitle>
          <DialogDescription>
            Anyone signed in to CPBoard can open this link to see your stats, heatmap and linked
            platforms.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            readOnly
            value={url}
            aria-label="Public profile link"
            onFocus={(event) => event.currentTarget.select()}
            className="h-9 font-mono text-[12px]"
          />
          <Button type="button" onClick={() => void copy()} className="h-9 shrink-0 gap-1.5 px-3">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogFooter className="bg-card sm:justify-between">
          <Link
            href={`/u/${username}`}
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 px-3 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <UserRound className="size-3.5" aria-hidden="true" /> View public profile
          </Link>
          {canShare && (
            <Button type="button" variant="outline" size="sm" onClick={() => void share()} className="gap-1.5">
              <Share2 aria-hidden="true" /> Share…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
