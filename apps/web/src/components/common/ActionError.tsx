import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { Button } from "../ui/button";

/** Keep failures beside the operation. Refresh reads data; it never replays a write. */
export function ActionError({
  error,
  onRefresh,
}: {
  error?: Error | null;
  onRefresh?: () => void;
}) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  if (!error) return null;
  return (
    <div className="my-3 space-y-2 rounded-xl bg-red-50 p-3 text-sm">
      <p role="alert" className="break-words text-destructive">
        {error.message}
      </p>
      <p className="text-xs text-muted-foreground">
        Review the fields and try the action again. If the connection failed or
        the data changed, refresh first to check whether it was saved. Your open
        form stays here.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            setMessage("");
            try {
              await client.refetchQueries(
                { type: "active" },
                { throwOnError: true },
              );
              setMessage(
                "Data refreshed. Review the current values before trying again.",
              );
              onRefresh?.();
            } catch {
              setMessage(
                "Still unable to refresh. Check your connection and try Refresh data again.",
              );
            } finally {
              setRefreshing(false);
            }
          }}
        >
          {refreshing ? "Refreshing…" : "Refresh data"}
        </Button>
        {error instanceof ApiError && error.status === 401 && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
          >
            Sign in in another tab
          </Button>
        )}
        {/\bAI\b|\bmodel\b|OpenRouter/i.test(error.message) && (
          <Button asChild size="sm" variant="secondary">
            <Link to="/settings/ai" target="_blank" rel="noreferrer">
              AI settings (new tab)
            </Link>
          </Button>
        )}
      </div>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
