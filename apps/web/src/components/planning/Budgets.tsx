import { BudgetRow } from "./BudgetRow";
import { useSearchParams } from "react-router-dom";
import { ActionError } from "../common/ActionError";
import { SelectItem, FormSelect } from "../ui/select";
import { CategoryChip } from "../common/EntityChip";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  budgetSchema,
  effectiveBudgets,
  categorySpend,
  money,
  moneyInput,
  type Snapshot,
} from "@finance/shared";
import { Plus } from "lucide-react";
import { useAction } from "../../hooks/data";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Card, Input, Field, Empty, SectionTitle } from "../common/primitives";
import { moneyField } from "../common/form";
const schema = budgetSchema.extend({
  amountCents: moneyField.refine(
    (value) => value >= 0,
    "Enter a positive amount or zero",
  ),
});
export function Budgets({ data }: { data: Snapshot }) {
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? data.today.slice(0, 7);
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
  const budgets = effectiveBudgets(data.budgets, month);
  const limit = budgets.reduce((s, b) => s + b.amountCents, 0);
  const spent = budgets.reduce(
    (s, b) => s + categorySpend(data.transactions, b.categoryId, month),
    0,
  );
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <Input
          aria-label="Budget month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
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
        {[
          ["Monthly plan", limit],
          ["Spent so far", spent],
          ["Still available", limit - spent],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {money(Number(value))}
            </p>
          </Card>
        ))}
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
                    key={month + category.id}
                    category={category}
                    month={month}
                    budget={b.amountCents}
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
          Budgets repeat until you set a new monthly amount. Unspent amounts
          don’t roll over. All owners are included.
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
function BudgetForm({
  data,
  month,
  categoryId,
  done,
}: {
  data: Snapshot;
  month: string;
  categoryId: string;
  done: () => void;
}) {
  const existing = effectiveBudgets(data.budgets, month).find(
    (b) => b.categoryId === categoryId,
  );
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      month,
      categoryId,
      amountCents: moneyInput(existing?.amountCents ?? 0),
    },
  });
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((body) =>
        action.mutate({ path: "/budgets", body, method: "PUT" }),
      )}
    >
      <Field label="Category" error={form.formState.errors.categoryId?.message}>
        <FormSelect control={form.control} name={"categoryId"}>
          <SelectItem value="">Choose category</SelectItem>
          {data.categories
            .filter((c) => !c.archived && c.kind === "expense")
            .map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <CategoryChip categoryId={c.id} categories={data.categories} />
              </SelectItem>
            ))}
        </FormSelect>
      </Field>
      <Field label="Month" error={form.formState.errors.month?.message}>
        <Input type="month" {...form.register("month")} />
      </Field>
      <Field
        label="Allowance (AUD)"
        error={form.formState.errors.amountCents?.message}
      >
        <Input inputMode="decimal" {...form.register("amountCents")} />
      </Field>
      <Button disabled={action.isPending} type="submit">
        Save budget
      </Button>
      <ActionError error={action.error} />
    </form>
  );
}
