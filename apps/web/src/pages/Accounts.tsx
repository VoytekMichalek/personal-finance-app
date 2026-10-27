import { PersonChip } from "../components/common/EntityChip";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Wallet, Plus, ArrowUpRight, CreditCard, Banknote } from "lucide-react";
import { accountBalance, money, type Account } from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  PageHeading,
  Card,
  Pill,
  Empty,
  Loading,
  ErrorState,
} from "../components/common/primitives";
import { OwnerFilter } from "../components/common/form";
import { AccountForm } from "../components/accounts/AccountForm";
export function Accounts() {
  const query = useSnapshot();
  const navigate = useNavigate();
  const [owner, setOwner] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
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
  const accounts = data.accounts.filter(
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
        title="A home for every dollar."
        description="See your accounts together. Keep the details simple."
        action={
          <Button onClick={create}>
            <Plus size={16} />
            Add account
          </Button>
        }
      />
      <Card className="mb-7 flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-xs text-muted-foreground">Combined balance</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const Icon =
              account.type === "credit"
                ? CreditCard
                : account.type === "cash"
                  ? Banknote
                  : Wallet;
            const balance = accountBalance(
              account,
              data.transactions,
              data.today,
            );
            return (
              <button
                onClick={() => {
                  navigate("/accounts/" + account.id);
                }}
                key={account.id}
                className="rounded-2xl border bg-white p-6 text-left transition-shadow hover:shadow-md"
              >
                <div className="mb-7 flex justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Icon size={20} />
                  </span>
                  <ArrowUpRight size={17} className="text-gray-300" />
                </div>
                <p className="text-base font-semibold">{account.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {account.institution ||
                    {
                      bank: "Bank account",
                      cash: "Cash",
                      credit: "Credit card",
                    }[account.type]}
                </p>
                <p className="mt-7 mb-4 text-3xl font-semibold tracking-tight tabular-nums">
                  {money(balance)}
                </p>
                <div className="flex gap-2">
                  <PersonChip owner={account.owner} people={data.people} />
                  {account.archived && <Pill>Archived</Pill>}
                </div>
              </button>
            );
          })}
        </div>
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
          done={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
