import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiResponse } from "../../lib/api";
import { ActionError } from "./ActionError";

/** Fetch first so storage/session failures stay recoverable beside the file. */
export function FileLink({
  path,
  filename,
  children,
  view = false,
  className = "text-xs text-primary",
}: {
  path: string;
  filename: string;
  children: ReactNode;
  view?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState("");
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, []);
  return (
    <div className="min-w-0">
      <a
        href={"/api" + path}
        download={filename}
        aria-disabled={busy}
        className={className}
        onClick={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          try {
            const response = await apiResponse(path);
            const url = URL.createObjectURL(await response.blob());
            urls.current.push(url);
            if (view) {
              setReady(url);
              window.open(url, "_blank", "noopener,noreferrer");
              return;
            }
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.append(link);
            link.click();
            link.remove();
          } catch (problem) {
            setError(problem as Error);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing download…" : children}
      </a>
      {ready && (
        <a
          className="ml-2 text-xs text-primary underline"
          href={ready}
          target="_blank"
          rel="noreferrer"
        >
          Open file
        </a>
      )}
      {error && (
        <>
          <ActionError error={error} />
          <p className="text-xs">
            Choose the file link again to retry the download.
          </p>
        </>
      )}
    </div>
  );
}
