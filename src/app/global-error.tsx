"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12 text-center">
          <div className="w-full rounded-xl border border-border/60 bg-card px-6 py-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Site unavailable
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              CPBoard couldn&apos;t finish loading
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Retry now, or return in a moment if the service is still
              recovering.
            </p>
            <button
              type="button"
              className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={unstable_retry}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
