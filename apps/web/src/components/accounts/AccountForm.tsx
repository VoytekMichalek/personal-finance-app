import { SelectItem, FormSelect } from "../ui/select";
import { DatePicker } from "../ui/date-picker";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  accountSchema,
  moneyInput,
  today,
  type Account,
  type Person,
} from "@finance/shared";
import { moneyField, OwnerOptions } from "../common/form";
import { Field, Input } from "../common/primitives";
import { Button } from "../ui/button";
import { useAction } from "../../hooks/data";
const schema = accountSchema.extend({ openingBalanceCents: moneyField });
export function AccountForm({
  account,
  people,
  done,
}: {
  account?: Account;
  people: Person[];
  done: () => void;
}) {
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account?.name ?? "",
      institution: account?.institution ?? "",
      type: account?.type ?? "bank",
      owner: account?.owner ?? "household",
      openingDate: account?.openingDate ?? today(),
      openingBalanceCents: moneyInput(account?.openingBalanceCents ?? 0),
      archived: account?.archived ?? false,
    },
  });
  const navigate = useNavigate();
  const [uploadStatement, setUploadStatement] = useState(false);
  const action = useAction((result) => {
    done();
    if (!account && uploadStatement)
      navigate("/accounts/" + (result as Account).id + "/statement");
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((data) =>
        action.mutate({
          path: "/accounts" + (account ? "/" + account.id : ""),
          body: data,
          method: account ? "PUT" : "POST",
        }),
      )}
    >
      {!account && (
        <label className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-sm">
          <input
            type="checkbox"
            checked={uploadStatement}
            onChange={(e) => setUploadStatement(e.target.checked)}
          />
          <span>
            <span className="mb-1 flex items-center gap-2 font-semibold">
              <FileText size={16} />
              Would you like to upload a statement to start?
            </span>
            <span className="text-xs leading-5 text-muted-foreground">
              Read a PDF, review transactions and categories, set the opening
              balance and accept recurring bills or income.
            </span>
          </span>
        </label>
      )}
      <Field label="Account name" error={form.formState.errors.name?.message}>
        <Input placeholder="e.g. Everyday account" {...form.register("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <FormSelect control={form.control} name={"type"}>
            <SelectItem value="bank">Bank account</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="credit">Credit card</SelectItem>
          </FormSelect>
        </Field>
        <Field label="Belongs to">
          <FormSelect control={form.control} name={"owner"}>
            <OwnerOptions people={people} />
          </FormSelect>
        </Field>
      </div>
      {form.watch("type") === "credit" && (
        <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-muted-foreground">
          Track this card separately from your bank account. Purchases are
          expenses; repayments are transfers. Enter an amount owed as a negative
          opening balance (for example −500.00), or import a card statement.
        </p>
      )}
      <Field label="Bank or institution">
        <Input placeholder="Optional" {...form.register("institution")} />
      </Field>
      {!uploadStatement && (
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Opening date"
            error={form.formState.errors.openingDate?.message}
          >
            <DatePicker
              value={form.watch("openingDate")}
              max={today()}
              onChange={(value) =>
                form.setValue("openingDate", value, { shouldValidate: true })
              }
            />
          </Field>
          <Field
            label="Opening balance (AUD)"
            error={form.formState.errors.openingBalanceCents?.message}
          >
            <Input
              inputMode="decimal"
              {...form.register("openingBalanceCents")}
            />
          </Field>
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        Start with the balance before your first transaction. Credit owed is a
        negative balance.
      </p>
      {account && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("archived")} />
          Archive this account
        </label>
      )}
      <Button disabled={action.isPending} type="submit">
        {action.isPending
          ? "Saving…"
          : account
            ? "Save changes"
            : uploadStatement
              ? "Continue to statement"
              : "Add account"}
      </Button>
    </form>
  );
}
