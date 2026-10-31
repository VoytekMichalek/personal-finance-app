import { Button } from "../ui/button";
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
  onRemember,
}: {
  row: Transaction;
  categories: Category[];
  disabled?: boolean;
  onRemember: (row: Transaction) => void;
}) {
  const action = useTransactionCategory(row.id);
  const selectedId = action.isPending
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
          colour: selected
            ? categoryColour(selected, categories)
            : identityColour("category:none"),
          label: selected
            ? categoryLabel(selected, categories)
            : "Uncategorised",
        }}
        value={
          action.isPending
            ? (action.variables?.categoryId ?? "")
            : (row.categoryId ?? "")
        }
        disabled={disabled || action.isPending || action.saving}
        onValueChange={(value) => {
          if (value === "__remember_category__") {
            onRemember(row);
            return;
          }
          if ((value || null) !== row.categoryId)
            action.mutate({ categoryId: value || null, version: row.version });
        }}
      >
        <SelectItem value="__remember_category__">
          Remember & apply to similar…
        </SelectItem>
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
      {action.isSuccess && row.categoryId && (
        <Button
          variant="ghost"
          size="sm"
          className="block px-0 text-[11px] text-primary"
          disabled={disabled || action.saving}
          aria-label={`Remember category for ${row.description}`}
          onClick={() => onRemember(row)}
        >
          Remember & apply…
        </Button>
      )}
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
