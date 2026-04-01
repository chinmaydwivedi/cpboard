"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

const VISITOR_ID_KEY = "cpboard_visitor_id";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server-runtime";

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;

    const generated =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

type AnalyticsUser = {
  id: string;
  email: string;
  name: string | null;
};

export function AnalyticsTracker({ user }: { user: AnalyticsUser | null }) {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string | null>(null);
  const posthogEnabled = Boolean(POSTHOG_KEY);

  useEffect(() => {
    if (!posthogEnabled || posthog.__loaded) return;
    posthog.init(POSTHOG_KEY!, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
      persistence: "localStorage+cookie",
    });
  }, [posthogEnabled]);

  useEffect(() => {
    if (!posthogEnabled || !posthog.__loaded) return;

    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name ?? undefined,
      });
      return;
    }

    posthog.reset();
  }, [posthogEnabled, user]);

  useEffect(() => {
    if (!pathname) return;
    if (lastTrackedPathRef.current === pathname) return;
    lastTrackedPathRef.current = pathname;

    const visitorId = getOrCreateVisitorId();

    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, visitorId }),
      keepalive: true,
    }).catch(() => {});

    if (posthogEnabled && posthog.__loaded) {
      posthog.capture("$pageview", {
        path: pathname,
        $current_url: window.location.href,
      });
    }
  }, [pathname, posthogEnabled]);

  return null;
}
