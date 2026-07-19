-- Preserve shared practice content if its author later removes their account.
ALTER TABLE "DailyPracticeProblem"
DROP CONSTRAINT "DailyPracticeProblem_createdById_fkey";

ALTER TABLE "DailyPracticeSolution"
DROP CONSTRAINT "DailyPracticeSolution_createdById_fkey";

ALTER TABLE "DailyPracticeProblem"
ALTER COLUMN "createdById" DROP NOT NULL;

ALTER TABLE "DailyPracticeSolution"
ALTER COLUMN "createdById" DROP NOT NULL;

ALTER TABLE "DailyPracticeProblem"
ADD CONSTRAINT "DailyPracticeProblem_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyPracticeSolution"
ADD CONSTRAINT "DailyPracticeSolution_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Atomic, database-backed request limits shared by every serverless instance.
CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- Domains and subdomains are trusted only when explicitly assigned. This
-- avoids granting access to every delegated subdomain of a university.
CREATE TABLE "UniversityEmailDomain" (
  "domain" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,

  CONSTRAINT "UniversityEmailDomain_pkey" PRIMARY KEY ("domain")
);

CREATE INDEX "UniversityEmailDomain_universityId_idx"
ON "UniversityEmailDomain"("universityId");

ALTER TABLE "UniversityEmailDomain"
ADD CONSTRAINT "UniversityEmailDomain_universityId_fkey"
FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the established PESU student-mail domain while moving matching to
-- an explicit allowlist.
INSERT INTO "UniversityEmailDomain" ("domain", "universityId")
SELECT 'stu.pes.edu', "id"
FROM "University"
WHERE LOWER("emailDomain") = 'pesu.pes.edu'
ON CONFLICT ("domain") DO NOTHING;

CREATE INDEX "PlatformProfile_platform_verified_lastSynced_id_idx"
ON "PlatformProfile"("platform", "verified", "lastSynced", "id");
