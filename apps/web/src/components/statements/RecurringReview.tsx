import { identityColour } from "@finance/shared";
import { SelectItem } from "../ui/select";
import { CategoryPicker } from "../categories/CategoryPicker";
import { DatePicker } from "../ui/date-picker";
import {
  moneyInput,
  parseMoney,
  type RecurringSuggestion,
  type ScheduleInput,
  type Snapshot,
} from "@finance/shared";
import { Card, Field, Input, Select, Pill } from "../common/primitives";
export type AcceptedRecurring = { key: string; schedule: ScheduleInput };
export function RecurringReview({
  suggestions,
  accepted,
  setAccepted,
  data,
}: {
  suggestions: RecurringSuggestion[];
  accepted: AcceptedRecurring[];
  setAccepted: (items: AcceptedRecurring[]) => void;
  data: Snapshot;
}) {
  function patch(key: string, values: Partial<ScheduleInput>) {
    setAccepted(
      accepted.map((a) =>
        a.key === key ? { ...a, schedule: { ...a.schedule, ...values } } : a,
      ),
    );
  }
  return (
    <div className="grid gap-4">
      {!suggestions.length && (
        <Card>
          <p className="text-sm text-muted-foreground">
            No recurring pattern found. You can add recurring items in Plan.
          </p>
        </Card>
      )}
      {suggestions.map((item) => {
        const selected = accepted.find((a) => a.key === item.key);
        const schedule = selected?.schedule ?? item.schedule;
        return (
          <Card key={item.key}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!selected}
                onChange={(e) =>
                  setAccepted(
                    e.target.checked
                      ? [
                          ...accepted,
                          { key: item.key, schedule: item.schedule },
                        ]
                      : accepted.filter((a) => a.key !== item.key),
                  )
                }
              />
              <span>
                <span className="block text-sm font-semibold">
                  {schedule.name}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {item.reason} Source rows: {item.evidence.join(", ")}
                </span>
              </span>
              <Pill
                colour={identityColour(
                  schedule.kind === "income"
                    ? "type:income"
                    : schedule.subscription
                      ? "type:subscription"
                      : "type:bill",
                )}
              >
                {schedule.kind === "income"
                  ? "Income"
                  : schedule.subscription
                    ? "Subscription"
                    : "Bill"}
              </Pill>
            </label>
            {selected && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Recurring name">
                  <Input
                    value={schedule.name}
                    onChange={(e) => patch(item.key, { name: e.target.value })}
                  />
                </Field>
                <Field label="Expected amount (AUD)">
                  <Input
                    defaultValue={moneyInput(schedule.amountCents)}
                    inputMode="decimal"
                    onBlur={(e) => {
                      try {
                        patch(item.key, {
                          amountCents: parseMoney(e.target.value),
                        });
                      } catch {
                        e.target.value = moneyInput(schedule.amountCents);
                      }
                    }}
                  />
                </Field>
                <Field label="Next date">
                  <DatePicker
                    value={schedule.startDate}
                    onChange={(value) => patch(item.key, { startDate: value })}
                  />
                </Field>
                <Field label="Frequency">
                  <Select
                    value={schedule.frequency}
                    onValueChange={(value) =>
                      patch(item.key, {
                        frequency: value as ScheduleInput["frequency"],
                      })
                    }
                  >
                    {[
                      "weekly",
                      "fortnightly",
                      "monthly",
                      "quarterly",
                      "annually",
                    ].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </Select>
                </Field>
                <Field label="Category">
                  <CategoryPicker
                    categories={data.categories}
                    kind={schedule.kind}
                    value={schedule.categoryId ?? null}
                    onChange={(value) => patch(item.key, { categoryId: value })}
                  />
                </Field>
                {schedule.kind === "expense" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={schedule.subscription}
                      onChange={(e) =>
                        patch(item.key, { subscription: e.target.checked })
                      }
                    />
                    This is a subscription
                  </label>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
