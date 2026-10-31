import {
  displayDate,
  money,
  transferChoicesFor,
  type Transaction,
} from "@finance/shared";
import { Select, SelectItem } from "../ui/select";

export function rememberedTransferPlan(
  matches: Transaction[],
  all: Transaction[],
  accountId: string,
  choices: Record<string, string>,
) {
  const plans = matches.map((row) => ({
    row,
    ...transferChoicesFor(row, all, accountId),
  }));
  return plans.map((plan) => {
    const unique =
      plan.candidates.length === 1 &&
      plans.filter((other) =>
        other.candidates.some((item) => item.id === plan.candidates[0]!.id),
      ).length === 1;
    const value =
      plan.counterpart?.id ??
      choices[plan.row.id] ??
      (unique ? plan.candidates[0]!.id : plan.candidates.length ? "" : "new");
    const counterpart =
      plan.counterpart ?? plan.candidates.find((item) => item.id === value);
    return {
      ...plan,
      value,
      chosen: counterpart,
      valid: !plan.issue && (!!counterpart || value === "new"),
    };
  });
}
export function RememberTransferPreview({
  plans,
  disabled,
  onChange,
}: {
  plans: ReturnType<typeof rememberedTransferPlan>;
  disabled: boolean;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <ul className="mt-2 max-h-72 divide-y overflow-y-auto rounded-xl border px-3">
      {plans.map((plan) => (
        <li key={plan.row.id} className="space-y-2 py-3 text-xs">
          <p className="font-medium [overflow-wrap:anywhere]">
            {plan.row.description}
          </p>
          <p>
            {displayDate(plan.row.date)} · {money(plan.row.amountCents)}
          </p>
          {plan.issue ? (
            <p role="alert" className="text-destructive">
              {plan.issue}
            </p>
          ) : plan.counterpart ? (
            <p className="text-emerald-700">
              Already a matching linked transfer
            </p>
          ) : (
            <Select
              aria-label={`Other entry for ${plan.row.description} on ${plan.row.date}`}
              value={plan.value}
              disabled={disabled}
              onValueChange={(value) => onChange(plan.row.id, value)}
            >
              <SelectItem value="">Choose the other entry</SelectItem>
              {plan.candidates.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  Link: {item.description} · {money(item.amountCents)}
                </SelectItem>
              ))}
              <SelectItem value="new">
                Create a separate counterpart entry
              </SelectItem>
            </Select>
          )}
        </li>
      ))}
    </ul>
  );
}
