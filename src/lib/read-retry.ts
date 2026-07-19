const READ_RETRY_DELAY_MS = 75;

function waitForRetry() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, READ_RETRY_DELAY_MS);
  });
}

/**
 * Retries an idempotent database read once after a short, bounded delay.
 *
 * Keep writes and externally visible side effects out of this helper: the
 * callback may run twice when a connection is briefly unavailable.
 */
export async function withReadRetry<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch {
    await waitForRetry();
    return read();
  }
}
