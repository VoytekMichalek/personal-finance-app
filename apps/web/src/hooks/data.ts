import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Snapshot, Person } from "@finance/shared";
import { api, send } from "../lib/api";
export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => api<Person>("/access/me"),
    retry: false,
  });
export const useSnapshot = () =>
  useQuery({
    queryKey: ["snapshot"],
    queryFn: () => api<Snapshot>("/snapshot"),
  });
export function useAction(onSuccess?: (result: unknown) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      body,
      method = "POST",
    }: {
      path: string;
      body?: unknown;
      method?: string;
    }) => send(path, body, method),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["snapshot"] });
      await client.invalidateQueries({ queryKey: ["users"] });
      await client.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Saved");
      onSuccess?.(result);
    },
    onError: (error) => toast.error(error.message),
  });
}
