import { z } from "zod";
import { cents, date, id, importRowSchema, scheduleSchema } from "./schemas.js";
import type { ImportRow, ScheduleInput } from "./index.js";
export type StatementLine = {
  page: number;
  line: number;
  text: string;
  rowNumber: number | null;
  status: "transaction" | "context" | "review";
};
export type RecurringSuggestion = {
  key: string;
  evidence: number[];
  reason: string;
  schedule: ScheduleInput;
};
export type StatementDetails = {
  lines: StatementLine[];
  opening: { date: string; amountCents: number } | null;
  closing: { date: string; amountCents: number } | null;
  warnings: string[];
  recurring: RecurringSuggestion[];
};
export type StatementPreview = {
  id: string;
  accountId: string;
  filename: string;
  pages: number;
  rows: ImportRow[];
  details: StatementDetails;
  committedAt: string | null;
};
export const statementCommitSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(10000),
  applyOpening: z.boolean(),
  opening: z.object({ date, amountCents: cents }).nullable(),
  reviewed: z.literal(true),
  schedules: z
    .array(z.object({ key: z.string(), schedule: scheduleSchema }))
    .max(500),
});
export const statementUploadSchema = z.object({
  accountId: id,
  useAi: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
});
export const statementRetrySchema = z.object({
  discardReview: z.boolean().default(false),
});

export type StatementProcessing = {
  id: string;
  accountId: string;
  filename: string;
  status: "queued" | "processing" | "failed";
  stage: string;
  error: string | null;
};
export type StatementResult =
  | (StatementPreview & { status: "ready" })
  | StatementProcessing;
export type StatementSummary = {
  id: string;
  filename: string;
  pages: number;
  createdAt: string;
  committedAt: string | null;
  status: "queued" | "processing" | "ready" | "failed";
  stage: string;
  error: string | null;
};
export const isStatementProcessing = (value: { status: string }) =>
  value.status === "queued" || value.status === "processing";
export const statementStatusLabel = (value: {
  status: string;
  stage: string;
  committedAt?: string | null;
}) =>
  value.committedAt
    ? "Imported"
    : value.status === "queued"
      ? "Queued"
      : value.status === "processing"
        ? value.stage === "reading"
          ? "Reading PDF pages…"
          : "Analysing transactions…"
        : value.status === "failed"
          ? "Needs attention"
          : "Ready to review";

export const statementRecurringSchema = z.object({
  reviewed: z.literal(true),
  schedules: statementCommitSchema.shape.schedules.min(1),
});
