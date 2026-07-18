-- Keep ownership challenges separate from public platform profiles so pending
-- handles never appear in rankings or activity feeds.
-- Hold the ALTER TABLE lock through the cohort backfill. A signup racing this
-- migration must wait, then receives the new default instead of being
-- accidentally grandfathered by the UPDATE snapshot.
BEGIN;

ALTER TABLE "User"
ADD COLUMN "ownershipVerificationRequired" BOOLEAN NOT NULL DEFAULT true;

-- This feature applies only to accounts created after the rollout. Members
-- already registered at migration time retain the direct link/sync flow.
UPDATE "User"
SET "ownershipVerificationRequired" = false;

ALTER TABLE "PlatformProfile"
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verificationMethod" TEXT,
ADD COLUMN "ownershipKey" TEXT;

CREATE UNIQUE INDEX "PlatformProfile_ownershipKey_key"
ON "PlatformProfile"("ownershipKey");

-- Grandfather existing linked handles so this rollout does not interrupt
-- current members. Accounts marked as requiring verification use the challenge
-- for new profiles and later handle changes. If legacy rows contain a duplicate
-- normalized handle, keep the oldest verified link and leave duplicates private.
WITH ranked_profiles AS (
    SELECT
        candidate_profiles."id",
        ROW_NUMBER() OVER (
            PARTITION BY
                candidate_profiles."platform",
                lower(btrim(candidate_profiles."handle"))
            ORDER BY
                candidate_profiles."verified" DESC,
                candidate_profiles."createdAt" ASC,
                candidate_profiles."id" ASC
        ) AS ownership_rank
    FROM "PlatformProfile" AS candidate_profiles
    INNER JOIN "User" AS owners
        ON owners."id" = candidate_profiles."userId"
    WHERE owners."ownershipVerificationRequired" = false
    AND candidate_profiles."platform" IN (
        'CODEFORCES'::"Platform",
        'LEETCODE'::"Platform"
    )
)
UPDATE "PlatformProfile" AS profiles
SET
    "verified" = profiles."verified" AND ranked_profiles.ownership_rank = 1,
    "verifiedAt" = CASE
        WHEN profiles."verified" AND ranked_profiles.ownership_rank = 1
            THEN COALESCE(
                profiles."lastSynced",
                profiles."updatedAt",
                profiles."createdAt",
                CURRENT_TIMESTAMP
            )
        ELSE NULL
    END,
    "verificationMethod" = CASE
        WHEN profiles."verified" AND ranked_profiles.ownership_rank = 1
            THEN 'LEGACY_LINK'
        ELSE NULL
    END,
    "ownershipKey" = CASE
        WHEN profiles."verified" AND ranked_profiles.ownership_rank = 1
            THEN profiles."platform"::text || ':' || lower(btrim(profiles."handle"))
        ELSE NULL
    END
FROM ranked_profiles
WHERE profiles."id" = ranked_profiles."id";

-- Preserve rolling-deploy compatibility with the previous app. Proof-omitting
-- writes from exempt accounts receive LEGACY_ACCOUNT metadata; the same writes
-- from verification-required accounts are made private. A new-app write with
-- matching proof fields keeps its submission-challenge metadata.
CREATE FUNCTION "enforce_platform_profile_verification"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    verification_required BOOLEAN;
    expected_ownership_key TEXT;
BEGIN
    IF NEW."platform" IN (
        'CODEFORCES'::"Platform",
        'LEETCODE'::"Platform"
    )
    AND NEW."verified" = true THEN
        expected_ownership_key :=
            NEW."platform"::text || ':' || lower(btrim(NEW."handle"));
        SELECT users."ownershipVerificationRequired"
        INTO verification_required
        FROM "User" AS users
        WHERE users."id" = NEW."userId";

        IF verification_required = false THEN
            -- The previous application version does not know about proof
            -- columns. Preserve the direct-link promise for exempt accounts
            -- while old and new instances overlap during deployment.
            IF NEW."ownershipKey" IS DISTINCT FROM expected_ownership_key THEN
                NEW."verifiedAt" := CURRENT_TIMESTAMP;
            ELSE
                NEW."verifiedAt" := COALESCE(NEW."verifiedAt", CURRENT_TIMESTAMP);
            END IF;
            NEW."verificationMethod" := 'LEGACY_ACCOUNT';
            NEW."ownershipKey" := expected_ownership_key;
        ELSIF (
            NEW."verifiedAt" IS NULL
            OR NEW."ownershipKey" IS NULL
            OR NEW."ownershipKey" <> expected_ownership_key
        ) THEN
            NEW."verified" := false;
            NEW."verifiedAt" := NULL;
            NEW."verificationMethod" := NULL;
            NEW."ownershipKey" := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "PlatformProfile_enforce_verification"
BEFORE INSERT OR UPDATE ON "PlatformProfile"
FOR EACH ROW
EXECUTE FUNCTION "enforce_platform_profile_verification"();

CREATE TABLE "PlatformVerificationChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "normalizedHandle" TEXT NOT NULL,
    "allocationKey" TEXT,
    "problemKey" TEXT NOT NULL,
    "problemTitle" TEXT NOT NULL,
    "problemUrl" TEXT NOT NULL,
    "requiredVerdict" TEXT,
    "baselineSubmissionIds" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformVerificationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformVerificationChallenge_userId_platform_key"
ON "PlatformVerificationChallenge"("userId", "platform");

CREATE UNIQUE INDEX "PlatformVerificationChallenge_allocationKey_key"
ON "PlatformVerificationChallenge"("allocationKey");

CREATE INDEX "PlatformVerificationChallenge_platform_normalizedHandle_exp_idx"
ON "PlatformVerificationChallenge"("platform", "normalizedHandle", "expiresAt");

CREATE INDEX "PlatformVerificationChallenge_expiresAt_idx"
ON "PlatformVerificationChallenge"("expiresAt");

ALTER TABLE "PlatformVerificationChallenge"
ADD CONSTRAINT "PlatformVerificationChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlatformVerificationStartLease" (
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "lastStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformVerificationStartLease_pkey" PRIMARY KEY ("userId", "platform")
);

ALTER TABLE "PlatformVerificationStartLease"
ADD CONSTRAINT "PlatformVerificationStartLease_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
