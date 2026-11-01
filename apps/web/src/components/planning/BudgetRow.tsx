import { useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays,
  money,
  moneyInput,
  parseMoney,
  type Category,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { Input } from "../common/primitives";
import { InlineSaveStatus } from "../common/InlineSaveStatus";
import { Button } from "../ui/button";
export function BudgetRow({
  category,
  month,
  budget,
  spent,
}: {
  category: Category;
  month: string;
  budget: number;
  spent: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(moneyInput(budget));
  const [error, setError] = useState("");
  const action = useAction(() => setEditing(false));
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
        path: "/budgets",
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
        <span className="text-sm font-medium">{category.name}</span>
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
                setValue(moneyInput(budget));
                setEditing(true);
              }}
            >
              {" "}
              <span className="sm:hidden">Budget </span>
              {money(budget)}
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
          className={`text-sm tabular-nums sm:text-right ${spent > budget ? "text-rose-700" : ""}`}
        >
          <span className="sm:hidden">Remaining </span>
          {money(budget - spent)}
        </span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-muted">
        <div
          className={`h-1 rounded-full ${spent > budget ? "bg-rose-600" : "bg-slate-400"}`}
          style={{
            width: `${Math.min(100, Math.max(0, budget ? (spent / budget) * 100 : spent > 0 ? 100 : 0))}%`,
          }}
        />
      </div>
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
