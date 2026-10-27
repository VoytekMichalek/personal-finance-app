import { useState } from "react";
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
import { ExpenseCategoryChart } from "../components/expenses/ExpenseCategoryChart";
import { ExpenseBreakdown } from "../components/expenses/ExpenseBreakdown";
import { ExpenseDetail } from "../components/expenses/ExpenseDetail";
import { ExpenseTransactions } from "../components/expenses/ExpenseTransactions";
import { SearchInput } from "../components/common/SearchInput";
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
  const [search, setSearch] = useState("");
  const report = expenseReport(data, {
    from,
    to,
    accountId,
    owner,
    categoryId,
    search,
  });
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
        <div className="mb-4">
          <Field label="Search expenses">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search descriptions"
            />
          </Field>
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
              <SelectItem value="uncategorised">Uncategorised</SelectItem>
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
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        {[
          ["Net expenses", report.totalCents],
          ["Spending", report.spendingCents],
        ].map(([label, amount]) => (
          <Card key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {money(Number(amount))}
            </p>
          </Card>
        ))}
      </div>
      <ExpenseCategoryChart
        rows={report.rows}
        data={data}
        from={from}
        to={to}
      />
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
        <ExpenseBreakdown data={data} report={report} onSelect={setDetail} />
        <Card className="min-w-0">
          <h2 className="mb-1 font-semibold">
            Included transactions · {report.rows.length}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Newest first · matches your report filters
          </p>
          <ExpenseTransactions
            key={[from, to, accountId, owner, categoryId, search].join(":")}
            rows={report.rows}
            data={data}
          />
        </Card>
      </div>
      {detail && (
        <ExpenseDetail
          data={data}
          filters={{ from, to, accountId, owner, categoryId, search, detail }}
          title={detail.title}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
