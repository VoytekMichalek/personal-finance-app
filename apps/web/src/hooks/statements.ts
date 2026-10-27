import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, send, ApiError } from "../lib/api";
import {
  isStatementProcessing,
  type StatementResult,
  type RecurringSuggestion,
} from "@finance/shared";
export function useStatement(id?: string) {
  return useQuery({
    queryKey: ["statement", id],
    queryFn: () => api<StatementResult>("/statements/" + id),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data && isStatementProcessing(query.state.data)
        ? 2000
        : false,
  });
}
export function useStatementUpload() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      file,
      year,
      useAi,
    }: {
      accountId: string;
      file: File;
      year: string;
      useAi: boolean;
    }) => {
      const body = new FormData();
      body.append("accountId", accountId);
      body.append("file", file);
      body.append("useAi", String(useAi));
      if (year) body.append("year", year);
      return api<StatementResult>("/statements", { method: "POST", body });
    },
    onSuccess: async (result) => {
      client.setQueryData(["statement", result.id], result);
      await client.invalidateQueries({
        queryKey: ["statements", result.accountId],
      });
    },
  });
}
export function useStatementRetry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      send<StatementResult>("/statements/" + id + "/retry", {}),
    onSuccess: async (result) => {
      client.setQueryData(["statement", result.id], result);
      await client.invalidateQueries({
        queryKey: ["statements", result.accountId],
      });
    },
  });
}
export function useStatementReread() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      send<StatementResult>("/statements/" + id + "/retry", {
        discardReview: true,
      }),
    onSuccess: async (result) => {
      client.setQueryData(["statement", result.id], result);
      await client.invalidateQueries({
        queryKey: ["statements", result.accountId],
      });
    },
  });
}
export function useStatementCommit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      send<{ imported: number; alreadyImported: boolean }>(
        "/statements/" + id + "/commit",
        body,
      ),
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.details?.type === "import-conflicts"
      )
        void client.invalidateQueries({ queryKey: ["snapshot"] });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["snapshot"] }),
        client.invalidateQueries({ queryKey: ["statements"] }),
        client.invalidateQueries({ queryKey: ["statement"] }),
      ]);
    },
  });
}

export function useSavedRecurring(id: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["statement-recurring", id],
    queryFn: () =>
      api<RecurringSuggestion[]>("/statements/" + id + "/recurring"),
  });
  const save = useMutation({
    mutationFn: (body: unknown) =>
      send<{ saved: number }>("/statements/" + id + "/recurring", body),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["snapshot"] }),
        client.invalidateQueries({ queryKey: ["statement-recurring", id] }),
      ]);
    },
  });
  return { query, save };
}
