import { CategoryIcon } from "../common/VisualIcon";
import { InlineSaveStatus } from "../common/InlineSaveStatus";
import { useState } from "react";
import { Dialog } from "../ui/dialog";
import { CategoryForm } from "../categories/Categories";
import {
  categoryColour,
  categoryLabel,
  identityColour,
  type Category,
  type Transaction,
} from "@finance/shared";
import { useTransactionCategory } from "../../hooks/transaction-category";
import { CategoryChip } from "../common/EntityChip";
import { Select, SelectItem } from "../ui/select";

export function TransactionCategory({
  row,
  categories,
  disabled = false,
}: {
  row: Transaction;
  categories: Category[];
  disabled?: boolean;
}) {
  const action = useTransactionCategory(row.id);
  const [creating, setCreating] = useState(false);
  const selectedId =
    action.isPending || action.isError
      ? action.variables?.categoryId
      : row.categoryId;
  const selected = categories.find((item) => item.id === selectedId);
  if (row.kind === "transfer")
    return <CategoryChip categoryId={null} categories={categories} transfer />;
  const kind = row.kind === "income" ? "income" : "expense";
  const options = categories.filter(
    (category) =>
      (!category.archived && category.kind === kind) ||
      category.id === row.categoryId,
  );
  return (
    <div className="max-w-full space-y-1">
      <Select
        aria-label={`Category for ${row.description}`}
        chip={{
          icon: selected ? (
            <CategoryIcon
              category={selected}
              categories={categories}
              small
              bare
            />
          ) : undefined,
          colour: selected
            ? categoryColour(selected, categories)
            : identityColour("category:none"),
          label: selected
            ? categoryLabel(selected, categories)
            : "Uncategorised",
        }}
        value={
          action.isPending || action.isError
            ? (action.variables?.categoryId ?? "")
            : (row.categoryId ?? "")
        }
        disabled={disabled || action.isPending || action.saving}
        onValueChange={(value) => {
          if (value === "__new_category__") {
            setCreating(true);
            return;
          }
          if ((value || null) !== row.categoryId)
            action.mutate({ categoryId: value || null, version: row.version });
          else action.reset();
        }}
      >
        <SelectItem value="__new_category__">+ Create category</SelectItem>
        <SelectItem value="">
          <CategoryChip categoryId={null} categories={categories} />
        </SelectItem>
        {options.map((category) => (
          <SelectItem
            key={category.id}
            value={category.id}
            disabled={category.archived || category.kind !== kind}
          >
            <CategoryChip categoryId={category.id} categories={categories} />
            {category.archived ? " (archived)" : ""}
          </SelectItem>
        ))}
      </Select>
      <Dialog open={creating} onOpenChange={setCreating} title="Add category">
        <CategoryForm
          categories={categories}
          defaultKind={kind}
          fixedKind
          done={(result) => {
            setCreating(false);
            action.mutate({
              categoryId: (result as Category).id,
              version: row.version,
            });
          }}
        />
      </Dialog>
      {action.isError && (
        <p className="text-[11px] text-muted-foreground">
          Currently saved:{" "}
          {categories.find((c) => c.id === row.categoryId)?.name ??
            "Uncategorised"}
          . Retry applies your displayed choice.
        </p>
      )}
      <InlineSaveStatus
        pending={action.isPending}
        saved={action.isSuccess}
        error={action.error}
        retry={() =>
          action.variables &&
          action.mutate({ ...action.variables, version: row.version })
        }
      />
    </div>
  );
}
