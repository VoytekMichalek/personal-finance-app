import { Field } from "./primitives";
import { visualIcons, type VisualIcon as IconName } from "@finance/shared";
import { VisualIcon } from "./VisualIcon";
import { Select, SelectItem } from "../ui/select";
export function IconPicker({
  value,
  onChange,
  label = "Icon",
}: {
  value?: IconName | null;
  onChange: (value: IconName | null) => void;
  label?: string;
}) {
  return (
    <Field label={label}>
      <Select
        aria-label={label}
        value={value ?? ""}
        onValueChange={(v) => onChange((v || null) as IconName | null)}
      >
        <SelectItem value="">Automatic</SelectItem>
        {visualIcons.map((icon) => (
          <SelectItem key={icon} value={icon}>
            <span className="inline-flex items-center gap-2">
              <VisualIcon name={icon} small />
              <span className="capitalize">{icon.replaceAll("-", " ")}</span>
            </span>
          </SelectItem>
        ))}
      </Select>
    </Field>
  );
}
