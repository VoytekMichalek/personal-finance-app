import type { AccountAppearance, Institution } from "./institutions.js";
export type Person = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  state: string;
};
export type Account = {
  id: string;
  name: string;
  type: "bank" | "cash" | "credit" | "asset" | "liability";
  assetId?: string | null;
  institution: string;
  institutionPreset?: string | null;
  customInstitutionId?: string | null;
  appearance?: AccountAppearance | null;
  owner: string;
  openingDate: string;
  openingBalanceCents: number;
  archived: boolean;
};
export type Category = {
  icon?: import("./visuals.js").VisualIcon | null;
  parentId?: string | null;
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
  archived: boolean;
};
export type Transaction = {
  version: number;
  id: string;
  accountId: string;
  kind: "income" | "expense" | "refund" | "transfer";
  amountCents: number;
  date: string;
  description: string;
  categoryId: string | null;
  owner: string;
  notes: string;
  transferGroupId: string | null;
  scheduleId: string | null;
  occurrenceDate: string | null;
  createdAt: string;
  importBatchId?: string | null;
  sourceRow?: number | null;
};
export type Rule = {
  id: string;
  matchMode?: "contains" | "exact";
  pattern: string;
  categoryId: string | null;
  kind?: "transfer" | null;
  accountId?: string | null;
  counterAccountId?: string | null;
  direction?: "in" | "out" | null;
  priority: number;
  enabled: boolean;
};
export type Budget = {
  id: string;
  categoryId: string;
  month: string;
  amountCents: number;
  endMonth: string | null;
};
export type BudgetOverride = Omit<Budget, "endMonth">;
export type EffectiveBudget = Budget & {
  overrideId: string | null;
  plannedAmountCents: number | null;
};
export type Schedule = {
  icon?: import("./visuals.js").VisualIcon | null;
  color?: string | null;
  id: string;
  name: string;
  accountId: string;
  kind: "income" | "expense" | "transfer";
  counterAccountId?: string | null;
  amountCents: number;
  categoryId: string | null;
  owner: string;
  startDate: string;
  endDate: string | null;
  frequency: "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually";
  subscription: boolean;
  provider: string;
  cancelled: boolean;
};
export type Valuation = {
  id: string;
  assetId: string;
  date: string;
  amountCents: number;
};
export type Asset = {
  id: string;
  accountId?: string | null;
  name: string;
  kind: "asset" | "liability";
  classification: string;
  owner: string;
  archived: boolean;
  valuations: Valuation[];
};
export type Receipt = {
  id: string;
  transactionId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
};
export type Snapshot = {
  institutions?: Institution[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  rules: Rule[];
  budgets: Budget[];
  budgetOverrides: BudgetOverride[];
  schedules: Schedule[];
  assets: Asset[];
  people: Person[];
  today: string;
};
export type ImportRow = {
  rememberCategory?: boolean;
  rememberPattern?: string;
  rememberMatchMode?: "exact" | "contains";
  categorySource?: "rule" | "remembered";
  rememberedFrom?: number;
  previousCategory?: Pick<
    ImportRow,
    "categoryId" | "categoryChosen" | "categorySource"
  >;
  linkExisting?: { id: string; version: number };
  reconciliationDismissed?: boolean;
  reconcileExisting?: {
    id: string;
    version: number;
    counterpartId: string;
    counterpartVersion: number;
  };
  categoryChosen?: boolean;
  kindChosen?: boolean;
  kind: "income" | "expense" | "refund" | "transfer";
  counterAccountId: string | null;
  rowNumber: number;
  date: string;
  description: string;
  amountCents: number;
  categoryId: string | null;
  owner: string;
  include: boolean;
  allowDuplicate: boolean;
  duplicate: boolean;
  error: string | null;
};
export type CsvReconciliation = {
  sourceRows: number;
  from: string | null;
  to: string | null;
  netCents: number;
  bankOpeningCents: number | null;
  bankClosingCents: number | null;
  balanceVerified: boolean;
  warning: string | null;
};
export type ImportPreview = {
  reconciliation?: CsvReconciliation;
  id: string;
  rows: ImportRow[];
  filename: string;
  validCount: number;
  invalidCount: number;
};
export type Occurrence = { schedule: Schedule; date: string; matched: boolean };
export type ForecastPoint = {
  date: string;
  balanceCents: number;
  scheduledCents: number;
  allowanceCents: number;
};
