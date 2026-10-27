import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { Snapshot, Transaction } from "@finance/shared";
import { Card, Input, Select } from "../common/primitives";
import { OwnerFilter } from "../common/form";
import { CategoryChip } from "../common/EntityChip";
import { SearchInput } from "../common/SearchInput";
import { Button } from "../ui/button";
import { SelectItem } from "../ui/select";
import { TransactionTable } from "./TransactionTable";

export function TransactionBrowser({
  data,
  accountId,
  initialAccount = "",
  initialKind = "",
  onOpen,
}: {
  data: Snapshot;
  accountId?: string;
  initialAccount?: string;
  initialKind?: string;
  onOpen: (row: Transaction) => void;
}) {
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState(initialAccount);
  const [owner, setOwner] = useState("all");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState(initialKind);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const activeAccount = accountId ?? account;
  const filtered = !!(
    search ||
    (!accountId && account) ||
    owner !== "all" ||
    category ||
    kind ||
    from ||
    to
  );
  const rows = data.transactions.filter(
    (t) =>
      (!search || t.description.toLowerCase().includes(search.toLowerCase())) &&
      (!activeAccount || t.accountId === activeAccount) &&
      (owner === "all" || t.owner === owner) &&
      (!category ||
        (category === "none" ? !t.categoryId : t.categoryId === category)) &&
      (!from || t.date >= from) &&
      (!to || t.date <= to) &&
      (!kind ||
        (kind === "expense"
          ? t.kind === "expense" || t.kind === "refund"
          : t.kind === kind)),
  );
  const context = JSON.stringify([
    search,
    activeAccount,
    owner,
    category,
    kind,
    from,
    to,
  ]);
  return (
    <>
      <Card className="mb-4 p-4!">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SearchInput
            aria-label="Search transactions"
            placeholder="Search activity"
            value={search}
            onValueChange={setSearch}
          />
          {!accountId && (
            <Select
              aria-label="Filter account"
              value={account}
              onValueChange={setAccount}
            >
              <SelectItem value="">All accounts</SelectItem>
              {data.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </Select>
          )}
          <Select
            aria-label="Filter category"
            value={category}
            onValueChange={setCategory}
          >
            <SelectItem value="">All categories</SelectItem>
            <SelectItem value="none">Uncategorised</SelectItem>
            {data.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <CategoryChip categoryId={c.id} categories={data.categories} />
              </SelectItem>
            ))}
          </Select>
          <OwnerFilter people={data.people} value={owner} onChange={setOwner} />
          <Select aria-label="Filter type" value={kind} onValueChange={setKind}>
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expenses & refunds</SelectItem>
            <SelectItem value="refund">Refunds</SelectItem>
            <SelectItem value="transfer">Transfers</SelectItem>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DateFilter label="From date" value={from} onChange={setFrom} />
          <span className="text-xs text-muted-foreground">to</span>
          <DateFilter label="To date" value={to} onChange={setTo} />
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setAccount("");
                setOwner("all");
                setCategory("");
                setKind("");
                setFrom("");
                setTo("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        {from && to && from > to && (
          <p role="alert" className="mt-3 text-sm text-amber-800">
            Choose an end date on or after the start date.
          </p>
        )}
      </Card>
      <TransactionTable key={context} data={data} rows={rows} onOpen={onOpen} />
    </>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center">
      <Input
        ref={input}
        aria-label={label}
        type="date"
        className="h-11 w-36 text-xs sm:h-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <X size={15} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
