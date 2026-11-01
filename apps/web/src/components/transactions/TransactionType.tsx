import { AccountDateIssue } from "../accounts/AccountDateIssue";
import { InlineSaveStatus } from "../common/InlineSaveStatus";
import { TransferValueNote } from "../assets/TransferValueNote";
import { accountLabel } from "@finance/shared";
import { useState } from "react";
import {
  identityColour,
  money,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
import { useTransactionType } from "../../hooks/transaction-type";
import { Select, SelectItem } from "../ui/select";
import { Button } from "../ui/button";

const kinds = {
  expense: "Expense",
  income: "Income",
  refund: "Refund",
  transfer: "Transfer",
};
export function TransactionType({
  row,
  data,
  disabled = false,
  onTransferred,
}: {
  row: Transaction;
  data: Snapshot;
  disabled?: boolean;
  onTransferred?: () => void;
}) {
  const action = useTransactionType(row.id, onTransferred);
  const [choice, setChoice] = useState<{
    kind: Transaction["kind"];
    version: number;
  }>();
  const [accountId, setAccountId] = useState("");
  const [matchId, setMatchId] = useState("");
  const pending = choice?.version === row.version ? choice.kind : undefined;
  const peer = row.transferGroupId
    ? data.transactions.find(
        (item) =>
          item.id !== row.id && item.transferGroupId === row.transferGroupId,
      )
    : undefined;
  const matches = data.transactions.filter(
    (item) =>
      item.accountId === accountId &&
      item.date === row.date &&
      item.amountCents === -row.amountCents &&
      item.kind !== "transfer" &&
      !item.transferGroupId &&
      !item.scheduleId &&
      !item.occurrenceDate,
  );
  const staleMatch =
    !!matchId &&
    matchId !== "new" &&
    !matches.some((item) => item.id === matchId);
  const peerKind = peer && peer.amountCents < 0 ? "expense" : "income";
  const busy = disabled || action.saving;
  const selectedKind =
    pending ??
    (action.isPending || action.isError ? action.variables?.kind : row.kind) ??
    row.kind;
  return (
    <div className="max-w-full space-y-2">
      <Select
        aria-label={`Type for ${row.description}`}
        chip={{
          colour: identityColour("type:" + selectedKind),
          label: kinds[selectedKind],
        }}
        value={selectedKind}
        disabled={busy}
        onValueChange={(value) => {
          const kind = value as Transaction["kind"];
          action.reset();
          setAccountId("");
          setMatchId("");
          if (kind === row.kind) {
            setChoice(undefined);
            return;
          }
          if (kind === "transfer" || row.kind === "transfer")
            setChoice({ kind, version: row.version });
          else {
            setChoice(undefined);
            action.mutate({ kind, version: row.version });
          }
        }}
      >
        {Object.entries(kinds).map(([kind, label]) => (
          <SelectItem key={kind} value={kind}>
            {label}
          </SelectItem>
        ))}
      </Select>
      {pending && (
        <div className="w-52 max-w-full space-y-2 rounded-lg border bg-white p-2 text-xs">
          {pending === "transfer" ? (
            <>
              <label className="grid gap-1">
                {row.amountCents < 0 ? "To account" : "From account"}
                <Select
                  aria-label={`Other account for ${row.description}`}
                  value={accountId}
                  disabled={busy}
                  className="px-2 text-xs"
                  onValueChange={(value) => {
                    setAccountId(value);
                    setMatchId("");
                  }}
                >
                  <SelectItem value="">Choose account</SelectItem>
                  {data.accounts
                    .filter(
                      (account) =>
                        !account.archived && account.id !== row.accountId,
                    )
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </SelectItem>
                    ))}
                </Select>
              </label>
              {!!accountId && (
                <>
                  <TransferValueNote
                    data={data}
                    accountIds={[row.accountId, accountId]}
                    date={row.date}
                  />
                  {!!matches.length && (
                    <label className="grid gap-1">
                      Other entry
                      <Select
                        aria-label={`Matching payment for ${row.description}`}
                        value={matchId}
                        disabled={busy}
                        className="px-2 text-xs"
                        onValueChange={setMatchId}
                      >
                        <SelectItem value="">Choose payment</SelectItem>
                        {matches.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.description} · {money(item.amountCents)}
                          </SelectItem>
                        ))}
                        <SelectItem value="new">
                          Create a separate entry
                        </SelectItem>
                      </Select>
                    </label>
                  )}
                  <p className="text-muted-foreground">
                    {matches.length && matchId !== "new"
                      ? "Link the existing payment to avoid counting it twice."
                      : "Creates the opposite entry in the other account. Both entries are excluded from income and spending."}
                  </p>
                </>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              {peer
                ? `Keep both payments and unlink them. The entry in ${data.accounts.find((a) => a.id === peer.accountId)?.name} becomes ${peerKind}.`
                : "The linked payment could not be found. Refresh before changing this transfer."}
            </p>
          )}
          {pending === "transfer" && staleMatch && (
            <p role="alert" className="text-destructive">
              The selected payment changed. Cancel and review the transfer
              again.
            </p>
          )}
          <AccountDateIssue
            data={data}
            accountIds={[accountId]}
            date={row.date}
          />
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              disabled={
                busy ||
                (pending === "transfer"
                  ? !accountId || staleMatch || (!!matches.length && !matchId)
                  : !peer)
              }
              onClick={() => {
                const match = matches.find((item) => item.id === matchId);
                action.mutate(
                  {
                    kind: pending,
                    version: row.version,
                    ...(pending === "transfer"
                      ? {
                          counterAccountId: accountId,
                          ...(match
                            ? {
                                linkExisting: {
                                  id: match.id,
                                  version: match.version,
                                },
                              }
                            : { createCounterpart: true }),
                        }
                      : peer
                        ? {
                            unlinkCounterpart: {
                              id: peer.id,
                              version: peer.version,
                              kind: peerKind,
                            },
                          }
                        : {}),
                  },
                  {
                    onSuccess: () => setChoice(undefined),
                  },
                );
              }}
            >
              Save type
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setChoice(undefined);
                action.reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {action.isError && (
        <p className="text-[11px] text-muted-foreground">
          Currently saved: {kinds[row.kind]}. Review the accounts before
          retrying.
        </p>
      )}
      <InlineSaveStatus
        pending={action.isPending}
        saved={action.isSuccess}
        error={action.error}
        retry={() => {
          if (!action.variables) return;
          const input = { ...action.variables, version: row.version };
          if (input.unlinkCounterpart && peer)
            input.unlinkCounterpart = {
              ...input.unlinkCounterpart,
              version: peer.version,
            };
          const linked = data.transactions.find(
            (t) => t.id === input.linkExisting?.id,
          );
          if (input.linkExisting && linked)
            input.linkExisting = {
              ...input.linkExisting,
              version: linked.version,
            };
          action.mutate(input);
        }}
      />
    </div>
  );
}
