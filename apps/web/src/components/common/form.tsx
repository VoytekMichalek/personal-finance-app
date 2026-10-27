import { PersonChip } from "./EntityChip";
import { SelectItem } from "../ui/select";
import { z } from "zod";
import { parseMoney, type Person } from "@finance/shared";
import { Select } from "./primitives";
export const moneyField = z.string().transform((value, context) => {
  try {
    return parseMoney(value);
  } catch (error) {
    context.addIssue({ code: "custom", message: (error as Error).message });
    return z.NEVER;
  }
});
export function OwnerOptions({ people }: { people: Person[] }) {
  return (
    <>
      <SelectItem value="household">
        <PersonChip owner="household" people={people} />
      </SelectItem>
      {people.map((person) => (
        <SelectItem key={person.id} value={person.id}>
          <PersonChip owner={person.id} people={people} />
        </SelectItem>
      ))}
    </>
  );
}
export function OwnerFilter({
  people,
  value,
  onChange,
}: {
  people: Person[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label="Ownership filter"
      value={value}
      onValueChange={(value) => onChange(value)}
    >
      <SelectItem value="all">All owners</SelectItem>
      <OwnerOptions people={people} />
    </Select>
  );
}
