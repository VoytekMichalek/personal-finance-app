import {
  today,
  categorise,
  applyTransferRules,
  type Category,
  type Rule,
  type ImportRow,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { validateAccount } from "../finance/service.js";
import { readStatement } from "./read.js";
import { recoverBalances } from "./balances.js";
import { recurringSuggestions } from "./suggestions.js";
export async function processStatement(
  accountId: string,
  content: Buffer,
  options: { year?: number; useAi?: boolean; modelId?: string | null },
  onExtracted: (pages: number) => Promise<void>,
) {
  const account = await validateAccount(prisma, accountId);
  const [categories, rules, history, accounts] = await Promise.all([
    prisma.category.findMany(),
    prisma.rule.findMany(),
    prisma.transaction.findMany({ where: { accountId } }),
    prisma.account.findMany(),
  ]);
  const { rows, details, pages } = await readStatement(
    content,
    account.owner,
    json<Category[]>(categories),
    account.type,
    options,
    onExtracted,
  );
  recoverBalances(details, rows, account.type);
  if (account.type === "credit") {
    for (const row of rows) {
      if (row.amountCents > 0) {
        row.kind = /refund|reversal|returned|cashback/i.test(row.description)
          ? "refund"
          : "transfer";
        row.categoryId = null;
      }
    }
    details.warnings.push(
      "Credit card balances owed are negative. Review credits as refunds or repayments. For repayments, choose the bank account that paid the card; both sides are recorded as a transfer. If that payment is already recorded, leave its duplicate unchecked.",
    );
  }
  applyTransferRules(rows, rules as Rule[], accountId, accounts);
  categorise(
    rows,
    json<Category[]>(categories),
    rules as Rule[],
    json<ImportRow[]>(history),
  );
  for (const row of rows) {
    row.duplicate = history.some(
      (t) => t.date === row.date && Number(t.amountCents) === row.amountCents,
    );
    if (row.duplicate || row.date > today()) row.include = false;
    if (row.date > today()) row.error = "Future transactions cannot be posted.";
  }
  details.recurring = recurringSuggestions(rows, accountId, today());
  return { rows, details, pages };
}
