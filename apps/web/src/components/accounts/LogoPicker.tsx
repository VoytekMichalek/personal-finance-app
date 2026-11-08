import { useEffect, useRef, useState } from "react";
import { Field, Input } from "../common/primitives";
import { Button } from "../ui/button";
import { readAccountLogo } from "./logo-file";

export function LogoPicker({
  onChange,
  onBusyChange,
  hasLogo,
}: {
  onChange: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  hasLogo: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  return (
    <div className="grid gap-2">
      <Field label="Upload logo" error={error}>
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const current = ++generation.current;
            setError("");
            setBusy(true);
            onBusyChange(true);
            try {
              const logo = await readAccountLogo(file);
              if (current === generation.current) onChange(logo);
            } catch (error) {
              if (current === generation.current)
                setError(
                  error instanceof Error
                    ? error.message
                    : "Choose another image or an icon.",
                );
            } finally {
              if (current === generation.current) {
                setBusy(false);
                onBusyChange(false);
              }
            }
          }}
        />
      </Field>
      <p className="text-xs text-muted-foreground" role="status">
        {busy ? "Preparing logo…" : "PNG, JPEG or WebP · up to 2 MB"}
      </p>
      {hasLogo && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            onChange(null);
            setError("");
          }}
        >
          Remove uploaded logo
        </Button>
      )}
    </div>
  );
}
