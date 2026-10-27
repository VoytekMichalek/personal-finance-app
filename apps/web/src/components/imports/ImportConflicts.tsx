import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  displayDate,
  money,
  type ImportConflict,
  type ImportConflictMatch,
  type ImportRow,
  type Snapshot,
} from "@finance/shared";
import { Card } from "../common/primitives";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

export function ImportConflicts({
  conflicts,
  rows,
  data,
  busy,
  updateRow,
  reviewRow,
}: {
  conflicts: ImportConflict[];
  rows: ImportRow[];
  data: Snapshot;
  busy: boolean;
  updateRow: (rowNumber: number, patch: Partial<ImportRow>) => void;
  reviewRow: (rowNumber: number) => void;
}) {
  const [choice, setChoice] = useState<{
    rowNumber: number;
    match?: ImportConflictMatch;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(0);
  useEffect(() => {
    if (conflicts.length && !previous.current) heading.current?.focus();
    previous.current = conflicts.length;
  }, [conflicts.length]);
  if (!conflicts.length) return null;
  const numbers = new Set(conflicts.map((item) => item.rowNumber));
  return (
    <Card className="mb-5 border-amber-300 bg-amber-50/40">
      <h2 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        Check {numbers.size} matching {numbers.size === 1 ? "row" : "rows"}{" "}
        before importing
      </h2>
      <p className="mt-2 text-sm">
        These rows match saved payments. Choose what to do with each one.
        Nothing is saved until you approve the import.
      </p>
      <div className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto">
        {conflicts.map((conflict) => {
          const row = rows.find(
            (item) => item.rowNumber === conflict.rowNumber,
          );
          if (!row) return null;
          const otherChoice =
            row.linkExisting &&
            rows.find(
              (item) =>
                item.include &&
                !item.error &&
                item.rowNumber !== row.rowNumber &&
                item.linkExisting?.id === row.linkExisting?.id,
            );

          return (
            <section
              key={`${conflict.rowNumber}:${conflict.reason}`}
              aria-label={`Conflict row ${row.rowNumber}`}
              className="rounded-xl border bg-white p-4 text-sm"
            >
              <p className="font-semibold">
                Row {row.rowNumber} · {displayDate(row.date)} ·{" "}
                {money(row.amountCents)}
              </p>
              <p className="mt-1 break-words">{row.description}</p>
              <p className="mt-2 text-muted-foreground">
                {conflict.reason === "duplicate"
                  ? "A payment with this date and amount is already in this account."
                  : conflict.reason === "stale-link"
                    ? otherChoice
                      ? `This payment is also chosen for row ${otherChoice.rowNumber}. Link it to only one source row; clear the other choice or skip that row.`
                      : "The payment you chose to link has changed or cannot be linked. Review it and choose again."
                    : "A payment with the opposite amount already exists in the other account."}
              </p>
              <ul className="my-3 space-y-3">
                {conflict.matches.map((match) => (
                  <li key={match.id} className="rounded-lg bg-muted/50 p-3">
                    <p>
                      {data.accounts.find(
                        (account) => account.id === match.accountId,
                      )?.name ?? "Other account"}{" "}
                      · {displayDate(match.date)} · {money(match.amountCents)}
                    </p>
                    <p className="mt-1 break-words">{match.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Link
                        className="text-primary underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        to={`/transactions?detail=${match.id}`}
                      >
                        Open matching payment
                      </Link>
                      {match.transferGroupId || match.kind === "transfer" ? (
                        <span className="text-xs">
                          Already a linked transfer — skip the source row if it
                          is the same payment.
                        </span>
                      ) : match.scheduleId || match.occurrenceDate ? (
                        <span className="text-xs">
                          Matched to a recurring item; review that payment
                          separately.
                        </span>
                      ) : (
                        !rows.some(
                          (item) =>
                            item.include &&
                            !item.error &&
                            item.rowNumber !== row.rowNumber &&
                            item.linkExisting?.id === match.id,
                        ) &&
                        conflict.reason !== "duplicate" &&
                        match.accountId === row.counterAccountId &&
                        match.date === row.date &&
                        match.amountCents === -row.amountCents && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              setChoice({ rowNumber: row.rowNumber, match })
                            }
                          >
                            Link this payment
                          </Button>
                        )
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    updateRow(row.rowNumber, {
                      include: false,
                      linkExisting: undefined,
                      allowDuplicate: false,
                    })
                  }
                >
                  Skip row {row.rowNumber}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => reviewRow(row.rowNumber)}
                >
                  Review row {row.rowNumber}
                </Button>
                {conflict.reason === "stale-link" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      updateRow(row.rowNumber, { linkExisting: undefined })
                    }
                  >
                    Clear link choice
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setChoice({ rowNumber: row.rowNumber })}
                >
                  Keep as a separate payment
                </Button>
              </div>
            </section>
          );
        })}
      </div>
      <Dialog
        open={!!choice}
        onOpenChange={(open) => {
          if (!open) setChoice(null);
        }}
        title={
          choice?.match
            ? "Link the existing payment?"
            : "Keep a separate payment?"
        }
        description={
          choice?.match
            ? "On approval, the existing payment becomes a linked transfer and only the missing account entry is added. Its amount, date, notes and attachments are preserved. Its category is cleared and it no longer counts as income or spending."
            : "Only confirm if these are genuinely different payments. The new transaction will also affect the balance; a transfer adds a new entry to both accounts."
        }
      >
        <p className="mb-5 text-sm">
          Source row {choice?.rowNumber}
          {choice?.match
            ? ` · ${choice.match.description} · ${money(choice.match.amountCents)}`
            : ""}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setChoice(null)}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (!choice) return;
              updateRow(
                choice.rowNumber,
                choice.match
                  ? {
                      linkExisting: {
                        id: choice.match.id,
                        version: choice.match.version,
                      },
                    }
                  : { allowDuplicate: true, linkExisting: undefined },
              );
              setChoice(null);
            }}
          >
            {choice?.match ? "Use this payment" : "Confirm separate payment"}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
