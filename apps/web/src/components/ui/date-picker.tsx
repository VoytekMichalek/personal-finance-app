import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, displayDate, today } from "@finance/shared";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Select, SelectItem } from "./select";
export function DatePicker({
  value,
  onChange,
  disabled,
  id,
  max,
  min,
  "aria-label": label,
}: {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  id?: string;
  min?: string;
  max?: string;
  "aria-label"?: string;
}) {
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
      <Button
        type="button"
        id={id}
        aria-label={label}
        variant="secondary"
        disabled={disabled}
        className="h-11 w-full justify-between font-normal"
        onClick={() => {
          setMonth((value || today()).slice(0, 7));
          setOpen(true);
        }}
      >
        {value ? displayDate(value) : "Choose date"}
        <CalendarDays size={16} className="text-muted-foreground" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Choose date"
        description="Select a day. Use the arrow keys to move between dates."
      >
        <div className="mb-4 flex items-center gap-2">
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
                  : day.startsWith(month)
                    ? ""
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
          className="mt-4 w-full"
          disabled={!!((min && today() < min) || (max && today() > max))}
          onClick={() => {
            onChange(today());
            setOpen(false);
          }}
        >
          Today
        </Button>
      </Dialog>
    </>
  );
}
