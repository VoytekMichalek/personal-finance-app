import { useState } from "react";
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
} from "lucide-react";
import {
  accountBalance,
  addDays,
  forecast,
  occurrences,
  money,
  displayDate,
  type Transaction,
  type StatementSummary,
  isStatementProcessing,
  statementStatusLabel,
} from "@finance/shared";
import { api } from "../lib/api";
import { useSnapshot } from "../hooks/data";
import {
  Card,
  PageHeading,
  SectionTitle,
  ErrorState,
  Loading,
  Pill,
} from "../components/common/primitives";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { AccountForm } from "../components/accounts/AccountForm";
import { TransactionForm } from "../components/transactions/TransactionForm";
import { BalanceChart } from "../components/common/Chart";
export function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useSnapshot();
  const files = useQuery({
    queryKey: ["statements", id],
    queryFn: () => api<StatementSummary[]>("/accounts/" + id + "/statements"),
    refetchInterval: (query) =>
      query.state.data?.some(isStatementProcessing) ? 2000 : false,
  });
  const [edit, setEdit] = useState(false);
  const [transaction, setTransaction] = useState<Transaction>();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") ?? "activity";
  const setTab = (value: string) => setSearch({ tab: value });
  const [page, setPage] = useState(0);
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data,
    account = data.accounts.find((a) => a.id === id);
  if (!account)
    return (
      <Card>
        Account not found. <Link to="/accounts">Back to accounts</Link>
      </Card>
    );
  const transactions = data.transactions.filter((t) => t.accountId === id);
  const schedules = data.schedules.filter((s) => s.accountId === id);
  const upcoming = occurrences(
    schedules,
    transactions,
    data.today,
    addDays(data.today, 90),
  ).filter((o) => !o.matched);
  const points = forecast(
    { ...data, accounts: [account], transactions, schedules, budgets: [] },
    90,
  );
  const balance = accountBalance(account, transactions, data.today);
  return (
    <>
      <Link
        to="/accounts"
        className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={14} />
        All accounts
      </Link>
      <PageHeading
        eyebrow={account.institution || "Your account"}
        title={account.name}
        description="Your activity, what’s coming up and the statements behind it."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEdit(true)}>
              <Pencil size={14} />
              Edit account
            </Button>
            {!account.archived && (
              <>
                <Button asChild>
                  <Link to={"/accounts/" + id + "/statement"}>
                    <FileText size={14} />
                    Upload statement
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to={"/imports?account=" + id}>
                    <FileSpreadsheet size={14} />
                    Upload CSV
                  </Link>
                </Button>
              </>
            )}
          </div>
        }
      />
      {account.type === "credit" && (
        <Card className="mb-6 border-blue-100 bg-blue-50/40">
          <p className="text-sm font-medium">
            Credit card ·{" "}
            {balance < 0
              ? `${money(-balance)} owed`
              : `${money(balance)} in credit`}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Purchases, interest and fees are expenses. Refunds reduce spending.
            Record repayments as transfers from your bank account to this card
            so they do not count as spending again. The signed card balance is
            included in net worth; do not also add this card under Liabilities.
          </p>
        </Card>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          [
            "Current balance",
            accountBalance(account, transactions, data.today),
          ],
          ["Opening balance", account.openingBalanceCents],
          ["Forecast in 90 days", points.at(-1)!.balanceCents],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {money(Number(value))}
            </p>
          </Card>
        ))}
      </div>
      <div
        className="mb-6 flex flex-wrap gap-2 rounded-xl bg-muted p-1"
        role="tablist"
        aria-label="Account details"
      >
        {[
          ["activity", "Transactions"],
          ["forecast", "Upcoming & forecast"],
          ["statements", "Statements"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value!)}
            className={
              "rounded-lg px-4 py-2.5 text-sm " +
              (tab === value
                ? "bg-white font-semibold shadow-sm"
                : "text-muted-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "activity" && (
        <Card>
          <SectionTitle
            action={
              <Button
                size="sm"
                onClick={() => {
                  setTransaction(undefined);
                  setTransactionOpen(true);
                }}
              >
                <Plus size={14} />
                Add transaction
              </Button>
            }
          >
            Account activity
          </SectionTitle>
          <p className="mb-4 text-xs text-muted-foreground">
            Opening balance {money(account.openingBalanceCents)} on{" "}
            {displayDate(account.openingDate)}. {transactions.length}{" "}
            transactions.
          </p>
          <div className="divide-y">
            {transactions.slice(page * 50, page * 50 + 50).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.kind === "transfer") {
                    navigate("/transactions?account=" + id);
                    return;
                  }
                  setTransaction(t);
                  setTransactionOpen(true);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-4 text-left hover:bg-muted"
              >
                <span>
                  <span className="block text-sm font-medium">
                    {t.description}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {displayDate(t.date)} ·{" "}
                    {data.categories.find((c) => c.id === t.categoryId)?.name ??
                      (t.kind === "transfer" ? "Transfer" : "Uncategorised")}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {money(t.amountCents)}
                </span>
              </button>
            ))}
          </div>
          {!transactions.length && (
            <p className="py-8 text-sm text-muted-foreground">
              Upload a statement or CSV, or add your first transaction.
            </p>
          )}
          <div className="mt-4 flex justify-between">
            <Button
              size="sm"
              variant="ghost"
              disabled={!page}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={(page + 1) * 50 >= transactions.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </Card>
      )}
      {tab === "forecast" && (
        <>
          <Card className="mb-6">
            <SectionTitle>The next 90 days</SectionTitle>
            <BalanceChart
              points={points}
              label="Account forecast from accepted scheduled bills and income"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Includes this account’s balance and scheduled bills/income.
              Household budget allowances are not assigned to individual
              accounts.
            </p>
          </Card>
          <Card>
            <SectionTitle
              action={
                <Link to="/plan" className="text-xs text-primary">
                  Manage recurring items →
                </Link>
              }
            >
              Coming up
            </SectionTitle>
            {upcoming.slice(0, 100).map((o) => (
              <div
                key={o.schedule.id + o.date}
                className="flex justify-between border-b py-4 text-sm"
              >
                <span>
                  {o.schedule.name}
                  <span className="block text-xs text-muted-foreground">
                    {displayDate(o.date)}
                  </span>
                </span>
                <span>
                  {money(
                    o.schedule.amountCents *
                      (o.schedule.kind === "expense" ? -1 : 1),
                  )}
                </span>
              </div>
            ))}
            {!upcoming.length && (
              <p className="text-sm text-muted-foreground">
                No upcoming bills or income. Accept recurring suggestions from a
                statement or add them in Plan.
              </p>
            )}
          </Card>
        </>
      )}
      {tab === "statements" && (
        <Card>
          <SectionTitle>Uploaded statements</SectionTitle>
          {files.isPending ? (
            <Loading />
          ) : files.error ? (
            <ErrorState
              message={files.error.message}
              retry={() => void files.refetch()}
            />
          ) : files.data?.length ? (
            files.data.map((file) => (
              <div
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-4"
              >
                <span className="min-w-0">
                  <span className="block break-all text-sm font-medium">
                    {file.filename}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {file.pages ? `${file.pages} pages · ` : ""}
                    {displayDate(file.createdAt.slice(0, 10))}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <Pill tone={file.status === "failed" ? "warning" : "neutral"}>
                    {statementStatusLabel(file)}
                  </Pill>
                  <Link
                    className="text-xs text-primary"
                    to={"/accounts/" + id + "/statement/" + file.id}
                  >
                    {file.committedAt
                      ? "View"
                      : file.status === "ready"
                        ? "Review"
                        : "View progress"}
                  </Link>
                  <a
                    className="text-xs text-primary"
                    href={"/api/statements/" + file.id + "/file"}
                  >
                    Download PDF
                  </a>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              No statements yet.
            </p>
          )}
        </Card>
      )}
      <Dialog open={edit} onOpenChange={setEdit} title="Account details">
        <AccountForm
          account={account}
          people={data.people}
          done={() => setEdit(false)}
        />
      </Dialog>
      <Dialog
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        title={transaction ? "Edit transaction" : "Add transaction"}
      >
        <TransactionForm
          key={transaction?.id ?? "new"}
          transaction={transaction}
          data={{
            ...data,
            accounts: [account, ...data.accounts.filter((a) => a.id !== id)],
          }}
          done={() => setTransactionOpen(false)}
        />
      </Dialog>
    </>
  );
}
