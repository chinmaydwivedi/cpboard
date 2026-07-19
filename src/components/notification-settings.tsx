"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BellRing,
  CalendarClock,
  Check,
  Loader2,
  Send,
  ShieldAlert,
  Trophy,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type NotificationPreferences = {
  leaderAlerts: boolean;
  contestAlerts: boolean;
  contestLeadMinutes: 15 | 30 | 60;
};

function samePreferences(
  left: NotificationPreferences,
  right: NotificationPreferences,
) {
  return (
    left.leaderAlerts === right.leaderAlerts &&
    left.contestAlerts === right.contestAlerts &&
    left.contestLeadMinutes === right.contestLeadMinutes
  );
}

type NotificationState =
  | "checking"
  | "idle"
  | "disconnected"
  | "error"
  | "active"
  | "blocked"
  | "unavailable";

function urlBase64ToArrayBuffer(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer;
}

async function waitForActiveServiceWorker() {
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("The notification worker took too long to start")),
      10_000,
    );
    void navigator.serviceWorker.ready.then((registration) => {
      window.clearTimeout(timeout);
      resolve(registration);
    });
  });
}

async function getPushServiceWorker() {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  return registration.active ? registration : waitForActiveServiceWorker();
}

function sameApplicationServerKey(
  current: ArrayBuffer | null,
  expected: ArrayBuffer,
) {
  if (!current) return false;
  const currentBytes = new Uint8Array(current);
  const expectedBytes = new Uint8Array(expected);
  if (currentBytes.length !== expectedBytes.length) return false;
  return currentBytes.every((value, index) => value === expectedBytes[index]);
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true
  );
}

