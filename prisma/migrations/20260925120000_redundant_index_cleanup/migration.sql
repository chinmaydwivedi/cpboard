-- DropIndex
DROP INDEX "University_emailDomain_idx";

-- DropIndex
DROP INDEX "User_username_idx";

-- DropIndex
DROP INDEX "PlatformProfile_platform_idx";

-- DropIndex
DROP INDEX "SyncLog_userId_idx";

-- DropIndex
DROP INDEX "DailyPracticeProblem_date_idx";

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE INDEX "VerificationToken_expires_idx" ON "VerificationToken"("expires");

