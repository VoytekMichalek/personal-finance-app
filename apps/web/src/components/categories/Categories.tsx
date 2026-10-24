import { SelectItem, FormSelect } from "../ui/select";
import { categoryLabel } from "@finance/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  categorySchema,
  ruleSchema,
  type Category,
  type Rule,
  type Snapshot,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import {
  Card,
  SectionTitle,
  Input,
  Select,
  Field,
  Pill,
} from "../common/primitives";
export function Categories({ data }: { data: Snapshot }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category>();
  const [ruleOpen, setRuleOpen] = useState(false);
  const [rule, setRule] = useState<Rule>();
  const action = useAction();
  return (
    <>
      <Card className="mb-6">
        <SectionTitle
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              <Plus size={14} />
              Add category
            </Button>
          }
        >
          A language that fits your life
        </SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.categories.map((category) => (
            <button
              key={category.id}
              className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left"
              onClick={() => {
                setEditing(category);
                setOpen(true);
              }}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: category.color }}
              />
              <span className="flex-1 text-xs font-medium">
                {category.parentId
                  ? data.categories.find((c) => c.id === category.parentId)
                      ?.name + " / "
                  : ""}
                {category.name}
              </span>
              <Pill>{category.archived ? "Archived" : category.kind}</Pill>
              <Pencil size={12} className="text-gray-400" />
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRule(undefined);
                setRuleOpen(true);
              }}
            >
              <Plus size={14} />
              Rule
            </Button>
          }
        >
          A little help with categorising
        </SectionTitle>
        <p className="mb-5 text-xs leading-5 text-muted-foreground">
          Rules match merchant descriptions, ignoring case. Lower priorities run
          first. Your chosen category always takes precedence.
        </p>
        <div className="divide-y">
          {data.rules.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 py-4"
            >
              <button
                className="flex-1 text-left"
                onClick={() => {
                  setRule(item);
                  setRuleOpen(true);
                }}
              >
                <p className="text-sm font-medium">Contains “{item.pattern}”</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.categories.find((c) => c.id === item.categoryId)?.name}{" "}
                  · priority {item.priority} ·{" "}
                  {item.enabled ? "Enabled" : "Paused"}
                </p>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={"Delete rule " + item.pattern}
                onClick={() => {
                  if (window.confirm("Delete this categorisation rule?"))
                    action.mutate({
                      path: "/rules/" + item.id,
                      method: "DELETE",
                    });
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        {!data.rules.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Add a merchant rule to save a little time next import.
          </p>
        )}
      </Card>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit category" : "Add category"}
      >
        <CategoryForm
          key={editing?.id ?? "new"}
          category={editing}
          categories={data.categories}
          done={() => setOpen(false)}
        />
      </Dialog>
      <Dialog
        open={ruleOpen}
        onOpenChange={setRuleOpen}
        title={rule ? "Edit rule" : "Add merchant rule"}
      >
        <RuleForm
          key={rule?.id ?? "new"}
          rule={rule}
          data={data}
          done={() => setRuleOpen(false)}
        />
      </Dialog>
    </>
  );
}
export function CategoryForm({
  defaultKind = "expense",
  category,
  categories,
  done,
}: {
  defaultKind?: "expense" | "income";
  category?: Category;
  categories: Category[];
  done: (result: unknown) => void;
}) {
  const form = useForm<
    z.input<typeof categorySchema>,
    unknown,
    z.output<typeof categorySchema>
  >({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      parentId: category?.parentId ?? null,
      name: category?.name ?? "",
      kind: category?.kind ?? defaultKind,
      color: category?.color ?? "#007aff",
      archived: category?.archived ?? false,
    },
  });
  const action = useAction(done);
  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((body) =>
        action.mutate({
          path: "/categories" + (category ? "/" + category.id : ""),
          body,
          method: category ? "PUT" : "POST",
        }),
      )}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <Input {...form.register("name")} />
      </Field>
      <Field label="Type">
        <FormSelect control={form.control} name={"kind"}>
          <SelectItem value="expense">Expense</SelectItem>
          <SelectItem value="income">Income</SelectItem>
        </FormSelect>
      </Field>
      <Field label="Parent category">
        <Select
          value={form.watch("parentId") ?? ""}
          onValueChange={(value) => form.setValue("parentId", value || null)}
        >
          <SelectItem value="">None — top-level category</SelectItem>
          {categories
            .filter(
              (c) =>
                !c.parentId &&
                !c.archived &&
                c.id !== category?.id &&
                c.kind === form.watch("kind"),
            )
            .map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
        </Select>
      </Field>
      <Field label="Colour">
        <input
          type="color"
          className="h-11 w-11 cursor-pointer rounded-full border-0 bg-transparent p-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
          {...form.register("color")}
        />
      </Field>
      {category && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("archived")} />
          Archive category
        </label>
      )}
      <Button disabled={action.isPending} type="submit">
        Save category
      </Button>
      {category && (
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={action.isPending}
          onClick={() => {
            if (
              window.confirm(
                "Remove this unused category? Used categories must be archived to preserve history.",
              )
            )
              action.mutate({
                path: "/categories/" + category.id,
                method: "DELETE",
              });
          }}
        >
          <Trash2 size={14} />
          Remove category
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Archiving hides a category and its subcategories from new entries, while
        preserving historical records.
      </p>
    </form>
  );
}
function RuleForm({
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
      categoryId: rule?.categoryId ?? "",
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
      <Field
        label="Description contains"
        error={form.formState.errors.pattern?.message}
      >
        <Input placeholder="e.g. Woolworths" {...form.register("pattern")} />
      </Field>
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
