import { useState } from "react";
import type { StatementPreview } from "@finance/shared";
import { Pill } from "../common/primitives";
import { Button } from "../ui/button";
export function StatementSourceNotes({
  preview,
}: {
  preview: StatementPreview;
}) {
  const [sourcePage, setSourcePage] = useState(1);
  return (
    <details className="rounded-2xl border bg-white p-5">
      <summary className="cursor-pointer text-sm font-medium">
        Source & reading notes
        {preview.details.warnings.some((w) =>
          /reconcile|does not match|no transactions/i.test(w),
        )
          ? " · Check totals"
          : ""}
      </summary>
      <div className="my-4 space-y-2 text-xs leading-5 text-muted-foreground">
        {preview.details.warnings
          .filter(
            (w) =>
              !/AI extraction needs|Credit card balances owed/i.test(w) &&
              !(
                preview.details.opening &&
                /opening balance/i.test(w) &&
                /not identified|not found|no verified/i.test(w)
              ),
          )
          .map((w) => (
            <p key={w}>{w}</p>
          ))}
      </div>
      <div className="max-h-96 overflow-auto rounded-xl border">
        {preview.details.lines
          .filter((l) => l.page === sourcePage)
          .map((l) => (
            <div
              key={l.page + ":" + l.line}
              className={
                "flex gap-3 border-b px-3 py-2 text-xs " +
                (l.status === "review" ? "bg-amber-50" : "")
              }
            >
              <span className="shrink-0 text-muted-foreground">{l.line}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono">
                {l.text}
              </span>
              {l.rowNumber && <Pill>Row {l.rowNumber}</Pill>}
            </div>
          ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          disabled={sourcePage === 1}
          onClick={() => setSourcePage((p) => p - 1)}
        >
          Previous page
        </Button>
        <span className="text-xs">
          Page {sourcePage} of {preview.pages}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={sourcePage >= preview.pages}
          onClick={() => setSourcePage((p) => p + 1)}
        >
          Next page
        </Button>
      </div>
    </details>
  );
}
