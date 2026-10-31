import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { transactionTypeSchema } from "@finance/shared";
import type { z } from "zod";
import { send } from "../lib/api";

export function useTransactionType(id: string) {
  const client = useQueryClient();
  const saving = useIsMutating({ mutationKey: ["transaction", id] }) > 0;
  const action = useMutation({
    mutationKey: ["transaction", id, "type"],
    mutationFn: (body: z.input<typeof transactionTypeSchema>) =>
      send(`/transactions/${id}/type`, body, "PUT"),
    onSuccess: () => toast.success("Transaction type saved"),
    onError: (error) => toast.error(error.message),
    onSettled: () => client.invalidateQueries({ queryKey: ["snapshot"] }),
  });
  return { ...action, saving };
}
