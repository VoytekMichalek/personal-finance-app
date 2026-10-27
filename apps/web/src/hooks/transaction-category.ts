import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { send } from "../lib/api";

export function useTransactionCategory(id: string) {
  const client = useQueryClient();
  const mutationKey = ["transaction-category", id];
  const saving = useIsMutating({ mutationKey }) > 0;
  const action = useMutation({
    mutationKey,
    mutationFn: ({
      categoryId,
      version,
    }: {
      categoryId: string | null;
      version: number;
    }) =>
      send("/transactions/bulk-category", {
        categoryId,
        records: [{ id, version }],
      }),
    onSuccess: () => toast.success("Category saved"),
    onError: (error) => toast.error(error.message),
    // Refresh after a conflict as well, so the next edit uses the current version.
    onSettled: () => client.invalidateQueries({ queryKey: ["snapshot"] }),
  });
  return { ...action, saving };
}
