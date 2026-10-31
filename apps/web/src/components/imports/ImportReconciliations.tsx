import {
  displayDate,
  money,
  type ImportRow,
  type ImportReconciliation,
  type Snapshot,
} from "@finance/shared";
import { Card } from "../common/primitives";
import { Button } from "../ui/button";
import { Link } from "react-router-dom";

export function ImportReconciliations({
  candidates,
  rows,
  data,
  busy,
  updateRow,
  reviewRow,
}: {
  candidates: ImportReconciliation[];
  rows: ImportRow[];
  data: Snapshot;
  busy: boolean;
  updateRow: (rowNumber: number, patch: Partial<ImportRow>) => void;
  reviewRow: (rowNumber: number) => void;
}) {
  const accepted = rows.filter((row) => row.include && row.reconcileExisting);
  if (!candidates.length && !accepted.length) return null;
  const accept = (item: ImportReconciliation) =>
    updateRow(item.rowNumber, {
      include: true,
      kind: "transfer",
      categoryId: null,
      categorySource: undefined,
      counterAccountId: item.counterpart.accountId,
      reconcileExisting: item.choice,
      linkExisting: undefined,
      allowDuplicate: false,
      rememberCategory: false,
    });
  return (
    <Card className="mb-5 border-emerald-200 bg-emerald-50/50">
      <h2 className="font-semibold">Transfer reconciliations</h2>
      {candidates.length > 0 && (
        <>
          <p className="mt-2 text-sm">
            Automatically matched {candidates.length} statement{" "}
            {candidates.length === 1 ? "entry" : "entries"} to transfers already
            recorded in both accounts. Accept these matches to reconcile them
            without adding payments or changing balances.
          </p>
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() => candidates.forEach(accept)}
          >
            Accept reconciliations ({candidates.length})
          </Button>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-primary">
              Review matched transfers
            </summary>
            <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto">
              {candidates.map((item) => (
                <li
                  key={item.rowNumber}
                  className="rounded-xl border bg-white p-3"
                >
                  <p>
                    Row {item.rowNumber} · {displayDate(item.match.date)} ·{" "}
                    {money(item.match.amountCents)}
                  </p>
                  <p className="mt-1 break-words">
                    {
                      rows.find((row) => row.rowNumber === item.rowNumber)
                        ?.description
                    }
                  </p>
                  <p className="mt-1 text-xs">
                    Already linked with{" "}
                    {
                      data.accounts.find(
                        (account) => account.id === item.counterpart.accountId,
                      )?.name
                    }
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Link
                      className="text-primary underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      to={`/transactions?detail=${item.match.id}`}
                    >
                      Open existing transfer
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => accept(item)}
                    >
                      Accept match for row {item.rowNumber}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        updateRow(item.rowNumber, {
                          reconciliationDismissed: true,
                          include: true,
                          allowDuplicate: false,
                        });
                        reviewRow(item.rowNumber);
                      }}
                    >
                      Review individually
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {accepted.length > 0 && (
        <p role="status" className="mt-3 text-sm">
          {accepted.length}{" "}
          {accepted.length === 1 ? "reconciliation" : "reconciliations"}{" "}
          accepted. These rows are highlighted in the review. Links are saved
          when you approve the import; no extra payments are created.
        </p>
      )}
    </Card>
  );
}
