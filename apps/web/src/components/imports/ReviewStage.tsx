import { useImportConflicts } from "../../hooks/import-conflicts";
import { ImportConflicts } from "./ImportConflicts";
import { importBalance } from "../../lib/import-balance";
import { useState } from "react";
import { ReconciliationNotice } from "./ReconciliationNotice";
import { money, type ImportPreview, type Snapshot } from "@finance/shared";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import type { CsvImport } from "../../hooks/csv-import";
import { ImportRows } from "./ImportRows";
import { Card } from "../common/primitives";
import { Button } from "../ui/button";

export function ReviewStage({
  data,
  flow,
  preview,
}: {
  data: Snapshot;
  flow: CsvImport;
  preview: ImportPreview;
}) {
  const conflicts = useImportConflicts(
    data,
    flow.accountId,
    preview.rows,
    flow.conflictError,
  );
  const [focusRow, setFocusRow] = useState<{ rowNumber: number }>();
  const [acknowledged, setAcknowledged] = useState("");
  const summary = importBalance(data, flow.accountId, preview);
  const reviewKey = JSON.stringify([
    preview.id,
    summary.difference,
    preview.rows.filter((row) => row.include).map((row) => row.rowNumber),
  ]);
  const needsCheck = Boolean(
    summary.source?.warning ||
      (summary.difference !== null && summary.difference !== 0),
  );
  const { accountId, filename, busy, page, setPage, updateRow } = flow;
  const selected = preview.rows.filter((row) => row.include && !row.error);
  const moneyIn = selected.reduce(
    (sum, row) => sum + Math.max(0, row.amountCents),
    0,
  );
  const moneyOut = selected.reduce(
    (sum, row) => sum + Math.max(0, -row.amountCents),
    0,
  );
  return (
    <>
      <ImportConflicts
        conflicts={conflicts}
        rows={preview.rows}
        data={data}
        busy={!!busy}
        updateRow={updateRow}
        reviewRow={(rowNumber) => {
          setPage(
            Math.floor(
              preview.rows.findIndex((row) => row.rowNumber === rowNumber) / 20,
            ),
          );
          setFocusRow({ rowNumber });
        }}
      />
      <ReconciliationNotice summary={summary} />
      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 break-all text-sm font-semibold">
              <FileSpreadsheet size={17} className="shrink-0" />
              {filename}
            </p>
            <p className="mt-2 text-sm">
              Import into {data.accounts.find((a) => a.id === accountId)?.name}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {preview.validCount} valid · {preview.invalidCount} need
              correction · {preview.rows.filter((r) => r.duplicate).length}{" "}
              possible duplicates
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {selected.length} selected · {money(moneyIn)} money in ·{" "}
              {money(moneyOut)} money out
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {selected.filter((row) => row.categoryId).length} categorised.
              Categories are suggested automatically from your rules, previous
              transactions and recognised merchants, just like PDF statements.
              Review or change them before approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={Boolean(busy) || !flow.aiAvailable}
              onClick={() => void flow.suggestCategories()}
            >
              <Sparkles size={14} />
              {flow.aiProgress?.failed
                ? "Retry suggestions"
                : "Suggest categories"}
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={flow.changePreview}
            >
              Change mapping
            </Button>
            <Button
              disabled={
                conflicts.length > 0 ||
                !selected.length ||
                Boolean(busy) ||
                (needsCheck && acknowledged !== reviewKey)
              }
              onClick={() => void flow.approve()}
            >
              {busy || "Approve & import (" + selected.length + ")"}
            </Button>
          </div>
        </div>
      </Card>
      {flow.aiProgress && (
        <p role="status" className="mb-4 text-sm">
          AI checked {flow.aiProgress.done} of {flow.aiProgress.total} remaining
          transactions
          {flow.aiProgress.failed
            ? " · interrupted; retry to continue"
            : flow.aiProgress.done === flow.aiProgress.total
              ? " · complete. Uncertain matches remain uncategorised."
              : "…"}
        </p>
      )}
      {needsCheck && (
        <label className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged === reviewKey}
            onChange={(event) =>
              setAcknowledged(event.target.checked ? reviewKey : "")
            }
          />
          I have checked the balance difference and want to import the selected
          rows.
        </label>
      )}
      <ImportRows
        {...{
          data,
          accountId,
          preview,
          page,
          setPage,
          busy,
          updateRow,
          focusRow,
        }}
      />
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Amounts and dates remain tied to your source rows. Correct their mapping
        if needed. Mark refunds and transfers before approving. Transfers create
        both linked account entries; a later import will flag the other entry as
        a possible duplicate. Identical legitimate payments can be retained
        explicitly. Only selected valid rows are saved when you approve.
      </p>
    </>
  );
}
