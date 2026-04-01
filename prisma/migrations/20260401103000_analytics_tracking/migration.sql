-- Add profile visit counter on users.
ALTER TABLE "User"
ADD COLUMN "profileViews" INTEGER NOT NULL DEFAULT 0;

-- Track normalized site page visits for admin analytics.
CREATE TABLE "PageVisit" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PageVisit"
ADD CONSTRAINT "PageVisit_viewerUserId_fkey"
FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PageVisit_createdAt_idx" ON "PageVisit"("createdAt");
CREATE INDEX "PageVisit_path_createdAt_idx" ON "PageVisit"("path", "createdAt");
CREATE INDEX "PageVisit_viewerUserId_createdAt_idx" ON "PageVisit"("viewerUserId", "createdAt");
CREATE INDEX "PageVisit_visitorId_path_createdAt_idx" ON "PageVisit"("visitorId", "path", "createdAt");
