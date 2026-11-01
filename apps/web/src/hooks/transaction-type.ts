import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { transactionTypeSchema } from "@finance/shared";
import type { z } from "zod";
import { send } from "../lib/api";

export function useTransactionType(id: string, onTransferred?: () => void) {
  const client = useQueryClient();
  const saving = useIsMutating({ mutationKey: ["transaction", id] }) > 0;
  const action = useMutation({
    mutationKey: ["transaction", id, "type"],
    mutationFn: (body: z.input<typeof transactionTypeSchema>) =>
      send(`/transactions/${id}/type`, body, "PUT"),
    onSuccess: (_result, input) => {
      toast.success("Transaction type saved");
      if (input.kind === "transfer") onTransferred?.();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => client.invalidateQueries({ queryKey: ["snapshot"] }),
  });
  return { ...action, saving };
}
