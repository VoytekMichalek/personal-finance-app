import { ActionError } from "../common/ActionError";
import { SelectItem, FormSelect } from "../ui/select";
import { DatePicker } from "../ui/date-picker";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  accountAppearanceSchema,
  matchInstitution,
  institutionPresets,
  moneyInput,
  today,
  type Account,
  type Person,
} from "@finance/shared";
import { OwnerOptions } from "../common/form";
import { Field, Input } from "../common/primitives";
import { Button } from "../ui/button";
import { useAction, useSnapshot } from "../../hooks/data";
import { AccountAppearanceFields } from "./AccountAppearanceFields";
import {
  accountFormSchema,
  type AccountFormInput,
  type AccountFormOutput,
} from "./form-model";
export function AccountForm({
  account,
  people,
  done,
  appearanceInitiallyOpen = false,
}: {
  account?: Account;
  people: Person[];
  done: () => void;
  appearanceInitiallyOpen?: boolean;
}) {
  const form = useForm<AccountFormInput, unknown, AccountFormOutput>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: account?.name ?? "",
      institution: account?.institution ?? "",
      institutionPreset: account?.customInstitutionId
        ? null
        : (institutionPresets.find((p) => p.id === account?.institutionPreset)
            ?.id ??
          matchInstitution(account?.institution ?? "")?.id ??
          null),
      customInstitutionId: account?.customInstitutionId ?? null,
      appearance: accountAppearanceSchema.parse(account?.appearance ?? {}),
      saveInstitution: false,
      type:
        account?.type === "cash" || account?.type === "credit"
          ? account.type
          : "bank",
      owner: account?.owner ?? "household",
      openingDate: account?.openingDate ?? today(),
      openingBalanceCents: moneyInput(account?.openingBalanceCents ?? 0),
      archived: account?.archived ?? false,
    },
  });
  const navigate = useNavigate();
  const snapshot = useSnapshot();
  const [logoBusy, setLogoBusy] = useState(false);
  const [uploadStatement, setUploadStatement] = useState(false);
  const action = useAction((result) => {
    done();
    if (!account && uploadStatement)
      navigate("/accounts/" + (result as Account).id + "/statement");
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((data) => {
        if (logoBusy || action.isPending) return;
        action.mutate({
          path: "/accounts" + (account ? "/" + account.id : ""),
          body: data,
          method: account ? "PUT" : "POST",
        });
      })}
    >
      <fieldset
        disabled={action.isPending || logoBusy}
        className="grid min-w-0 gap-4"
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
          <Input
            placeholder="e.g. Everyday account"
            {...form.register("name")}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" error={form.formState.errors.type?.message}>
            <FormSelect control={form.control} name={"type"}>
              <SelectItem value="bank">Bank account</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit card</SelectItem>
            </FormSelect>
          </Field>
          <Field
            label="Belongs to"
            error={form.formState.errors.owner?.message}
          >
            <FormSelect control={form.control} name={"owner"}>
              <OwnerOptions people={people} />
            </FormSelect>
          </Field>
        </div>
        {form.watch("type") === "credit" && (
          <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-muted-foreground">
            Track this card separately from your bank account. Purchases are
            expenses; repayments are transfers. Enter an amount owed as a
            negative opening balance (for example −500.00), or import a card
            statement.
          </p>
        )}
        <AccountAppearanceFields
          form={form}
          institutions={snapshot.data?.institutions ?? []}
          initiallyOpen={appearanceInitiallyOpen}
          busy={logoBusy}
          onBusyChange={setLogoBusy}
        />
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
        <Button disabled={action.isPending || logoBusy} type="submit">
          {action.isPending
            ? "Saving…"
            : account
              ? "Save changes"
              : uploadStatement
                ? "Continue to statement"
                : "Add account"}
        </Button>
      </fieldset>
      <ActionError error={action.error} />
    </form>
  );
}
