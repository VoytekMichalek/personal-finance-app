import { AccountCard } from "../components/accounts/AccountCard";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Plus } from "lucide-react";
import {
  accountBalance,
  latestTransactionDates,
  isCashAccount,
  money,
  type Account,
} from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  PageHeading,
  Card,
  Empty,
  Loading,
  ErrorState,
} from "../components/common/primitives";
import { OwnerFilter } from "../components/common/form";
import { AccountForm } from "../components/accounts/AccountForm";
export function Accounts() {
  const query = useSnapshot();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const owner = params.get("owner") ?? "all";
  const showArchived = params.get("archived") === "1";
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const setOwner = (value: string) =>
    update("owner", value === "all" ? "" : value);
  const setShowArchived = (value: boolean) =>
    update("archived", value ? "1" : "");
  const [editing, setEditing] = useState<Account | undefined>();
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
  const lastDates = latestTransactionDates(data.transactions);
  const accounts = data.accounts
    .filter(isCashAccount)
    .filter(
      (a) =>
        (owner === "all" || a.owner === owner) && (showArchived || !a.archived),
    );
  const total = accounts.reduce(
    (sum, a) => sum + accountBalance(a, data.transactions, data.today),
    0,
  );
  const create = () => {
    setEditing(undefined);
    setOpen(true);
  };
  return (
    <>
      <PageHeading
        eyebrow="Your foundations"
        title="Accounts"
        description="See your accounts together. Keep the details simple."
        action={
          <Button onClick={create}>
            <Plus size={16} />
            Add account
          </Button>
        }
      />
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-4!">
        <div>
          <p className="text-xs text-muted-foreground">Combined balance</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {money(total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <div className="w-40">
            <OwnerFilter
              people={data.people}
              value={owner}
              onChange={setOwner}
            />
          </div>
        </div>
      </Card>
      {accounts.length ? (
        <ul
          aria-label="Accounts"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3"
        >
          {accounts.map((account) => (
            <li key={account.id} className="min-w-0">
              <AccountCard
                account={account}
                people={data.people}
                institutions={data.institutions}
                lastTransactionDate={lastDates.get(account.id)}
                balance={accountBalance(account, data.transactions, data.today)}
                onOpen={() => navigate("/accounts/" + account.id)}
                onAppearance={() => {
                  setEditing(account);
                  setOpen(true);
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title="Start with an account"
          description="Add your everyday account, savings, credit card or cash. Your balances will update as you record transactions."
          action={<Button onClick={create}>Add your first account</Button>}
        />
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Account details" : "Add an account"}
      >
        <AccountForm
          key={editing?.id ?? "new"}
          account={editing}
          people={data.people}
          appearanceInitiallyOpen={!!editing}
          done={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
