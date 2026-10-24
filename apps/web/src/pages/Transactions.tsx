import { SelectItem } from "../components/ui/select";
import { categoryLabel } from "@finance/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Upload, Search, ArrowLeftRight, Trash2 } from "lucide-react";
import { money, displayDate, type Transaction } from "@finance/shared";
import { useAction, useSnapshot } from "../hooks/data";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  Card,
  PageHeading,
  Input,
  Select,
  Loading,
  ErrorState,
  Empty,
  Pill,
} from "../components/common/primitives";
import { OwnerFilter } from "../components/common/form";
import {
  TransactionForm,
  TransferForm,
} from "../components/transactions/TransactionForm";
import { ReceiptPanel } from "../components/transactions/ReceiptPanel";
export function Transactions() {
  const query = useSnapshot();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [account, setAccount] = useState(
    () => new URLSearchParams(window.location.search).get("account") ?? "",
  );
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(params.get("new") === "1");
  const [transfer, setTransfer] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState("");
  const action = useAction(() => setSelected(new Set()));
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
  const kind = params.get("kind") ?? "";
  const transactions = data.transactions.filter(
    (t) =>
      (!search || t.description.toLowerCase().includes(search.toLowerCase())) &&
      (owner === "all" || t.owner === owner) &&
      (!account || t.accountId === account) &&
      (!category ||
        (category === "none" ? !t.categoryId : t.categoryId === category)) &&
      (!from || t.date >= from) &&
      (!to || t.date <= to) &&
      (!kind ||
        (kind === "expense"
          ? t.kind === "expense" || t.kind === "refund"
          : t.kind === kind)),
  );
  const create = () => {
    setEditing(undefined);
    setOpen(true);
  };
  const edit = (record: Transaction) => {
    setParams({});
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
      <Card className="mb-5 p-4!">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className="relative">
            <Search
              className="absolute top-3.5 left-3 text-gray-400"
              size={15}
            />
            <Input
              aria-label="Search transactions"
              className="pl-9"
              placeholder="Search activity"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label="Filter account"
            value={account}
            onValueChange={(value) => setAccount(value)}
          >
            <SelectItem value="">All accounts</SelectItem>
            {data.accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Filter category"
            value={category}
            onValueChange={(value) => setCategory(value)}
          >
            <SelectItem value="">All categories</SelectItem>
            <SelectItem value="none">Uncategorised</SelectItem>
            {data.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {categoryLabel(c, data.categories)}
              </SelectItem>
            ))}
          </Select>
          <OwnerFilter people={data.people} value={owner} onChange={setOwner} />
          <Select
            aria-label="Filter type"
            value={kind}
            onValueChange={(value) => setParams(value ? { kind: value } : {})}
          >
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expenses & refunds</SelectItem>
            <SelectItem value="transfer">Transfers</SelectItem>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Input
              aria-label="From date"
              type="date"
              className="h-9 w-36 text-xs"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              aria-label="To date"
              type="date"
              className="h-9 w-36 text-xs"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setTransfer(true)}>
            <ArrowLeftRight size={14} />
            Record transfer
          </Button>
        </div>
      </Card>
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-blue-50 p-3">
          <p className="text-xs font-medium">{selected.size} selected</p>
          <Select
            aria-label="Bulk category"
            className="w-48"
            value={bulk}
            onValueChange={(value) => setBulk(value)}
          >
            <SelectItem value="">Uncategorised</SelectItem>
            {data.categories
              .filter((c) => !c.archived)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {categoryLabel(c, data.categories)}
                </SelectItem>
              ))}
          </Select>
          <Button
            size="sm"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: "/transactions/bulk-category",
                body: {
                  categoryId: bulk || null,
                  records: data.transactions
                    .filter((t) => selected.has(t.id))
                    .map(({ id, version }) => ({ id, version })),
                },
              })
            }
          >
            Apply category
          </Button>
        </div>
      )}
      <p className="mb-3 text-xs text-muted-foreground">
        {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
      </p>
      {transactions.length ? (
        <Card className="overflow-hidden p-0!">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-[#fafafa] text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="w-10 p-4">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="p-4">Transaction</th>
                  <th className="hidden p-4 md:table-cell">Account</th>
                  <th className="hidden p-4 sm:table-cell">Category</th>
                  <th className="hidden p-4 xl:table-cell">Belongs to</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-[#fafbfc]">
                    <td className="p-4">
                      {t.kind !== "transfer" && (
                        <input
                          type="checkbox"
                          aria-label={"Select " + t.description}
                          checked={selected.has(t.id)}
                          onChange={(e) =>
                            setSelected((current) => {
                              const result = new Set(current);
                              if (e.target.checked) result.add(t.id);
                              else result.delete(t.id);
                              return result;
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        className="text-left"
                        onClick={() => setParams({ detail: t.id })}
                      >
                        <span className="block font-medium">
                          {t.description}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {displayDate(t.date)}
                          {t.kind === "refund" ? " · Refund" : ""}
                        </span>
                      </button>
                    </td>
                    <td className="hidden p-4 text-muted-foreground md:table-cell">
                      {data.accounts.find((a) => a.id === t.accountId)?.name}
                    </td>
                    <td className="hidden p-4 sm:table-cell">
                      <Pill>
                        {data.categories.find((c) => c.id === t.categoryId)
                          ?.name ??
                          (t.kind === "transfer"
                            ? "Transfer"
                            : "Uncategorised")}
                      </Pill>
                    </td>
                    <td className="hidden p-4 text-muted-foreground xl:table-cell">
                      {t.owner === "household"
                        ? "Household"
                        : data.people.find((p) => p.id === t.owner)?.name}
                    </td>
                    <td
                      className={
                        "p-4 text-right font-semibold whitespace-nowrap tabular-nums " +
                        (t.kind !== "transfer" && t.amountCents > 0
                          ? "text-emerald-700"
                          : "")
                      }
                    >
                      {t.amountCents > 0 ? "+" : ""}
                      {money(t.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Empty
          title={
            data.transactions.length
              ? "Nothing matches just yet"
              : "Your first transaction awaits"
          }
          description={
            data.transactions.length
              ? "Try adjusting your filters."
              : "Add an account, then record activity or import a CSV from your bank."
          }
          action={<Button onClick={create}>Add transaction</Button>}
        />
      )}
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
          if (!isOpen) setParams({});
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
                {data.categories.find((c) => c.id === detail.categoryId)
                  ?.name ?? "Uncategorised"}
              </dd>
              <dt className="text-muted-foreground">Belongs to</dt>
              <dd>
                {detail.owner === "household"
                  ? "Household"
                  : data.people.find((p) => p.id === detail.owner)?.name}
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
                  setParams({});
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
