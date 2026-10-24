import { useState } from "react";
import type { Snapshot } from "@finance/shared";
import { useSavedRecurring } from "../../hooks/statements";
import { Card, ErrorState, Loading } from "../common/primitives";
import { Button } from "../ui/button";
import { RecurringReview, type AcceptedRecurring } from "./RecurringReview";
export function SavedRecurring({ id, data }: { id: string; data: Snapshot }) {
  const { query, save } = useSavedRecurring(id);
  const [accepted, setAccepted] = useState<AcceptedRecurring[]>([]);
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  return (
    <div className="mt-5 space-y-4">
      <Card>
        <h2 className="font-semibold">Recurring items from this statement</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {query.data.length
            ? "Select any additional bills, subscriptions or income to track."
            : "No additional recurring items found."}
        </p>
      </Card>
      {query.data.length > 0 && (
        <RecurringReview
          suggestions={query.data}
          accepted={accepted}
          setAccepted={setAccepted}
          data={data}
        />
      )}
      {save.error && (
        <p role="alert" className="text-sm text-destructive">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm text-emerald-700">
          Recurring items saved.
        </p>
      )}
      {query.data.length > 0 && (
        <Button
          disabled={!accepted.length || save.isPending}
          onClick={() =>
            save.mutate(
              { reviewed: true, schedules: accepted },
              { onSuccess: () => setAccepted([]) },
            )
          }
        >
          {save.isPending
            ? "Saving recurring items…"
            : "Accept recurring items"}
        </Button>
      )}
    </div>
  );
}
