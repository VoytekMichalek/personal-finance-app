import { useExpenseFilters } from "../hooks/expense-filters";
import { expenseReport, money, type Snapshot } from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import {
  Card,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/common/primitives";
import { ExpenseCategoryChart } from "../components/expenses/ExpenseCategoryChart";
import { ExpenseBreakdown } from "../components/expenses/ExpenseBreakdown";
import { ExpenseDetail } from "../components/expenses/ExpenseDetail";
import { ExpenseTransactions } from "../components/expenses/ExpenseTransactions";
import { ExpenseToolbar } from "../components/expenses/ExpenseToolbar";
export function Expenses() {
  const query = useSnapshot();
  if (query.isPending) return <Loading />;
  if (query.error && !query.data)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  return <ExpenseReport data={query.data} />;
}
function ExpenseReport({ data }: { data: Snapshot }) {
  const { filters, update, detail, setDetail } = useExpenseFilters(data);
  const { from, to } = filters;
  const report = expenseReport(data, filters);
  return (
    <>
      <PageHeading
        eyebrow="Understand your spending"
        title="Expenses"
        description="See where your money goes, with refunds deducted."
      />
      <ExpenseToolbar data={data} filters={filters} onChange={update} />
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
      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <ExpenseCategoryChart
          rows={report.rows}
          data={data}
          from={from}
          to={to}
        />
        <ExpenseBreakdown data={data} report={report} onSelect={setDetail} />
      </div>
      <Card className="min-w-0">
        <h2 className="mb-1 font-semibold">
          Included transactions · {report.rows.length}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Newest first · matches your report filters
        </p>
        <ExpenseTransactions
          key={JSON.stringify(filters)}
          rows={report.rows}
          data={data}
          filters={filters}
        />
      </Card>
      {detail && (
        <ExpenseDetail
          data={data}
          filters={{ ...filters, detail }}
          title={detail.title}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
