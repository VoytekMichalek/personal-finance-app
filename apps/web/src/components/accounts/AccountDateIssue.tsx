import { displayDate, type Snapshot } from "@finance/shared";
import { EditAccountButton } from "./EditAccountButton";

export function AccountDateIssue({
  data,
  accountIds,
  date,
}: {
  data: Snapshot;
  accountIds: (string | null | undefined)[];
  date: string;
}) {
  return (
    <>
      {data.accounts
        .filter(
          (account) =>
            accountIds.includes(account.id) &&
            !account.assetId &&
            date &&
            date < account.openingDate,
        )
        .map((account) => (
          <div
            key={account.id}
            className="space-y-2 rounded-xl bg-amber-50 p-3"
          >
            <p role="alert" className="text-xs">
              This payment predates {account.name}’s opening date (
              {displayDate(account.openingDate)}). Correct the payment date
              above, or update the account’s opening date and balance here.
            </p>
            <EditAccountButton account={account} people={data.people} />
          </div>
        ))}
    </>
  );
}
