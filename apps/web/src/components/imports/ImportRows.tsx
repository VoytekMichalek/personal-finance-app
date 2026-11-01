import { reviewStatus, type ReviewStatus } from "./review-status";
import { accountLabel } from "@finance/shared";
import { TransferValueNote } from "../assets/TransferValueNote";
import { RememberCategory } from "./RememberCategory";
import { EditAccountButton } from "../accounts/EditAccountButton";
import {
  memo,
  useState,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import {
  money,
  identityColour,
  displayDate,
  type ImportRow,
  type Snapshot,
} from "@finance/shared";
import { Select, SelectItem } from "../ui/select";
import { OwnerOptions } from "../common/form";
import { Card, Pill } from "../common/primitives";
import { Button } from "../ui/button";
import { CategoryPicker } from "../categories/CategoryPicker";
type RowProps = {
  row: ImportRow;
  rememberedCount: number;
  focusRow?: { rowNumber: number };
  data: Snapshot;
  accountId: string;
  busy: string;
  updateRow: (n: number, patch: Partial<ImportRow>) => void;
  repairError?: (row: ImportRow) => ReactNode;
};
const ReviewRow = memo(function ReviewRow({
  row,
  rememberedCount,
  data,
  accountId,
  busy,
  updateRow,
  focusRow,
  repairError,
}: RowProps) {
  const articleRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (focusRow?.rowNumber === row.rowNumber) articleRef.current?.focus();
  }, [focusRow, row.rowNumber]);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = descriptionRef.current;
    if (!field) return;
    const resize = () => {
      field.style.height = "auto";
      field.style.height = field.scrollHeight + 2 + "px";
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== width) {
        width = field.clientWidth;
        resize();
      }
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [row.description]);
  const patch = (values: Partial<ImportRow>) =>
    updateRow(row.rowNumber, values);
  const other = data.accounts.find((a) => a.id === row.counterAccountId);
  if (row.reconcileExisting && row.include)
    return (
      <article
        ref={articleRef}
        tabIndex={-1}
        aria-label={"Transaction row " + row.rowNumber}
        className="space-y-3 bg-emerald-50/60 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Pill tone="positive">Reconciliation accepted</Pill>
          <span>{displayDate(row.date)}</span>
          <strong className="ml-auto tabular-nums">
            {money(row.amountCents)}
          </strong>
        </div>
        <p className="break-words text-sm">{row.description}</p>
        <p className="text-xs text-muted-foreground">
          Already recorded as a transfer with{" "}
          {other?.name ?? "the other account"}. Approval links this source row
          without adding another payment or changing the existing transfer.
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={!!busy}
          onClick={() =>
            patch({ reconcileExisting: undefined, include: !row.duplicate })
          }
        >
          Undo reconciliation for row {row.rowNumber}
        </Button>
      </article>
    );
  return (
    <article
      ref={articleRef}
      tabIndex={-1}
      aria-label={"Transaction row " + row.rowNumber}
      className={
        "min-w-0 space-y-3 p-4 sm:p-5 " +
        (row.error
          ? "bg-red-50/50"
          : !row.include
            ? "bg-muted/40"
            : row.categorySource
              ? "bg-emerald-50/60"
              : "")
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input
          aria-label={"Include row " + row.rowNumber}
          type="checkbox"
          checked={row.include}
          disabled={!!row.error || !!busy}
          onChange={(e) =>
            patch({
              include: e.target.checked,
              allowDuplicate: row.duplicate && e.target.checked,
            })
          }
        />
        <span className="text-muted-foreground">
          {row.date ? displayDate(row.date) : "Invalid date"}
        </span>
        <strong className="ml-auto tabular-nums">
          {money(row.amountCents)}
        </strong>
      </div>
      <textarea
        ref={descriptionRef}
        aria-label={"Description row " + row.rowNumber}
        rows={2}
        maxLength={250}
        disabled={!!busy}
        className="w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm leading-6 [field-sizing:content]"
        value={row.description}
        onChange={(e) => patch({ description: e.target.value })}
      />
      {row.error ? (
        <p className="text-xs text-destructive">{row.error}</p>
      ) : row.duplicate ? (
        <Pill tone="warning">Possible duplicate · select to retain</Pill>
      ) : null}
      {row.error && repairError?.(row)}
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <label className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">
          Type
          <Select
            disabled={!!busy}
            aria-label={"Type row " + row.rowNumber}
            value={row.kind}
            onValueChange={(value) =>
              patch({
                kind: value as ImportRow["kind"],
                categoryId: null,
                counterAccountId: null,
                linkExisting: undefined,
                allowDuplicate: false,
              })
            }
          >
            {row.amountCents < 0 ? (
              <SelectItem value="expense">
                <Pill colour={identityColour("type:expense")}>Expense</Pill>
              </SelectItem>
            ) : (
              <>
                <SelectItem value="income">
                  <Pill colour={identityColour("type:income")}>Income</Pill>
                </SelectItem>
                <SelectItem value="refund">
                  <Pill colour={identityColour("type:refund")}>Refund</Pill>
                </SelectItem>
              </>
            )}
            <SelectItem value="transfer">
              <Pill colour={identityColour("type:transfer")}>
                Transfer / card repayment
              </Pill>
            </SelectItem>
          </Select>
        </label>
        <div className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">
          <span>{row.kind === "transfer" ? "Other account" : "Category"}</span>
          {row.kind === "transfer" ? (
            <Select
              disabled={!!busy}
              aria-label={"Transfer account row " + row.rowNumber}
              value={row.counterAccountId ?? ""}
              onValueChange={(value) =>
                patch({
                  counterAccountId: value || null,
                  linkExisting: undefined,
                  allowDuplicate: false,
                })
              }
            >
              <SelectItem value="">Choose account</SelectItem>
              {data.accounts
                .filter((a) => !a.archived && a.id !== accountId)
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <Pill colour={identityColour("account:" + a.id)}>
                      {accountLabel(a)}
                    </Pill>
                  </SelectItem>
                ))}
            </Select>
          ) : (
            <CategoryPicker
              categories={data.categories}
              kind={row.kind === "income" ? "income" : "expense"}
              disabled={!!busy}
              aria-label={"Category row " + row.rowNumber}
              value={row.categoryId}
              onChange={(value) =>
                patch({ categoryId: value, categoryChosen: true })
              }
            />
          )}
        </div>
        <label className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">
          Belongs to
          <Select
            disabled={!!busy}
            aria-label={"Owner row " + row.rowNumber}
            value={row.owner}
            onValueChange={(owner) => patch({ owner })}
          >
            <OwnerOptions people={data.people} />
          </Select>
        </label>
      </div>
      {row.categorySource && (row.categoryId || row.kind === "transfer") && (
        <Pill tone="positive">
          {row.kind === "transfer"
            ? "Auto transfer · saved rule"
            : row.categorySource === "rule"
              ? "Auto categorised · saved rule"
              : "Auto categorised · remembered in this upload"}
        </Pill>
      )}
      {row.kind === "transfer" && (
        <TransferValueNote
          data={data}
          accountIds={[row.counterAccountId]}
          date={row.date}
        />
      )}
      {row.kind !== "transfer" && !row.error && (
        <RememberCategory
          row={row}
          count={rememberedCount}
          busy={!!busy}
          patch={patch}
        />
      )}
      {row.linkExisting && (
        <p className="text-xs text-primary">
          This row will link to the chosen existing payment on approval.{" "}
          <Button
            size="sm"
            variant="ghost"
            disabled={!!busy}
            onClick={() => patch({ linkExisting: undefined })}
          >
            Undo link choice
          </Button>
        </p>
      )}
      {other && row.date < other.openingDate && row.include && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            This repayment predates {other.name}’s opening date (
            {displayDate(other.openingDate)}). Update that account’s opening
            date and balance, or exclude this row.
          </p>
          <EditAccountButton account={other} people={data.people} />
        </div>
      )}
    </article>
  );
});
const PAGE_SIZE = 20;
export function ImportRows({
  data,
  accountId,
  preview,
  page,
  setPage,
  busy,
  updateRow,
  focusRow,
  repairError,
  conflictRows = [],
}: Omit<RowProps, "row" | "rememberedCount"> & {
  preview: { rows: ImportRow[] };
  conflictRows?: number[];
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  const [selection, setSelection] = useState<{
    filter: ReviewStatus | "all";
    focus: typeof focusRow;
  }>({ filter: "all", focus: focusRow });
  const filter = selection.focus === focusRow ? selection.filter : "all";
  const statusRows = preview.rows.map((row) => ({
    row,
    status: reviewStatus(row, data, accountId, conflictRows),
  }));
  const visible = statusRows
    .filter((item) => filter === "all" || item.status === filter)
    .map((item) => item.row);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(visible.length / PAGE_SIZE) - 1),
  );
  const rememberedCounts = new Map<number, number>();
  for (const row of preview.rows) {
    if (row.rememberedFrom !== undefined)
      rememberedCounts.set(
        row.rememberedFrom,
        (rememberedCounts.get(row.rememberedFrom) ?? 0) + 1,
      );
  }
  return (
    <Card className="min-w-0 overflow-hidden p-0!">
      <div
        role="group"
        aria-label="Review status"
        className="flex flex-wrap gap-1 border-b p-3"
      >
        {(
          [
            ["all", "All"],
            ["attention", "Needs attention"],
            ["ready", "Ready"],
            ["reconciled", "Reconciled"],
            ["excluded", "Excluded"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "ghost"}
            aria-pressed={filter === value}
            onClick={() => {
              setSelection({ filter: value, focus: focusRow });
              setPage(0);
            }}
          >
            {label} (
            {value === "all"
              ? preview.rows.length
              : statusRows.filter((item) => item.status === value).length}
            )
          </Button>
        ))}
      </div>
      {filter === "attention" && (
        <p className="border-b p-3 text-xs text-muted-foreground">
          Check errors, transfer details and uncategorised payments. Valid
          uncategorised payments can still be imported.
        </p>
      )}
      {!visible.length && (
        <p className="p-5 text-sm text-muted-foreground">
          No transactions in this view. Choose All to see the complete
          statement.
        </p>
      )}
      <div className="divide-y">
        {visible
          .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
          .map((row) => (
            <ReviewRow
              key={row.rowNumber}
              row={row}
              rememberedCount={rememberedCounts.get(row.rowNumber) ?? 0}
              focusRow={focusRow}
              repairError={repairError}
              data={data}
              accountId={accountId}
              busy={busy}
              updateRow={updateRow}
            />
          ))}
      </div>
      <div className="flex items-center justify-between border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={!currentPage}
          onClick={() => setPage(currentPage - 1)}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {currentPage + 1} of{" "}
          {Math.max(1, Math.ceil(visible.length / PAGE_SIZE))}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={(currentPage + 1) * PAGE_SIZE >= visible.length}
          onClick={() => setPage(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </Card>
  );
}
