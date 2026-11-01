import { useSearchParams } from "react-router-dom";
import { date, type TransactionFilters } from "@finance/shared";

export function useTransactionFilters(accountId?: string) {
  const [params, setParams] = useSearchParams();
  const kinds = ["income", "expense", "refund", "transfer"] as const;
  const requestedKinds = params.getAll("kind");
  const filters: TransactionFilters = {
    search: params.get("search") ?? "",
    accountId: accountId ?? null,
    accountIds: params.getAll("account"),
    owners: params.getAll("owner").filter((owner) => owner !== "all"),
    categoryIds: params.getAll("category"),
    kinds: kinds.filter((kind) => requestedKinds.includes(kind)),
    owner: "all",
    categoryId: null,
    kind: null,
    from: date.safeParse(params.get("from")).success
      ? params.get("from")
      : null,
    to: date.safeParse(params.get("to")).success ? params.get("to") : null,
  };
  const update = (values: Partial<TransactionFilters>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        const names = {
          search: "search",
          accountIds: "account",
          owners: "owner",
          categoryIds: "category",
          kinds: "kind",
          from: "from",
          to: "to",
        } as const;
        for (const [key, name] of Object.entries(names)) {
          if (!(key in values)) continue;
          next.delete(name);
          const value = values[key as keyof typeof names];
          for (const item of Array.isArray(value) ? value : [value])
            if (item) next.append(name, item);
        }
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  };
  return { filters, update };
}
