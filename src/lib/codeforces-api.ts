import "server-only";

import { acquireProviderRequestSlot } from "@/lib/provider-request-queue";

const CODEFORCES_API = "https://codeforces.com/api";
const REQUEST_SPACING_MS = 2_100;
const MAX_PENDING_REQUESTS = 12;
const MAX_QUEUE_WAIT_MS = 25_000;
const PROVIDER_LEASE_KEY = "CODEFORCES_API";

type CodeforcesResponse<T> =
  | { status: "OK"; result: T }
  | { status: "FAILED"; comment?: string };

let queueTail: Promise<void> = Promise.resolve();
let pendingRequests = 0;

/**
 * Codeforces permits one API request every two seconds. The in-process queue
 * bounds local work while the Neon-backed lease spaces requests across all
 * serverless instances and features.
 */
export function fetchCodeforcesApi<T>(
  method: string,
  params: Record<string, string | number | boolean | undefined>,
  timeoutMs = 15_000,
  deadlineAt?: number,
): Promise<T> {
  if (pendingRequests >= MAX_PENDING_REQUESTS) {
    return Promise.reject(
      new Error("Codeforces request queue is busy. Try again shortly."),
    );
  }
  pendingRequests += 1;
  const queuedAt = Date.now();

  const request = queueTail.then(async () => {
    const deadlineRemainingMs = deadlineAt
      ? deadlineAt - Date.now()
      : Number.POSITIVE_INFINITY;
    if (
      Date.now() - queuedAt > MAX_QUEUE_WAIT_MS ||
      deadlineRemainingMs < 500
    ) {
      throw new Error("Codeforces request queue timed out. Try again shortly.");
    }
    await acquireProviderRequestSlot({
      key: PROVIDER_LEASE_KEY,
      spacingMs: REQUEST_SPACING_MS,
      maxQueueWaitMs: Math.min(MAX_QUEUE_WAIT_MS, deadlineRemainingMs),
      queuedAt,
    });

    const fetchRemainingMs = deadlineAt
      ? deadlineAt - Date.now()
      : Number.POSITIVE_INFINITY;
    if (fetchRemainingMs < 1) {
      throw new Error("Codeforces request timed out. Try again shortly.");
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }

    const response = await fetch(
      `${CODEFORCES_API}/${method}?${searchParams.toString()}`,
      {
        cache: "no-store",
        headers: { "User-Agent": "CPBoard/1.0" },
        signal: AbortSignal.timeout(Math.min(timeoutMs, fetchRemainingMs)),
      },
    );

    if (!response.ok) {
      throw new Error(`Codeforces ${method} failed (${response.status})`);
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("status" in payload)) {
      throw new Error(`Codeforces ${method} returned invalid data`);
    }
    const status = (payload as { status?: unknown }).status;
    if (status === "FAILED") {
      const comment = (payload as { comment?: unknown }).comment;
      throw new Error(
        (typeof comment === "string" && comment.trim()) ||
          `Codeforces ${method} returned a failed response`,
      );
    }
    if (status !== "OK" || !("result" in payload)) {
      throw new Error(`Codeforces ${method} returned invalid data`);
    }

    return (payload as CodeforcesResponse<T> & { status: "OK" }).result;
  });

  const settledRequest = request.finally(() => {
    pendingRequests -= 1;
  });
  queueTail = settledRequest.then(
    () => undefined,
    () => undefined,
  );
  return settledRequest;
}
