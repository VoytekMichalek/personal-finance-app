import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Snapshot, Transaction } from "@finance/shared";
import { useAction } from "../../hooks/data";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

export function BulkDelete({
  data,
  selection,
  disabled,
  onDeleted,
}: {
  data: Snapshot;
  selection: Transaction[];
  disabled: boolean;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState<{
    selectedCount: number;
    linkedCount: number;
    records: { id: string; version: number }[];
  } | null>(null);
  const action = useAction(() => {
    setConfirmation(null);
    onDeleted();
  });
  const selectedIds = new Set(selection.map((row) => row.id));
  const groups = new Set(
    selection.flatMap((row) =>
      row.transferGroupId ? [row.transferGroupId] : [],
    ),
  );
  const affected = data.transactions.filter(
    (row) =>
      selectedIds.has(row.id) ||
      (row.transferGroupId && groups.has(row.transferGroupId)),
  );
  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        disabled={disabled || affected.length > 10000}
        onClick={() => {
          action.reset();
          setConfirmation({
            selectedCount: selection.length,
            linkedCount: affected.length - selection.length,
            records: affected.map(({ id, version }) => ({ id, version })),
          });
        }}
      >
        <Trash2 size={15} /> Delete selected
      </Button>
      {affected.length > 10000 && (
        <p className="text-xs" role="alert">
          Narrow your filters to delete at most 10,000 entries, including linked
          transfers, at once.
        </p>
      )}
      <Dialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setConfirmation(null);
        }}
        title="Delete selected transactions?"
        description="This permanently removes these entries and updates account balances. This cannot be undone."
      >
        {confirmation && (
          <>
            <p className="mb-3 text-sm">
              {confirmation.selectedCount} selected transaction
              {confirmation.selectedCount === 1 ? "" : "s"} will be deleted.
            </p>
            {confirmation.linkedCount > 0 && (
              <p className="mb-3 text-sm font-medium">
                This also deletes {confirmation.linkedCount} linked transfer{" "}
                {confirmation.linkedCount === 1 ? "entry" : "entries"} outside
                your selection, including in other accounts.
              </p>
            )}
            <p className="mb-5 text-sm text-muted-foreground">
              Both sides of a transfer are removed together. Entries with
              attached receipts must have their receipts removed first.
            </p>
            {action.error && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {action.error.message}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="secondary"
                disabled={action.isPending}
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    path: "/transactions/bulk-delete",
                    body: { records: confirmation.records },
                  })
                }
              >
                {action.isPending
                  ? "Deleting…"
                  : `Delete ${confirmation.records.length} ${confirmation.records.length === 1 ? "entry" : "entries"}`}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
