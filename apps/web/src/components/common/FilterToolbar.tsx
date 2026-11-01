import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
export function FilterToolbar({
  label,
  children,
  active,
  clear,
  summary,
}: {
  label: string;
  children: ReactNode;
  active: boolean;
  clear: () => void;
  summary?: string;
}) {
  return (
    <section
      aria-label={label}
      className="mb-5 rounded-2xl border bg-white p-3 shadow-[0_2px_8px_#20242a03]"
    >
      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-3 xl:flex [&>div]:min-w-0 [&>div]:xl:flex-1 [&>div:first-child]:col-span-2 [&>div:first-child]:sm:col-span-2 [&>div:first-child]:xl:flex-[1.4]">
        {children}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear filters"
          title="Clear filters"
          disabled={!active}
          onClick={clear}
          className="justify-self-end"
        >
          <X size={16} />
        </Button>
      </div>
      {summary && (
        <p className="sr-only" aria-label="Transaction filter scope">
          {summary}
        </p>
      )}
    </section>
  );
}
