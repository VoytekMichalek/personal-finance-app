import { SummaryCard } from "../common/SummaryCard";
import { BudgetForm } from "./BudgetForm";
import { MonthPicker } from "../ui/month-picker";
import { BudgetRow } from "./BudgetRow";
import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import {
  monthSchema,
  effectiveBudgets,
  categorySpend,
  type Snapshot,
} from "@finance/shared";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Card, Empty, SectionTitle } from "../common/primitives";
export function Budgets({ data }: { data: Snapshot }) {
  const [params, setParams] = useSearchParams();
  const month =
    monthSchema.safeParse(params.get("month")).data ?? data.today.slice(0, 7);
  const setMonth = (month: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("month", month);
        return next;
      },
      { replace: true },
    );
  const [categoryId, setCategoryId] = useState("");
  const [open, setOpen] = useState(false);
  const budgets = effectiveBudgets(data.budgets, month, data.budgetOverrides);
  const limit = budgets.reduce((s, b) => s + b.amountCents, 0);
  const spent = budgets.reduce(
    (s, b) => s + categorySpend(data.transactions, b.categoryId, month),
    0,
  );
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <MonthPicker
          aria-label="Budget month"
          value={month}
          onChange={setMonth}
          className="w-56"
        />
        <Button
          onClick={() => {
            setCategoryId("");
            setOpen(true);
          }}
        >
          <Plus size={15} />
          Set budget
        </Button>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Monthly plan"
          amount={limit}
          icon="piggy-bank"
          color="#8c7bab"
          detail="Your category allowances"
        />
        <SummaryCard
          label="Spent so far"
          amount={spent}
          icon="shopping-bag"
          color="#b28a61"
          detail="Expenses less refunds in budgeted categories"
        />
        <SummaryCard
          label="Still available"
          amount={limit - spent}
          icon="wallet"
          color={limit < spent ? "#ad6c70" : "#62947c"}
          detail={
            limit < spent ? "Over budget" : "Remaining in this month's plan"
          }
        />
      </div>
      <div className="mb-4 flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/budget-report?month=${month}`}>
            View budget vs actual →
          </Link>
        </Button>
      </div>
      <Card>
        <SectionTitle>Monthly budgets</SectionTitle>
        {budgets.length ? (
          <>
            <div className="hidden grid-cols-[minmax(8rem,1fr)_8rem_7rem_7rem] gap-3 border-b pb-2 text-xs text-muted-foreground sm:grid">
              <span>Category</span>
              <span>Budget</span>
              <span className="text-right">Spent</span>
              <span className="text-right">Remaining</span>
            </div>
            {budgets.map((b) => {
              const category = data.categories.find(
                (c) => c.id === b.categoryId,
              );
              return (
                category && (
                  <BudgetRow
                    categories={data.categories}
                    key={month + category.id}
                    category={category}
                    month={month}
                    budget={b}
                    spent={categorySpend(
                      data.transactions,
                      b.categoryId,
                      month,
                    )}
                  />
                )
              );
            })}
          </>
        ) : (
          <Empty
            title="Set your first budget"
            description="Choose a category and a monthly allowance."
            action={
              <Button onClick={() => setOpen(true)}>
                Set your first budget
              </Button>
            }
          />
        )}

        <p className="mt-6 border-t pt-4 text-[11px] leading-5 text-muted-foreground">
          Choose whether a new budget repeats and for how many months. Edit an
          amount to override just that month; Restore plan removes the override.
          Unspent amounts don’t roll over. All owners are included.
        </p>
      </Card>
      <Dialog open={open} onOpenChange={setOpen} title="Set monthly budget">
        <BudgetForm
          key={month + categoryId}
          data={data}
          month={month}
          categoryId={categoryId}
          done={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
