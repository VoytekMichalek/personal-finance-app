import type { Category, Transaction } from "@finance/shared";
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
  if (row.kind === "transfer")
    return <CategoryChip categoryId={null} categories={categories} transfer />;
  const kind = row.kind === "income" ? "income" : "expense";
  const options = categories.filter(
    (category) =>
      (!category.archived && category.kind === kind) ||
      category.id === row.categoryId,
  );
  return (
    <div className="w-40 max-w-full space-y-1 sm:w-52">
      <Select
        aria-label={`Category for ${row.description}`}
        className="h-11 gap-1 px-2 text-xs shadow-none sm:h-9"
        value={
          action.isPending
            ? (action.variables?.categoryId ?? "")
            : (row.categoryId ?? "")
        }
        disabled={disabled || action.isPending || action.saving}
        onValueChange={(value) => {
          if ((value || null) !== row.categoryId)
            action.mutate({ categoryId: value || null, version: row.version });
        }}
      >
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
      {action.saving && (
        <p role="status" className="text-[10px] text-muted-foreground">
          Saving category…
        </p>
      )}
      {action.error && (
        <p role="alert" className="text-xs text-destructive">
          {action.error.message}
        </p>
      )}
    </div>
  );
}
