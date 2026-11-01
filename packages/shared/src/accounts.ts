import type { Account } from "./types.js";

/** Assets and long-term debts contribute to net worth, not available cash. */
export const isCashAccount = (
  account: Account,
): account is Account & { type: "bank" | "cash" | "credit" } =>
  account.type !== "asset" && account.type !== "liability";

export const accountLabel = (account: Account) =>
  isCashAccount(account)
    ? account.name
    : `${account.name} · ${account.type === "asset" ? "Asset" : "Liability"}`;
