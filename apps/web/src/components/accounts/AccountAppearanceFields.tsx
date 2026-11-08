import {
  accountAppearanceSchema,
  accountBrand,
  institutionPresets,
  type Institution,
} from "@finance/shared";
import { Palette } from "lucide-react";
import { Field, Input } from "../common/primitives";
import { Select, SelectItem } from "../ui/select";
import { Button } from "../ui/button";
import { InstitutionLogo } from "./InstitutionLogo";
import { LogoPicker } from "./LogoPicker";
import type { AccountFormControl } from "./form-model";

export function AccountAppearanceFields({
  form,
  institutions,
  initiallyOpen,
  busy,
  onBusyChange,
}: {
  form: AccountFormControl;
  institutions: Institution[];
  initiallyOpen: boolean;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const values = form.watch();
  const selection =
    values.customInstitutionId ?? values.institutionPreset ?? "";
  const appearance =
    accountAppearanceSchema.safeParse(values.appearance).data ??
    accountAppearanceSchema.parse({});
  const brand = accountBrand(
    { ...values, institution: values.institution ?? "", appearance },
    institutions,
  );
  const set = { shouldDirty: true, shouldValidate: true };
  return (
    <>
      <Field
        label="Bank or institution"
        error={
          form.formState.errors.customInstitutionId?.message ??
          form.formState.errors.institutionPreset?.message
        }
      >
        <Select
          value={selection}
          disabled={busy}
          onValueChange={(value) => {
            const preset = institutionPresets.find((p) => p.id === value);
            const custom = institutions.find((i) => i.id === value);
            form.setValue("institutionPreset", preset?.id ?? null, set);
            form.setValue("customInstitutionId", custom?.id ?? null, set);
            form.setValue(
              "institution",
              preset?.name ?? custom?.name ?? "",
              set,
            );
            form.setValue("appearance", accountAppearanceSchema.parse({}), set);
            form.setValue("saveInstitution", false, set);
          }}
        >
          <SelectItem value="">Other / no institution</SelectItem>
          {[...institutionPresets]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          {institutions.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.name} · custom
            </SelectItem>
          ))}
        </Select>
      </Field>
      {!selection && (
        <Field
          label="Institution name"
          error={form.formState.errors.institution?.message}
        >
          <Input
            placeholder="Optional, e.g. My credit union"
            {...form.register("institution")}
          />
        </Field>
      )}
      <details
        open={initiallyOpen || undefined}
        className="rounded-xl border p-4"
      >
        <summary className="cursor-pointer text-sm font-medium">
          <span className="ml-1 inline-flex items-center gap-2">
            <Palette size={15} aria-hidden="true" />
            Appearance
          </span>
        </summary>
        <div className="mt-4 grid gap-4">
          <div
            aria-label="Account appearance preview"
            className="flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-4"
            style={{
              backgroundImage: brand.tint
                ? `linear-gradient(120deg, ${brand.color}18, transparent)`
                : undefined,
            }}
          >
            <InstitutionLogo brand={brand} />
            <div className="min-w-0">
              <p className="text-sm font-semibold [overflow-wrap:anywhere]">
                {values.name || "Your account"}
              </p>
              <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {brand.name || "Custom appearance"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Card colour"
              error={form.formState.errors.appearance?.color?.message}
            >
              <Input
                type="color"
                className="h-11 p-1.5"
                value={brand.color}
                onChange={(e) =>
                  form.setValue("appearance.color", e.target.value, set)
                }
              />
            </Field>
            <Field label="Icon">
              <Select
                value={values.appearance?.icon ?? ""}
                onValueChange={(value) => {
                  const icon = accountAppearanceSchema.shape.icon.parse(
                    value || null,
                  );
                  form.setValue("appearance.icon", icon, set);
                  form.setValue("appearance.logoDataUrl", null, set);
                }}
              >
                <SelectItem value="">Institution default</SelectItem>
                <SelectItem value="landmark">Bank</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
                <SelectItem value="banknote">Cash</SelectItem>
                <SelectItem value="piggy-bank">Savings</SelectItem>
                <SelectItem value="credit-card">Credit card</SelectItem>
              </Select>
            </Field>
          </div>
          <LogoPicker
            hasLogo={!!values.appearance?.logoDataUrl}
            onBusyChange={onBusyChange}
            onChange={(logo) =>
              form.setValue("appearance.logoDataUrl", logo, set)
            }
          />
          {form.formState.errors.appearance?.logoDataUrl && (
            <p role="alert" className="text-xs text-destructive">
              {form.formState.errors.appearance.logoDataUrl.message} Remove the
              logo or choose another image.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("appearance.tint")} />
            Subtle background tint
          </label>
          {!selection && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                {...form.register("saveInstitution")}
              />
              <span>
                Save as a reusable institution
                <span className="mt-1 block text-xs text-muted-foreground">
                  Give it an institution name above. These colours and logo will
                  be available for your other accounts.
                </span>
              </span>
            </label>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              form.setValue(
                "appearance",
                accountAppearanceSchema.parse({}),
                set,
              )
            }
          >
            Use institution defaults
          </Button>
          <p className="text-xs text-muted-foreground">
            Appearance changes apply to this account. Other accounts keep their
            own settings.
          </p>
        </div>
      </details>
    </>
  );
}
