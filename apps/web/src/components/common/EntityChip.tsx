import {
  categoryColour,
  categoryLabel,
  identityColour,
  ownerColour,
  type Category,
  type Person,
} from "@finance/shared";
import { Pill } from "./primitives";
import { CategoryIcon } from "./VisualIcon";
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
      <span className="inline-flex items-center gap-1.5">
        {category && (
          <CategoryIcon
            category={category}
            categories={categories}
            small
            bare
          />
        )}
        {category
          ? categoryLabel(category, categories)
          : transfer
            ? "Transfer"
            : "Uncategorised"}
      </span>
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
  const person = people.find((p) => p.id === owner);
  const name =
    owner === "household"
      ? "Household"
      : (person?.name ?? "Former member") +
        (person?.state === "deleted" ? " (former member)" : "");
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  const colour = ownerColour(owner, people);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        aria-hidden="true"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{
          background: `color-mix(in srgb, ${colour} 13%, white)`,
          color: `color-mix(in srgb, ${colour} 55%, black)`,
        }}
      >
        {initials}
      </span>
      <span>{name}</span>
    </span>
  );
}
