import {
  today,
  type Category,
  type Rule,
  type ImportRow,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateAccount } from "../finance/service.js";
import { readWithAi } from "./ai-reader.js";
import { extractPdf } from "./pdf.js";
import { recoverBalances } from "./balances.js";
import { parseStatement } from "./parser.js";
import { categorise, recurringSuggestions } from "./suggestions.js";
export async function processStatement(
  accountId: string,
  content: Buffer,
  options: { year?: number; useAi?: boolean; modelId?: string | null },
  onExtracted: (pages: number) => Promise<void>,
) {
  const { year, useAi, modelId } = options;
  const account = await validateAccount(prisma, accountId);
  const pages = await extractPdf(content);
  await onExtracted(pages.length);
  const [categories, rules, history] = await Promise.all([
    prisma.category.findMany(),
    prisma.rule.findMany(),
    prisma.transaction.findMany({ where: { accountId } }),
  ]);
  if (useAi && !modelId)
    throw new HttpError(400, "Choose an AI model in Settings → AI first.");
  const { rows, details } = useAi
    ? await readWithAi(
        pages,
        account.owner,
        json<Category[]>(categories),
        modelId!,
        year,
        account.type,
      )
    : parseStatement(pages, account.owner, year, account.type);
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
  return { rows, details, pages: pages.length };
}
