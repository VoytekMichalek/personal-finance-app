import { useMutation, useQuery } from "@tanstack/react-query";
import { Paperclip, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Receipt } from "@finance/shared";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
export function ReceiptPanel({ transactionId }: { transactionId: string }) {
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
      await query.refetch();
      toast.success("Receipt attached");
    },
    onError: (error) => toast.error(error.message),
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
              <a
                href={"/api/receipts/" + receipt.id + "/content"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-xs font-medium text-primary"
              >
                <span className="truncate">{receipt.filename}</span>
                <ExternalLink size={12} />
              </a>
              <Button
                variant="ghost"
                size="icon"
                aria-label={"Delete receipt " + receipt.filename}
                onClick={async () => {
                  if (!window.confirm("Delete this receipt permanently?"))
                    return;
                  try {
                    await api("/receipts/" + receipt.id, { method: "DELETE" });
                    await query.refetch();
                    toast.success("Receipt removed");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <a
              href={"/api/receipts/" + receipt.id + "/content?download=1"}
              download={receipt.filename}
              className="inline-flex min-h-11 items-center text-xs text-muted-foreground"
            >
              Download · {Math.ceil(receipt.size / 1024)} KB
            </a>
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
        <p role="alert" className="my-3 text-xs text-destructive">
          {query.error.message}
        </p>
      )}
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
              if (file.size > 20 * 1024 * 1024)
                toast.error("Choose a file up to 20 MB.");
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
