import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  categoryLabel,
  ruleSchema,
  type Rule,
  type Snapshot,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { Field, Input } from "../common/primitives";
import { Button } from "../ui/button";
import { FormSelect, Select, SelectItem } from "../ui/select";
export function RuleForm({
  rule,
  data,
  done,
}: {
  rule?: Rule;
  data: Snapshot;
  done: () => void;
}) {
  const form = useForm<
    z.input<typeof ruleSchema>,
    unknown,
    z.output<typeof ruleSchema>
  >({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      pattern: rule?.pattern ?? "",
      matchMode: rule?.matchMode ?? "contains",
      categoryId: rule?.kind === "transfer" ? null : (rule?.categoryId ?? ""),
      kind: rule?.kind ?? null,
      accountId: rule?.accountId ?? null,
      counterAccountId: rule?.counterAccountId ?? null,
      direction: rule?.direction ?? null,
      priority: rule?.priority ?? 100,
      enabled: rule?.enabled ?? true,
    },
  });
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((body) =>
        action.mutate({
          path: "/rules" + (rule ? "/" + rule.id : ""),
          body,
          method: rule ? "PUT" : "POST",
        }),
      )}
    >
      <Field label="Match description">
        <FormSelect control={form.control} name="matchMode">
          <SelectItem value="contains">Contains</SelectItem>
          <SelectItem value="exact">Exact description</SelectItem>
        </FormSelect>
      </Field>
      <Field
        label="Description text"
        error={form.formState.errors.pattern?.message}
      >
        <Input placeholder="e.g. Woolworths" {...form.register("pattern")} />
      </Field>
      <Field label="Rule action">
        <Select
          value={form.watch("kind") ?? "category"}
          onValueChange={(value) => {
            const transfer = value === "transfer";
            form.setValue("kind", transfer ? "transfer" : null);
            form.setValue("categoryId", transfer ? null : "");
            form.setValue("accountId", null);
            form.setValue("counterAccountId", null);
            form.setValue("direction", transfer ? "out" : null);
          }}
        >
          <SelectItem value="category">Assign category</SelectItem>
          <SelectItem value="transfer">Transfer between accounts</SelectItem>
        </Select>
      </Field>
      {form.watch("kind") === "transfer" ? (
        <>
          <Field label="Source account">
            <FormSelect control={form.control} name="accountId">
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
          <Field
            label="Other account"
            error={form.formState.errors.counterAccountId?.message}
          >
            <FormSelect control={form.control} name="counterAccountId">
              <SelectItem value="">Choose other account</SelectItem>
              {data.accounts
                .filter((a) => !a.archived && a.id !== form.watch("accountId"))
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
            </FormSelect>
          </Field>
          <Field label="Direction at source account">
            <FormSelect control={form.control} name="direction">
              <SelectItem value="out">Money out</SelectItem>
              <SelectItem value="in">Money in</SelectItem>
            </FormSelect>
          </Field>
        </>
      ) : (
        <Field
          label="Assign category"
          error={form.formState.errors.categoryId?.message}
        >
          <FormSelect control={form.control} name={"categoryId"}>
            <SelectItem value="">Choose category</SelectItem>
            {data.categories
              .filter((c) => !c.archived)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {categoryLabel(c, data.categories)}
                </SelectItem>
              ))}
          </FormSelect>
        </Field>
      )}
      <Field label="Priority">
        <Input
          type="number"
          {...form.register("priority", { valueAsNumber: true })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register("enabled")} />
        Enable rule
      </label>
      <Button disabled={action.isPending} type="submit">
        Save rule
      </Button>
    </form>
  );
}
