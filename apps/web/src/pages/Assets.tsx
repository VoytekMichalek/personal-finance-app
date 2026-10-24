import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ArrowUpRight } from "lucide-react";
import { assetValue, money } from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  Card,
  PageHeading,
  Loading,
  ErrorState,
  Empty,
  Pill,
} from "../components/common/primitives";
import { AssetForm } from "../components/assets/AssetForms";
export function Assets() {
  const query = useSnapshot(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (query.isPending) return <Loading />;
  if (query.error)
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
        title="Assets & Liabilities"
        description="Property, investments, superannuation and debts."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} />
            Add asset or liability
          </Button>
        }
      />
      <Card>
        {data.assets.length ? (
          <div className="divide-y">
            {data.assets.map((asset) => (
              <Link
                key={asset.id}
                to={"/assets/" + asset.id}
                className="flex items-center justify-between gap-4 rounded-xl px-2 py-5 transition hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold">{asset.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill>{asset.classification}</Pill>
                    <Pill>
                      {asset.kind === "asset" ? "Asset" : "Liability"}
                    </Pill>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold tabular-nums">
                    {money(Math.abs(assetValue(asset, data.today)))}
                  </span>
                  <ArrowUpRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="Your wealth, beyond the everyday"
            description="Add an asset or debt to start its value history."
            action={<Button onClick={() => setOpen(true)}>Add an asset</Button>}
          />
        )}
        <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
          Account balances are already included in net worth.
        </p>
      </Card>
      <Dialog open={open} onOpenChange={setOpen} title="Add asset or liability">
        <AssetForm
          data={data}
          done={(result) => {
            setOpen(false);
            navigate("/assets/" + (result as { id: string }).id);
          }}
        />
      </Dialog>
    </>
  );
}
