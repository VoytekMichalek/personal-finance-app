import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { rememberTransactionSchema } from "@finance/shared";
import type { z } from "zod";
import { send } from "../lib/api";

export function useRememberTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["remember-transaction"],
    mutationFn: (body: z.input<typeof rememberTransactionSchema>) =>
      send<{ matched: number; changed: number }>(
        "/transactions/remember",
        body,
      ),
    onSuccess: (result) =>
      toast.success(
        `Rule saved. ${result.changed} of ${result.matched} matching transactions updated.`,
      ),
    onError: (error) => toast.error(error.message),
    onSettled: () => client.invalidateQueries({ queryKey: ["snapshot"] }),
  });
}
