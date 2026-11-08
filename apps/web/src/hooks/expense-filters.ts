import { useSearchParams } from "react-router-dom";
import { date, type ExpenseFilters, type Snapshot } from "@finance/shared";
export function useExpenseFilters(data: Snapshot) {
  const [params, setParams] = useSearchParams();
  const validDate = (value: string | null, fallback: string) =>
    date.safeParse(value).success ? value! : fallback;
  const filters: ExpenseFilters = {
    from: validDate(params.get("from"), `${data.today.slice(0, 7)}-01`),
    to: validDate(params.get("to"), data.today),
    accountIds: params.getAll("account"),
    owners: params.getAll("owner"),
    categoryIds: params.getAll("category"),
    categoryMatch:
      params.get("categoryMatch") === "exact" ? "exact" : undefined,
    search: params.get("search") ?? "",
  };
  const group = params.get("detailGroup"),
    id = params.get("detailId");
  const title =
    group === "categories"
      ? (data.categories.find((c) => c.id === id)?.name ?? "Uncategorised")
      : group === "accounts"
        ? (data.accounts.find((a) => a.id === id)?.name ?? "Account")
        : id === "household"
          ? "Household"
          : (data.people.find((p) => p.id === id)?.name ?? "Former member");
  const detail =
    id && ["categories", "accounts", "people"].includes(group ?? "")
      ? { group: group as "categories" | "accounts" | "people", id, title }
      : null;
  const update = (change: Partial<ExpenseFilters>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, name] of Object.entries({
          from: "from",
          to: "to",
          accountIds: "account",
          owners: "owner",
          categoryIds: "category",
          categoryMatch: "categoryMatch",
          search: "search",
        })) {
          if (!(key in change)) continue;
          next.delete(name);
          const value = change[key as keyof ExpenseFilters];
          for (const item of Array.isArray(value) ? value : [value])
            if (typeof item === "string" && item) next.append(name, item);
        }
        next.delete("expensePage");
        next.delete("detailPage");
        next.delete("detailGroup");
        next.delete("detailId");
        return next;
      },
      { replace: true },
    );
  const setDetail = (value: typeof detail) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("detailPage");
        if (value) {
          next.set("detailGroup", value.group);
          next.set("detailId", value.id);
        } else {
          next.delete("detailGroup");
          next.delete("detailId");
        }
        return next;
      },
      { replace: true },
    );
  return { filters, update, detail, setDetail };
}
