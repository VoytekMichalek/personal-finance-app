import { BarChart3, Table2 } from "lucide-react";
import { Button } from "../ui/button";

export function ChartViewTabs({
  id,
  value,
  onChange,
}: {
  id: string;
  value: "graph" | "table";
  onChange: (value: "graph" | "table") => void;
}) {
  const views = ["graph", "table"] as const;
  return (
    <div
      role="tablist"
      aria-label="Chart view"
      className="flex w-fit gap-1 rounded-xl bg-muted/60 p-1"
    >
      {views.map((view, index) => (
        <Button
          key={view}
          role="tab"
          id={`${id}-tab-${view}`}
          aria-controls={`${id}-panel-${view}`}
          aria-selected={value === view}
          tabIndex={value === view ? 0 : -1}
          size="sm"
          variant={value === view ? "default" : "ghost"}
          className="gap-2"
          onClick={() => onChange(view)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
            onChange(views[next]!);
            const tabs =
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]',
              );
            tabs?.[next]?.focus();
          }}
        >
          {view === "graph" ? (
            <BarChart3 size={15} aria-hidden="true" />
          ) : (
            <Table2 size={15} aria-hidden="true" />
          )}
          {view === "graph" ? "Graph" : "Table"}
        </Button>
      ))}
    </div>
  );
}
