ALTER TABLE "Rule" ALTER COLUMN "categoryId" DROP NOT NULL;
ALTER TABLE "Rule"
  ADD COLUMN "kind" TEXT,
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "counterAccountId" TEXT,
  ADD COLUMN "direction" TEXT;
ALTER TABLE "Rule"
  ADD CONSTRAINT "Rule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Rule_counterAccountId_fkey" FOREIGN KEY ("counterAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Rule_action_check" CHECK (
    ("kind" IS NULL AND "categoryId" IS NOT NULL AND "accountId" IS NULL AND "counterAccountId" IS NULL AND "direction" IS NULL)
    OR
    ("kind" IS NOT NULL AND "kind" = 'transfer' AND "categoryId" IS NULL AND "accountId" IS NOT NULL AND "counterAccountId" IS NOT NULL AND "accountId" <> "counterAccountId" AND "direction" IS NOT NULL AND "direction" IN ('in', 'out'))
  );
