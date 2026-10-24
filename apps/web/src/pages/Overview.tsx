import { SelectItem } from "../components/ui/select";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  ChevronRight,
} from "lucide-react";
import {
  overview,
  forecast,
  effectiveBudgets,
  categorySpend,
  occurrences,
  money,
  displayDate,
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
  Empty,
  Pill,
  TextLink,
} from "../components/common/primitives";
import { BalanceChart } from "../components/common/Chart";
export function Overview() {
  const query = useSnapshot();
  const navigate = useNavigate();
  const [owner, setOwner] = useState("all");
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  const summary = overview(data, owner);
  const projected = forecast(data, 90);
  const closing = projected.at(-1)!.balanceCents;
  const budgets = effectiveBudgets(data.budgets, data.today.slice(0, 7));
  const upcoming = occurrences(
    data.schedules,
    data.transactions,
    data.today,
    projected.at(-1)!.date,
  )
    .filter((o) => !o.matched)
    .slice(0, 4);
  return (
    <>
      <PageHeading
        eyebrow="A clearer picture"
        title="Everything, in balance."
        description={
          new Intl.DateTimeFormat("en-AU", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(data.today + "T00:00:00Z")) +
          " · Your household at a glance"
        }
        action={
          <Button onClick={() => navigate("/transactions?new=1")}>
            <Plus size={16} />
            Add transaction
          </Button>
        }
      />
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">This month</span>
        <Select
          aria-label="Ownership filter"
          className="h-9 w-40 bg-transparent text-xs"
          value={owner}
          onValueChange={(value) => setOwner(value)}
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
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          [
            "Available balance",
            summary.balance,
            Wallet,
            "Bank & cash, less credit owed",
            "/accounts",
          ],
          [
            "Money in",
            summary.income,
            ArrowUpRight,
            "Income this month",
            "/transactions?kind=income",
          ],
          [
            "Money out",
            summary.spent,
            ArrowDownRight,
            "Expenses, less refunds",
            "/transactions?kind=expense",
          ],
          [
            "Budget remaining",
            summary.remaining,
            Wallet,
            budgets.length
              ? "From " + money(summary.budget, true) + " planned"
              : "Set a budget to get started",
            "/plan",
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
      <div className="mb-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <SectionTitle
            action={
              <TextLink onClick={() => navigate("/plan?tab=forecast")}>
                Explore forecast
              </TextLink>
            }
          >
            A little look ahead
          </SectionTitle>
          <div className="mb-5 flex items-center gap-3">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {money(closing)}
            </p>
            <Pill>In 90 days</Pill>
          </div>
          <BalanceChart
            points={projected.filter((_, i) => i % 3 === 0 || i === 90)}
            label={
              "Household forecast from " +
              money(projected[0]!.balanceCents) +
              " to " +
              money(closing) +
              " over 90 days."
            }
          />
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            Household projection · scheduled income and bills, plus remaining
            spending budgets.
          </p>
        </Card>
        <Card>
          <SectionTitle
            action={
              <TextLink onClick={() => navigate("/plan")}>View plan</TextLink>
            }
          >
            Your spending plan
          </SectionTitle>
          {budgets.length ? (
            <div className="grid gap-5">
              {budgets.slice(0, 5).map((b) => {
                const category = data.categories.find(
                  (c) => c.id === b.categoryId,
                );
                const spent = categorySpend(
                  data.transactions,
                  b.categoryId,
                  data.today.slice(0, 7),
                  data.today,
                );
                const percent = b.amountCents
                  ? Math.min(100, Math.max(0, (spent / b.amountCents) * 100))
                  : 0;
                return (
                  <div key={b.categoryId}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-medium">{category?.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {money(spent, true)}{" "}
                        <span className="text-gray-300">/</span>{" "}
                        {money(b.amountCents, true)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: percent + "%",
                          backgroundColor:
                            spent > b.amountCents ? "#c63845" : category?.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="mt-2 text-xs text-muted-foreground">
                Small decisions. A bigger picture.
              </p>
            </div>
          ) : (
            <Empty
              title="Give your money a plan"
              description="Set a monthly budget for the things that matter."
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate("/plan")}
                >
                  Create a budget
                </Button>
              }
            />
          )}
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <SectionTitle
            action={
              <TextLink onClick={() => navigate("/transactions")}>
                All activity
              </TextLink>
            }
          >
            Recent activity
          </SectionTitle>
          {data.transactions.length ? (
            <div className="divide-y">
              {data.transactions.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate("/transactions?detail=" + t.id)}
                  className="flex w-full items-center gap-3 py-3.5 text-left"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    {t.amountCents > 0 ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {t.description}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {data.categories.find((c) => c.id === t.categoryId)
                        ?.name ??
                        (t.kind === "transfer"
                          ? "Transfer"
                          : "Uncategorised")}{" "}
                      · {displayDate(t.date)}
                    </span>
                  </span>
                  <span
                    className={
                      "text-xs font-semibold tabular-nums " +
                      (t.kind !== "transfer" && t.amountCents > 0
                        ? "text-emerald-700"
                        : "")
                    }
                  >
                    {t.amountCents > 0 ? "+" : ""}
                    {money(t.amountCents)}
                  </span>
                  <ChevronRight size={13} className="text-gray-300" />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="Your story starts here"
              description="Add an account, then record a transaction or import a bank CSV."
              action={
                <Button
                  variant="secondary"
                  onClick={() => navigate("/accounts")}
                >
                  Add your first account
                </Button>
              }
            />
          )}
        </Card>
        <Card>
          <SectionTitle
            action={
              <TextLink onClick={() => navigate("/plan?tab=bills")}>
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
