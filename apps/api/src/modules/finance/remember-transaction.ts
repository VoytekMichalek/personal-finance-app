import {
  matchingCategoryTransactions,
  matchingTransferTransactions,
  filterTransactions,
  matchesRule,
  rememberTransactionSchema,
  transferCounterpart,
  transferChoicesFor,
  type Transaction,
} from "@finance/shared";
import { Prisma } from "@prisma/client";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateAccount, validateCategory } from "./service.js";
import { saveRememberedRule } from "./category-rules.js";
import { saveRememberedTransferRule } from "./rules.js";
import { applyTransactionType } from "./transaction-type.js";

const conflict = () =>
  new HttpError(
    409,
    "Matching transactions changed. Review the refreshed matches and try again.",
  );
export async function rememberTransaction(body: unknown) {
  const input = rememberTransactionSchema.parse(body);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = json<Transaction[]>(await tx.transaction.findMany());
        const source = rows.find((row) => row.id === input.source.id);
        if (!source || source.version !== input.source.version)
          throw conflict();
        if (!matchesRule(source.description, input))
          throw new HttpError(
            400,
            "Choose text matching the starting transaction.",
          );
        const visible = filterTransactions(rows, input.filters);
        const transfer = source.kind === "transfer";
        const matches = transfer
          ? matchingTransferTransactions(visible, source, input)
          : matchingCategoryTransactions(visible, source.kind, input);
        const confirmed = new Map(
          input.records.map((row) => [row.id, row.version]),
        );
        // Recompute the current filters on the server; never expand to hidden matches.
        if (
          !matches.some((row) => row.id === source.id) ||
          matches.length !== confirmed.size ||
          matches.some((row) => confirmed.get(row.id) !== row.version)
        )
          throw conflict();
        if (transfer) {
          const counterpart = transferCounterpart(source, rows);
          if (!counterpart || input.categoryId || matches.length > 1000)
            throw new HttpError(
              400,
              "Choose a complete transfer and at most 1,000 matching rows.",
            );
          await validateAccount(tx, source.accountId);
          await validateAccount(tx, counterpart.accountId);
          const choices = new Map(
            input.transferChoices.map((choice) => [choice.id, choice]),
          );
          if (
            choices.size !== input.transferChoices.length ||
            choices.size !== matches.length
          )
            throw conflict();
          const versions = new Map(
            input.records.map((row) => [row.id, row.version]),
          );
          const linked = new Set<string>();
          for (const row of matches) {
            const choice = choices.get(row.id);
            const plan = transferChoicesFor(row, rows, counterpart.accountId);
            if (plan.issue) throw new HttpError(409, plan.issue);
            if (!choice || !!choice.counterpart === choice.createCounterpart)
              throw conflict();
            const other =
              plan.counterpart ??
              plan.candidates.find(
                (item) => item.id === choice.counterpart?.id,
              );
            if (choice.counterpart) {
              if (
                !other ||
                other.id !== choice.counterpart.id ||
                other.version !== choice.counterpart.version ||
                linked.has(other.id)
              )
                throw conflict();
              linked.add(other.id);
              versions.set(other.id, other.version);
            } else if (plan.counterpart) throw conflict();
          }
          const ids = [...versions.keys()].sort();
          const locked = await tx.$queryRaw<{ id: string; version: number }[]>(
            Prisma.sql`SELECT "id", "version" FROM "Transaction" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`,
          );
          if (
            locked.length !== ids.length ||
            locked.some((row) => versions.get(row.id) !== row.version)
          )
            throw conflict();
          let changed = 0;
          for (const row of [...matches].sort((a, b) =>
            a.id.localeCompare(b.id),
          )) {
            if (row.kind === "transfer") continue;
            const choice = choices.get(row.id)!;
            await applyTransactionType(tx, row.id, {
              version: row.version,
              kind: "transfer",
              counterAccountId: counterpart.accountId,
              linkExisting: choice.counterpart,
              createCounterpart: choice.createCounterpart,
            });
            changed++;
          }
          const rule = await saveRememberedTransferRule(
            tx,
            input,
            source.accountId,
            counterpart.accountId,
            source.amountCents < 0 ? "out" : "in",
          );
          return { matched: matches.length, changed, rule };
        }
        if (!input.categoryId || input.transferChoices.length)
          throw new HttpError(400, "Choose a category to remember.");
        await validateCategory(tx, input.categoryId, source.kind);
        for (let offset = 0; offset < input.records.length; offset += 500) {
          const updated = await tx.transaction.updateMany({
            where: { OR: input.records.slice(offset, offset + 500) },
            data: { categoryId: input.categoryId, version: { increment: 1 } },
          });
          if (updated.count !== Math.min(500, input.records.length - offset))
            throw conflict();
        }
        const rule = await saveRememberedRule(
          tx,
          input,
          input.categoryId,
          source.kind === "income" ? "income" : "expense",
        );
        return {
          matched: matches.length,
          changed: matches.filter((row) => row.categoryId !== input.categoryId)
            .length,
          rule,
        };
      },
      { timeout: 60000 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      throw conflict();
    throw error;
  }
}
