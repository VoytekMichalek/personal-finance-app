import { displayDate, type Snapshot } from "@finance/shared";

export function TransferValueNote({
  data,
  accountIds,
  date,
}: {
  data: Snapshot;
  accountIds: (string | null | undefined)[];
  date: string;
}) {
  const assets = data.assets.filter(
    (asset) => asset.accountId && accountIds.includes(asset.accountId),
  );
  return (
    <>
      {assets.map((asset) => {
        const valued = asset.valuations
          .filter((value) => value.date <= data.today)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        return (
          <p key={asset.id} className="text-xs leading-5 text-muted-foreground">
            {valued && date && date <= valued.date
              ? `${asset.name}: this payment is on or before the closing valuation of ${displayDate(valued.date)}, so it is already included in that value. Update the valuation if it did not include this payment.`
              : `${asset.name}: this transfer will automatically adjust ${asset.kind === "liability" ? "the amount owed" : "the tracked value"}.`}
          </p>
        );
      })}
    </>
  );
}
