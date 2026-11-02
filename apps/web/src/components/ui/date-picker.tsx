import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { addDays, displayDate, today } from "@finance/shared";
import { Dialog } from "./dialog";
import { Popover } from "./popover";
import type { ReactElement, ReactNode, Ref } from "react";
import { Button, cn } from "./button";
import { Select, SelectItem } from "./select";
import { useCompactViewport } from "../../hooks/compact-viewport";
export function DatePicker({
  value,
  onChange,
  disabled,
  clearLabel,
  popover,
  id,
  max,
  min,
  className,
  onBlur,
  ref,
  "aria-label": label,
  ...aria
}: {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  clearLabel?: string;
  popover?: boolean;
  id?: string;
  min?: string;
  max?: string;
  className?: string;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}) {
  const compact = useCompactViewport();
  const usePopover = popover ?? !compact;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || today()).slice(0, 7));
  const first = month + "-01";
  const offset = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
  const changeMonth = (delta: number) => {
    const date = new Date(first + "T00:00:00Z");
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonth(date.toISOString().slice(0, 7));
  };
  return (
    <>
      <div className={cn("flex min-w-0 items-center gap-1", className)}>
        <PickerSurface
          open={open}
          onOpenChange={setOpen}
          popover={usePopover}
          trigger={
            <Button
              {...aria}
              ref={ref}
              onBlur={onBlur}
              type="button"
              id={id}
              aria-label={label}
              variant="secondary"
              disabled={disabled}
              className="h-11 min-w-0 flex-1 justify-between gap-2 bg-gradient-to-b from-white to-slate-50/70 px-3 font-normal"
              onClick={(event) => {
                setMonth((value || today()).slice(0, 7));
                if (!usePopover) {
                  event.currentTarget.focus();
                  setOpen(true);
                }
              }}
            >
              <CalendarDays size={16} className="shrink-0 text-primary/75" />
              <span className="flex-1 truncate text-left">
                {value ? displayDate(value) : "Choose date"}
              </span>
              <ChevronDown
                size={14}
                className="shrink-0 text-muted-foreground"
              />
            </Button>
          }
        >
          <div className="mb-4 flex items-center gap-1 rounded-xl bg-muted/60 p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={18} />
            </Button>
            <Select
              aria-label="Month"
              className="h-9 flex-1 gap-1 border-0 bg-none px-1 text-sm shadow-none [&>span]:gap-1"
              value={month.slice(5)}
              onValueChange={(m) => setMonth(month.slice(0, 4) + "-" + m)}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                  {new Intl.DateTimeFormat("en-AU", {
                    month: "long",
                    timeZone: "UTC",
                  }).format(new Date(Date.UTC(2026, i, 1)))}
                </SelectItem>
              ))}
            </Select>
            <Select
              aria-label="Year"
              className="h-9 w-20 shrink-0 gap-1 border-0 bg-none px-1 text-sm shadow-none [&>span]:gap-1"
              value={month.slice(0, 4)}
              onValueChange={(y) => setMonth(y + month.slice(4))}
            >
              {Array.from({ length: 301 }, (_, i) => (
                <SelectItem key={i} value={String(1900 + i)}>
                  {1900 + i}
                </SelectItem>
              ))}
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d} className="py-2 text-xs text-muted-foreground">
                {d}
              </span>
            ))}
            {days.map((day) => (
              <button
                key={day}
                type="button"
                data-date={day}
                aria-label={displayDate(day)}
                aria-pressed={day === value}
                disabled={!!((min && day < min) || (max && day > max))}
                className={
                  "aspect-square rounded-xl text-sm transition hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-25 " +
                  (day === value
                    ? "bg-primary text-white hover:bg-primary"
                    : day === today()
                      ? "bg-blue-50 text-primary ring-1 ring-inset ring-primary/25"
                      : day.startsWith(month)
                        ? "text-foreground"
                        : "text-muted-foreground/50")
                }
                onKeyDown={(e) => {
                  const delta = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  }[e.key];
                  if (!delta) return;
                  e.preventDefault();
                  const next = addDays(day, delta);
                  const target =
                    e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                      `[data-date="${next}"]`,
                    );
                  target?.focus();
                }}
                onClick={() => {
                  onChange(day);
                  setOpen(false);
                }}
              >
                {Number(day.slice(-2))}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-4 w-full border-t pt-3 text-primary"
            disabled={!!((min && today() < min) || (max && today() > max))}
            onClick={() => {
              onChange(today());
              setOpen(false);
            }}
          >
            Today
          </Button>
        </PickerSurface>
        {clearLabel && value && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={clearLabel}
            disabled={disabled}
            onClick={() => onChange("")}
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </>
  );
}

function PickerSurface({
  open,
  onOpenChange,
  popover,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popover: boolean;
  trigger: ReactElement;
  children: ReactNode;
}) {
  return popover ? (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      label="Choose date"
      className="w-[22rem]"
    >
      {children}
    </Popover>
  ) : (
    <>
      {trigger}
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Choose date"
        description="Select a day. Use the arrow keys to move between dates."
      >
        {children}
      </Dialog>
    </>
  );
}
