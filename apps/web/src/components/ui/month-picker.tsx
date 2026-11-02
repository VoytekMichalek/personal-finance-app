import { useState, type Ref } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { today } from "@finance/shared";
import { Popover } from "./popover";
import { Button, cn } from "./button";
import { Select, SelectItem } from "./select";

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));

export function MonthPicker({
  value,
  onChange,
  currentMonth = today().slice(0, 7),
  min,
  max,
  disabled,
  className,
  id,
  onBlur,
  ref,
  ...aria
}: {
  value: string;
  onChange: (month: string) => void;
  currentMonth?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState((value || currentMonth).slice(0, 4));
  const minYear = Number(min?.slice(0, 4) ?? 1900);
  const maxYear = Number(max?.slice(0, 4) ?? 2200);
  const allowed = (month: string) =>
    (!min || month >= min) && (!max || month <= max);
  const select = (month: string) => {
    onChange(month);
    setOpen(false);
  };
  return (
    <div className={cn("min-w-0", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setYear((value || currentMonth).slice(0, 4));
          setOpen(next);
        }}
        label="Choose month"
        trigger={
          <Button
            {...aria}
            ref={ref}
            id={id}
            onBlur={onBlur}
            type="button"
            variant="secondary"
            disabled={disabled}
            className="w-full justify-between gap-2 bg-gradient-to-b from-white to-slate-50/70 px-3 text-left font-normal"
          >
            <CalendarDays size={16} className="shrink-0 text-primary/75" />
            <span className="min-w-0 flex-1 truncate">
              {value ? monthLabel(value) : "Choose month"}
            </span>
            <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
          </Button>
        }
      >
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted/60 p-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Previous year"
            disabled={Number(year) <= minYear}
            onClick={() => setYear(String(Number(year) - 1))}
          >
            <ChevronLeft size={17} />
          </Button>
          <Select
            aria-label="Year"
            value={year}
            onValueChange={setYear}
            className="h-9 flex-1 border-0 bg-none text-center shadow-none"
          >
            {Array.from({ length: maxYear - minYear + 1 }, (_, index) => (
              <SelectItem key={index} value={String(minYear + index)}>
                {minYear + index}
              </SelectItem>
            ))}
          </Select>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Next year"
            disabled={Number(year) >= maxYear}
            onClick={() => setYear(String(Number(year) + 1))}
          >
            <ChevronRight size={17} />
          </Button>
        </div>
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label={`Months in ${year}`}
        >
          {Array.from({ length: 12 }, (_, index) => {
            const month = `${year}-${String(index + 1).padStart(2, "0")}`;
            return (
              <button
                key={month}
                type="button"
                data-month={month}
                aria-label={monthLabel(month)}
                aria-pressed={month === value}
                disabled={!allowed(month)}
                className={cn(
                  "relative min-h-12 rounded-xl border border-transparent px-3 py-3 text-sm transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30",
                  month === value
                    ? "bg-primary font-semibold text-white shadow-sm hover:bg-primary"
                    : month === currentMonth &&
                        "border-primary/25 bg-blue-50/50 text-primary",
                )}
                onClick={() => select(month)}
                onKeyDown={(event) => {
                  const step = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -3,
                    ArrowDown: 3,
                  }[event.key];
                  if (!step) return;
                  event.preventDefault();
                  const buttons =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      "button",
                    );
                  buttons?.[index + step]?.focus();
                }}
              >
                {new Intl.DateTimeFormat("en-AU", {
                  month: "short",
                  timeZone: "UTC",
                }).format(new Date(month + "-01T00:00:00Z"))}
              </button>
            );
          })}
        </div>
        <div className="mt-4 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-primary"
            disabled={!allowed(currentMonth)}
            onClick={() => select(currentMonth)}
          >
            This month
          </Button>
        </div>
      </Popover>
    </div>
  );
}
