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
  type: "bank" | "cash" | "credit";
  institution: string;
  owner: string;
  openingDate: string;
  openingBalanceCents: number;
  archived: boolean;
};
export type Category = {
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
};
export type Schedule = {
  id: string;
  name: string;
  accountId: string;
  kind: "income" | "expense";
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
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  rules: Rule[];
  budgets: Budget[];
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
  categoryChosen?: boolean;
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
