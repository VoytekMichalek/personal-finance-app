import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { send } from "../../lib/api";
import { Button } from "../ui/button";

export function DemoLogin() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-3 text-sm text-amber-950">
        Explore the demo household with fictional finances. No passkey needed.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await send("/auth/demo-login", {});
            await client.invalidateQueries({ queryKey: ["me"] });
          } catch (problem) {
            setError(
              (problem as Error).message + " Try the demo button again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening demo…" : "Continue as demo admin"}
      </Button>
    </div>
  );
}
