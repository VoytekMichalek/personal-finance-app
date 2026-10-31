import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { rememberTransactionCategorySchema } from "@finance/shared";
import type { z } from "zod";
import { send } from "../lib/api";

export function useRememberTransactionCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["remember-transaction-category"],
    mutationFn: (body: z.input<typeof rememberTransactionCategorySchema>) =>
      send<{ matched: number; changed: number }>(
        "/transactions/remember-category",
        body,
      ),
    onSuccess: (result) =>
      toast.success(
        `Category applied to ${result.matched} matching transactions. Rule saved.`,
      ),
    onError: (error) => toast.error(error.message),
    onSettled: () => client.invalidateQueries({ queryKey: ["snapshot"] }),
  });
}
