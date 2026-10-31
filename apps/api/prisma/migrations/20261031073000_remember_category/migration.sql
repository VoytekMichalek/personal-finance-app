CREATE TYPE "RuleMatchMode" AS ENUM ('contains', 'exact');
ALTER TABLE "Rule" ADD COLUMN "matchMode" "RuleMatchMode" NOT NULL DEFAULT 'contains';
