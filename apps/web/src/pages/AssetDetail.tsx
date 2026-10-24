import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  assetValue,
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
export function AssetDetail() {
  const { id } = useParams(),
    query = useSnapshot(),
    action = useAction();
  const [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState<Valuation | "new" | null>(null);
  if (query.isPending) return <Loading />;
  if (query.error)
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
    current = Math.abs(assetValue(asset, data.today));
  const change = latest && recorded[0] ? current - recorded[0].amountCents : 0;
  const owner =
    asset.owner === "household"
      ? "Household"
      : (data.people.find((p) => p.id === asset.owner)?.name ??
        "Former member");
  return (
    <>
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
          <div className="flex gap-2">
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
        <Card>
          <p className="text-xs text-muted-foreground">
            {asset.kind === "asset" ? "Current value" : "Amount owed"}
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {latest ? money(current) : "No value recorded"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">
            Change since first entry
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {latest ? money(change) : "—"}
          </p>
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
        {recorded.length ? (
          <BalanceChart
            points={recorded.map((v) => ({
              date: v.date,
              balanceCents: v.amountCents,
            }))}
            label={asset.name + " value history"}
            valueLabel={asset.kind === "asset" ? "Value" : "Amount owed"}
            step
          />
        ) : (
          <p className="py-8 text-sm text-muted-foreground">
            Add a value to start the graph.
          </p>
        )}
      </Card>
      <Card>
        <h2 className="mb-4 font-semibold">Past entries</h2>
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
