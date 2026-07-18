-- Coordinate expensive provider refreshes across serverless instances and
-- retain a durable failure backoff so one broken profile cannot monopolize a
-- scheduled sync cycle.
CREATE TABLE "PlatformSyncLease" (
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "leaseToken" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "lastStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSyncLease_pkey" PRIMARY KEY ("userId", "platform")
);

CREATE INDEX "PlatformSyncLease_leaseUntil_idx"
ON "PlatformSyncLease"("leaseUntil");

CREATE INDEX "PlatformSyncLease_nextAttemptAt_lastStartedAt_idx"
ON "PlatformSyncLease"("nextAttemptAt", "lastStartedAt");

ALTER TABLE "PlatformSyncLease"
ADD CONSTRAINT "PlatformSyncLease_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Generic distributed pacing primitive. Provider integrations can atomically
-- advance nextAllowedAt instead of depending on process-local module state.
CREATE TABLE "ProviderRequestLease" (
    "provider" TEXT NOT NULL,
    "nextAllowedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderRequestLease_pkey" PRIMARY KEY ("provider")
);
