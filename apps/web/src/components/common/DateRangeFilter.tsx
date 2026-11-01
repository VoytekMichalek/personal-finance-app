import { startTransition, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { displayDate } from "@finance/shared";
import { Popover } from "../ui/popover";
import { DatePicker } from "../ui/date-picker";
import { Button } from "../ui/button";
import { Field } from "./primitives";

export function DateRangeFilter({
  from,
  to,
  today,
  allFrom = "",
  optional = false,
  labels = ["From", "To"],
  onChange,
}: {
  from: string;
  to: string;
  today: string;
  allFrom?: string;
  optional?: boolean;
  labels?: [string, string];
  onChange: (range: { from: string; to: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const presets = [
    { label: "This month", from: today.slice(0, 7) + "-01", to: today },
    { label: "This year", from: today.slice(0, 4) + "-01-01", to: today },
    { label: "All history", from: allFrom, to: optional ? "" : today },
  ];
  const shortDate = (date: string) =>
    new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(date + "T00:00:00Z"));
  const selected = presets.find((p) => p.from === from && p.to === to);
  const label =
    selected?.label ??
    `${from ? shortDate(from) : "Start"} – ${to ? shortDate(to) : "Any date"}`;
  const valid =
    (!draft.from || !draft.to || draft.from <= draft.to) &&
    (optional || !!(draft.from && draft.to && draft.to <= today));
  const apply = (range: { from: string; to: string }) => {
    // Close with the URL-backed filter update so the previous rows cannot be edited
    // while React Router is still preparing their replacement.
    startTransition(() => {
      onChange(range);
      setOpen(false);
    });
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft({ from, to });
        setOpen(next);
      }}
      label="Date range"
      className="w-[28rem]"
      trigger={
        <Button
          variant="secondary"
          aria-label="Date range"
          title={`${from ? displayDate(from) : "Any start date"} – ${to ? displayDate(to) : "Any end date"}`}
          className="w-full justify-between gap-2 px-3 font-normal"
        >
          <CalendarDays size={15} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button
            key={p.label}
            size="sm"
            variant={selected?.label === p.label ? "default" : "secondary"}
            onClick={() => apply({ from: p.from, to: p.to })}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels[0]}>
          <DatePicker
            popover
            value={draft.from}
            clearLabel={optional ? "Clear from date" : undefined}
            onChange={(from) => setDraft({ ...draft, from })}
          />
        </Field>
        <Field label={labels[1]}>
          <DatePicker
            popover
            value={draft.to}
            max={optional ? undefined : today}
            clearLabel={optional ? "Clear to date" : undefined}
            onChange={(to) => setDraft({ ...draft, to })}
          />
        </Field>
      </div>
      {!valid && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Choose an end date on or after the start date
          {optional ? "." : ", no later than today."}
        </p>
      )}
      <Button
        className="mt-5 w-full"
        disabled={!valid}
        onClick={() => apply(draft)}
      >
        Apply dates
      </Button>
    </Popover>
  );
}
