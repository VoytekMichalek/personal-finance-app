import { normaliseDescription, type RememberedRule } from "@finance/shared";
import type { Prisma } from "@prisma/client";

// Shared by import approval and ledger review so concurrent remembering stays idempotent.
export async function saveRememberedRule(
  tx: Prisma.TransactionClient,
  rule: RememberedRule,
  categoryId: string,
  categoryKind: string,
) {
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    "remembered-import-categories",
  );
  const pattern = normaliseDescription(rule.pattern);
  const existing = await tx.rule.findMany({
    where: { matchMode: rule.matchMode, category: { kind: categoryKind } },
  });
  const matches = existing.filter(
    (item) => normaliseDescription(item.pattern) === pattern,
  );
  const data = { categoryId, enabled: true };
  if (matches.length) {
    await tx.rule.updateMany({
      where: { id: { in: matches.map((item) => item.id) } },
      data,
    });
    return { ...matches[0]!, ...data };
  }
  return tx.rule.create({
    data: { ...data, pattern, matchMode: rule.matchMode, priority: 0 },
  });
}
