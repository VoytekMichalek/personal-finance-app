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
import { Plus, Pencil } from "lucide-react";
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
  const [month, setMonth] = useState(data.today.slice(0, 7));
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
        <SectionTitle>Room for what matters</SectionTitle>
        {budgets.length ? (
          <div className="grid gap-6">
            {budgets.map((b) => {
              const category = data.categories.find(
                (c) => c.id === b.categoryId,
              );
              const amount = categorySpend(
                data.transactions,
                b.categoryId,
                month,
              );
              return (
                <div key={b.categoryId}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">
                      {category?.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {money(amount)} / {money(b.amountCents)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={"Edit " + category?.name + " budget"}
                        onClick={() => {
                          setCategoryId(b.categoryId);
                          setOpen(true);
                        }}
                      >
                        <Pencil size={13} />
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width:
                          Math.min(
                            100,
                            Math.max(
                              0,
                              b.amountCents
                                ? (amount / b.amountCents) * 100
                                : 0,
                            ),
                          ) + "%",
                        backgroundColor:
                          amount > b.amountCents ? "#c63845" : category?.color,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {money(Math.abs(b.amountCents - amount))}{" "}
                    {amount > b.amountCents ? "over budget" : "remaining"}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            title="A plan that fits your life"
            description="Choose a category and give it a monthly allowance."
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
      <Field label="Month">
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
    </form>
  );
}
