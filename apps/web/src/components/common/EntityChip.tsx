import {
  categoryColour,
  categoryLabel,
  identityColour,
  type Category,
  type Person,
} from "@finance/shared";
import { Pill } from "./primitives";
export function CategoryChip({
  categoryId,
  categories,
  transfer = false,
}: {
  categoryId: string | null;
  categories: Category[];
  transfer?: boolean;
}) {
  const category = categories.find((item) => item.id === categoryId);
  return (
    <Pill
      colour={
        category
          ? categoryColour(category, categories)
          : identityColour(transfer ? "type:transfer" : "category:none")
      }
    >
      {category
        ? categoryLabel(category, categories)
        : transfer
          ? "Transfer"
          : "Uncategorised"}
    </Pill>
  );
}
export function PersonChip({
  owner,
  people,
}: {
  owner: string;
  people: Person[];
}) {
  return (
    <Pill colour={identityColour("person:" + owner)}>
      {owner === "household"
        ? "Household"
        : (people.find((person) => person.id === owner)?.name ??
            "Former member") +
          (people.find((person) => person.id === owner)?.state === "deleted"
            ? " (former member)"
            : "")}
    </Pill>
  );
}
