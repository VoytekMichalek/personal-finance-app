import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { addDays, occurrences, type Snapshot } from "@finance/shared";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

type Pending = {
  id: string;
  accountId: string;
  filename: string;
  status: string;
};
export function Attention({ data, owner }: { data: Snapshot; owner: string }) {
  const [open, setOpen] = useState(false);
  const statements = useQuery({
    queryKey: ["statements", "pending"],
    queryFn: () => api<Pending[]>("/statements/pending"),
  });
  const uncategorised = data.transactions.filter(
    (t) =>
      t.kind !== "transfer" &&
      !t.categoryId &&
      (owner === "all" || t.owner === owner),
  ).length;
  const upcoming = occurrences(
    data.schedules.filter((s) => owner === "all" || s.owner === owner),
    data.transactions,
    data.today,
    addDays(data.today, 7),
  ).filter((o) => !o.matched && o.schedule.kind === "expense").length;
  const pending = (statements.data ?? []).filter(
    (s) =>
      owner === "all" ||
      data.accounts.find((a) => a.id === s.accountId)?.owner === owner,
  );
  const suffix = owner === "all" ? "" : `&owner=${encodeURIComponent(owner)}`;
  return (
    <>
      {(uncategorised > 0 ||
        upcoming > 0 ||
        pending.length > 0 ||
        statements.error) && (
        <section
          aria-label="Needs attention"
          className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3"
        >
          <h2 className="mr-2 text-xs font-semibold">Needs attention</h2>
          {!!uncategorised && (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/transactions?category=none${suffix}`}>
                {uncategorised} uncategorised
              </Link>
            </Button>
          )}
          {!!pending.length && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              {pending.length} statements to review
            </Button>
          )}
          {!!upcoming && (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/plan?tab=bills${suffix}`}>
                {upcoming} bills in the next 7 days
              </Link>
            </Button>
          )}
          {statements.error && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void statements.refetch()}
            >
              Couldn’t check statements · Retry
            </Button>
          )}
        </section>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Statements to review"
        description="Continue reviewing a saved statement."
      >
        <ul className="divide-y">
          {pending.map((s) => (
            <li key={s.id}>
              <Link
                className="block rounded-lg py-3 hover:bg-muted"
                to={`/accounts/${s.accountId}/statement/${s.id}`}
              >
                <span className="block break-all text-sm font-medium">
                  {s.filename}
                </span>
                <span className="text-xs text-muted-foreground">
                  {data.accounts.find((a) => a.id === s.accountId)?.name} ·{" "}
                  {s.status === "failed"
                    ? "Reading needs attention"
                    : "Ready for review"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
