"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

async function loadPosthog() {
  if (!POSTHOG_KEY) return null;

  const { default: posthog } = await import("posthog-js");
  if (!posthog.__loaded) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
      persistence: "localStorage+cookie",
    });
  }

  return posthog;
}

let posthogPromise: ReturnType<typeof loadPosthog> | null = null;

function getPosthog() {
  if (!posthogPromise) {
    posthogPromise = loadPosthog().catch((error) => {
      posthogPromise = null;
      throw error;
    });
  }
  return posthogPromise;
}

type AnalyticsUser = {
  id: string;
  email: string;
  name: string | null;
};

export function AnalyticsTracker({ user }: { user: AnalyticsUser | null }) {
  const pathname = usePathname();
  const lastNativePathRef = useRef<string | null>(null);
  const lastPosthogPathRef = useRef<string | null>(null);
  const lastPosthogIdentityRef = useRef<string | null>(null);
  const posthogEnabled = Boolean(POSTHOG_KEY);

  useEffect(() => {
    if (!pathname) return;

    if (user && lastNativePathRef.current !== pathname) {
      lastNativePathRef.current = pathname;

      fetch("/api/analytics/pageview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {});
    }

    if (!posthogEnabled) return;

    let cancelled = false;
    const currentUrl = window.location.href;
    const identityKey = user
      ? `${user.id}\u0000${user.email}\u0000${user.name ?? ""}`
      : "anonymous";

    void getPosthog()
      .then((posthog) => {
        if (cancelled || !posthog) return;

        if (lastPosthogIdentityRef.current !== identityKey) {
          if (user) {
            posthog.identify(user.id, {
              email: user.email,
              name: user.name ?? undefined,
            });
          } else {
            posthog.reset();
          }
          lastPosthogIdentityRef.current = identityKey;
        }

        if (lastPosthogPathRef.current !== pathname) {
          posthog.capture("$pageview", {
            path: pathname,
            $current_url: currentUrl,
          });
          lastPosthogPathRef.current = pathname;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname, posthogEnabled, user]);

  return null;
}
