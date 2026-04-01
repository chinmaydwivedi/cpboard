-- Keep migration history aligned with schema.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;

-- Enums for daily practice problems and language-specific solutions.
CREATE TYPE "ProblemPlatform" AS ENUM ('LEETCODE', 'CODEFORCES', 'ATCODER', 'CODECHEF');
CREATE TYPE "SolutionLanguage" AS ENUM ('JAVA', 'CPP', 'PYTHON');

-- One daily problem per date.
CREATE TABLE "DailyPracticeProblem" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "platform" "ProblemPlatform" NOT NULL,
  "title" TEXT NOT NULL,
  "problemUrl" TEXT NOT NULL,
  "difficulty" TEXT,
  "notes" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyPracticeProblem_pkey" PRIMARY KEY ("id")
);

-- Three language solutions (JAVA/CPP/PYTHON) per problem.
CREATE TABLE "DailyPracticeSolution" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "language" "SolutionLanguage" NOT NULL,
  "code" TEXT NOT NULL,
  "explanation" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyPracticeSolution_pkey" PRIMARY KEY ("id")
);

-- Problem discussion thread comments.
CREATE TABLE "DailyPracticeComment" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyPracticeComment_pkey" PRIMARY KEY ("id")
);

-- Per-user solve marks for POTD and streak computation.
CREATE TABLE "PotdSolve" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "solvedDate" DATE NOT NULL,

  CONSTRAINT "PotdSolve_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyPracticeProblem_date_key" ON "DailyPracticeProblem"("date");
CREATE INDEX "DailyPracticeProblem_date_idx" ON "DailyPracticeProblem"("date");
CREATE INDEX "DailyPracticeProblem_isPublished_date_idx" ON "DailyPracticeProblem"("isPublished", "date");
CREATE INDEX "DailyPracticeProblem_createdById_idx" ON "DailyPracticeProblem"("createdById");

CREATE UNIQUE INDEX "DailyPracticeSolution_problemId_language_key" ON "DailyPracticeSolution"("problemId", "language");
CREATE INDEX "DailyPracticeSolution_createdById_idx" ON "DailyPracticeSolution"("createdById");

CREATE INDEX "DailyPracticeComment_problemId_createdAt_idx" ON "DailyPracticeComment"("problemId", "createdAt");
CREATE INDEX "DailyPracticeComment_userId_createdAt_idx" ON "DailyPracticeComment"("userId", "createdAt");

CREATE UNIQUE INDEX "PotdSolve_problemId_userId_key" ON "PotdSolve"("problemId", "userId");
CREATE INDEX "PotdSolve_userId_solvedDate_idx" ON "PotdSolve"("userId", "solvedDate");

ALTER TABLE "DailyPracticeProblem"
ADD CONSTRAINT "DailyPracticeProblem_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyPracticeSolution"
ADD CONSTRAINT "DailyPracticeSolution_problemId_fkey"
FOREIGN KEY ("problemId") REFERENCES "DailyPracticeProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyPracticeSolution"
ADD CONSTRAINT "DailyPracticeSolution_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyPracticeComment"
ADD CONSTRAINT "DailyPracticeComment_problemId_fkey"
FOREIGN KEY ("problemId") REFERENCES "DailyPracticeProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyPracticeComment"
ADD CONSTRAINT "DailyPracticeComment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PotdSolve"
ADD CONSTRAINT "PotdSolve_problemId_fkey"
FOREIGN KEY ("problemId") REFERENCES "DailyPracticeProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PotdSolve"
ADD CONSTRAINT "PotdSolve_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
