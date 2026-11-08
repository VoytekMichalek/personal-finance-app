import { SummaryCard } from "../components/common/SummaryCard";
import { ScheduleIdentity } from "../components/planning/ScheduleIdentity";
import { BalanceOutlook } from "../components/overview/BalanceOutlook";
import { MonthPicker } from "../components/ui/month-picker";
import { SpendingHistory } from "../components/overview/SpendingHistory";
import { Attention } from "../components/overview/Attention";
import { SpendingCategories } from "../components/overview/SpendingCategories";
import { SelectItem } from "../components/ui/select";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  overview,
  effectiveBudgets,
  occurrences,
  money,
  displayDate,
  addDays,
  overviewPeriod,
  budgetSchema,
} from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import { Button } from "../components/ui/button";
import {
  Card,
  PageHeading,
  SectionTitle,
  Select,
  Loading,
  ErrorState,
  TextLink,
} from "../components/common/primitives";
export function Overview() {
  const query = useSnapshot();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const owner = params.get("owner") ?? "all";
  const setFilter = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  if (query.isPending) return <Loading />;
  if (query.error && !query.data)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  const currentMonth = data.today.slice(0, 7);
  const selectedMonth = budgetSchema.shape.month.safeParse(params.get("month"));
  const month =
    selectedMonth.success && selectedMonth.data <= currentMonth
      ? selectedMonth.data
      : currentMonth;
  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));
  const period = params.get("period") === "year" ? "year" : "month";
  const summary = overview(data, owner, month, period);
  const range = overviewPeriod(data.today, month, period);
  const choosePeriod = (
    nextPeriod: "month" | "year",
    nextMonth = currentMonth,
  ) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("month");
        next.delete("period");
        if (nextPeriod === "year") next.set("period", "year");
        else if (nextMonth !== currentMonth) next.set("month", nextMonth);
        return next;
      },
      { replace: true },
    );
  const ownerQuery =
    owner === "all" ? "" : `&owner=${encodeURIComponent(owner)}`;
  const monthQuery = `from=${range.from}&to=${range.to}${ownerQuery}`;
  const budgets = effectiveBudgets(data.budgets, month, data.budgetOverrides);
  const upcoming = occurrences(
    data.schedules,
    data.transactions,
    data.today,
    addDays(data.today, 90),
  )
    .filter(
      (o) => !o.matched && (owner === "all" || o.schedule.owner === owner),
    )
    .slice(0, 4);
  return (
    <>
      <PageHeading
        title="Overview"
        action={
          <div className="contents">
            <MonthPicker
              aria-label="Overview month"
              max={currentMonth}
              currentMonth={currentMonth}
              value={month}
              onChange={(value) => choosePeriod("month", value)}
              className="order-2 w-full sm:order-none sm:ml-auto sm:w-52"
            />
            <Select
              aria-label="Ownership filter"
              className="order-3 w-full sm:order-none sm:w-48"
              value={owner}
              onValueChange={(value) =>
                setFilter("owner", value === "all" ? "" : value)
              }
            >
              <SelectItem value="all">Whole household</SelectItem>
              <SelectItem value="household">Shared only</SelectItem>
              {data.people
                .filter((p) => p.state !== "deleted")
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </Select>
            <Button
              className="ml-auto sm:ml-0"
              onClick={() => navigate("/transactions?new=1")}
            >
              <Plus size={16} />
              Add transaction
            </Button>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Dashboard period"
          className="flex rounded-xl border bg-white p-1"
        >
          <Button
            size="sm"
            variant={
              period === "month" && month === currentMonth ? "default" : "ghost"
            }
            aria-pressed={period === "month" && month === currentMonth}
            onClick={() => choosePeriod("month")}
          >
            This month
          </Button>
          <Button
            size="sm"
            variant={period === "year" ? "default" : "ghost"}
            aria-pressed={period === "year"}
            onClick={() => choosePeriod("year")}
          >
            This year
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {period === "year"
            ? `Year to date · ${displayDate(range.from)} – ${displayDate(range.to)}`
            : `${monthLabel} · ${month === currentMonth ? "Month to date" : "Complete month"}`}
        </p>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <SummaryCard
          label="Available balance"
          amount={summary.balance}
          featured
          color="#6289af"
          icon="wallet"
          detail="Current bank & cash, less credit owed"
          onClick={() =>
            navigate(
              owner === "all"
                ? "/accounts"
                : `/accounts?owner=${encodeURIComponent(owner)}`,
            )
          }
        />
        <SummaryCard
          label="Money in"
          amount={summary.income}
          color="#4e927b"
          icon="briefcase"
          detail={
            period === "year"
              ? "Income this year to date"
              : `Income in ${monthLabel}`
          }
          onClick={() => navigate(`/transactions?kind=income&${monthQuery}`)}
        />
        <SummaryCard
          label="Money out"
          amount={summary.spent}
          color="#b78658"
          icon="shopping-bag"
          detail="Expenses, less refunds"
          onClick={() => navigate(`/transactions?kind=expense&${monthQuery}`)}
        />
        {period === "year" ? (
          <SummaryCard
            label="Net income"
            amount={summary.income - summary.spent}
            color="#8a79b0"
            icon="piggy-bank"
            detail="Year-to-date income less spending"
            onClick={() =>
              navigate(
                `/transactions?kind=income&kind=expense&kind=refund&${monthQuery}`,
              )
            }
          />
        ) : (
          <SummaryCard
            label="Budget remaining"
            amount={summary.remaining}
            color="#8a79b0"
            icon="piggy-bank"
            detail={
              budgets.length
                ? "Whole household · " +
                  money(summary.budget, true) +
                  " planned"
                : "Set a budget to get started"
            }
            onClick={() => navigate(`/plan?month=${month}`)}
          />
        )}
      </div>
      <Attention data={data} owner={owner} />
      <div className="mb-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <BalanceOutlook data={data} />
        <SpendingHistory data={data} owner={owner} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <SpendingCategories
          data={data}
          owner={owner}
          from={range.from}
          to={range.to}
        />
        <Card>
          <SectionTitle
            action={
              <TextLink
                onClick={() => navigate(`/plan?tab=bills${ownerQuery}`)}
              >
                All upcoming
              </TextLink>
            }
          >
            Coming up
          </SectionTitle>
          {upcoming.length ? (
            <div className="grid gap-5">
              {upcoming.map((o) => (
                <div
                  key={o.schedule.id + o.date}
                  className="flex items-center justify-between gap-3"
                >
                  <div>
                    <ScheduleIdentity
                      schedule={o.schedule}
                      categories={data.categories}
                      small
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {displayDate(o.date)}
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums">
                    {money(o.schedule.amountCents)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              A quiet calendar.
              <br />
              <span className="text-xs">
                Add your regular income and bills in Plan.
              </span>
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
