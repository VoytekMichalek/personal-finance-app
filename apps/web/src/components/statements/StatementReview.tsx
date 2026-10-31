import { StatementSourceNotes } from "./StatementSourceNotes";
import { ImportConflicts } from "../imports/ImportConflicts";
import { useImportConflicts } from "../../hooks/import-conflicts";
import { useState, useCallback, useTransition } from "react";
import { SavedRecurring } from "./SavedRecurring";
import { StatementReadAgain } from "./StatementReadAgain";
import { EditAccountButton } from "../accounts/EditAccountButton";
import { DatePicker } from "../ui/date-picker";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  money,
  moneyInput,
  parseMoney,
  updateImportRows,
  type Account,
  type ImportRow,
  type Snapshot,
  type StatementPreview,
} from "@finance/shared";
import { Card, Field, Input } from "../common/primitives";
import { Button } from "../ui/button";
import { ImportRows } from "../imports/ImportRows";
import { useStatementCommit } from "../../hooks/statements";
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
  const goTo = (next: number) => startTransition(() => setStep(next));
  const [accepted, setAccepted] = useState<AcceptedRecurring[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const empty = !data.transactions.some((t) => t.accountId === account.id);
  const [applyOpening, setApplyOpening] = useState(empty);
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
  const clearError = commit.reset;
  const selected = rows.filter((r) => r.include && !r.error);
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
      <>
        {" "}
        <Card>
          <h2 className="text-xl font-semibold">Statement imported</h2>
          <p className="my-4 text-sm text-muted-foreground">
            {commit.data ? `${commit.data.imported} transactions saved. ` : ""}
            Your account activity and accepted recurring items are ready.
          </p>
          <Button asChild>
            <Link to={"/accounts/" + account.id}>View account</Link>
          </Button>
          <a
            className="ml-4 text-sm text-primary"
            href={"/api/statements/" + preview.id + "/file"}
          >
            Download original PDF
          </a>
        </Card>
        <SavedRecurring id={preview.id} data={data} />
      </>
    );
  return (
    <>
      <ImportConflicts
        conflicts={conflicts}
        rows={rows}
        data={data}
        busy={commit.isPending}
        updateRow={updateRow}
        reviewRow={(rowNumber) => {
          setPage(
            Math.floor(
              rows.findIndex((row) => row.rowNumber === rowNumber) / 20,
            ),
          );
          setFocusRow({ rowNumber });
          goTo(1);
        }}
      />
      {commit.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {commit.error.message}
        </p>
      )}
      <Card className="mb-5">
        <div className="flex flex-wrap justify-between gap-3">
          <span>
            <strong className="break-all text-sm">{preview.filename}</strong>
            <span className="mt-1 block text-xs text-muted-foreground">
              {preview.pages} pages read · {rows.length} transaction lines ·{" "}
              {rows.filter((r) => r.duplicate).length} possible duplicates
            </span>
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={"/api/statements/" + preview.id + "/file"}
              className="text-xs text-primary"
            >
              Download source PDF
            </a>
            <StatementReadAgain id={preview.id} disabled={commit.isPending} />
          </div>
        </div>
      </Card>
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
                disabled={!empty}
                onChange={(e) => setApplyOpening(e.target.checked)}
              />
              Use the statement’s opening balance
            </label>
            {!empty && (
              <p className="mb-4 text-xs text-muted-foreground">
                This account already has transactions. Its opening balance will
                be preserved.
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
          <StatementSourceNotes preview={preview} />
        </div>
      )}
      {step === 1 && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Check the selected transactions and their categories.
          </p>
          <ImportRows
            data={data}
            accountId={account.id}
            preview={{ rows }}
            page={page}
            setPage={setPage}
            busy={commit.isPending ? "Saving" : ""}
            updateRow={updateRow}
            focusRow={focusRow}
          />
        </>
      )}
      {step === 2 && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Select the bills, subscriptions and income you want to track.
          </p>
          <RecurringReview
            suggestions={preview.details.recurring}
            accepted={accepted}
            setAccepted={setAccepted}
            data={data}
          />
        </>
      )}
      {step === 3 && (
        <Card>
          <h2 className="mb-4 text-xl font-semibold">
            Ready to bring it together?
          </h2>
          <div className="grid gap-3 text-sm">
            <p>
              {selected.length} transactions selected ·{" "}
              {rows.length - selected.length} excluded
            </p>
            <p>
              {selected.filter((r) => r.categoryId).length} categorised ·{" "}
              {
                selected.filter((r) => !r.categoryId && r.kind !== "transfer")
                  .length
              }{" "}
              uncategorised
            </p>
            <p>{accepted.length} recurring items accepted</p>
            <p>
              {applyOpening
                ? `Opening balance: ${openingAmount} AUD on ${openingDate}`
                : "Keep the existing account opening balance"}
            </p>
          </div>
          <label className="my-6 flex gap-3 text-sm leading-6">
            <input
              className="mt-1"
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I have checked all statement pages, amounts, opening balance,
            categorisations and recurring items. I accept the selected entries.
          </label>
          {transferProblems && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              Check the transfer accounts and their opening dates in Review
              transactions before importing.
            </p>
          )}
          {error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={
              conflicts.length > 0 ||
              !reviewed ||
              !selected.length ||
              commit.isPending ||
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
        </Card>
      )}
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" disabled={!step} onClick={() => goTo(step - 1)}>
          Back
        </Button>
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
      </div>
    </>
  );
}
