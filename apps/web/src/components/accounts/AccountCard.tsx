import { useId } from "react";
import { ArrowUpRight, Palette } from "lucide-react";
import {
  accountBrand,
  money,
  ownerColour,
  type Account,
  type Institution,
  type Person,
} from "@finance/shared";
import { Pill } from "../common/primitives";
import { LastTransaction } from "./LastTransaction";
import { InstitutionLogo } from "./InstitutionLogo";

export function AccountCard({
  account,
  balance,
  people,
  institutions = [],
  lastTransactionDate,
  onOpen,
  onAppearance,
}: {
  account: Account;
  balance: number;
  people: Person[];
  institutions?: Institution[];
  lastTransactionDate?: string;
  onOpen: () => void;
  onAppearance: () => void;
}) {
  const id = useId();
  const brand = accountBrand(account, institutions);
  const typeLabel =
    account.type === "credit"
      ? "Credit card"
      : account.type === "cash"
        ? "Cash"
        : "Bank account";
  const owed = account.type === "credit" && balance < 0;
  const balanceLabel = owed
    ? "Amount owed"
    : account.type === "credit" && balance > 0
      ? "Credit balance"
      : "Balance";
  const [whole, cents] = money(owed ? -balance : balance).split(".");
  const person = people.find((p) => p.id === account.owner);
  const ownerName =
    account.owner === "household"
      ? "Household"
      : person
        ? person.name + (person.state === "deleted" ? " (former member)" : "")
        : "Former member";
  const initials = ownerName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  const colour = ownerColour(account.owner, people);
  return (
    <div className="relative h-full min-w-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open account: ${account.name}`}
        aria-describedby={`${id}-balance ${id}-owner`}
        className="flex h-full w-full min-w-0 flex-col rounded-2xl border bg-white p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{
          backgroundImage: brand.tint
            ? `linear-gradient(120deg, ${brand.color}18, transparent 90%)`
            : undefined,
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5 pr-8">
          <InstitutionLogo brand={brand} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold [overflow-wrap:anywhere]">
              {account.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {brand.name || typeLabel}
            </p>
          </div>
        </div>
        <div id={`${id}-balance`} className="mt-auto pt-5">
          <p className="text-[11px] text-muted-foreground">{balanceLabel}</p>
          <p
            className={`mt-0.5 text-[28px] leading-tight font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] ${balance < 0 ? "text-rose-700" : ""}`}
          >
            {whole}
            <span className="text-xl">.{cents}</span>
          </p>
        </div>
        <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-2 border-t border-black/8 pt-3 text-[11px]">
          <span
            id={`${id}-owner`}
            aria-label={`Owner: ${ownerName}`}
            className="inline-flex min-w-0 items-center gap-1.5"
          >
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
              style={{
                backgroundColor: `color-mix(in srgb, ${colour} 13%, white)`,
                color: `color-mix(in srgb, ${colour} 55%, black)`,
              }}
            >
              {initials}
            </span>
            <span className="[overflow-wrap:anywhere]">{ownerName}</span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            {typeLabel}
            <ArrowUpRight size={12} aria-hidden="true" />
          </span>
        </div>
        <LastTransaction date={lastTransactionDate} />
        {account.archived && (
          <div className="mt-2">
            <Pill>Archived</Pill>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onAppearance}
        aria-label="Edit appearance"
        aria-describedby={`${id}-name`}
        className="absolute top-2.5 right-2 flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Palette size={16} aria-hidden="true" />
        <span id={`${id}-name`} className="sr-only">
          {account.name}
        </span>
      </button>
    </div>
  );
}
