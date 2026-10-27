import { CategoryChip, PersonChip } from "../components/common/EntityChip";
import { TransactionBrowser } from "../components/transactions/TransactionBrowser";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Upload, ArrowLeftRight, Trash2 } from "lucide-react";
import { money, displayDate, type Transaction } from "@finance/shared";
import { useAction, useSnapshot } from "../hooks/data";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  PageHeading,
  Loading,
  ErrorState,
} from "../components/common/primitives";
import {
  TransactionForm,
  TransferForm,
} from "../components/transactions/TransactionForm";
import { ReceiptPanel } from "../components/transactions/ReceiptPanel";
export function Transactions() {
  const query = useSnapshot();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [transfer, setTransfer] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const action = useAction();
  const setParam = (key: string, value?: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  const detailId = params.get("detail");
  const detail = data.transactions.find((t) => t.id === detailId);
  const create = () => {
    setEditing(undefined);
    setOpen(true);
  };
  const edit = (record: Transaction) => {
    setParam("detail");
    setEditing(record);
    setOpen(true);
  };
  return (
    <>
      <PageHeading
        eyebrow="Everyday clarity"
        title="The little things add up."
        description="Your income, spending and transfers. All in one place."
        action={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link to="/imports">
                <Upload size={15} />
                Import CSV
              </Link>
            </Button>
            <Button onClick={create}>
              <Plus size={15} />
              Add transaction
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setTransfer(true)}>
          <ArrowLeftRight size={14} />
          Record transfer
        </Button>
      </div>
      <TransactionBrowser
        data={data}
        initialAccount={params.get("account") ?? ""}
        initialKind={params.get("kind") ?? ""}
        onOpen={(record) => setParam("detail", record.id)}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit transaction" : "Add transaction"}
      >
        <TransactionForm
          key={editing?.id ?? "new"}
          transaction={editing}
          data={data}
          done={() => setOpen(false)}
        />
      </Dialog>
      <Dialog open={transfer} onOpenChange={setTransfer} title="Move money">
        <TransferForm data={data} done={() => setTransfer(false)} />
      </Dialog>
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setParam("detail");
        }}
        title={detail?.description ?? "Transaction"}
        description={detail ? displayDate(detail.date) : ""}
      >
        {detail && (
          <>
            <p className="mb-5 text-3xl font-semibold tabular-nums">
              {money(detail.amountCents)}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Account</dt>
              <dd>
                {data.accounts.find((a) => a.id === detail.accountId)?.name}
              </dd>
              <dt className="text-muted-foreground">Category</dt>
              <dd>
                <CategoryChip
                  categoryId={detail.categoryId}
                  categories={data.categories}
                  transfer={detail.kind === "transfer"}
                />
              </dd>
              <dt className="text-muted-foreground">Belongs to</dt>
              <dd>
                <PersonChip owner={detail.owner} people={data.people} />
              </dd>
            </dl>
            {detail.notes && (
              <p className="mt-4 text-sm text-muted-foreground">
                {detail.notes}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              {detail.kind !== "transfer" && (
                <Button variant="secondary" onClick={() => edit(detail)}>
                  Edit transaction
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    !window.confirm(
                      detail.kind === "transfer"
                        ? "Delete both sides of this transfer?"
                        : "Delete this transaction?",
                    )
                  )
                    return;
                  action.mutate({
                    path: "/transactions/" + detail.id,
                    method: "DELETE",
                  });
                  setParam("detail");
                }}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            </div>
            <ReceiptPanel transactionId={detail.id} />
          </>
        )}
      </Dialog>
    </>
  );
}
