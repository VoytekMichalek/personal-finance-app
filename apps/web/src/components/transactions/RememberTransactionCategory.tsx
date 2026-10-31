import { useState } from "react";
import {
  matchingCategoryTransactions,
  matchesRule,
  suggestRememberedRule,
  money,
  displayDate,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
import { useRememberTransactionCategory } from "../../hooks/remember-transaction-category";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Select, SelectItem } from "../ui/select";
import { Input, Field } from "../common/primitives";
import { CategoryPicker } from "../categories/CategoryPicker";
import { CategoryChip } from "../common/EntityChip";

export function RememberTransactionCategory({
  row,
  data,
  close,
}: {
  row: Transaction;
  data: Snapshot;
  close: () => void;
}) {
  const [rule, setRule] = useState(() =>
    suggestRememberedRule(row.description),
  );
  const [categoryId, setCategoryId] = useState(row.categoryId);
  const action = useRememberTransactionCategory();
  const valid = !!rule.pattern.trim() && matchesRule(row.description, rule);
  const matches = valid
    ? matchingCategoryTransactions(data.transactions, row.kind, rule)
    : [];
  const changed = matches.filter((item) => item.categoryId !== categoryId);
  const replacing = changed.filter((item) => item.categoryId);
  const category = data.categories.find((item) => item.id === categoryId);
  const eligible =
    category &&
    !category.archived &&
    category.kind === (row.kind === "income" ? "income" : "expense");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !action.isPending) close();
      }}
      title="Remember & apply category"
      description="Apply one category to matching transactions already imported and save a rule for future imports."
    >
      <div className="space-y-4">
        <p className="text-sm [overflow-wrap:anywhere]">
          Starting from: <strong>{row.description}</strong>
        </p>
        <Field label="Category to remember">
          <CategoryPicker
            categories={data.categories}
            kind={row.kind === "income" ? "income" : "expense"}
            value={categoryId}
            onChange={setCategoryId}
            disabled={action.isPending}
          />
        </Field>
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
            <strong>{matches.length} matching transactions</strong> across all
            accounts and dates, including other pages and rows hidden by your
            filters.
          </p>
          <p className="mt-2">
            {changed.length} to update · {matches.length - changed.length}{" "}
            already correct.
            {replacing.length > 0 &&
              ` This will replace ${replacing.length} existing categor${replacing.length === 1 ? "y" : "ies"}.`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Transfers are excluded.{" "}
            {row.kind === "income"
              ? "Only income is included."
              : "Expenses and refunds are included."}{" "}
            Amounts, dates and other details stay the same.
          </p>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Review matching transactions ({matches.length})
          </summary>
          <ul className="mt-2 max-h-60 divide-y overflow-y-auto rounded-xl border px-3">
            {matches.map((item) => (
              <li key={item.id} className="space-y-1 py-2 text-xs">
                <p className="[overflow-wrap:anywhere]">{item.description}</p>
                <p className="text-muted-foreground">
                  {displayDate(item.date)} ·{" "}
                  {
                    data.accounts.find(
                      (account) => account.id === item.accountId,
                    )?.name
                  }{" "}
                  · {money(item.amountCents)}
                </p>
                <CategoryChip
                  categoryId={item.categoryId}
                  categories={data.categories}
                />
              </li>
            ))}
          </ul>
        </details>
        <p className="text-xs text-muted-foreground">
          Manage saved rules in{" "}
          <a
            className="text-primary underline"
            href="/categories"
            target="_blank"
            rel="noreferrer"
          >
            Categories → Category rules
          </a>
          . Exact rules take priority over contains rules on future imports.
        </p>
        {matches.length > 10000 && (
          <p role="alert" className="text-sm text-destructive">
            Narrow the remembered text to match at most 10,000 transactions.
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
              matches.length > 10000
            }
            onClick={() =>
              action.mutate(
                {
                  ...rule,
                  categoryId: categoryId!,
                  source: { id: row.id, version: row.version },
                  records: matches.map(({ id, version }) => ({ id, version })),
                },
                { onSuccess: close },
              )
            }
          >
            {action.isPending
              ? "Applying category…"
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
