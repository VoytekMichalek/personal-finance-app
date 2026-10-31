import {
  normaliseDescription,
  ruleSchema,
  type RememberedRule,
} from "@finance/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { validateAccount, validateCategory } from "./service.js";

export async function saveRule(body: unknown, id?: string) {
  const data = ruleSchema.parse(body);
  return prisma.$transaction(async (tx) => {
    if (data.kind === "transfer") {
      await validateAccount(tx, data.accountId!);
      await validateAccount(tx, data.counterAccountId!);
    } else await validateCategory(tx, data.categoryId);
    return id
      ? tx.rule.update({ where: { id }, data })
      : tx.rule.create({ data });
  });
}
export async function saveRememberedTransferRule(
  tx: Prisma.TransactionClient,
  rule: RememberedRule,
  accountId: string,
  counterAccountId: string,
  direction: "in" | "out",
) {
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    "remembered-import-categories",
  );
  const pattern = normaliseDescription(rule.pattern);
  const existing = await tx.rule.findMany({
    where: {
      kind: "transfer",
      accountId,
      direction,
      matchMode: rule.matchMode,
    },
  });
  const matches = existing.filter(
    (item) => normaliseDescription(item.pattern) === pattern,
  );
  const data = { counterAccountId, enabled: true };
  if (matches.length) {
    await tx.rule.updateMany({
      where: { id: { in: matches.map((item) => item.id) } },
      data,
    });
    return { ...matches[0]!, ...data };
  }
  return tx.rule.create({
    data: {
      ...data,
      kind: "transfer",
      accountId,
      direction,
      pattern,
      matchMode: rule.matchMode,
      priority: 0,
    },
  });
}
