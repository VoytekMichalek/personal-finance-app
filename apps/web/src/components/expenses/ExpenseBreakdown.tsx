import { CategoryIcon } from "../common/VisualIcon";
import { AccountIdentity } from "../accounts/AccountIdentity";
import { PersonChip } from "../common/EntityChip";
import { VisualTitle } from "../common/VisualTitle";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  categoryColour,
  accountBrand,
  categoryLabel,
  identityColour,
  ownerColour,
  money,
  type ExpenseGroup,
  type Snapshot,
  type expenseReport,
} from "@finance/shared";
import { Card } from "../common/primitives";
import { Button } from "../ui/button";

export function ExpenseBreakdown({
  data,
  report,
  onSelect,
}: {
  data: Snapshot;
  report: ReturnType<typeof expenseReport>;
  onSelect: (selection: {
    group: ExpenseGroup;
    id: string;
    title: string;
  }) => void;
}) {
  const [group, setGroup] = useState<ExpenseGroup>("categories");
  const [expandedGroup, setExpandedGroup] = useState<ExpenseGroup | null>(null);
  const expanded = expandedGroup === group;
  const groups = report[group];
  const visible = expanded ? groups : groups.slice(0, 8);
  const max = Math.max(
    1,
    ...report[group].map((row) => Math.abs(row.amountCents)),
  );
  const identity = (id: string) => {
    const category = data.categories.find((item) => item.id === id);
    if (group === "categories")
      return {
        title: category
          ? categoryLabel(category, data.categories)
          : "Uncategorised",
        colour: category
          ? categoryColour(category, data.categories)
          : identityColour("category:none"),
      };
    return {
      title:
        group === "accounts"
          ? (data.accounts.find((item) => item.id === id)?.name ?? "Account")
          : id === "household"
            ? "Household"
            : (data.people.find((item) => item.id === id)?.name ??
              "Former member"),
      colour:
        group === "accounts"
          ? data.accounts.find((a) => a.id === id)
            ? accountBrand(
                data.accounts.find((a) => a.id === id)!,
                data.institutions,
              ).color
            : "#788ca6"
          : ownerColour(id, data.people),
    };
  };
  return (
    <Card className="min-w-0 self-start">
      <VisualTitle
        title="Expense breakdown"
        context="Expenses less refunds in the selected dates and filters. Choose a category, account or person to see its transactions. Percentages use positive net spending."
        action={
          <div
            role="tablist"
            aria-label="Expense breakdown"
            className="ml-auto flex w-fit flex-wrap gap-1 rounded-xl bg-muted/60 p-1"
          >
            {(
              [
                ["categories", "Category"],
                ["accounts", "Account"],
                ["people", "Person"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                role="tab"
                aria-selected={group === key}
                variant={group === key ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setGroup(key);
                  setExpandedGroup(null);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        }
      />
      {!report.rows.length && (
        <p className="py-6 text-sm text-muted-foreground">
          No expenses in this selection.
        </p>
      )}
      <div
        role="region"
        aria-label="Breakdown totals"
        tabIndex={0}
        className="rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      >
        {visible.map((row) => {
          const { title, colour } = identity(row.id);
          return (
            <button
              key={row.id}
              type="button"
              aria-label={`View ${title} transactions`}
              onClick={() => onSelect({ group, id: row.id, title })}
              className="block w-full rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <div className="mb-1.5 flex justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2 break-words">
                  {group === "accounts" ? (
                    <AccountIdentity
                      account={data.accounts.find((a) => a.id === row.id)}
                      institutions={data.institutions}
                    />
                  ) : group === "people" ? (
                    <PersonChip owner={row.id} people={data.people} />
                  ) : (
                    <>
                      <CategoryIcon
                        category={data.categories.find((c) => c.id === row.id)}
                        categories={data.categories}
                        small
                      />
                      {title}
                    </>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <strong className="tabular-nums">
                    {money(row.amountCents)}
                  </strong>
                  {report.totalCents > 0 && (
                    <span
                      className="w-10 text-right text-[11px] text-muted-foreground"
                      aria-label={`${((row.amountCents / report.totalCents) * 100).toFixed(1)}% of net expenses`}
                    >
                      {((row.amountCents / report.totalCents) * 100).toFixed(1)}
                      %
                    </span>
                  )}
                  <ChevronRight size={13} className="text-muted-foreground" />
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${(Math.abs(row.amountCents) / max) * 100}%`,
                    background: colour,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
      {groups.length > 8 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 text-primary"
          aria-expanded={expanded}
          onClick={() => setExpandedGroup(expanded ? null : group)}
        >
          {expanded
            ? "Show top 8"
            : `Show all ${group === "people" ? "people" : group} (${groups.length})`}
        </Button>
      )}
    </Card>
  );
}
