import { z } from "zod";
export const id = z.string().uuid({ error: "Choose a valid record." });
export const cents = z.number().int().safe();
export const positiveCents = cents.positive();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value,
    "Choose a valid date",
  );
export const owner = z.string().min(1).default("household");
export const accountSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  type: z.enum(["bank", "cash", "credit"]),
  institution: z.string().trim().max(80).default(""),
  owner,
  openingDate: date,
  openingBalanceCents: cents,
  archived: z.boolean().default(false),
});
export const categorySchema = z.object({
  parentId: id.nullable().default(null),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["income", "expense"]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#007aff"),
  archived: z.boolean().default(false),
});
export const transactionSchema = z.object({
  accountId: id,
  kind: z.enum(["income", "expense", "refund"]),
  amountCents: positiveCents,
  date,
  description: z.string().trim().min(1, "Enter a description.").max(250),
  categoryId: id.nullable().default(null),
  owner,
  notes: z.string().max(2000).default(""),
});
export const transferSchema = z
  .object({
    fromAccountId: id,
    toAccountId: id,
    amountCents: positiveCents,
    date,
    description: z
      .string()
      .trim()
      .min(1, "Enter a description.")
      .max(250)
      .default("Transfer"),
  })
  .refine(
    (v) => v.fromAccountId !== v.toAccountId,
    "Choose two different accounts",
  );
export const ruleSchema = z.object({
  pattern: z.string().trim().min(1).max(120),
  categoryId: id,
  priority: z.number().int().min(0).max(10000).default(100),
  enabled: z.boolean().default(true),
});
export const budgetSchema = z.object({
  categoryId: id,
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amountCents: cents.nonnegative(),
});
export const scheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    accountId: id,
    kind: z.enum(["income", "expense"]),
    amountCents: positiveCents,
    categoryId: id.nullable().default(null),
    owner,
    startDate: date,
    endDate: date.nullable().default(null),
    frequency: z.enum([
      "weekly",
      "fortnightly",
      "monthly",
      "quarterly",
      "annually",
    ]),
    subscription: z.boolean().default(false),
    provider: z.string().trim().max(100).default(""),
    cancelled: z.boolean().default(false),
  })
  .refine(
    (v) => !v.endDate || v.endDate >= v.startDate,
    "End date must follow start date",
  );
export const assetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["asset", "liability"]),
  classification: z
    .enum([
      "property",
      "investment",
      "superannuation",
      "vehicle",
      "loan",
      "other",
    ])
    .default("other"),
  owner,
});
export const valuationSchema = z.object({
  date,
  amountCents: cents.nonnegative(),
});
export const mappingSchema = z
  .object({
    dateColumn: z.string().min(1),
    descriptionColumn: z.string().min(1),
    amountColumn: z.string().default(""),
    debitColumn: z.string().default(""),
    creditColumn: z.string().default(""),
    dateFormat: z.enum(["DMY", "MDY", "ISO"]).default("DMY"),
  })
  .refine(
    (v) => !!v.amountColumn || (!!v.debitColumn && !!v.creditColumn),
    "Map an amount column, or both debit and credit",
  );
export const previewSchema = z.object({
  accountId: id,
  csv: z.string().min(1).max(5_000_000),
  mapping: mappingSchema,
});
export const importRowSchema = z.object({
  kind: z.enum(["income", "expense", "refund", "transfer"]).optional(),
  counterAccountId: id.nullable().default(null),
  rowNumber: z.number().int().positive(),
  date,
  description: z.string().min(1).max(250),
  amountCents: cents.refine((v) => v !== 0),
  categoryId: id.nullable(),
  owner: z.string().min(1),
  include: z.boolean(),
  allowDuplicate: z.boolean(),
});
export const commitImportSchema = z.object({
  rows: z.array(importRowSchema).max(10000),
});
export const userInviteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  role: z.enum(["admin", "member"]).default("member"),
});
export const bootstrapSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  token: z.string().min(1),
});
export const aiSuggestionSchema = z.object({
  mapping: z
    .object({
      dateColumn: z.string(),
      descriptionColumn: z.string(),
      amountColumn: z.string(),
      debitColumn: z.string(),
      creditColumn: z.string(),
      dateFormat: z.enum(["DMY", "MDY", "ISO"]),
    })
    .optional(),
  categories: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        categoryId: id.nullable(),
      }),
    )
    .max(10000)
    .default([]),
});
export type AccountInput = z.input<typeof accountSchema>;
export type TransactionInput = z.input<typeof transactionSchema>;
export type ScheduleInput = z.input<typeof scheduleSchema>;
export type Mapping = z.infer<typeof mappingSchema>;
