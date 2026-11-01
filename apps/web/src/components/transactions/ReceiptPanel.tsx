import { FileLink } from "../common/FileLink";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Paperclip, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Receipt } from "@finance/shared";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { useState } from "react";
import { ActionError } from "../common/ActionError";
import { ErrorState } from "../common/primitives";
export function ReceiptPanel({ transactionId }: { transactionId: string }) {
  const [problem, setProblem] = useState<Error | null>(null);
  const query = useQuery({
    queryKey: ["receipts", transactionId],
    queryFn: () =>
      api<Receipt[]>("/transactions/" + transactionId + "/receipts"),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.set("file", file);
      return api("/transactions/" + transactionId + "/receipts", {
        method: "POST",
        body,
      });
    },
    onSuccess: async () => {
      setProblem(null);
      await query.refetch();
      toast.success("Receipt attached");
    },
  });
  return (
    <div className="mt-6 border-t pt-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Paperclip size={15} />
        Receipts
      </h3>
      <div className="grid gap-2">
        {query.data?.map((receipt) => (
          <div key={receipt.id} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <FileLink
                path={"/receipts/" + receipt.id + "/content"}
                filename={receipt.filename}
                view
                className="flex min-w-0 items-center gap-2 text-xs font-medium text-primary"
              >
                <span className="truncate">{receipt.filename}</span>
                <ExternalLink size={12} />
              </FileLink>
              <Button
                variant="ghost"
                size="icon"
                aria-label={"Delete receipt " + receipt.filename}
                onClick={async () => {
                  if (!window.confirm("Delete this receipt permanently?"))
                    return;
                  try {
                    setProblem(null);
                    await api("/receipts/" + receipt.id, { method: "DELETE" });
                    await query.refetch();
                    toast.success("Receipt removed");
                  } catch (e) {
                    setProblem(e as Error);
                  }
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <FileLink
              path={"/receipts/" + receipt.id + "/content?download=1"}
              filename={receipt.filename}
              className="inline-flex min-h-11 items-center text-xs text-muted-foreground"
            >
              Download · {Math.ceil(receipt.size / 1024)} KB
            </FileLink>
            {receipt.mimeType.startsWith("image/") && (
              <img
                src={"/api/receipts/" + receipt.id + "/content"}
                alt={"Receipt " + receipt.filename}
                className="mt-3 max-h-40 rounded-lg object-contain"
              />
            )}
          </div>
        ))}
      </div>
      {query.error && (
        <ErrorState
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      )}
      <ActionError error={problem || upload.error} />
      <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-xs font-medium">
        <Paperclip size={14} />
        {upload.isPending ? "Uploading…" : "Attach receipt"}
        <input
          type="file"
          className="sr-only"
          aria-label="Attach receipt"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={upload.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setProblem(null);
              if (file.size > 20 * 1024 * 1024)
                setProblem(
                  new Error(
                    "Choose a file up to 20 MB using Attach receipt below.",
                  ),
                );
              else upload.mutate(file);
            }
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Private to your household · JPG, PNG, WebP or PDF · up to 20 MB
      </p>
    </div>
  );
}
