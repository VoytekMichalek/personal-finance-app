import { ReviewBar } from "../common/ReviewBar";
import { reviewStatus } from "../imports/review-status";
import { StatementRowIssue } from "./StatementRowIssue";
import { ActionError } from "../common/ActionError";
import { StatementConfirmation } from "./StatementConfirmation";
import { StatementSourceNotes } from "./StatementSourceNotes";
import { ImportConflicts } from "../imports/ImportConflicts";
import { useImportConflicts } from "../../hooks/import-conflicts";
import { useState, useCallback, useTransition } from "react";
import { StatementImported } from "./StatementImported";
import { StatementFileHeader } from "./StatementFileHeader";
import {
  StatementDateRepairs,
  StatementRowDateRepair,
} from "./StatementDateRepairs";
import { EditAccountButton } from "../accounts/EditAccountButton";
import { DatePicker } from "../ui/date-picker";
import { LoaderCircle } from "lucide-react";
import {
  money,
  moneyInput,
  parseMoney,
  updateImportRows,
  scheduleSchema,
  mergeStatementDateRepairs,
  type Account,
  type ImportRow,
  type Snapshot,
  type StatementPreview,
} from "@finance/shared";
import { Card, Field, Input } from "../common/primitives";
import { Button } from "../ui/button";
import { ImportRows } from "../imports/ImportRows";
import {
  useStatementCommit,
  useStatementDateCorrection,
} from "../../hooks/statements";
import { RecurringReview, type AcceptedRecurring } from "./RecurringReview";
export function StatementReview({
  preview,
  data,
  account,
}: {
  preview: StatementPreview;
  data: Snapshot;
  account: Account;
}) {
  const [rows, setRows] = useState(preview.rows);
  const [page, setPage] = useState(0);
  const [step, setStep] = useState(0);
  const [changingStep, startTransition] = useTransition();
  const goTo = (next: number) =>
    startTransition(() => {
      setStep(next);
      setError("");
    });
  const [accepted, setAccepted] = useState<AcceptedRecurring[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const empty = !data.transactions.some((t) => t.accountId === account.id);
  const canApplyOpening = empty && account.openingBalanceCents === 0;
  const [openingRequested, setApplyOpening] = useState(canApplyOpening);
  const applyOpening = openingRequested && canApplyOpening;
  const [openingDate, setOpeningDate] = useState(
    [preview.details.opening?.date, ...rows.map((r) => r.date)]
      .filter((d): d is string => !!d)
      .sort()[0] ?? account.openingDate,
  );
  const [openingAmount, setOpeningAmount] = useState(
    !preview.details.opening && empty && !account.openingBalanceCents
      ? ""
      : moneyInput(
          preview.details.opening?.amountCents ?? account.openingBalanceCents,
        ),
  );
  const [error, setError] = useState("");
  const commit = useStatementCommit();
  const conflicts = useImportConflicts(data, account.id, rows, commit.error);
  const [focusRow, setFocusRow] = useState<{ rowNumber: number }>();
  const reviewRow = (rowNumber: number) => {
    setPage(
      Math.max(
        0,
        Math.floor(rows.findIndex((row) => row.rowNumber === rowNumber) / 20),
      ),
    );
    setFocusRow({ rowNumber });
    goTo(1);
  };
  const dateRepair = useStatementDateCorrection(preview.id, (corrected) => {
    setRows((current) => mergeStatementDateRepairs(current, corrected.rows));
    setReviewed(false);
    commit.reset();
    const first = corrected.rows
      .map((row) => row.date)
      .filter(Boolean)
      .sort()[0];
    if (first)
      setOpeningDate((current) =>
        current && current <= first ? current : first,
      );
    if (corrected.details.opening)
      setOpeningAmount(
        (current) =>
          current || moneyInput(corrected.details.opening!.amountCents),
      );
  });
  const clearError = commit.reset;
  const selected = rows.filter((r) => r.include && !r.error);
  const reconciledCount = selected.filter((r) => r.reconcileExisting).length;
  const updateRow = useCallback(
    (n: number, patch: Partial<ImportRow>) => {
      clearError();
      setReviewed(false);
      setRows((current) => updateImportRows(current, n, patch));
    },
    [clearError],
  );
  const firstDate = selected.map((r) => r.date).sort()[0];
  const dateProblem =
    firstDate && firstDate < (applyOpening ? openingDate : account.openingDate);
  const transferProblems = selected
    .filter((r) => r.kind === "transfer")
    .some((r) => {
      const other = data.accounts.find((a) => a.id === r.counterAccountId);
      return !other || r.date < other.openingDate;
    });
  if (commit.isSuccess || preview.committedAt)
    return (
      <StatementImported
        id={preview.id}
        accountId={account.id}
        imported={commit.data?.imported}
        data={data}
      />
    );
  return (
    <>
      <ImportConflicts
        accountId={account.id}
        conflicts={conflicts}
        rows={rows}
        data={data}
        busy={commit.isPending}
        updateRow={updateRow}
        reviewRow={reviewRow}
      />
      <ActionError
        error={commit.error || dateRepair.error}
        onRefresh={dateRepair.refresh}
      />
      <StatementFileHeader
        preview={preview}
        rows={rows}
        busy={commit.isPending || dateRepair.isPending}
      />
      <StatementDateRepairs
        rows={rows}
        details={preview.details}
        busy={commit.isPending || dateRepair.isPending}
        correct={dateRepair.mutate}
        error={dateRepair.error?.message}
        reviewRow={reviewRow}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          "Opening balance",
          "Review transactions",
          "Recurring suggestions",
          "Confirm",
        ].map((label, i) => (
          <Button
            key={label}
            variant={step === i ? "default" : "secondary"}
            size="sm"
            disabled={changingStep}
            onClick={() => goTo(i)}
          >
            {i + 1}. {label}
          </Button>
        ))}
      </div>
      {changingStep && (
        <p
          role="status"
          className="mb-4 flex items-center gap-2 text-sm text-primary"
        >
          <LoaderCircle size={16} className="animate-spin" /> Loading next step…
        </p>
      )}
      {step === 0 && (
        <div className="grid gap-5">
          <Card>
            <h2 className="mb-4 font-semibold">Start with the right balance</h2>
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyOpening}
                disabled={!canApplyOpening}
                onChange={(e) => setApplyOpening(e.target.checked)}
              />
              Use the statement’s opening balance
            </label>
            {!canApplyOpening && (
              <p className="mb-4 text-xs text-muted-foreground">
                This account already has a balance or transactions. Its opening
                balance will be preserved.
              </p>
            )}
            {!preview.details.opening && applyOpening && (
              <p className="mb-4 text-sm text-muted-foreground">
                Enter the balance shown before the first transaction.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Statement opening date">
                <DatePicker
                  value={openingDate}
                  max={firstDate ?? data.today}
                  disabled={!applyOpening}
                  onChange={setOpeningDate}
                />
              </Field>
              <Field label="Statement opening balance (AUD)">
                <Input
                  value={openingAmount}
                  disabled={!applyOpening || !!preview.details.opening}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                />
              </Field>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              The opening balance is before the first imported transaction.
              Credit owed is negative.
            </p>
            {dateProblem && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                The first transaction is {firstDate}.{" "}
                {applyOpening
                  ? "Choose that date or earlier above."
                  : "Update this account’s opening date and balance in account details, or exclude earlier rows."}
              </p>
            )}
            {dateProblem && !applyOpening && (
              <EditAccountButton account={account} people={data.people} />
            )}
            {preview.details.closing && (
              <p className="mt-3 text-sm">
                Statement closing balance:{" "}
                <strong>{money(preview.details.closing.amountCents)}</strong>
              </p>
            )}
          </Card>
          {preview.details.warnings.some((w) =>
            /reconcile|does not match|no transactions/i.test(w),
          ) && (
            <p
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Check the extracted totals against your PDF. See Source & reading
              notes below.
            </p>
          )}
          <StatementSourceNotes preview={preview} reviewRow={reviewRow} />
        </div>
      )}
      {step === 1 && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Check the selected transactions and their categories.
          </p>
          <ImportRows
            conflictRows={conflicts.map((c) => c.rowNumber)}
            data={data}
            accountId={account.id}
            preview={{ rows }}
            page={page}
            setPage={setPage}
            busy={commit.isPending || dateRepair.isPending ? "Saving" : ""}
            updateRow={updateRow}
            focusRow={focusRow}
            repairError={(row) => (
              <>
                <StatementRowIssue
                  row={row}
                  id={preview.id}
                  busy={commit.isPending || dateRepair.isPending}
                />
                <StatementRowDateRepair
                  row={row}
                  details={preview.details}
                  today={data.today}
                  busy={commit.isPending || dateRepair.isPending}
                  correct={dateRepair.mutate}
                  error={
                    dateRepair.error?.message.startsWith(
                      `Row ${row.rowNumber}:`,
                    ) ||
                    (dateRepair.variables?.length === 1 &&
                      dateRepair.variables[0]?.rowNumber === row.rowNumber)
                      ? dateRepair.error?.message
                      : undefined
                  }
                />
              </>
            )}
          />
        </>
      )}
      {step === 2 && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Select the bills, income and transfers you want to track. Choose
            each type and the other account for transfers.
          </p>
          <RecurringReview
            suggestions={preview.details.recurring}
            accepted={accepted}
            setAccepted={setAccepted}
            data={data}
            accountId={account.id}
          />
        </>
      )}
      {step === 3 && (
        <StatementConfirmation
          selected={selected}
          total={rows.length}
          reconciledCount={reconciledCount}
          acceptedCount={accepted.length}
          applyOpening={applyOpening}
          openingAmount={openingAmount}
          openingDate={openingDate}
          reviewed={reviewed}
          setReviewed={setReviewed}
          dateProblem={!!dateProblem}
          transferProblems={transferProblems}
          recurringProblems={accepted.some(
            (item) => !scheduleSchema.safeParse(item.schedule).success,
          )}
          error={error}
          goTo={goTo}
        />
      )}

      <ReviewBar
        summary={`${selected.length} selected · ${
          rows.filter(
            (row) =>
              reviewStatus(
                row,
                data,
                account.id,
                conflicts.map((c) => c.rowNumber),
              ) === "attention",
          ).length
        } need attention`}
      >
        <Button variant="ghost" disabled={!step} onClick={() => goTo(step - 1)}>
          Back
        </Button>
        {step === 3 && (
          <Button
            disabled={
              accepted.some(
                (item) => !scheduleSchema.safeParse(item.schedule).success,
              ) ||
              conflicts.length > 0 ||
              !reviewed ||
              !selected.length ||
              commit.isPending ||
              dateRepair.isPending ||
              !!dateProblem ||
              transferProblems
            }
            onClick={() => {
              try {
                setError("");
                commit.mutate({
                  id: preview.id,
                  body: {
                    rows: rows.filter((r) => !r.error),
                    applyOpening,
                    opening: applyOpening
                      ? {
                          date: openingDate,
                          amountCents: parseMoney(openingAmount),
                        }
                      : null,
                    reviewed: true,
                    schedules: accepted,
                  },
                });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {commit.isPending
              ? "Saving reviewed statement…"
              : "Accept & import statement"}
          </Button>
        )}
        {step < 3 && (
          <Button
            disabled={changingStep || (step === 0 && !!dateProblem)}
            onClick={() => goTo(step + 1)}
          >
            {changingStep ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> Opening
                review…
              </>
            ) : (
              "Continue"
            )}
          </Button>
        )}
      </ReviewBar>
    </>
  );
}
