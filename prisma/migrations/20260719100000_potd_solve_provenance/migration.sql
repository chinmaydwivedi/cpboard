-- Historical POTD marks predate platform ownership verification, so retain
-- them for auditability but exclude them from public streaks until the user
-- re-verifies the solve through the current flow.
ALTER TABLE "PotdSolve"
ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
