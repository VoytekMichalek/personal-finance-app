import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  categoryColour,
  categoryLabel,
  identityColour,
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
      colour: identityColour(
        (group === "accounts" ? "account:" : "person:") + id,
      ),
    };
  };
  return (
    <Card className="min-w-0 self-start">
      <h2 className="mb-3 font-semibold">Expense breakdown</h2>
      <div
        role="tablist"
        aria-label="Expense breakdown"
        className="mb-3 flex flex-wrap gap-2"
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
            variant={group === key ? "default" : "secondary"}
            size="sm"
            onClick={() => setGroup(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {!report.rows.length && (
        <p className="py-6 text-sm text-muted-foreground">
          No expenses in this selection.
        </p>
      )}
      <div
        role="region"
        aria-label="Breakdown totals"
        tabIndex={0}
        className="max-h-80 overflow-y-auto rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      >
        {report[group].map((row) => {
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
                <span className="min-w-0 break-words">{title}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <strong className="tabular-nums">
                    {money(row.amountCents)}
                  </strong>
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
    </Card>
  );
}
