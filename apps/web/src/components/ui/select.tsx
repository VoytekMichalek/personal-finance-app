import * as Radix from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ComponentProps, type ReactNode, type Ref } from "react";
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
  scrollButtons?: boolean;
  chip?: { colour: string; label: string };
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
  scrollButtons = true,
  chip,
  id,
  onBlur,
  ref,
  ...aria
}: Props) {
  const [pointerFocus, setPointerFocus] = useState(false);
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
        onPointerDown={() => chip && setPointerFocus(true)}
        onKeyDown={() => setPointerFocus(false)}
        onBlur={() => {
          setPointerFocus(false);
          onBlur?.();
        }}
        ref={ref}
        className={cn(
          "group flex h-11 w-full min-w-0 max-w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 px-3.5 text-left text-base font-normal shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 data-[state=open]:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          chip &&
            "h-11 w-auto rounded-full border-0 bg-none p-0 shadow-none hover:shadow-none data-[state=open]:border-transparent",
          chip && pointerFocus && "focus-visible:ring-0",
          className,
        )}
      >
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center justify-between gap-3",
            chip &&
              "gap-2 rounded-full border px-2.5 py-1 text-center text-[11px] font-medium",
          )}
          style={
            chip
              ? {
                  backgroundColor: `color-mix(in srgb, ${chip.colour} 13%, white)`,
                  color: `color-mix(in srgb, ${chip.colour} 55%, black)`,
                  borderColor: `color-mix(in srgb, ${chip.colour} 28%, white)`,
                }
              : undefined
          }
        >
          <span className="min-w-0 flex-1 truncate">
            <Radix.Value placeholder="Choose an option">
              {chip?.label}
            </Radix.Value>
          </span>
          <Radix.Icon className="shrink-0">
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180",
                !chip && "text-slate-400",
              )}
            />
          </Radix.Icon>
        </span>
      </Radix.Trigger>
      <Radix.Portal>
        <Radix.Content
          // Radix restores trigger focus after selection, which some browsers
          // mark focus-visible even after a click/tap. Keep focus for the next
          // Tab, but show the chip's ring only when using the keyboard.
          onPointerDownCapture={() => chip && setPointerFocus(true)}
          onKeyDownCapture={() => setPointerFocus(false)}
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            chip && "min-w-52",
            "select-popup z-[80] max-h-[min(320px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/98 p-1.5 shadow-[0_12px_40px_#1e293b20] backdrop-blur-xl",
          )}
        >
          {scrollButtons && (
            <Radix.ScrollUpButton className="flex justify-center p-1">
              <ChevronUp size={14} />
            </Radix.ScrollUpButton>
          )}
          <Radix.Viewport
            className={cn(
              "min-h-0 max-h-[280px] overflow-y-auto",
              !scrollButtons &&
                "[scrollbar-width:thin]! [&::-webkit-scrollbar]:block!",
            )}
          >
            {children}
          </Radix.Viewport>
          {scrollButtons && (
            <Radix.ScrollDownButton className="flex justify-center p-1">
              <ChevronDown size={14} />
            </Radix.ScrollDownButton>
          )}
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
