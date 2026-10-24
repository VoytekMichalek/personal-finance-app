import { Link } from "react-router-dom";
import {
  accountBalance,
  assetValue,
  netWorth,
  money,
  addDays,
} from "@finance/shared";
import { useSnapshot } from "../hooks/data";
import {
  PageHeading,
  Card,
  SectionTitle,
  Loading,
  ErrorState,
} from "../components/common/primitives";
import { BalanceChart } from "../components/common/Chart";
import { Button } from "../components/ui/button";
export function NetWorth() {
  const query = useSnapshot();
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  const total = netWorth(data, data.today);
  const entries = [
    ...data.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      value: accountBalance(a, data.transactions, data.today),
      to: "/accounts/" + a.id,
      type: "Account",
    })),
    ...data.assets.map((a) => ({
      id: a.id,
      name: a.name,
      value: assetValue(a, data.today),
      to: "/assets/" + a.id,
      type: a.classification,
    })),
  ];
  const assets = entries.reduce((s, e) => s + Math.max(0, e.value), 0);
  const debt = assets - total;
  const earliest =
    [
      ...data.accounts.map((a) => a.openingDate),
      ...data.assets.flatMap((a) => a.valuations.map((v) => v.date)),
    ].sort()[0] ?? data.today;
  const start =
    earliest > addDays(data.today, -365) ? earliest : addDays(data.today, -365);
  const points = [];
  for (let date = start; date < data.today; date = addDays(date, 7))
    points.push({ date, balanceCents: netWorth(data, date) });
  points.push({ date: data.today, balanceCents: total });
  return (
    <>
      <PageHeading
        eyebrow="The bigger picture"
        title="See how far you’ve come."
        description="Your bank accounts, cash, investments and property, less everything you owe."
        action={
          <Button asChild variant="secondary">
            <Link to="/assets">Manage assets & liabilities</Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Net worth", total],
          ["Total assets", assets],
          ["Total liabilities", debt],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {money(Number(value))}
            </p>
          </Card>
        ))}
      </div>
      <Card className="mb-6">
        <SectionTitle>Your progress</SectionTitle>
        <BalanceChart
          points={points}
          label={`Recorded net worth is ${money(total)} as of ${data.today}. History begins ${start}.`}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          History includes dated account opening balances, transactions and
          recorded valuations.
        </p>
      </Card>
      <Card>
        <SectionTitle>What makes up your net worth</SectionTitle>
        <div className="divide-y">
          {entries.map((e) => (
            <Link
              key={e.id}
              to={e.to}
              className="flex items-center justify-between gap-4 rounded-lg px-2 py-4 hover:bg-muted"
            >
              <span>
                <span className="block text-sm font-medium">{e.name}</span>
                <span className="text-xs text-muted-foreground">{e.type}</span>
              </span>
              <span className="font-semibold tabular-nums">
                {money(e.value)}
              </span>
            </Link>
          ))}
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
