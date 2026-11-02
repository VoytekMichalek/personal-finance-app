import { BalanceOutlook } from "../components/overview/BalanceOutlook";
import { MonthPicker } from "../components/ui/month-picker";
import { SpendingHistory } from "../components/overview/SpendingHistory";
import { Attention } from "../components/overview/Attention";
import { SpendingCategories } from "../components/overview/SpendingCategories";
import { SelectItem } from "../components/ui/select";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  overview,
  effectiveBudgets,
  occurrences,
  money,
  displayDate,
  addDays,
  monthEnd,
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
  const summary = overview(data, owner, month);
  const ownerQuery =
    owner === "all" ? "" : `&owner=${encodeURIComponent(owner)}`;
  const to = month === currentMonth ? data.today : monthEnd(month);
  const monthQuery = `from=${month}-01&to=${to}${ownerQuery}`;
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
              onChange={(value) =>
                setFilter("month", value === currentMonth ? "" : value)
              }
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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          [
            "Available balance",
            summary.balance,
            Wallet,
            "Current bank & cash, less credit owed",
            owner === "all"
              ? "/accounts"
              : `/accounts?owner=${encodeURIComponent(owner)}`,
          ],
          [
            "Money in",
            summary.income,
            ArrowUpRight,
            month === currentMonth
              ? "Income this month"
              : `Income in ${monthLabel}`,
            `/transactions?kind=income&${monthQuery}`,
          ],
          [
            "Money out",
            summary.spent,
            ArrowDownRight,
            "Expenses, less refunds",
            `/transactions?kind=expense&${monthQuery}`,
          ],
          [
            "Budget remaining",
            summary.remaining,
            Wallet,
            budgets.length
              ? "Whole household · " + money(summary.budget, true) + " planned"
              : "Set a budget to get started",
            `/plan?month=${month}`,
          ],
        ].map(([label, value, Icon, detail, route]) => (
          <button
            key={String(label)}
            onClick={() => navigate(String(route))}
            className="rounded-2xl border bg-white p-5 text-left transition-shadow hover:shadow-md"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {String(label)}
              </span>
              {Icon && typeof Icon !== "string" && typeof Icon !== "number" && (
                <Icon size={16} className="text-gray-400" />
              )}
            </div>
            <p className="text-[23px] md:text-[29px] font-semibold tracking-[-0.04em] tabular-nums">
              {money(Number(value))}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {String(detail)}
            </p>
          </button>
        ))}
      </div>
      <Attention data={data} owner={owner} />
      <div className="mb-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <BalanceOutlook data={data} />
        <SpendingHistory data={data} owner={owner} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <SpendingCategories data={data} owner={owner} />
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
                    <p className="text-xs font-medium">{o.schedule.name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
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
