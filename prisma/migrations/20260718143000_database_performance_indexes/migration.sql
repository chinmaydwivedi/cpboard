-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformProfile_verified_lastSynced_id_idx" ON "PlatformProfile"("verified", "lastSynced", "id");

-- CreateIndex
CREATE INDEX "PlatformProfile_platform_verified_rating_userId_idx" ON "PlatformProfile"("platform", "verified", "rating" DESC, "userId");

-- CreateIndex
CREATE INDEX "SyncLog_userId_platform_status_syncedAt_idx" ON "SyncLog"("userId", "platform", "status", "syncedAt" DESC);
