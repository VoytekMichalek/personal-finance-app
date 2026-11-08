import { SummaryCard } from "../components/common/SummaryCard";
import { AccountIdentity } from "../components/accounts/AccountIdentity";
import { AssetIdentity } from "../components/assets/AssetIdentity";
import { VisualTitle } from "../components/common/VisualTitle";
import { useSearchParams, Link } from "react-router-dom";
import {
  accountBalance,
  assetValue,
  netWorth,
  money,
  addDays,
  isCashAccount,
} from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import {
  PageHeading,
  Card,
  SectionTitle,
  Loading,
  ErrorState,
} from "../components/common/primitives";
import { BalanceHistory } from "../components/common/BalanceHistory";
import { Button } from "../components/ui/button";
export function NetWorth() {
  const query = useSnapshot();
  const [params, setParams] = useSearchParams();
  const period = params.get("period") ?? "365";
  if (query.isPending) return <Loading />;
  if (query.error && !query.data)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  const total = netWorth(data, data.today);
  const entries = [
    ...data.accounts.filter(isCashAccount).map((a) => ({
      id: a.id,
      name: a.name,
      value: accountBalance(a, data.transactions, data.today),
      to: "/accounts/" + a.id,
      type: "Account",
      group:
        accountBalance(a, data.transactions, data.today) < 0
          ? "Debts"
          : "Cash & accounts",
    })),
    ...data.assets.map((a) => ({
      id: a.id,
      name: a.name,
      value: assetValue(a, data.today, data.transactions),
      to: "/assets/" + a.id,
      type: a.classification,
      group:
        assetValue(a, data.today, data.transactions) < 0
          ? "Debts"
          : a.classification === "property"
            ? "Property"
            : ["investment", "superannuation"].includes(a.classification)
              ? "Investments"
              : "Other assets",
    })),
  ];
  const assets = entries.reduce((s, e) => s + Math.max(0, e.value), 0);
  const debt = assets - total;
  const earliest =
    [
      ...data.accounts.filter(isCashAccount).map((a) => a.openingDate),
      ...data.assets.flatMap((a) => a.valuations.map((v) => v.date)),
      ...data.transactions.map((row) => row.date),
    ].sort()[0] ?? data.today;
  const requestedStart =
    period === "all"
      ? earliest
      : addDays(
          data.today,
          -(["30", "90", "365"].includes(period) ? Number(period) : 365),
        );
  const start = earliest > requestedStart ? earliest : requestedStart;
  const points = [];
  for (let date = start; date < data.today; date = addDays(date, 7))
    points.push({ date, balanceCents: netWorth(data, date) });
  points.push({ date: data.today, balanceCents: total });
  return (
    <>
      <PageHeading
        eyebrow="The bigger picture"
        title="Net worth"
        description="Your bank accounts, cash, investments and property, less everything you owe."
        action={
          <Button asChild variant="secondary">
            <Link to="/assets">Manage assets & liabilities</Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]">
        <SummaryCard
          label="Net worth"
          amount={total}
          featured
          color="#608ba6"
          icon="trending-up"
          detail="Current assets less liabilities"
        />
        <SummaryCard
          label="Total assets"
          amount={assets}
          color="#62947c"
          icon="home"
          detail="Accounts, property and investments"
        />
        <SummaryCard
          label="Total liabilities"
          amount={debt}
          color="#ad7a68"
          icon="landmark"
          detail="Outstanding debts and credit owed"
        />
      </div>
      <Card className="mb-6">
        <VisualTitle
          title="Your progress"
          context="History includes account opening balances, transactions and recorded closing valuations, adjusted by later transfers. Values before the earliest record are not invented."
        />
        <BalanceHistory
          controls={
            <div className="flex flex-wrap gap-2">
              {[
                ["30", "1 month"],
                ["90", "3 months"],
                ["365", "1 year"],
                ["all", "All"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={period === value ? "default" : "secondary"}
                  aria-pressed={period === value}
                  onClick={() =>
                    setParams({ period: value! }, { replace: true })
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          }
          points={points}
          label={`Recorded net worth is ${money(total)} as of ${data.today}. History begins ${start}.`}
        />
      </Card>
      <Card>
        <SectionTitle>What makes up your net worth</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            "Cash & accounts",
            "Investments",
            "Property",
            "Other assets",
            "Debts",
          ].map((group) => {
            const items = entries.filter((e) => e.group === group);
            return (
              items.length > 0 && (
                <section key={group} aria-label={group}>
                  <div className="mb-1 flex justify-between gap-3 border-b pb-2 text-sm font-semibold">
                    <h3>{group}</h3>
                    <span className="tabular-nums">
                      {money(items.reduce((sum, e) => sum + e.value, 0))}
                    </span>
                  </div>
                  {items.map((e) => (
                    <Link
                      key={e.id}
                      to={e.to}
                      className="flex items-center justify-between gap-3 rounded-lg py-3 hover:bg-muted"
                    >
                      <span className="min-w-0 break-words text-sm">
                        {e.type === "Account" ? (
                          <AccountIdentity
                            account={data.accounts.find((a) => a.id === e.id)}
                            institutions={data.institutions}
                          />
                        ) : (
                          <AssetIdentity
                            asset={data.assets.find((a) => a.id === e.id)!}
                            small
                          />
                        )}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">
                        {money(e.value)}
                      </span>
                    </Link>
                  ))}
                </section>
              )
            );
          })}
        </div>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          Bank and credit accounts are included automatically. Negative account
          balances count as liabilities. Don’t add the same balance again under
          Assets & Liabilities.
        </p>
      </Card>
    </>
  );
}
