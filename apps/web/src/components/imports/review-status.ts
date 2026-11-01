import type { ImportRow, Snapshot } from "@finance/shared";
export type ReviewStatus = "attention" | "ready" | "reconciled" | "excluded";
export function reviewStatus(row: ImportRow, data: Snapshot, accountId: string, conflicts: readonly number[] = []): ReviewStatus {
  if(row.error) return "attention";
  if(!row.include) return "excluded";
  if(conflicts.includes(row.rowNumber)) return "attention";
  if(row.reconcileExisting) return "reconciled";
  const account=data.accounts.find(a=>a.id===accountId);
  const other=data.accounts.find(a=>a.id===row.counterAccountId);
  if((account && row.date < account.openingDate) || (row.duplicate && !row.allowDuplicate && !row.linkExisting) || (row.kind === "transfer" ? !other || row.date < other.openingDate : !row.categoryId)) return "attention";
  return "ready";
}
