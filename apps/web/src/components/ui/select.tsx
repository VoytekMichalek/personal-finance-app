import * as Radix from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentProps, ReactNode, Ref } from "react";
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "./button";
const EMPTY = "__finance_empty__";
type Props = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
};
export function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  className,
  disabled,
  id,
  onBlur,
  ref,
  ...aria
}: Props) {
  return (
    <Radix.Root
      value={value === undefined ? undefined : value || EMPTY}
      defaultValue={
        defaultValue === undefined ? undefined : defaultValue || EMPTY
      }
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onValueChange?.(next === EMPTY ? "" : next);
      }}
    >
      <Radix.Trigger
        {...aria}
        id={id}
        onBlur={onBlur}
        ref={ref}
        className={cn(
          "group flex h-11 w-full min-w-0 max-w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 px-3.5 text-left text-base font-normal shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 data-[state=open]:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <Radix.Value placeholder="Choose an option" />
        </span>
        <Radix.Icon className="shrink-0">
          <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
        </Radix.Icon>
      </Radix.Trigger>
      <Radix.Portal>
        <Radix.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="select-popup z-[80] max-h-[min(320px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/98 p-1.5 shadow-[0_12px_40px_#1e293b20] backdrop-blur-xl"
        >
          <Radix.ScrollUpButton className="flex justify-center p-1">
            <ChevronUp size={14} />
          </Radix.ScrollUpButton>
          <Radix.Viewport className="min-h-0 max-h-[280px] overflow-y-auto">
            {children}
          </Radix.Viewport>
          <Radix.ScrollDownButton className="flex justify-center p-1">
            <ChevronDown size={14} />
          </Radix.ScrollDownButton>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
export function SelectItem({
  value,
  children,
  ...props
}: ComponentProps<typeof Radix.Item>) {
  return (
    <Radix.Item
      {...props}
      value={value || EMPTY}
      className="relative flex cursor-pointer select-none items-center rounded-xl py-2.5 pr-8 pl-3 text-sm outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-blue-50 data-[highlighted]:text-primary data-[state=checked]:font-semibold"
    >
      <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
        <Radix.ItemText>{children}</Radix.ItemText>
      </span>
      <Radix.ItemIndicator className="absolute right-2.5">
        <Check size={14} />
      </Radix.ItemIndicator>
    </Radix.Item>
  );
}
export function FormSelect<T extends FieldValues, TOutput extends FieldValues>({
  control,
  name,
  onValueChange,
  ...props
}: Omit<Props, "value" | "ref"> & {
  control: Control<T, unknown, TOutput>;
  name: FieldPath<T>;
}) {
  const { field, fieldState } = useController({ control, name });
  return (
    <Select
      {...props}
      value={String(field.value ?? "")}
      onValueChange={(value) => {
        field.onChange(value);
        onValueChange?.(value);
      }}
      onBlur={field.onBlur}
      ref={field.ref}
      aria-invalid={!!fieldState.error}
    />
  );
}
