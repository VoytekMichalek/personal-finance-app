import { SelectItem, FormSelect } from "../ui/select";
import { CategoryChip } from "../common/EntityChip";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  scheduleSchema,
  moneyInput,
  today,
  type Schedule,
  type Snapshot,
} from "@finance/shared";
import { moneyField, OwnerOptions } from "../common/form";
import { Field, Input, Select } from "../common/primitives";
import { Button } from "../ui/button";
import { useAction } from "../../hooks/data";
const schema = z
  .object({
    ...scheduleSchema.shape,
    amountCents: moneyField.refine(
      (value) => value > 0,
      "Enter a positive amount",
    ),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: "End date must follow start date",
    path: ["endDate"],
  });
export function ScheduleForm({
  schedule,
  data,
  subscription = false,
  done,
}: {
  schedule?: Schedule;
  data: Snapshot;
  subscription?: boolean;
  done: () => void;
}) {
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      name: schedule?.name ?? "",
      accountId:
        schedule?.accountId ?? data.accounts.find((a) => !a.archived)?.id ?? "",
      kind: schedule?.kind ?? "expense",
      amountCents: moneyInput(schedule?.amountCents ?? 0),
      categoryId: schedule?.categoryId ?? null,
      owner: schedule?.owner ?? "household",
      startDate: schedule?.startDate ?? today(),
      endDate: schedule?.endDate ?? null,
      frequency: schedule?.frequency ?? "monthly",
      subscription: schedule?.subscription ?? subscription,
      provider: schedule?.provider ?? "",
      cancelled: schedule?.cancelled ?? false,
    },
  });
  const kind = form.watch("kind");
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((body) =>
        action.mutate({
          path: "/schedules" + (schedule ? "/" + schedule.id : ""),
          body,
          method: schedule ? "PUT" : "POST",
        }),
      )}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <Input
          placeholder={
            subscription ? "e.g. Apple Music" : "e.g. Payday or electricity"
          }
          {...form.register("name")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <FormSelect control={form.control} name={"kind"}>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </FormSelect>
        </Field>
        <Field
          label="Amount (AUD)"
          error={form.formState.errors.amountCents?.message}
        >
          <Input inputMode="decimal" {...form.register("amountCents")} />
        </Field>
      </div>
      <Field label="Account" error={form.formState.errors.accountId?.message}>
        <FormSelect control={form.control} name={"accountId"}>
          <SelectItem value="">Choose account</SelectItem>
          {data.accounts
            .filter((a) => !a.archived || a.id === schedule?.accountId)
            .map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
        </FormSelect>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts / next renewal">
          <Input type="date" {...form.register("startDate")} />
        </Field>
        <Field label="Repeats">
          <FormSelect control={form.control} name={"frequency"}>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="fortnightly">Fortnightly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annually">Annually</SelectItem>
          </FormSelect>
        </Field>
      </div>
      <Field
        label="End date (optional)"
        error={form.formState.errors.endDate?.message}
      >
        <Input
          type="date"
          value={form.watch("endDate") ?? ""}
          onChange={(e) => form.setValue("endDate", e.target.value || null)}
        />
      </Field>
      <Field label="Category">
        <Select
          value={form.watch("categoryId") ?? ""}
          onValueChange={(value) => form.setValue("categoryId", value || null)}
        >
          <SelectItem value="">Uncategorised</SelectItem>
          {data.categories
            .filter((c) => !c.archived && c.kind === kind)
            .map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <CategoryChip categoryId={c.id} categories={data.categories} />
              </SelectItem>
            ))}
        </Select>
      </Field>
      <Field label="Belongs to">
        <FormSelect control={form.control} name={"owner"}>
          <OwnerOptions people={data.people} />
        </FormSelect>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register("subscription")} />
        This is a subscription
      </label>
      {form.watch("subscription") && (
        <Field label="Provider">
          <Input {...form.register("provider")} />
        </Field>
      )}
      {schedule && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("cancelled")} />
          Cancelled / stop future occurrences
        </label>
      )}
      <Button disabled={action.isPending} type="submit">
        {action.isPending
          ? "Saving…"
          : schedule
            ? "Save schedule"
            : "Add schedule"}
      </Button>
    </form>
  );
}
