import { Children, useId, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "../ui/button";
export function FilterToolbar({
  label,
  children,
  active,
  clear,
  summary,
  tags = [],
}: {
  label: string;
  children: ReactNode;
  active: boolean;
  clear: () => void;
  summary?: string;
  tags?: { label: string; remove: () => void }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const [search, ...controls] = Children.toArray(children);
  return (
    <section
      aria-label={label}
      className="mb-5 rounded-2xl border bg-white p-3 shadow-[0_2px_8px_#20242a03]"
    >
      <div className="flex flex-wrap items-start gap-2 xl:flex-nowrap">
        <div className="min-w-0 flex-1 xl:flex-[1.4]">{search}</div>
        <Button
          variant="secondary"
          className="xl:hidden"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={16} />
          Filters{tags.length ? ` · ${tags.length}` : ""}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear filters"
          title="Clear filters"
          disabled={!active}
          onClick={clear}
          className="xl:order-last"
        >
          <X size={16} />
        </Button>
        <div
          id={id}
          className={`${expanded ? "grid" : "hidden"} w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-[4] [&>div]:min-w-0 [&>div]:xl:flex-1`}
        >
          {controls}
        </div>
      </div>
      {!!tags.length && (
        <div aria-label="Active filters" className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={tag.remove}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 text-xs text-slate-700"
              aria-label={`Remove filter: ${tag.label}`}
            >
              {tag.label}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {summary && (
        <p className="sr-only" aria-label="Transaction filter scope">
          {summary}
        </p>
      )}
    </section>
  );
}
