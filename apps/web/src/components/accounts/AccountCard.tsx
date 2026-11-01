import { ArrowUpRight, Banknote, CreditCard, Wallet } from "lucide-react";
import { money, type Account, type Person } from "@finance/shared";
import { PersonChip } from "../common/EntityChip";
import { Pill } from "../common/primitives";

export function AccountCard({
  account,
  balance,
  people,
  onOpen,
}: {
  account: Account;
  balance: number;
  people: Person[];
  onOpen: () => void;
}) {
  const Icon =
    account.type === "credit"
      ? CreditCard
      : account.type === "cash"
        ? Banknote
        : Wallet;
  const typeLabel =
    account.type === "credit"
      ? "Credit card"
      : account.type === "cash"
        ? "Cash"
        : "Bank account";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full min-w-0 flex-col rounded-xl border bg-white p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold [overflow-wrap:anywhere]">
            {account.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
            {account.institution
              ? `${account.institution} · ${typeLabel}`
              : typeLabel}
          </p>
        </div>
        <ArrowUpRight
          size={15}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
      </div>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
        <p
          className={`text-xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] ${balance < 0 ? "text-rose-700" : ""}`}
        >
          {money(balance)}
        </p>
        <PersonChip owner={account.owner} people={people} />
      </div>
      {account.archived && (
        <div className="mt-2">
          <Pill>Archived</Pill>
        </div>
      )}
    </button>
  );
}
