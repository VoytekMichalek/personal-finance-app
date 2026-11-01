import type { ImportRow } from "@finance/shared";
import { Card } from "../common/primitives";
import { StatementReviewIssues } from "./StatementReviewIssues";
export function StatementConfirmation({
  selected,
  total,
  reconciledCount,
  acceptedCount,
  applyOpening,
  openingAmount,
  openingDate,
  reviewed,
  setReviewed,
  dateProblem,
  transferProblems,
  recurringProblems,
  error,
  goTo,
}: {
  selected: ImportRow[];
  total: number;
  reconciledCount: number;
  acceptedCount: number;
  applyOpening: boolean;
  openingAmount: string;
  openingDate: string;
  reviewed: boolean;
  setReviewed: (value: boolean) => void;
  dateProblem: boolean;
  transferProblems: boolean;
  recurringProblems: boolean;
  error: string;
  goTo: (step: number) => void;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-xl font-semibold">
        Ready to bring it together?
      </h2>
      <div className="grid gap-3 text-sm">
        <p>
          {selected.length} transactions selected · {total - selected.length}{" "}
          excluded
        </p>
        <p>
          {selected.filter((r) => r.categoryId).length} categorised ·{" "}
          {
            selected.filter((r) => !r.categoryId && r.kind !== "transfer")
              .length
          }{" "}
          uncategorised
        </p>
        {reconciledCount > 0 && (
          <p>
            {selected.length - reconciledCount} new payments · {reconciledCount}{" "}
            existing transfers to reconcile
          </p>
        )}
        <p>{acceptedCount} recurring items accepted</p>
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
      <StatementReviewIssues
        dateProblem={!!dateProblem}
        transferProblems={transferProblems}
        recurringProblems={recurringProblems}
        openingError={error}
        goTo={goTo}
      />
    </Card>
  );
}