function PreferenceSwitch({
  checked,
  disabled,
  label,
  descriptionId,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  descriptionId: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-describedby={descriptionId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex min-h-11 min-w-11 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors",
          checked
            ? "border-primary/60 bg-primary"
            : "border-border bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

export function NotificationSettings({
  vapidPublicKey,
  initialPreferences,
}: {
  vapidPublicKey: string | null;
  initialPreferences: NotificationPreferences;
}) {
  const [state, setState] = useState<NotificationState>("checking");
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(initialPreferences);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState<"enable" | "disable" | "test" | "preference" | null>(null);
  const [explanation, setExplanation] = useState("Checking this browser…");
  const [liveMessage, setLiveMessage] = useState("");
  const inspectionIdRef = useRef(0);
  const enableInFlightRef = useRef(false);
  const preferenceRevisionRef = useRef(0);
  const initialPreferencesRef = useRef(initialPreferences);
  const {
    leaderAlerts: initialLeaderAlerts,
    contestAlerts: initialContestAlerts,
    contestLeadMinutes: initialContestLeadMinutes,
  } = initialPreferences;

  const inspectBrowser = useCallback(async () => {
    const inspectionId = ++inspectionIdRef.current;
    const preferenceRevision = preferenceRevisionRef.current;
    const isCurrentInspection = () => inspectionIdRef.current === inspectionId;

    setState("checking");
    setExplanation("Checking this browser…");

    if (!vapidPublicKey) {
      setState("unavailable");
      setExplanation("Notifications have not been configured on this deployment yet.");
      return;
    }
    if (
      !window.isSecureContext ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unavailable");
      setExplanation("This browser does not support secure web push notifications.");
      return;
    }
    if (isIosDevice() && !isStandalone()) {
      setState("unavailable");
      setExplanation("On iPhone or iPad, add CPBoard to your Home Screen first.");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      setExplanation("Allow CPBoard in your browser’s site settings, then reload this page.");
      return;
    }

    try {
      const registration = await getPushServiceWorker();
      const browserSubscription = await registration.pushManager.getSubscription();
      if (!isCurrentInspection()) return;
      setSubscription(browserSubscription);

      if (browserSubscription) {
        const response = await fetch("/api/notifications/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: browserSubscription.endpoint }),
        });
        const result = await response.json().catch(() => ({}));
        if (!isCurrentInspection()) return;
        if (!response.ok) {
          setState("error");
          setExplanation(
            result.error || "CPBoard could not confirm this browser connection.",
          );
          return;
        }
        if (
          result.preferences &&
          preferenceRevisionRef.current === preferenceRevision
        ) {
          setPreferences(result.preferences as NotificationPreferences);
        }
        if (result.subscribed) {
          setState("active");
          setExplanation("This browser is connected and ready to receive alerts.");
        } else {
          setState("disconnected");
          setExplanation("Reconnect this browser to resume alerts.");
        }
        return;
      }

      if (Notification.permission === "granted") {
        setState("disconnected");
        setExplanation("Permission is allowed, but this browser is not connected.");
      } else {
        setState("idle");
        setExplanation("Enable alerts when you want them—CPBoard will ask only once.");
      }
    } catch {
      if (!isCurrentInspection()) return;
      setState("error");
      setExplanation(
        "CPBoard could not prepare notifications right now. Retry the connection.",
      );
    }
  }, [vapidPublicKey]);

  useEffect(() => {
    void inspectBrowser();
    return () => {
      inspectionIdRef.current += 1;
    };
  }, [inspectBrowser]);

  useEffect(() => {
    const nextPreferences: NotificationPreferences = {
      leaderAlerts: initialLeaderAlerts,
      contestAlerts: initialContestAlerts,
      contestLeadMinutes: initialContestLeadMinutes,
    };
    if (samePreferences(initialPreferencesRef.current, nextPreferences)) return;

    initialPreferencesRef.current = nextPreferences;
    preferenceRevisionRef.current += 1;
    setPreferences((current) =>
      samePreferences(current, nextPreferences) ? current : nextPreferences,
    );
  }, [
    initialContestAlerts,
    initialContestLeadMinutes,
    initialLeaderAlerts,
  ]);

  const enableNotifications = async () => {
    if (!vapidPublicKey || enableInFlightRef.current) return;
    enableInFlightRef.current = true;
    setBusy("enable");
    try {
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        const blocked = permission === "denied";
        setState(blocked ? "blocked" : "idle");
        setExplanation(
          blocked
            ? "Allow CPBoard in your browser’s site settings, then reload this page."
            : "Permission wasn’t granted. You can try again when you’re ready.",
        );
        setLiveMessage(
          blocked
            ? "Browser notifications were blocked."
            : "Browser notification permission was not granted.",
        );
        return;
      }

      const registration = await getPushServiceWorker();
      const existing = await registration.pushManager.getSubscription();
      let previousEndpoint: string | undefined;
      const applicationServerKey = urlBase64ToArrayBuffer(vapidPublicKey);
      const keyMatches = existing
        ? sameApplicationServerKey(
            existing.options.applicationServerKey,
            applicationServerKey,
          )
        : false;
      if (existing && !keyMatches) {
        previousEndpoint = existing.endpoint;
        await existing.unsubscribe();
      }
      const nextSubscription =
        existing && keyMatches
          ? existing
          : await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            });
      setSubscription(nextSubscription);
      const serialized = nextSubscription.toJSON();
      if (!serialized.keys?.p256dh || !serialized.keys.auth) {
        throw new Error("Browser did not return subscription keys");
      }

      const response = await fetch("/api/notifications/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: nextSubscription.endpoint,
          keys: serialized.keys,
          previousEndpoint,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not connect this browser");

      setSubscription(nextSubscription);
      setState("active");
      setExplanation("This browser is connected and ready to receive alerts.");
      setLiveMessage("Browser notifications enabled.");
      toast.success("Browser notifications enabled");
    } catch (error) {
      setState("error");
      const message = error instanceof Error ? error.message : "Could not enable notifications";
      setExplanation(message);
      setLiveMessage(message);
      toast.error(message);
    } finally {
      enableInFlightRef.current = false;
      setBusy(null);
    }
  };

  const disableNotifications = async () => {
    if (!subscription) return;
    setBusy("disable");
    const endpoint = subscription.endpoint;
    try {
      await subscription.unsubscribe();
      setSubscription(null);
      setState("disconnected");
      setExplanation("This browser is disconnected. Your preferences are saved.");
      const response = await fetch("/api/notifications/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      if (!response.ok) {
        throw new Error("Browser disconnected; server cleanup will happen automatically");
      }
      setLiveMessage("Browser notifications disabled on this device.");
      toast.success("Notifications disabled on this browser");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not disable notifications";
      setLiveMessage(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const updatePreference = async (
    patch: Partial<NotificationPreferences>,
  ) => {
    const previous = preferences;
    preferenceRevisionRef.current += 1;
    setPreferences((current) => ({ ...current, ...patch }));
    setBusy("preference");
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save preferences");
      const savedPreferences = result.preferences as NotificationPreferences;
      setPreferences((current) =>
        samePreferences(current, savedPreferences) ? current : savedPreferences,
      );
      setLiveMessage("Notification preferences saved.");
    } catch (error) {
      setPreferences(previous);
      const message = error instanceof Error ? error.message : "Could not save preferences";
      setLiveMessage(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    if (!subscription) return;
    setBusy("test");
    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Test notification failed");
      setLiveMessage("Test notification sent.");
      toast.success("Test notification sent");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test notification failed";
      setLiveMessage(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const active = state === "active";
  const canEnable =
    state === "idle" || state === "disconnected" || state === "error";
  const settingsDisabled = busy !== null || state === "checking";
  const status = {
    checking: "Checking",
    idle: "Off",
    disconnected: "Disconnected",
    error: "Connection issue",
    active: "Active",
    blocked: "Blocked",
    unavailable: "Unavailable",
  }[state];

  return (
    <section
      className="mb-8 overflow-hidden rounded-lg border border-border/80 bg-card/60"
      data-tour="dash-notifications"
    >
      <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <BellRing className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Browser notifications</h2>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                state === "active" && "border-primary/30 text-primary",
                state === "blocked" && "border-amber-500/30 text-amber-500",
                state === "error" && "border-amber-500/30 text-amber-500",
              )}
            >
              {state === "active" && <Check className="size-2.5" />}
              {state === "blocked" && <ShieldAlert className="size-2.5" />}
              {status}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{explanation}</p>
        </div>
        {canEnable && (
          <Button
            size="sm"
            onClick={enableNotifications}
            disabled={busy !== null}
            aria-busy={busy === "enable"}
            className="w-full sm:min-w-36 sm:w-auto"
          >
            <span className="relative size-4 shrink-0" aria-hidden="true">
              <BellRing
                className={cn(
                  "absolute inset-0 size-4 transition-opacity",
                  busy === "enable" ? "opacity-0" : "opacity-100",
                )}
              />
              <Loader2
                className={cn(
                  "absolute inset-0 size-4 transition-opacity",
                  busy === "enable"
                    ? "motion-safe:animate-spin opacity-100"
                    : "opacity-0",
                )}
              />
            </span>
            {busy === "enable"
              ? "Connecting…"
              : state === "error"
                ? "Retry connection"
                : state === "disconnected"
                  ? "Reconnect browser"
                  : "Enable alerts"}
          </Button>
        )}
      </div>

      <div className="divide-y divide-border/40">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Trophy className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Global leader changes</p>
              <p id="leader-alert-description" className="mt-0.5 text-[11px] text-muted-foreground">
                Know when someone takes the global lead across all synced platforms.
              </p>
            </div>
          </div>
          <PreferenceSwitch
            label="Global leader change alerts"
            descriptionId="leader-alert-description"
            checked={preferences.leaderAlerts}
            disabled={settingsDisabled}
            onChange={(leaderAlerts) => void updatePreference({ leaderAlerts })}
          />
        </div>

        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CalendarClock className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Contest reminders</p>
              <p id="contest-alert-description" className="mt-0.5 text-[11px] text-muted-foreground">
                Checked every 10 minutes for Codeforces, LeetCode, AtCoder, and CodeChef.
              </p>
            </div>
          </div>
          <div className="flex min-h-11 w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <Select
              value={String(preferences.contestLeadMinutes)}
              onValueChange={(value) => {
                const minutes = Number(value) as 15 | 30 | 60;
                if ([15, 30, 60].includes(minutes)) {
                  void updatePreference({ contestLeadMinutes: minutes });
                }
              }}
              disabled={!preferences.contestAlerts || settingsDisabled}
            >
              <SelectTrigger
                size="sm"
                className="min-w-28"
                aria-label="Contest reminder time"
                aria-describedby="contest-alert-description"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">About 15 min before</SelectItem>
                <SelectItem value="30">About 30 min before</SelectItem>
                <SelectItem value="60">About 60 min before</SelectItem>
              </SelectContent>
            </Select>
            <PreferenceSwitch
              label="Contest reminder alerts"
              descriptionId="contest-alert-description"
              checked={preferences.contestAlerts}
              disabled={settingsDisabled}
              onChange={(contestAlerts) => void updatePreference({ contestAlerts })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/50 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] text-muted-foreground">
          Preferences follow your account. Each browser must be enabled separately.
        </p>
        {active && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              variant="outline"
              onClick={sendTest}
              disabled={busy !== null}
              className="w-full sm:w-auto"
            >
              {busy === "test" ? <Loader2 className="animate-spin" /> : <Send />}
              Send test
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={disableNotifications}
              disabled={busy !== null}
              className="w-full text-destructive hover:text-destructive sm:w-auto"
            >
              {busy === "disable" ? <Loader2 className="animate-spin" /> : <Unplug />}
              Disable this browser
            </Button>
          </div>
        )}
      </div>
      <span className="sr-only" aria-live="polite">{liveMessage}</span>
    </section>
  );
}
