CREATE TABLE "Institution" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "logoDataUrl" TEXT,
  CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Institution_nameKey_key" ON "Institution"("nameKey");
ALTER TABLE "Account"
  ADD COLUMN "institutionPreset" TEXT,
  ADD COLUMN "customInstitutionId" TEXT,
  ADD COLUMN "appearance" JSONB;
ALTER TABLE "Account" ADD CONSTRAINT "Account_customInstitutionId_fkey"
  FOREIGN KEY ("customInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_one_institution"
  CHECK ("institutionPreset" IS NULL OR "customInstitutionId" IS NULL);
