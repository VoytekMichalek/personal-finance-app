import { useState } from "react";
import {
  hasStatementDateError,
  statementDate,
  statementRowDateText,
  type ImportRow,
  type StatementDetails,
} from "@finance/shared";
import { Card, Field, Input } from "../common/primitives";
import { Button } from "../ui/button";
import { DatePicker } from "../ui/date-picker";

type RepairProps = {
  details: StatementDetails;
  busy: boolean;
  correct: (corrections: { rowNumber: number; date: string }[]) => void;
};
export function StatementDateRepairs({
  rows,
  details,
  busy,
  correct,
  error,
  reviewRow,
}: RepairProps & {
  rows: ImportRow[];
  error?: string;
  reviewRow: (rowNumber: number) => void;
}) {
  const [year, setYear] = useState("");
  const [problem, setProblem] = useState("");
  const invalid = rows.filter(hasStatementDateError);
  if (!invalid.length) return null;
  return (
    <Card className="mb-5 border-amber-200 bg-amber-50/40">
      <h2 className="font-semibold">
        Fix statement dates · {invalid.length} need attention
      </h2>
      <p className="mt-2 text-sm">
        If the PDF omits the year, enter it here. The printed day, month and
        amount stay the same. Your category edits and other review choices are
        kept. For a statement spanning New Year, correct those rows individually
        below.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Year for invalid statement dates">
          <Input
            type="number"
            min={1900}
            max={2200}
            placeholder="e.g. 2026"
            value={year}
            disabled={busy}
            onChange={(event) => {
              setYear(event.target.value);
              setProblem("");
            }}
          />
        </Field>
        <Button
          disabled={busy || !year}
          onClick={() => {
            setProblem("");
            const value = Number(year);
            if (!Number.isInteger(value) || value < 1900 || value > 2200) {
              setProblem("Enter a four-digit year from 1900 to 2200.");
              return;
            }
            const corrections = [];
            for (const row of invalid) {
              const printed = statementRowDateText(details, row.rowNumber);
              try {
                if (!printed) throw new Error();
                corrections.push({
                  rowNumber: row.rowNumber,
                  date: statementDate(printed, value),
                });
              } catch {
                setProblem(
                  `Row ${row.rowNumber} cannot use that year. Open the row below to check its printed date and correct it individually.`,
                );
                return;
              }
            }
            correct(corrections);
          }}
        >
          {busy ? "Checking dates…" : "Apply year to invalid dates"}
        </Button>
      </div>
      {(problem || error) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {problem || error}
        </p>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">
          Review individual dates ({invalid.length})
        </summary>
        <ul className="mt-2 max-h-48 overflow-y-auto divide-y">
          {invalid.map((row) => (
            <li
              key={row.rowNumber}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span className="min-w-0 break-words">
                Row {row.rowNumber} ·{" "}
                {statementRowDateText(details, row.rowNumber) ??
                  "Unreadable date"}{" "}
                · {row.description}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => reviewRow(row.rowNumber)}
              >
                Fix row {row.rowNumber}
              </Button>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

export function StatementRowDateRepair({
  row,
  details,
  busy,
  correct,
  error,
  today,
}: RepairProps & {
  row: ImportRow;
  error?: string;
  today: string;
}) {
  const [date, setDate] = useState(row.date);
  if (!hasStatementDateError(row)) return null;
  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-white p-3">
      <p className="text-xs">
        Printed date:{" "}
        <strong>
          {statementRowDateText(details, row.rowNumber) ??
            "Check the source PDF"}
        </strong>
        . Choose its full date, including the year.
      </p>
      <Field label={`Correct date for row ${row.rowNumber}`}>
        <DatePicker
          value={date}
          max={today}
          disabled={busy}
          onChange={setDate}
        />
      </Field>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        size="sm"
        disabled={busy || !date}
        onClick={() => correct([{ rowNumber: row.rowNumber, date }])}
      >
        {busy ? "Checking date…" : `Save date for row ${row.rowNumber}`}
      </Button>
    </div>
  );
}
