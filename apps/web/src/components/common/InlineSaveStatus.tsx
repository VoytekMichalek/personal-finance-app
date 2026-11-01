import { ActionError } from "./ActionError";
import { Button } from "../ui/button";
export function InlineSaveStatus({
  pending,
  saved,
  error,
  retry,
}: {
  pending: boolean;
  saved: boolean;
  error: Error | null;
  retry: () => void;
}) {
  if (pending)
    return (
      <p role="status" className="text-[11px] text-muted-foreground">
        Saving…
      </p>
    );
  if (error)
    return (
      <div className="space-y-1 text-xs">
        <ActionError error={error} />
        <Button size="sm" variant="secondary" onClick={retry}>
          Retry save
        </Button>
      </div>
    );
  return saved ? (
    <p role="status" className="text-[11px] text-muted-foreground">
      Saved
    </p>
  ) : null;
}
