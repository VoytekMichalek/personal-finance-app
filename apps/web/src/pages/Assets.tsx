import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ArrowUpRight } from "lucide-react";
import { assetValue, displayDate, money } from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  Card,
  PageHeading,
  Loading,
  ErrorState,
  Empty,
} from "../components/common/primitives";
import { PersonChip } from "../components/common/EntityChip";
import { AssetForm } from "../components/assets/AssetForms";
export function Assets() {
  const query = useSnapshot(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (query.isPending) return <Loading />;
  if (query.error && !query.data)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  return (
    <>
      <PageHeading
        eyebrow="Beyond your accounts"
        title="Assets & liabilities"
        description="Track investments, property and debts."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} />
            Add asset or liability
          </Button>
        }
      />
      {data.assets.length ? (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {(["asset", "liability"] as const).map((kind) => {
            const assets = data.assets.filter((a) => a.kind === kind);
            const value = (asset: (typeof assets)[number]) =>
              assetValue(asset, data.today, data.transactions) *
              (kind === "liability" ? -1 : 1);
            return (
              <Card key={kind} className="overflow-hidden p-0!">
                <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-4 py-4">
                  <h2 className="font-semibold">
                    {kind === "asset" ? "Assets" : "Liabilities"}
                  </h2>
                  <strong className="tabular-nums">
                    {money(assets.reduce((sum, a) => sum + value(a), 0))}
                  </strong>
                </div>
                <ul className="divide-y px-4">
                  {assets.map((asset) => {
                    const last = asset.valuations
                      .filter((v) => v.date <= data.today)
                      .map((v) => v.date)
                      .sort()
                      .at(-1);
                    return (
                      <li key={asset.id}>
                        <Link
                          to={`/assets/${asset.id}`}
                          className="flex items-start justify-between gap-3 rounded-lg py-3 hover:bg-muted/50"
                        >
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium">
                              {asset.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {asset.classification}
                              {asset.archived ? " · Archived" : ""}
                            </p>
                            <div className="mt-2">
                              <PersonChip
                                owner={asset.owner}
                                people={data.people}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="flex items-center justify-end gap-2 font-semibold tabular-nums">
                              {money(value(asset))}
                              <ArrowUpRight size={14} />
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {last
                                ? `Valued ${displayDate(last)}`
                                : "No valuation yet"}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {!assets.length && (
                  <p className="py-4 text-sm text-muted-foreground">
                    No {kind === "asset" ? "assets" : "liabilities"} recorded.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Add your first asset or debt"
          description="Track its value and transfers over time."
          action={<Button onClick={() => setOpen(true)}>Add an asset</Button>}
        />
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Bank and credit account balances are already included in net worth.
      </p>
      <Dialog open={open} onOpenChange={setOpen} title="Add asset or liability">
        <AssetForm
          data={data}
          done={(result) => {
            setOpen(false);
            navigate(`/assets/${(result as { id: string }).id}`);
          }}
        />
      </Dialog>
    </>
  );
}
