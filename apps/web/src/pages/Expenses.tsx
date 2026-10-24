import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  categoryLabel,
  expenseReport,
  money,
  type Snapshot,
  type ExpenseFilters,
} from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import {
  Card,
  ErrorState,
  Field,
  Loading,
  PageHeading,
} from "../components/common/primitives";
import { Select, SelectItem } from "../components/ui/select";
import { DatePicker } from "../components/ui/date-picker";
import { Button } from "../components/ui/button";
import { ExpenseDetail } from "../components/expenses/ExpenseDetail";
import { ExpenseTransactions } from "../components/expenses/ExpenseTransactions";
export function Expenses() {
  const query = useSnapshot();
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  return <ExpenseReport data={query.data} />;
}
function ExpenseReport({ data }: { data: Snapshot }) {
  const [detail, setDetail] = useState<
    (NonNullable<ExpenseFilters["detail"]> & { title: string }) | null
  >(null);
  const [from, setFrom] = useState(data.today.slice(0, 7) + "-01");
  const [to, setTo] = useState(data.today);
  const [accountId, setAccount] = useState("");
  const [owner, setOwner] = useState("");
  const [categoryId, setCategory] = useState("");
  const [group, setGroup] = useState<"categories" | "accounts" | "people">(
    "categories",
  );
  const report = expenseReport(data, {
    from,
    to,
    accountId,
    owner,
    categoryId,
  });
  const person = (id: string) =>
    id === "household"
      ? "Household"
      : (data.people.find((p) => p.id === id)?.name ?? "Former member");
  const category = (id: string) => {
    const item = data.categories.find((c) => c.id === id);
    return item ? categoryLabel(item, data.categories) : "Uncategorised";
  };
  const name = (id: string) =>
    group === "categories"
      ? category(id)
      : group === "accounts"
        ? (data.accounts.find((a) => a.id === id)?.name ?? "Account")
        : person(id);
  const max = Math.max(1, ...report[group].map((r) => Math.abs(r.amountCents)));
  return (
    <>
      <PageHeading
        eyebrow="Understand your spending"
        title="Expenses"
        description="See where your money goes, with refunds deducted."
      />
      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFrom(data.today.slice(0, 7) + "-01");
              setTo(data.today);
            }}
          >
            This month
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFrom(data.today.slice(0, 4) + "-01-01");
              setTo(data.today);
            }}
          >
            This year
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFrom(
                data.transactions.map((t) => t.date).sort()[0] ?? data.today,
              );
              setTo(data.today);
            }}
          >
            All history
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="From">
            <DatePicker value={from} max={to} onChange={setFrom} />
          </Field>
          <Field label="To">
            <DatePicker
              value={to}
              min={from}
              max={data.today}
              onChange={setTo}
            />
          </Field>
          <Field label="Account">
            <Select value={accountId} onValueChange={setAccount}>
              <SelectItem value="">All accounts</SelectItem>
              {data.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field label="Person">
            <Select value={owner} onValueChange={setOwner}>
              <SelectItem value="">Everyone</SelectItem>
              <SelectItem value="household">Household</SelectItem>
              {data.people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={categoryId} onValueChange={setCategory}>
              <SelectItem value="">All categories</SelectItem>
              {data.categories
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {categoryLabel(c, data.categories)}
                  </SelectItem>
                ))}
            </Select>
          </Field>
        </div>
      </Card>
      {from > to && (
        <p role="alert" className="mb-4 text-destructive">
          Choose an end date on or after the start date.
        </p>
      )}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          ["Net expenses", report.totalCents],
          ["Spending", report.spendingCents],
          ["Refunds", report.refundCents],
        ].map(([label, amount]) => (
          <Card key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {money(Number(amount))}
            </p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <div
            role="tablist"
            aria-label="Expense breakdown"
            className="mb-5 flex flex-wrap gap-2"
          >
            {(
              [
                ["categories", "Category"],
                ["accounts", "Account"],
                ["people", "Person"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                role="tab"
                aria-selected={group === key}
                variant={group === key ? "default" : "secondary"}
                size="sm"
                onClick={() => setGroup(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          {!report.rows.length && (
            <p className="py-8 text-sm text-muted-foreground">
              No expenses in this selection.
            </p>
          )}
          <div className="space-y-5">
            {report[group].map((row) => (
              <button
                type="button"
                key={row.id}
                aria-label={"View " + name(row.id) + " transactions"}
                onClick={() =>
                  setDetail({ group, id: row.id, title: name(row.id) })
                }
                className="block w-full rounded-xl p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="mb-2 flex justify-between gap-4 text-sm">
                  <span className="min-w-0 break-words">{name(row.id)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <strong className="tabular-nums">
                      {money(row.amountCents)}
                    </strong>
                    <ChevronRight size={15} className="text-muted-foreground" />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={
                      "h-2 rounded-full " +
                      (row.amountCents < 0 ? "bg-emerald-400" : "bg-primary/70")
                    }
                    style={{
                      width: (Math.abs(row.amountCents) / max) * 100 + "%",
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-5 font-semibold">By month</h2>
          <div className="divide-y">
            {report.months.map((month) => (
              <div
                key={month.id}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span>
                  {new Intl.DateTimeFormat("en-AU", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(month.id + "-01T00:00:00Z"))}
                </span>
                <strong>{money(month.amountCents)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <h2 className="mb-3 font-semibold">
          Included transactions · {report.rows.length}
        </h2>
        <div className="max-h-[32rem] divide-y overflow-y-auto">
          <ExpenseTransactions rows={report.rows} data={data} />
        </div>
      </Card>
      {detail && (
        <ExpenseDetail
          data={data}
          filters={{ from, to, accountId, owner, categoryId, detail }}
          title={detail.title}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
