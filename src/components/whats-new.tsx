"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles, BookText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CURRENT_CHANGELOG } from "@/lib/changelog";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "cpboard:open-whats-new";
const SEEN_RELEASE_KEY = "cpboard_whats_new_seen_release";
const SEEN_AT_KEY = "cpboard_whats_new_seen_at";
const SNOOZE_UNTIL_KEY = "cpboard_whats_new_snooze_until";
const SNOOZE_MS = 12 * 60 * 60 * 1000;

function getSnoozeUntil(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(SNOOZE_UNTIL_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function setSnooze() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    SNOOZE_UNTIL_KEY,
    String(Date.now() + SNOOZE_MS)
  );
}

export function openWhatsNewModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function WhatsNewModal({ releaseId }: { releaseId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (pathname === "/changelog") return;

    const seenRelease = localStorage.getItem(SEEN_RELEASE_KEY);
    if (seenRelease === releaseId) return;
    if (Date.now() < getSnoozeUntil()) return;

    const timer = window.setTimeout(() => setOpen(true), 320);
    return () => window.clearTimeout(timer);
  }, [pathname, releaseId]);

  const markSeenAndClose = () => {
    localStorage.setItem(SEEN_RELEASE_KEY, releaseId);
    localStorage.setItem(SEEN_AT_KEY, new Date().toISOString());
    window.sessionStorage.removeItem(SNOOZE_UNTIL_KEY);
    setOpen(false);
  };

  const maybeLater = () => {
    setSnooze();
    setOpen(false);
  };

  const openChangelog = () => {
    localStorage.setItem(SEEN_RELEASE_KEY, releaseId);
    localStorage.setItem(SEEN_AT_KEY, new Date().toISOString());
    window.sessionStorage.removeItem(SNOOZE_UNTIL_KEY);
    setOpen(false);
    router.push("/changelog");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          const seenRelease = localStorage.getItem(SEEN_RELEASE_KEY);
          if (seenRelease !== releaseId) {
            setSnooze();
          }
        }
        setOpen(next);
      }}
    >
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-xl border border-border/70 bg-card/95 backdrop-blur-xl p-0 overflow-hidden"
        data-tour="whats-new-modal"
      >
        <div className="bg-linear-to-br from-primary/15 via-card to-card p-5 sm:p-6">
          <DialogHeader className="gap-3">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium tracking-wide text-primary uppercase">
                What&apos;s New
              </span>
            </div>
            <DialogTitle className="text-2xl sm:text-3xl leading-tight">
              {CURRENT_CHANGELOG.headline}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-[15px] max-w-[36rem] leading-relaxed">
              {CURRENT_CHANGELOG.summary}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-2.5">
            {CURRENT_CHANGELOG.highlights.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border/50 bg-background/65 p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/70">
                    <Image
                      src={item.iconSrc || "/favicon.ico"}
                      alt=""
                      width={18}
                      height={18}
                      className="rounded-[4px]"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono",
                          item.label === "NEW" &&
                            "border-primary/40 text-primary",
                          item.label === "IMPROVED" &&
                            "border-emerald-400/40 text-emerald-300",
                          item.label === "FIXED" &&
                            "border-amber-400/40 text-amber-300"
                        )}
                      >
                        {item.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-border/60 text-muted-foreground"
                      >
                        {item.pageLabel}
                      </Badge>
                      <p className="text-sm font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="bg-card/95 p-4 sm:p-5 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            className="sm:mr-auto"
            onClick={maybeLater}
          >
            Maybe later
          </Button>
          <Button type="button" variant="outline" onClick={openChangelog}>
            <BookText className="h-3.5 w-3.5 mr-1.5" />
            Full changelog
          </Button>
          <Button type="button" onClick={markSeenAndClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
