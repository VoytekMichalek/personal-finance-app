import { CategoryIcon } from "../common/VisualIcon";
import { categoryColour } from "@finance/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays,
  money,
  moneyInput,
  parseMoney,
  type Category,
  type EffectiveBudget,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { Input } from "../common/primitives";
import { InlineSaveStatus } from "../common/InlineSaveStatus";
import { Button } from "../ui/button";
import { monthLabel } from "../ui/month-picker";
export function BudgetRow({
  category,
  categories = [],
  month,
  budget,
  spent,
}: {
  category: Category;
  categories?: Category[];
  month: string;
  budget: EffectiveBudget;
  spent: number;
}) {
  const [editing, setEditing] = useState(false);
  const amount = budget.amountCents;
  const [value, setValue] = useState(moneyInput(amount));
  const [error, setError] = useState("");
  const action = useAction(() => setEditing(false));
  const restoration = useAction();
  const restore = () =>
    restoration.mutate({
      path: `/budgets/overrides/${budget.overrideId}`,
      method: "DELETE",
    });
  const start = `${month}-01`;
  const endDate = new Date(start + "T00:00:00Z");
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const end = addDays(endDate.toISOString().slice(0, 10), -1);
  const save = () => {
    try {
      const cents = parseMoney(value);
      if (cents < 0) throw new Error("Enter zero or a positive budget.");
      setError("");
      action.mutate({
        path: "/budgets/overrides",
        method: "PUT",
        body: { month, categoryId: category.id, amountCents: cents },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="border-b py-3 last:border-0">
      <div className="grid items-center gap-3 sm:grid-cols-[minmax(8rem,1fr)_8rem_7rem_7rem]">
        <div>
          <span className="flex items-center gap-2 text-sm font-medium">
            <CategoryIcon category={category} categories={categories} small />
            {category.name}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            {budget.overrideId
              ? "Overridden for this month"
              : !budget.endMonth
                ? "Repeats until changed"
                : budget.endMonth === budget.month
                  ? "This month only"
                  : `Repeats through ${monthLabel(budget.endMonth)}`}
          </p>
        </div>
        <div>
          {editing ? (
            <form
              className="flex flex-wrap gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Input
                aria-label={`${category.name} budget amount`}
                inputMode="decimal"
                disabled={action.isPending}
                className="h-9"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Button size="sm" disabled={action.isPending} type="submit">
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={action.isPending}
                onClick={() => {
                  setEditing(false);
                  action.reset();
                  setError("");
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <Button
              className="h-auto px-0 text-sm tabular-nums"
              variant="ghost"
              aria-label={`Edit ${category.name} budget`}
              onClick={() => {
                action.reset();
                setValue(moneyInput(amount));
                setEditing(true);
              }}
            >
              {" "}
              <span className="sm:hidden">Budget </span>
              {money(amount)}
            </Button>
          )}
        </div>
        <Link
          className="text-sm text-primary underline decoration-primary/30 underline-offset-4 tabular-nums sm:text-right"
          to={`/transactions?category=${category.id}&kind=expense&from=${start}&to=${end}`}
        >
          <span className="sm:hidden">Spent </span>
          {money(spent)}
        </Link>
        <span
          className={`text-sm tabular-nums sm:text-right ${spent > amount ? "text-rose-700" : ""}`}
        >
          <span className="sm:hidden">Remaining </span>
          {money(amount - spent)}
          {spent > amount && (
            <span className="mt-1 block text-xs font-medium">Over budget</span>
          )}
        </span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-muted">
        <div
          className={`h-1 rounded-full ${spent > amount ? "bg-rose-600" : "bg-slate-400"}`}
          style={{
            backgroundColor:
              spent > amount ? "#be123c" : categoryColour(category, categories),
            width: `${Math.min(100, Math.max(0, amount ? (spent / amount) * 100 : spent > 0 ? 100 : 0))}%`,
          }}
        />
      </div>
      {editing && (
        <p className="mt-2 text-xs text-muted-foreground">
          Only {monthLabel(month)} changes. Other months keep their planned
          amount.
        </p>
      )}
      {budget.overrideId && !editing && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 px-0 text-primary"
          aria-label={`Restore ${category.name} planned amount`}
          disabled={restoration.isPending}
          onClick={restore}
        >
          {restoration.isPending
            ? "Restoring…"
            : budget.plannedAmountCents === null
              ? "Remove override"
              : `Restore plan (${money(budget.plannedAmountCents)})`}
        </Button>
      )}
      <InlineSaveStatus
        pending={restoration.isPending}
        saved={restoration.isSuccess}
        error={restoration.error}
        retry={restore}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
      <InlineSaveStatus
        pending={action.isPending}
        saved={action.isSuccess}
        error={action.error}
        retry={save}
      />
    </div>
  );
}
