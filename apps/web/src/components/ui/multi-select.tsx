import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "./button";
import type { ReactNode } from "react";

export function MultiSelect({
  value,
  onChange,
  onSelectAll,
  options,
  allLabel,
  id,
  "aria-label": labelText,
  selectionLabel,
  "aria-labelledby": labelledBy,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  onSelectAll?: (value: string[]) => void;
  options: { value: string; label: string; content?: ReactNode }[];
  allLabel: string;
  id?: string;
  "aria-label"?: string;
  selectionLabel?: string;
  "aria-labelledby"?: string;
}) {
  const selected = options.filter((option) => value.includes(option.value));
  const label = !selected.length
    ? allLabel
    : selected.length === 1
      ? selected[0]!.label
      : `${selectionLabel ?? "Selected"} (${selected.length})`;
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          id={id}
          aria-label={labelText}
          aria-labelledby={labelledBy}
          variant="secondary"
          className="w-full justify-between gap-2 rounded-xl px-3.5 text-left font-normal"
          title={selected.map((option) => option.label).join(", ") || allLabel}
        >
          <span className="min-w-0 truncate">
            {selected.length === 1 ? (selected[0]!.content ?? label) : label}
          </span>
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          sideOffset={6}
          collisionPadding={12}
          align="start"
          className="z-[80] max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] w-[var(--radix-dropdown-menu-trigger-width)] min-w-48 max-w-[var(--radix-dropdown-menu-content-available-width)] overflow-y-auto rounded-2xl border bg-white p-1.5 shadow-xl"
        >
          {onSelectAll && (
            <Menu.Item
              onSelect={(event) => {
                event.preventDefault();
                onSelectAll(options.map((option) => option.value));
              }}
              className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 py-2 text-sm font-medium text-primary outline-none data-[highlighted]:bg-blue-50"
            >
              Select all
            </Menu.Item>
          )}
          <Menu.CheckboxItem
            checked={!value.length}
            onCheckedChange={() => onChange([])}
            onSelect={(event) => event.preventDefault()}
            className="relative flex min-h-11 cursor-pointer items-center rounded-xl py-2 pl-9 pr-3 text-sm outline-none data-[highlighted]:bg-blue-50"
          >
            <Menu.ItemIndicator className="absolute left-3">
              <Check size={15} />
            </Menu.ItemIndicator>
            {allLabel}
          </Menu.CheckboxItem>
          <Menu.Separator className="my-1 h-px bg-border" />
          {options.map((option) => (
            <Menu.CheckboxItem
              key={option.value}
              checked={value.includes(option.value)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...value, option.value]
                    : value.filter((item) => item !== option.value),
                )
              }
              className="relative flex min-h-11 cursor-pointer items-center rounded-xl py-2 pl-9 pr-3 text-sm outline-none data-[highlighted]:bg-blue-50"
            >
              <Menu.ItemIndicator className="absolute left-3">
                <Check size={15} />
              </Menu.ItemIndicator>
              <span className="[overflow-wrap:anywhere]">
                {option.content ?? option.label}
              </span>
            </Menu.CheckboxItem>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
