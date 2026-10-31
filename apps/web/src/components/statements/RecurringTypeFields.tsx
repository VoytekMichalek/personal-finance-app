import type {
  RecurringSuggestion,
  ScheduleInput,
  Snapshot,
} from "@finance/shared";
import { Field, Select } from "../common/primitives";
import { SelectItem } from "../ui/select";

export function RecurringTypeFields({
  item,
  schedule,
  accountId,
  data,
  patch,
}: {
  item: RecurringSuggestion;
  schedule: ScheduleInput;
  accountId: string;
  data: Snapshot;
  patch: (values: Partial<ScheduleInput>) => void;
}) {
  const incoming =
    item.schedule.kind === "income" ||
    (item.schedule.kind === "transfer" &&
      item.schedule.counterAccountId === accountId);
  const otherId = incoming ? schedule.accountId : schedule.counterAccountId;
  return (
    <>
      <Field label="Type">
        <Select
          value={schedule.kind}
          onValueChange={(value) => {
            const kind = value as ScheduleInput["kind"];
            patch({
              kind,
              accountId: kind === "transfer" && incoming ? "" : accountId,
              counterAccountId:
                kind === "transfer" && incoming ? accountId : null,
              categoryId:
                kind === "transfer"
                  ? null
                  : item.schedule.kind === kind
                    ? item.schedule.categoryId
                    : null,
              subscription: kind === "expense" && !!item.schedule.subscription,
            });
          }}
        >
          <SelectItem value="expense">Expense</SelectItem>
          <SelectItem value="income">Income</SelectItem>
          <SelectItem value="transfer">Transfer</SelectItem>
        </Select>
      </Field>
      {schedule.kind === "transfer" && (
        <div>
          <Field label={incoming ? "Transfer from" : "Transfer to"}>
            <Select
              value={otherId ?? ""}
              onValueChange={(value) =>
                patch(
                  incoming ? { accountId: value } : { counterAccountId: value },
                )
              }
            >
              <SelectItem value="">Choose other account</SelectItem>
              {data.accounts
                .filter((a) => !a.archived && a.id !== accountId)
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
            </Select>
          </Field>
          <p className="mt-1 text-xs text-muted-foreground">
            {incoming ? "Received into" : "Paid from"}{" "}
            {data.accounts.find((a) => a.id === accountId)?.name}.
            {(!otherId || otherId === accountId) &&
              " Choose the other account to continue."}
          </p>
        </div>
      )}
    </>
  );
}
