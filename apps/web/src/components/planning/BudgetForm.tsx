import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Repeat2 } from "lucide-react";
import {
  budgetSchema,
  effectiveBudgets,
  moneyInput,
  shiftMonth,
  type Snapshot,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { ActionError } from "../common/ActionError";
import { CategoryChip } from "../common/EntityChip";
import { moneyField } from "../common/form";
import { Field, Input } from "../common/primitives";
import { Button } from "../ui/button";
import { FormSelect, SelectItem } from "../ui/select";
import { FormMonthPicker } from "../ui/form-date-picker";
import { monthLabel } from "../ui/month-picker";

const schema = budgetSchema.extend({
  repeat: z.boolean(),
  amountCents: moneyField.refine(
    (value) => value >= 0,
    "Enter a positive amount or zero",
  ),
});
export function BudgetForm({
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
  const existing = effectiveBudgets(
    data.budgets,
    month,
    data.budgetOverrides,
  ).find((b) => b.categoryId === categoryId);
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
      repeat: false,
      repeatMonths: 3,
    },
  });
  const repeat = form.watch("repeat");
  const count = form.watch("repeatMonths") ?? 3;
  const start = form.watch("month");
  const end =
    Number.isInteger(count) && count >= 1 && count <= 120
      ? shiftMonth(start, count - 1)
      : "";
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(({ repeat, ...body }) =>
        action.mutate({
          path: "/budgets",
          method: "PUT",
          body: { ...body, repeatMonths: repeat ? body.repeatMonths : 1 },
        }),
      )}
    >
      <Field label="Category" error={form.formState.errors.categoryId?.message}>
        <FormSelect control={form.control} name="categoryId">
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
        <FormMonthPicker control={form.control} name="month" />
      </Field>
      <Field
        label="Allowance (AUD)"
        error={form.formState.errors.amountCents?.message}
      >
        <Input inputMode="decimal" {...form.register("amountCents")} />
      </Field>
      <div className="rounded-xl border bg-muted/30 p-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded accent-primary"
            {...form.register("repeat", {
              onChange: (event) => {
                if (!event.target.checked) {
                  form.setValue("repeatMonths", 3);
                  form.clearErrors("repeatMonths");
                }
              },
            })}
          />
          <Repeat2 size={17} className="text-primary" />
          Repeat monthly
        </label>
        {repeat ? (
          <div className="mt-4 grid gap-2">
            <Field
              label="Number of months"
              error={form.formState.errors.repeatMonths?.message}
            >
              <Input
                type="number"
                min={1}
                max={120}
                {...form.register("repeatMonths", { valueAsNumber: true })}
              />
            </Field>
            <p className="text-xs leading-5 text-muted-foreground">
              {end.length === 7
                ? `${monthLabel(start)} – ${monthLabel(end)}. Includes the starting month.`
                : "Choose 1 to 120 months and a starting month before year 9999. Includes the starting month."}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Applies to this month only.
          </p>
        )}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        You can override any month later. Existing monthly overrides are kept
        when you save a plan.
      </p>
      <Button disabled={action.isPending} type="submit">
        {action.isPending ? "Saving…" : "Save budget"}
      </Button>
      <ActionError error={action.error} />
    </form>
  );
}
