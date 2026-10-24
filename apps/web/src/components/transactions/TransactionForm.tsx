import { SelectItem, FormSelect } from "../ui/select";
import { categoryLabel } from "@finance/shared";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  transactionSchema,
  transferSchema,
  moneyInput,
  today,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
import { moneyField, OwnerOptions } from "../common/form";
import { Input, Select, Field, inputClass } from "../common/primitives";
import { Button } from "../ui/button";
import { useAction } from "../../hooks/data";
const schema = transactionSchema.extend({
  amountCents: moneyField.refine(
    (value) => value > 0,
    "Enter a positive amount",
  ),
});
const transferFormSchema = z
  .object({
    ...transferSchema.shape,
    amountCents: moneyField.refine(
      (value) => value > 0,
      "Enter a positive amount",
    ),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "Choose different accounts",
    path: ["toAccountId"],
  });
export function TransactionForm({
  transaction,
  data,
  done,
}: {
  transaction?: Transaction;
  data: Snapshot;
  done: () => void;
}) {
  const account =
    data.accounts.find((a) => a.id === transaction?.accountId) ??
    data.accounts.find((a) => !a.archived);
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      accountId: account?.id ?? "",
      kind:
        transaction?.kind === "transfer"
          ? "expense"
          : (transaction?.kind ?? "expense"),
      amountCents: moneyInput(Math.abs(transaction?.amountCents ?? 0)),
      date: transaction?.date ?? today(),
      description: transaction?.description ?? "",
      categoryId: transaction?.categoryId ?? null,
      owner: transaction?.owner ?? account?.owner ?? "household",
      notes: transaction?.notes ?? "",
    },
  });
  const kind = form.watch("kind");
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((body) =>
        action.mutate({
          path: "/transactions" + (transaction ? "/" + transaction.id : ""),
          body: {
            ...body,
            ...(transaction ? { version: transaction.version } : {}),
          },
          method: transaction ? "PUT" : "POST",
        }),
      )}
    >
      <Field
        label="Description"
        error={form.formState.errors.description?.message}
      >
        <Input
          placeholder="What was it for?"
          {...form.register("description")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <FormSelect
            control={form.control}
            name={"kind"}
            onValueChange={(value) => {
              form.setValue("kind", value as "income" | "expense" | "refund");
              form.setValue("categoryId", null);
            }}
          >
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
          </FormSelect>
        </Field>
        <Field
          label="Amount (AUD)"
          error={form.formState.errors.amountCents?.message}
        >
          <Input inputMode="decimal" {...form.register("amountCents")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account" error={form.formState.errors.accountId?.message}>
          <FormSelect
            control={form.control}
            name={"accountId"}
            onValueChange={(value) => {
              form.setValue("accountId", value);
              form.setValue(
                "owner",
                data.accounts.find((a) => a.id === value)?.owner ?? "household",
              );
            }}
          >
            <SelectItem value="">Choose account</SelectItem>
            {data.accounts
              .filter((a) => !a.archived || a.id === transaction?.accountId)
              .map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
          </FormSelect>
        </Field>
        <Field label="Date" error={form.formState.errors.date?.message}>
          <Input type="date" max={data.today} {...form.register("date")} />
        </Field>
      </div>
      <Field label="Category">
        <Select
          value={form.watch("categoryId") ?? ""}
          onValueChange={(value) => form.setValue("categoryId", value || null)}
        >
          <SelectItem value="">Uncategorised</SelectItem>
          {data.categories
            .filter(
              (c) =>
                !c.archived &&
                c.kind === (kind === "income" ? "income" : "expense"),
            )
            .map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {categoryLabel(c, data.categories)}
              </SelectItem>
            ))}
        </Select>
      </Field>
      <Field label="Belongs to">
        <FormSelect control={form.control} name={"owner"}>
          <OwnerOptions people={data.people} />
        </FormSelect>
      </Field>
      <Field label="Notes">
        <textarea
          className={inputClass + " h-20 py-3"}
          {...form.register("notes")}
        />
      </Field>
      <Button disabled={action.isPending} type="submit">
        {action.isPending
          ? "Saving…"
          : transaction
            ? "Save transaction"
            : "Add transaction"}
      </Button>
    </form>
  );
}
export function TransferForm({
  data,
  done,
}: {
  data: Snapshot;
  done: () => void;
}) {
  const form = useForm<
    z.input<typeof transferFormSchema>,
    unknown,
    z.output<typeof transferFormSchema>
  >({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountId: "",
      amountCents: "",
      date: today(),
      description: "Transfer",
    },
  });
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((body) =>
        action.mutate({ path: "/transfers", body }),
      )}
    >
      <p className="text-xs leading-5 text-muted-foreground">
        Move money between accounts, including credit-card repayments. Both
        sides are recorded together.
      </p>
      {(["fromAccountId", "toAccountId"] as const).map((key) => (
        <Field
          key={key}
          label={key === "fromAccountId" ? "From account" : "To account"}
          error={form.formState.errors[key]?.message}
        >
          <FormSelect control={form.control} name={key}>
            <SelectItem value="">Choose account</SelectItem>
            {data.accounts
              .filter((a) => !a.archived)
              .map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
          </FormSelect>
        </Field>
      ))}
      <Field
        label="Amount (AUD)"
        error={form.formState.errors.amountCents?.message}
      >
        <Input inputMode="decimal" {...form.register("amountCents")} />
      </Field>
      <Field label="Date">
        <Input type="date" max={data.today} {...form.register("date")} />
      </Field>
      <Field label="Description">
        <Input {...form.register("description")} />
      </Field>
      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">
          Choose two different accounts.
        </p>
      )}
      <Button disabled={action.isPending} type="submit">
        Record transfer
      </Button>
    </form>
  );
}
