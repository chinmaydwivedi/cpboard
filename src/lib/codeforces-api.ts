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
): Promise<T> {
  if (pendingRequests >= MAX_PENDING_REQUESTS) {
    return Promise.reject(
      new Error("Codeforces request queue is busy. Try again shortly."),
    );
  }
  pendingRequests += 1;
  const queuedAt = Date.now();

  const request = queueTail.then(async () => {
    if (Date.now() - queuedAt > MAX_QUEUE_WAIT_MS) {
      throw new Error("Codeforces request queue timed out. Try again shortly.");
    }
    await acquireProviderRequestSlot({
      key: PROVIDER_LEASE_KEY,
      spacingMs: REQUEST_SPACING_MS,
      maxQueueWaitMs: MAX_QUEUE_WAIT_MS,
      queuedAt,
    });

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }

    const response = await fetch(
      `${CODEFORCES_API}/${method}?${searchParams.toString()}`,
      {
        cache: "no-store",
        headers: { "User-Agent": "CPBoard/1.0" },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    if (!response.ok) {
      throw new Error(`Codeforces ${method} failed (${response.status})`);
    }

    const payload = (await response.json()) as CodeforcesResponse<T>;
    if (payload.status !== "OK") {
      throw new Error(
        payload.comment || `Codeforces ${method} returned a failed response`,
      );
    }

    return payload.result;
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
