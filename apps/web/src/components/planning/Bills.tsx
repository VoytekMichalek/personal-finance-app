import { useSearchParams } from "react-router-dom";
import { OwnerFilter } from "../common/form";
import { ActionError } from "../common/ActionError";
import { SelectItem } from "../ui/select";
import { useState } from "react";
import { Plus, Pencil, Check, Link2 } from "lucide-react";
import {
  addDays,
  occurrences,
  annualSubscriptionCost,
  displayDate,
  money,
  canMatchSchedule,
  type Snapshot,
  type Schedule,
  type Occurrence,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Card, SectionTitle, Empty, Pill, Select } from "../common/primitives";
import { ScheduleForm } from "./ScheduleForm";
export function Bills({
  data,
  subscriptions = false,
}: {
  data: Snapshot;
  subscriptions?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "recurring" ? "recurring" : "upcoming";
  const owner = params.get("owner") ?? "all";
  const setFilter = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule>();
  const [match, setMatch] = useState<Occurrence>();
  const [transactionId, setTransactionId] = useState("");
  const action = useAction(() => setMatch(undefined));
  const schedules = data.schedules.filter(
    (s) =>
      (subscriptions ? s.subscription : true) &&
      (owner === "all" || s.owner === owner),
  );
  const upcoming = occurrences(
    schedules,
    data.transactions,
    addDays(data.today, -30),
    addDays(data.today, 90),
  ).filter((o) => !o.matched);
  const cost = schedules
    .filter((s) => s.subscription && !s.cancelled)
    .reduce((sum, s) => sum + annualSubscriptionCost(s), 0);
  const create = () => {
    setEditing(undefined);
    setOpen(true);
  };
  return (
    <>
      <ActionError error={action.error} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {subscriptions
            ? "Know what renews. Keep what you love."
            : "Your regular income, bills and transfers, thoughtfully organised."}
        </p>
        <Button onClick={create}>
          <Plus size={15} />
          {subscriptions ? "Add subscription" : "Add schedule"}
        </Button>
      </div>
      {subscriptions && (
        <Card className="mb-6">
          <p className="text-xs text-muted-foreground">Active subscriptions</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {money(Math.round(cost / 12))}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              / month
            </span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {money(cost)} per year · normalised estimate
          </p>
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Payment view" className="flex gap-2">
          {[
            ["upcoming", "Upcoming"],
            ["recurring", "Recurring items"],
          ].map(([value, label]) => (
            <Button
              key={value}
              role="tab"
              aria-selected={view === value}
              variant={view === value ? "default" : "secondary"}
              onClick={() => setFilter("view", value!)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="w-44">
          <OwnerFilter
            people={data.people}
            value={owner}
            onChange={(value) => setFilter("owner", value)}
          />
        </div>
      </div>
      {view === "upcoming" && (
        <Card className="mb-6">
          <SectionTitle>Upcoming payments</SectionTitle>
          {upcoming.length ? (
            <div className="divide-y">
              {["Overdue", "This week", "Later"].map((group) => {
                const weekEnd = addDays(
                  data.today,
                  6 -
                    ((new Date(data.today + "T00:00:00Z").getUTCDay() + 6) % 7),
                );
                const rows = upcoming.filter((o) =>
                  group === "Overdue"
                    ? o.date < data.today
                    : group === "This week"
                      ? o.date >= data.today && o.date <= weekEnd
                      : o.date > weekEnd,
                );
                return (
                  rows.length > 0 && (
                    <section key={group} aria-label={group}>
                      <h3 className="mt-4 border-b pb-2 text-xs font-semibold text-muted-foreground">
                        {group}
                      </h3>
                      {rows.map((o) => (
                        <div
                          key={o.schedule.id + o.date}
                          className="flex flex-wrap items-center justify-between gap-4 py-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-11 flex-col items-center justify-center rounded-xl bg-muted">
                              <span className="text-[9px] text-muted-foreground">
                                {new Intl.DateTimeFormat("en-AU", {
                                  month: "short",
                                  timeZone: "UTC",
                                }).format(new Date(o.date + "T00:00:00Z"))}
                              </span>
                              <span className="text-sm font-semibold">
                                {o.date.slice(8)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {o.schedule.name}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">
                                  {o.schedule.kind === "transfer"
                                    ? "Transfer"
                                    : o.schedule.kind === "income"
                                      ? "Income"
                                      : "Expense"}{" "}
                                  ·{" "}
                                  {
                                    data.accounts.find(
                                      (a) => a.id === o.schedule.accountId,
                                    )?.name
                                  }
                                  {o.schedule.kind === "transfer" &&
                                    ` → ${data.accounts.find((a) => a.id === o.schedule.counterAccountId)?.name}`}
                                </span>
                                {o.date < data.today && (
                                  <Pill tone="warning">Unrecorded</Pill>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold tabular-nums">
                              {money(o.schedule.amountCents)}
                            </span>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={o.date > data.today || action.isPending}
                              onClick={() =>
                                action.mutate({
                                  path:
                                    "/schedules/" + o.schedule.id + "/match",
                                  body: { date: o.date },
                                })
                              }
                            >
                              <Check size={13} />
                              {o.schedule.kind === "income"
                                ? "Record income"
                                : o.schedule.kind === "transfer"
                                  ? "Record transfer"
                                  : "Record payment"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={"Match " + o.schedule.name}
                              onClick={() => {
                                setMatch(o);
                                setTransactionId("");
                              }}
                            >
                              <Link2 size={14} />
                              Match transaction
                            </Button>
                          </div>
                        </div>
                      ))}
                    </section>
                  )
                );
              })}
            </div>
          ) : (
            <Empty
              title="A little less to remember"
              description="Add a regular payday, bill or subscription. Upcoming payments will appear here."
              action={
                <Button variant="secondary" onClick={create}>
                  Add a schedule
                </Button>
              }
            />
          )}
        </Card>
      )}
      {view === "recurring" && (
        <Card>
          <SectionTitle>
            All {subscriptions ? "subscriptions" : "schedules"}
          </SectionTitle>
          <div className="divide-y">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {s.name} {s.cancelled && <Pill>Cancelled</Pill>}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.provider || displayDate(s.startDate)} · {s.frequency}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {money(s.amountCents)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={"Edit " + s.name}
                    onClick={() => {
                      setEditing(s);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={
          editing
            ? "Edit schedule"
            : subscriptions
              ? "Add subscription"
              : "Add a schedule"
        }
      >
        <ScheduleForm
          key={editing?.id ?? "new"}
          schedule={editing}
          data={data}
          subscription={subscriptions}
          done={() => setOpen(false)}
        />
      </Dialog>
      <Dialog
        open={Boolean(match)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setMatch(undefined);
        }}
        title="Match an existing transaction"
        description="Choose an unmatched transaction with the same account, type and amount."
      >
        {match && (
          <div className="grid gap-4">
            <ActionError error={action.error} />
            <Select
              aria-label="Existing transaction"
              value={transactionId}
              onValueChange={(value) => setTransactionId(value)}
            >
              <SelectItem value="">Choose transaction</SelectItem>
              {data.transactions
                .filter((t) =>
                  canMatchSchedule(t, match.schedule, data.transactions),
                )
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {displayDate(t.date)} · {t.description}
                  </SelectItem>
                ))}
            </Select>
            <Button
              disabled={!transactionId || action.isPending}
              onClick={() =>
                action.mutate({
                  path: "/schedules/" + match.schedule.id + "/match",
                  body: { date: match.date, transactionId },
                })
              }
            >
              Match transaction
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
