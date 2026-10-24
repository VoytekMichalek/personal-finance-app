ALTER TABLE "Statement"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN "processingError" TEXT,
  ADD COLUMN "processingOptions" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "leaseToken" TEXT,
  ADD COLUMN "leaseUntil" TIMESTAMP(3);
CREATE INDEX "Statement_status_leaseUntil_idx" ON "Statement"("status", "leaseUntil");
