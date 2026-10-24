import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  assetSchema,
  valuationSchema,
  moneyInput,
  type Asset,
  type Snapshot,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { Button } from "../ui/button";
import { SelectItem, FormSelect } from "../ui/select";
import { Field, Input } from "../common/primitives";
import { moneyField, OwnerOptions } from "../common/form";
import { DatePicker } from "../ui/date-picker";
const valuationFormSchema = valuationSchema.extend({
  amountCents: moneyField.refine(
    (n) => n >= 0,
    "Enter zero or a positive amount",
  ),
});
export function AssetForm({
  asset,
  data,
  done,
}: {
  asset?: Asset;
  data: Snapshot;
  done: (result: unknown) => void;
}) {
  const form = useForm<
    z.input<typeof assetSchema>,
    unknown,
    z.output<typeof assetSchema>
  >({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: asset?.name ?? "",
      kind: asset?.kind ?? "asset",
      classification:
        (asset?.classification as z.input<
          typeof assetSchema
        >["classification"]) ?? "other",
      owner: asset?.owner ?? "household",
    },
  });
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((body) =>
        action.mutate({
          path: "/assets" + (asset ? "/" + asset.id : ""),
          body,
          method: asset ? "PUT" : "POST",
        }),
      )}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <Input placeholder="e.g. Our home" {...form.register("name")} />
      </Field>
      <Field label="Type">
        <FormSelect control={form.control} name={"kind"}>
          <SelectItem value="asset">Asset</SelectItem>
          <SelectItem value="liability">Liability</SelectItem>
        </FormSelect>
      </Field>
      <Field label="Classification">
        <FormSelect control={form.control} name={"classification"}>
          {[
            "property",
            "investment",
            "superannuation",
            "vehicle",
            "loan",
            "other",
          ].map((value) => (
            <SelectItem key={value} value={value}>
              {value[0]!.toUpperCase() + value.slice(1)}
            </SelectItem>
          ))}
        </FormSelect>
      </Field>
      <Field label="Belongs to">
        <FormSelect control={form.control} name={"owner"}>
          <OwnerOptions people={data.people} />
        </FormSelect>
      </Field>
      <Button disabled={action.isPending} type="submit">
        Save details
      </Button>
    </form>
  );
}
export function ValuationForm({
  assetId,
  date,
  amount,
  done,
}: {
  assetId: string;
  date: string;
  amount: number;
  done: () => void;
}) {
  const form = useForm<
    z.input<typeof valuationFormSchema>,
    unknown,
    z.output<typeof valuationFormSchema>
  >({
    resolver: zodResolver(valuationFormSchema),
    defaultValues: { date, amountCents: moneyInput(amount) },
  });
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((body) =>
        action.mutate({
          path: "/assets/" + assetId + "/valuations",
          body,
          method: "PUT",
        }),
      )}
    >
      <Field label="Valuation date">
        <DatePicker
          value={form.watch("date")}
          onChange={(value) =>
            form.setValue("date", value, { shouldValidate: true })
          }
        />
      </Field>
      <Field
        label="Value (AUD)"
        error={form.formState.errors.amountCents?.message}
      >
        <Input inputMode="decimal" {...form.register("amountCents")} />
      </Field>
      <Button disabled={action.isPending} type="submit">
        Save valuation
      </Button>
    </form>
  );
}
