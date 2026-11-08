import { AssetIdentity } from "../components/assets/AssetIdentity";
import { ActionError } from "../components/common/ActionError";
import { useState } from "react";
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  assetValue,
  assetHistory,
  displayDate,
  money,
  type Valuation,
} from "@finance/shared";
import { useAction, useSnapshot } from "../hooks/data";
import {
  Card,
  PageHeading,
  Loading,
  ErrorState,
} from "../components/common/primitives";
import { BalanceChart } from "../components/common/Chart";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { AssetForm, ValuationForm } from "../components/assets/AssetForms";
import { TransferForm } from "../components/transactions/TransactionForm";
import { TransactionBrowser } from "../components/transactions/TransactionBrowser";
export function AssetDetail() {
  const { id } = useParams(),
    query = useSnapshot(),
    action = useAction();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "valuations" ? "valuations" : "activity";
  const [transferOpen, setTransferOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState<Valuation | "new" | null>(null);
  if (query.isPending) return <Loading />;
  if (query.error && !query.data)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data,
    asset = data.assets.find((a) => a.id === id);
  if (!asset)
    return (
      <Card>
        Asset or liability not found. <Link to="/assets">Back to assets</Link>
      </Card>
    );
  const history = [...asset.valuations].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const recorded = history.filter((v) => v.date <= data.today);
  const latest = recorded.at(-1),
    current =
      assetValue(asset, data.today, data.transactions) *
      (asset.kind === "liability" ? -1 : 1);
  const points = assetHistory(asset, data.transactions, data.today);
  const hasHistory = points.length > 0;
  const valued = latest?.amountCents ?? 0;
  const movements = current - valued;
  const owner =
    asset.owner === "household"
      ? "Household"
      : (data.people.find((p) => p.id === asset.owner)?.name ??
        "Former member");
  return (
    <>
      <ActionError error={action.error} />
      <Link
        className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground"
        to="/assets"
      >
        <ArrowLeft size={14} />
        Assets & Liabilities
      </Link>
      <PageHeading
        eyebrow={asset.kind === "asset" ? "Asset" : "Liability"}
        title={asset.name}
        description={asset.classification + " · " + owner}
        action={
          <div className="flex flex-wrap gap-2">
            {asset.accountId && (
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                Record transfer
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={14} />
              Edit details
            </Button>
            <Button onClick={() => setEntry("new")}>
              <Plus size={14} />
              Update value
            </Button>
          </div>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-slate-100 to-white">
          <div className="mb-4">
            <AssetIdentity asset={asset} />
          </div>
          <p className="text-xs text-muted-foreground">
            {asset.kind === "asset" ? "Current value" : "Amount owed"}
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {hasHistory ? money(current) : "No value recorded"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">
            Transfers since valuation
          </p>
          <p className="mt-2 text-2xl font-semibold">{money(movements)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">Last valued</p>
          <p className="mt-2 text-lg font-semibold">
            {latest ? displayDate(latest.date) : "—"}
          </p>
        </Card>
      </div>
      <Card className="mb-5">
        <h2 className="mb-4 font-semibold">Value history</h2>
        {hasHistory ? (
          <BalanceChart
            points={points}
            label={asset.name + " value history"}
            valueLabel={asset.kind === "asset" ? "Value" : "Amount owed"}
            step
          />
        ) : (
          <p className="py-8 text-sm text-muted-foreground">
            Add a value to start the graph.
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Last recorded value {money(valued)} + subsequent transfers{" "}
          {money(movements)} = current{" "}
          {asset.kind === "asset" ? "value" : "amount owed"} {money(current)}.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          A valuation includes all movements on or before its date. Changes
          include deposits and withdrawals; they are not a measure of investment
          returns. A negative amount owed means credit.
        </p>
      </Card>
      <div
        role="tablist"
        aria-label="Asset details"
        className="mb-4 flex w-fit gap-1 rounded-xl bg-muted p-1"
      >
        {(["activity", "valuations"] as const).map((value) => (
          <Button
            key={value}
            role="tab"
            aria-selected={tab === value}
            variant={tab === value ? "default" : "secondary"}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set("tab", value);
                return next;
              })
            }
          >
            {value === "activity" ? "Activity" : "Valuations"}
          </Button>
        ))}
      </div>
      {tab === "valuations" && (
        <Card>
          <h2 className="mb-4 font-semibold">Past valuations</h2>
          <div className="divide-y">
            {history.reverse().map((value) => (
              <div
                key={value.id}
                className="flex flex-wrap items-center gap-3 py-4"
              >
                <span className="text-sm">
                  {displayDate(value.date)}
                  {value.date > data.today ? " · Future entry" : ""}
                </span>
                <strong className="ml-auto tabular-nums">
                  {money(value.amountCents)}
                </strong>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={"Edit valuation " + value.date}
                  onClick={() => setEntry(value)}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={"Delete valuation " + value.date}
                  disabled={action.isPending}
                  onClick={() => {
                    if (window.confirm("Delete this historical valuation?"))
                      action.mutate({
                        path: "/assets/" + asset.id + "/valuations/" + value.id,
                        method: "DELETE",
                      });
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
          {!history.length && (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          )}
        </Card>
      )}
      {tab === "activity" && asset.accountId && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold">Transactions</h2>
          <TransactionBrowser
            data={data}
            accountId={asset.accountId}
            onOpen={(row) => {
              const next = new URLSearchParams(params);
              next.delete("tab");
              next.set("account", asset.accountId!);
              next.set("detail", row.id);
              navigate(`/transactions?${next}`);
            }}
          />
        </section>
      )}
      <Dialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title="Move money"
      >
        <TransferForm
          data={data}
          toAccountId={asset.accountId ?? ""}
          done={() => setTransferOpen(false)}
        />
      </Dialog>
      <Dialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit asset or liability"
      >
        <AssetForm asset={asset} data={data} done={() => setEditing(false)} />
      </Dialog>
      <Dialog
        open={!!entry}
        onOpenChange={(open) => {
          if (!open) setEntry(null);
        }}
        title={"Value of " + asset.name}
      >
        <ValuationForm
          key={typeof entry === "object" ? entry?.id : "new"}
          assetId={asset.id}
          date={typeof entry === "object" && entry ? entry.date : data.today}
          amount={
            typeof entry === "object" && entry ? entry.amountCents : current
          }
          done={() => setEntry(null)}
        />
      </Dialog>
    </>
  );
}
