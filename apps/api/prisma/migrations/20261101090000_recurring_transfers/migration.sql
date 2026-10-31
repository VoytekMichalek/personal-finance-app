ALTER TABLE "Schedule" ADD COLUMN "counterAccountId" TEXT;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_counterAccountId_fkey"
  FOREIGN KEY ("counterAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_transfer_accounts_check" CHECK (
  ("kind" = 'transfer' AND "counterAccountId" IS NOT NULL
    AND "counterAccountId" <> "accountId" AND "categoryId" IS NULL AND NOT "subscription")
  OR ("kind" IN ('income', 'expense') AND "counterAccountId" IS NULL)
);
