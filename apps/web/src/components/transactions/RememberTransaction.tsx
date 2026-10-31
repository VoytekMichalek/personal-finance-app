import { useState } from "react";
import {
  matchingCategoryTransactions,
  matchingTransferTransactions,
  matchesRule,
  suggestRememberedRule,
  transferCounterpart,
  money,
  displayDate,
  type Snapshot,
  type Transaction,
  type TransactionFilters,
} from "@finance/shared";
import { useRememberTransaction } from "../../hooks/remember-transaction";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Select, SelectItem } from "../ui/select";
import { Input, Field } from "../common/primitives";
import { CategoryPicker } from "../categories/CategoryPicker";
import { CategoryChip } from "../common/EntityChip";
import {
  rememberedTransferPlan,
  RememberTransferPreview,
} from "./RememberTransferPreview";

export function RememberTransaction({
  row,
  data,
  rows,
  filters,
  close,
}: {
  row: Transaction;
  data: Snapshot;
  rows: Transaction[];
  filters: TransactionFilters;
  close: () => void;
}) {
  const [rule, setRule] = useState(() =>
    suggestRememberedRule(row.description),
  );
  const [categoryId, setCategoryId] = useState(row.categoryId);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const action = useRememberTransaction();
  const transfer = row.kind === "transfer";
  const peer = transferCounterpart(row, data.transactions);
  const valid = !!rule.pattern.trim() && matchesRule(row.description, rule);
  const matches = !valid
    ? []
    : transfer
      ? matchingTransferTransactions(rows, row, rule)
      : matchingCategoryTransactions(rows, row.kind, rule);
  const plans =
    transfer && peer
      ? rememberedTransferPlan(
          matches,
          data.transactions,
          peer.accountId,
          choices,
        )
      : [];
  const chosenIds = plans.flatMap((plan) =>
    plan.chosen ? [plan.chosen.id] : [],
  );
  const duplicate = new Set(chosenIds).size !== chosenIds.length;
  const changed = matches.filter((item) =>
    transfer ? item.kind !== "transfer" : item.categoryId !== categoryId,
  );
  const replacing = changed.filter((item) => item.categoryId);
  const category = data.categories.find((item) => item.id === categoryId);
  const eligible = transfer
    ? !!peer &&
      plans.length === matches.length &&
      plans.every((plan) => plan.valid) &&
      !duplicate
    : category &&
      !category.archived &&
      category.kind === (row.kind === "income" ? "income" : "expense");
  const limit = transfer ? 1000 : 10000;
  const accountName = (id: string) =>
    data.accounts.find((account) => account.id === id)?.name;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !action.isPending) close();
      }}
      title="Remember this transaction"
      description="Review the matches in your current filters, then apply the change and save a rule for future imports."
    >
      <div className="space-y-4">
        <p className="text-sm [overflow-wrap:anywhere]">
          Starting from: <strong>{row.description}</strong>
        </p>
        {transfer ? (
          <div className="rounded-xl bg-blue-50 p-3 text-sm">
            <strong>Remember as a transfer</strong>
            <p className="mt-1">
              {accountName(row.accountId)} {row.amountCents < 0 ? "→" : "←"}{" "}
              {peer ? accountName(peer.accountId) : "Missing linked account"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Matches use this account and the same money-in or money-out
              direction.
            </p>
          </div>
        ) : (
          <Field label="Category to remember">
            <CategoryPicker
              categories={data.categories}
              kind={row.kind === "income" ? "income" : "expense"}
              value={categoryId}
              onChange={setCategoryId}
              disabled={action.isPending}
            />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field label="Match descriptions">
            <Select
              value={rule.matchMode}
              disabled={action.isPending}
              onValueChange={(value) =>
                setRule({ ...rule, matchMode: value as "exact" | "contains" })
              }
            >
              <SelectItem value="contains">Containing text</SelectItem>
              <SelectItem value="exact">Exactly matching</SelectItem>
            </Select>
          </Field>
          <Field label="Remembered text">
            <Input
              value={rule.pattern}
              maxLength={250}
              disabled={action.isPending}
              onChange={(event) =>
                setRule({ ...rule, pattern: event.target.value })
              }
            />
          </Field>
        </div>
        {!valid && (
          <p role="alert" className="text-sm text-destructive">
            Enter text that matches the starting transaction.
          </p>
        )}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
          <p role="status">
            <strong>
              Found {matches.length} matching transactions in the current
              filters. Apply to all?
            </strong>
          </p>
          <p className="mt-2">
            {changed.length} to update · {matches.length - changed.length}{" "}
            already correct.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Includes all pages within your account, date and other filters.
            Transactions outside those filters are not included as matches.
          </p>
          {transfer ? (
            <p className="mt-2">
              The transfer update will also link{" "}
              {plans.filter((plan) => !plan.counterpart && plan.chosen).length}{" "}
              existing payments and create{" "}
              {plans.filter((plan) => plan.value === "new").length} counterpart
              entries in {peer && accountName(peer.accountId)}. These other
              entries may be outside your filters.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {replacing.length
                ? `Replaces ${replacing.length} existing categories. `
                : ""}
              Transfers are excluded. Amounts, dates and transaction types stay
              the same.
            </p>
          )}
        </div>
        <details
          className="text-sm"
          open={transfer && (!eligible || duplicate) ? true : undefined}
        >
          <summary className="cursor-pointer font-medium">
            Review matching transactions ({matches.length})
          </summary>
          {transfer ? (
            <RememberTransferPreview
              plans={plans}
              disabled={action.isPending}
              onChange={(id, value) => setChoices({ ...choices, [id]: value })}
            />
          ) : (
            <ul className="mt-2 max-h-60 divide-y overflow-y-auto rounded-xl border px-3">
              {matches.map((item) => (
                <li key={item.id} className="space-y-1 py-2 text-xs">
                  <p className="[overflow-wrap:anywhere]">{item.description}</p>
                  <p className="text-muted-foreground">
                    {displayDate(item.date)} · {accountName(item.accountId)} ·{" "}
                    {money(item.amountCents)}
                  </p>
                  <CategoryChip
                    categoryId={item.categoryId}
                    categories={data.categories}
                  />
                </li>
              ))}
            </ul>
          )}
        </details>
        {transfer && !eligible && (
          <p role="alert" className="text-sm text-destructive">
            Review the transfer matches and choose a different existing payment
            for each row, or explicitly create its counterpart.
          </p>
        )}
        <div className="rounded-xl bg-muted/50 p-3 text-sm">
          <p className="font-medium">
            Also saves a rule for future transactions
          </p>
          <p className="mt-1">
            Future matching CSV and PDF imports will automatically use{" "}
            {transfer ? "this transfer and other account" : "this category"} for
            your review. Your current date and display filters only limit which
            existing transactions are updated now.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Manage saved rules in{" "}
            <a
              className="text-primary underline"
              href="/categories"
              target="_blank"
              rel="noreferrer"
            >
              Categories → Transaction rules
            </a>
            .
          </p>
        </div>
        {matches.length > limit && (
          <p role="alert" className="text-sm text-destructive">
            Narrow your filters or remembered text to match at most{" "}
            {limit.toLocaleString()} transactions.
          </p>
        )}
        {action.error && (
          <p role="alert" className="text-sm text-destructive">
            {action.error.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              action.isPending ||
              !eligible ||
              !valid ||
              !matches.length ||
              matches.length > limit
            }
            onClick={() =>
              action.mutate(
                {
                  ...rule,
                  filters,
                  categoryId: transfer ? null : categoryId!,
                  source: { id: row.id, version: row.version },
                  records: matches.map(({ id, version }) => ({ id, version })),
                  transferChoices: plans.map((plan) => ({
                    id: plan.row.id,
                    counterpart: plan.chosen
                      ? { id: plan.chosen.id, version: plan.chosen.version }
                      : undefined,
                    createCounterpart: plan.value === "new",
                  })),
                },
                { onSuccess: close },
              )
            }
          >
            {action.isPending
              ? "Applying rule…"
              : `Save rule & apply to ${matches.length}`}
          </Button>
          <Button variant="ghost" disabled={action.isPending} onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
