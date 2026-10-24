ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "Statement" (
 "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "importBatchId" TEXT NOT NULL,
 "filename" TEXT NOT NULL, "content" BYTEA NOT NULL, "pages" INTEGER NOT NULL,
 "details" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Statement_importBatchId_key" ON "Statement"("importBatchId");
CREATE INDEX "Statement_accountId_idx" ON "Statement"("accountId");
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
