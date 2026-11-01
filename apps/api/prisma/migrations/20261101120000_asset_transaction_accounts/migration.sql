ALTER TABLE "Account" ADD COLUMN "assetId" TEXT;
CREATE UNIQUE INDEX "Account_assetId_key" ON "Account"("assetId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve every valuation and historical record. The associated account holds
-- movements only. Dated valuations remain the authoritative closing balances.
INSERT INTO "Account" ("id", "assetId", "name", "type", "institution", "owner", "openingDate", "openingBalanceCents", "archived")
SELECT gen_random_uuid()::text, "id", "name", "kind", '', "owner", '0001-01-01', 0, "archived"
FROM "Asset";
