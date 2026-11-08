import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  displayDate,
  money,
  savedCategoryRuleChanges,
  type Snapshot,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { ActionError } from "../common/ActionError";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

export function ApplySavedRules({ data }: { data: Snapshot }) {
  const [review, setReview] = useState<Snapshot>();
  const [page, setPage] = useState(0);
  const client = useQueryClient();
  const action = useAction(() => setReview(undefined));
  const changes = review ? savedCategoryRuleChanges(review) : [];
  const matchCount = savedCategoryRuleChanges(data).length;
  const rows = new Map(review?.transactions.map((row) => [row.id, row]));
  const refresh = () => {
    setReview(client.getQueryData<Snapshot>(["snapshot"]) ?? data);
    setPage(0);
    action.reset();
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setReview(data);
          setPage(0);
          action.reset();
        }}
      >
        Apply saved rules
      </Button>
      {matchCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {matchCount} uncategorised transactions match enabled category rules.
        </p>
      )}
      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setReview(undefined);
        }}
        title="Apply saved category rules"
        description="Review matches across all active accounts. Only uncategorised income, expenses and refunds are included. Existing categories and transfers stay unchanged."
      >
        <p className="mb-4 text-sm" role="status">
          {changes.length} uncategorised transactions match saved rules.
        </p>
        <ul aria-label="Rule matches" className="divide-y">
          {changes.slice(page * 20, (page + 1) * 20).map((change) => {
            const row = rows.get(change.id)!;
            return (
              <li key={row.id} className="py-3 text-sm">
                <p className="font-medium break-words">{row.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {displayDate(row.date)} ·{" "}
                  {review?.accounts.find((a) => a.id === row.accountId)?.name} ·{" "}
                  {money(row.amountCents)}
                </p>
                <p className="mt-1">
                  Uncategorised →{" "}
                  {
                    review?.categories.find((c) => c.id === change.categoryId)
                      ?.name
                  }
                </p>
              </li>
            );
          })}
        </ul>
        {changes.length > 20 && (
          <div className="my-4 flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs">
              Page {page + 1} of {Math.ceil(changes.length / 20)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={(page + 1) * 20 >= changes.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
        <ActionError error={action.error} onRefresh={refresh} />
        {!changes.length && (
          <p className="mb-4 text-sm text-muted-foreground">
            Check the rule’s matching text, category and Enabled setting, or
            return to your transactions to review their types.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            disabled={
              action.isPending || !changes.length || changes.length > 10000
            }
            onClick={() =>
              action.mutate({
                path: "/rules/apply-categories",
                body: { records: changes },
              })
            }
          >
            {action.isPending
              ? "Applying…"
              : `Apply to ${changes.length} transactions`}
          </Button>
          <Button
            variant="secondary"
            disabled={action.isPending}
            onClick={() => setReview(undefined)}
          >
            Cancel
          </Button>
        </div>
        {changes.length > 10000 && (
          <p role="alert" className="mt-3 text-sm">
            More than 10,000 transactions match. Pause some rules to review a
            smaller group, then apply the remaining rules separately.
          </p>
        )}
      </Dialog>
    </>
  );
}
