-- Existing plans retain their unlimited duration. New plans set an explicit end.
ALTER TABLE "Budget" ADD COLUMN "endMonth" TEXT;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_period_check"
  CHECK ("endMonth" IS NULL OR "endMonth" >= "month");

CREATE TABLE "BudgetOverride" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "amountCents" BIGINT NOT NULL CHECK ("amountCents" >= 0),
  CONSTRAINT "BudgetOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BudgetOverride_categoryId_fkey" FOREIGN KEY ("categoryId")
    REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BudgetOverride_categoryId_month_key" ON "BudgetOverride"("categoryId", "month");
