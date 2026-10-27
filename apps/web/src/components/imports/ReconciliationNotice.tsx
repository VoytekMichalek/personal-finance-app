import type { importBalance } from "../../lib/import-balance";
import { displayDate, money } from "@finance/shared";
import { Card } from "../common/primitives";
export function ReconciliationNotice({
  summary,
}: {
  summary: ReturnType<typeof importBalance>;
}) {
  const { source, selected, projected, difference, account, end } = summary;
  if (!source) return null;
  return (
    <Card className="mb-5">
      <h2 className="font-semibold">Check your balance</h2>
      <p className="mt-2 text-sm">
        {source.sourceRows} source rows · {selected.length} selected ·{" "}
        {source.sourceRows - selected.length} excluded
      </p>
      {source.from && source.to && (
        <p className="mt-2 text-sm">
          CSV covers {displayDate(source.from)} to {displayDate(source.to)}.
        </p>
      )}
      <p className="mt-2 text-sm">
        Account opening: {money(account.openingBalanceCents)} at the start of{" "}
        {displayDate(account.openingDate)}.
      </p>
      {source.from && source.from > account.openingDate && (
        <p className="mt-2 text-xs text-muted-foreground">
          This file does not include earlier activity between the account
          opening date and {displayDate(source.from)}. Import that history too
          if it is not already recorded.
        </p>
      )}
      {source.balanceVerified && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">
              Bank balance before this file
            </dt>
            <dd className="font-semibold">{money(source.bankOpeningCents!)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bank closing balance</dt>
            <dd className="font-semibold">{money(source.bankClosingCents!)}</dd>
          </div>
        </dl>
      )}
      <p className="mt-3 text-sm">
        App balance after selected rows, as at {displayDate(end)}:{" "}
        <strong>{money(projected)}</strong>
      </p>
      {difference === 0 && (
        <p className="mt-3 text-sm text-emerald-700">
          The selected import reconciles with the bank’s closing balance.
        </p>
      )}
      {difference !== null && difference !== 0 && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          Balance difference: {money(difference)}. Check missing history,
          excluded rows, duplicates and the opening balance before approving. AI
          categories do not change balances.
        </p>
      )}
      {source.warning && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          {source.warning}
        </p>
      )}
      {!source.balanceVerified && !source.warning && (
        <p className="mt-3 text-xs text-muted-foreground">
          Map a running balance column to check this against the bank. Without
          one, compare the projected balance with your bank’s closing balance.
        </p>
      )}
    </Card>
  );
}
