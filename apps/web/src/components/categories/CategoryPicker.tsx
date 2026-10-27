import { useState } from "react";
import { type Category } from "@finance/shared";
import { Select, SelectItem } from "../ui/select";
import { CategoryChip } from "../common/EntityChip";
import { Dialog } from "../ui/dialog";
import { CategoryForm } from "./Categories";
export function CategoryPicker({
  categories,
  kind,
  value,
  onChange,
  disabled,
  id,
  "aria-label": label,
}: {
  categories: Category[];
  kind: "income" | "expense";
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Select
        id={id}
        aria-label={label}
        disabled={disabled}
        value={value ?? ""}
        onValueChange={(next) =>
          next === "__new_category__" ? setOpen(true) : onChange(next || null)
        }
      >
        <SelectItem value="__new_category__">+ Create category</SelectItem>
        <SelectItem value="">
          <CategoryChip categoryId={null} categories={categories} />
        </SelectItem>
        {categories
          .filter((c) => !c.archived && c.kind === kind)
          .map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <CategoryChip categoryId={c.id} categories={categories} />
            </SelectItem>
          ))}
      </Select>
      <Dialog open={open} onOpenChange={setOpen} title="Add category">
        <CategoryForm
          categories={categories}
          defaultKind={kind}
          done={(result) => {
            onChange((result as Category).id);
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}
