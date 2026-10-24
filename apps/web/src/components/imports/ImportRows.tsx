import { EditAccountButton } from "../accounts/EditAccountButton";
import {
  memo,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  money,
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
  data: Snapshot;
  accountId: string;
  busy: string;
  updateRow: (n: number, patch: Partial<ImportRow>) => void;
};
const ReviewRow = memo(function ReviewRow({
  row,
  data,
  accountId,
  busy,
  updateRow,
}: RowProps) {
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
  return (
    <article
      aria-label={"Transaction row " + row.rowNumber}
      className={
        "min-w-0 space-y-3 p-4 sm:p-5 " +
        (row.error ? "bg-red-50/50" : !row.include ? "bg-muted/40" : "")
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
              })
            }
          >
            {row.amountCents < 0 ? (
              <SelectItem value="expense">Expense</SelectItem>
            ) : (
              <>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </>
            )}
            <SelectItem value="transfer">Transfer / card repayment</SelectItem>
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
                patch({ counterAccountId: value || null })
              }
            >
              <SelectItem value="">Choose account</SelectItem>
              {data.accounts
                .filter((a) => !a.archived && a.id !== accountId)
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
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
}: Omit<RowProps, "row"> & {
  preview: { rows: ImportRow[] };
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  return (
    <Card className="min-w-0 overflow-hidden p-0!">
      <div className="divide-y">
        {preview.rows
          .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
          .map((row) => (
            <ReviewRow
              key={row.rowNumber}
              row={row}
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
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of{" "}
          {Math.max(1, Math.ceil(preview.rows.length / PAGE_SIZE))}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={(page + 1) * PAGE_SIZE >= preview.rows.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </Card>
  );
}
