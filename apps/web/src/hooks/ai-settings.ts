import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, send } from "../lib/api";
export type Integrations = {
  openrouterConfigured: boolean;
  keySource: "settings" | "environment" | null;
  r2Configured: boolean;
  modelId: string | null;
  models: { id: string; provider: string; displayName: string }[];
};
export function useAiSettings() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api<Integrations>("/integrations"),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["integrations"] });
  const save = useMutation({
    gcTime: 0,
    mutationFn: (body: { apiKey?: string; modelId: string | null }) =>
      send("/integrations/ai", body, "PUT"),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => send("/integrations/ai/key", undefined, "DELETE"),
    onSuccess: refresh,
  });
  const check = useMutation({
    gcTime: 0,
    mutationFn: (apiKey?: string) =>
      send("/integrations/ai/check", apiKey ? { apiKey } : {}),
  });
  return { status, save, remove, check };
}
