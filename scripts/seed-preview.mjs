import { previewSchedules } from "./preview-schedules.mjs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { statementPdf } from "../apps/api/src/integration/statement-fixture.ts";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
require("dotenv").config({ path: root + ".env", quiet: true });
const database = process.argv[2];
if (!/^finance_preview_[a-z0-9]+$/.test(database ?? ""))
  throw Error(
    "Pass an isolated finance_preview_* database name. This script never seeds finance or production.",
  );
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw Error("Preview database must be local.");
url.pathname = "/" + database;
const { PrismaClient } = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const id = (n) => "e604f9e7-885c-4e42-8d34-" + String(n).padStart(12, "0");
const output = root + "artifacts/preview-samples";
try {
  const owner = await db.user.findFirstOrThrow({
    where: { state: "active", role: "admin" },
  });
  const people = [owner.id, id(100), "household"];
  await db.user.upsert({
    where: { id: id(100) },
    update: {},
    create: {
      id: id(100),
      name: "Nicola (sample)",
      email: "nicola.preview@example.test",
      role: "member",
      state: "invited",
    },
  });
  // Insert-only fixtures: rerunning never overwrites edits or removes existing data.
  const names = [
    "Everyday",
    "Savings",
    "Credit card",
    "Cash",
    "Everyday",
    "Savings",
    "Credit card",
    "Cash",
    "Bills",
    "Holiday",
    "Emergency savings",
    "Old account",
  ];
  await db.account.createMany({
    skipDuplicates: true,
    data: names.map((name, index) => ({
      id: id(index + 1),
      name: "Sample · " + name,
      institution: "Local preview",
      type: index % 4 === 2 ? "credit" : index % 4 === 3 ? "cash" : "bank",
      owner: people[Math.floor(index / 4)],
      openingDate: "2026-01-01",
      openingBalanceCents: BigInt(index % 4 === 2 ? -42500 : 1250000),
      archived: index === 11,
    })),
  });
  const categories = [
    ["Groceries", "expense", "#e6a64d"],
    ["Dining", "expense", "#dc7075"],
    ["Rent", "expense", "#a52a87"],
    ["Salary", "income", "#5298a8"],
    ["Travel", "expense", "#65a18b"],
    ["Subscriptions", "expense", "#85929e"],
  ];
  await db.category.createMany({
    skipDuplicates: true,
    data: categories.map(([name, kind, color], i) => ({
      id: id(200 + i),
      name: "Sample · " + name,
      kind,
      color,
    })),
  });
  const transactions = [];
  for (let month = 5; month <= 11; month++) {
    const limit = month === 11 ? 2 : 28;
    for (let day = 1; day <= limit; day++)
      for (let person = 0; person < 3; person++) {
        const index = (month - 8) * 100 + day * 3 + person;
        const income = day === 1 || day === 15;
        const refund = day % 13 === 0;
        const category = income ? 3 : day % 7 === 0 ? 2 : day % 3 === 0 ? 1 : 0;
        transactions.push({
          id: id(
            month < 8
              ? 10000 + (month - 5) * 100 + day * 3 + person
              : 1000 + index,
          ),
          accountId: id([1, 5, 9][person]),
          owner: people[person],
          date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          kind: income ? "income" : refund ? "refund" : "expense",
          amountCents: BigInt(
            income
              ? 280000
              : refund
                ? 2400
                : category === 2
                  ? -42500
                  : -(800 + day * 145 + person * 250),
          ),
          description: income
            ? "Sample · Salary"
            : refund
              ? "Sample · Market refund"
              : category === 2
                ? "Sample · Rent payment"
                : category === 1
                  ? "Sample · Corner Cafe"
                  : "Sample · Local Market",
          categoryId: !income && day % 5 === 0 ? null : id(200 + category),
        });
      }
  }
  await db.transaction.createMany({ skipDuplicates: true, data: transactions });
  await db.budget.createMany({
    skipDuplicates: true,
    data: [0, 1, 2, 4, 5].flatMap((category, i) =>
      [8, 9, 10, 11].map((month) => ({
        id: id(300 + category * 10 + month),
        categoryId: id(200 + category),
        month: `2026-${String(month).padStart(2, "0")}`,
        amountCents: BigInt([55000, 18000, 180000, 30000, 9000][i]),
      })),
    ),
  });
  const assets = [
    ["Share portfolio", "asset", "investment", owner.id, 2500000],
    ["Superannuation", "asset", "superannuation", id(100), 8200000],
    ["Family home", "asset", "property", "household", 72000000],
    ["Home loan", "liability", "loan", "household", 45000000],
    ["Car", "asset", "vehicle", id(100), 2800000],
    ["Car loan", "liability", "loan", id(100), 1200000],
  ];
  await db.asset.createMany({
    skipDuplicates: true,
    data: assets.map(([name, kind, classification, owner], i) => ({
      id: id(400 + i),
      name: "Sample · " + name,
      kind,
      classification,
      owner,
    })),
  });
  await db.account.createMany({
    skipDuplicates: true,
    data: assets.map(([name, kind, , owner], i) => ({
      id: id(420 + i),
      assetId: id(400 + i),
      name: "Sample · " + name,
      type: kind,
      owner,
      institution: "Local preview",
      openingDate: "2026-01-01",
      openingBalanceCents: 0n,
    })),
  });
  await db.valuation.createMany({
    skipDuplicates: true,
    data: assets.flatMap((a, i) =>
      [1, 4, 7, 10].map((month, j) => ({
        id: id(450 + i * 10 + j),
        assetId: id(400 + i),
        date: `2026-${String(month).padStart(2, "0")}-01`,
        amountCents: BigInt(
          a[4] + (a[1] === "asset" ? -1 : 1) * (3 - j) * 25000,
        ),
      })),
    ),
  });
  const transfers = [
    [
      id(1),
      id(420),
      owner.id,
      50000,
      "2026-10-20",
      "Sample · Share contribution",
    ],
    [
      id(9),
      id(423),
      "household",
      150000,
      "2026-10-22",
      "Sample · Mortgage repayment",
    ],
    [id(5), id(6), id(100), 25000, "2026-10-25", "Sample · Savings transfer"],
  ];
  await db.transaction.createMany({
    skipDuplicates: true,
    data: transfers.flatMap(([from, to, owner, amount, date, description], i) =>
      [from, to].map((accountId, j) => ({
        id: id(600 + i * 2 + j),
        transferGroupId: id(620 + i),
        accountId,
        owner,
        date,
        description,
        kind: "transfer",
        amountCents: BigInt(j ? amount : -amount),
      })),
    ),
  });
  const schedules = previewSchedules(id, owner);
  await db.schedule.createMany({
    skipDuplicates: true,
    data: schedules.map(
      (
        [
          name,
          accountId,
          kind,
          amount,
          categoryId,
          owner,
          startDate,
          frequency,
          subscription,
          counterAccountId,
        ],
        i,
      ) => ({
        id: id(700 + i),
        name: "Sample · " + name,
        accountId,
        kind,
        amountCents: BigInt(amount),
        categoryId,
        owner,
        startDate,
        frequency,
        subscription,
        counterAccountId,
        provider: "Local preview",
      }),
    ),
  });
  await db.rule.createMany({
    skipDuplicates: true,
    data: [
      {
        id: id(800),
        pattern: "Sample · Corner Cafe",
        categoryId: id(201),
        enabled: true,
        priority: 100,
      },
      {
        id: id(801),
        pattern: "Sample · Local Market",
        categoryId: id(200),
        enabled: true,
        priority: 100,
      },
      {
        id: id(802),
        pattern: "Sample · Travel",
        categoryId: id(204),
        enabled: false,
        priority: 200,
      },
      {
        id: id(803),
        pattern: "Sample · Share contribution",
        kind: "transfer",
        accountId: id(1),
        counterAccountId: id(420),
        direction: "out",
        categoryId: null,
        enabled: true,
        priority: 100,
      },
    ],
  });
  await mkdir(output, { recursive: true });
  const documents = [
    [
      "sample-review.pdf",
      id(9),
      [
        "Sample review statement 2026",
        "Date Details Amount",
        "01/11/2026 Sample Local Market -84.20",
        "01/11/2026 Sample Corner Cafe -12.50",
        "02/11/2026 Sample Book Shop -29.90",
      ],
    ],
    [
      "sample-missing-year.pdf",
      id(5),
      [
        "Sample statement",
        "Date Details Amount",
        "12 Oct Sample Market -20.00",
        "13 Oct Sample Other -10.00",
      ],
    ],
    [
      "sample-reconciliation.pdf",
      id(6),
      [
        "Sample savings statement 2026",
        "Date Details Amount",
        "25/10/2026 Sample Savings transfer +250.00",
        "30/10/2026 Sample Bank interest +2.15",
      ],
    ],
  ];
  for (const [index, [filename, accountId, lines]] of documents.entries()) {
    const content = statementPdf([lines]);
    await writeFile(output + "/" + filename, content);
    const statementId = id(900 + index);
    if (
      !(await db.statement.findUnique({
        where: { id: statementId },
        select: { id: true },
      }))
    )
      await db.statement.create({
        data: {
          id: statementId,
          account: { connect: { id: accountId } },
          filename,
          content,
          pages: 0,
          details: {},
          status: "queued",
          stage: "queued",
          processingOptions: { useAi: false },
          importBatch: {
            create: {
              id: id(910 + index),
              accountId,
              fileHash: createHash("sha256").update(content).digest("hex"),
              mapping: {},
              preview: [],
              expiresAt: new Date("2027-11-02T00:00:00Z"),
            },
          },
        },
      });
  }
  await writeFile(
    output + "/sample-transactions.csv",
    "Date,Description,Amount\n01/11/2026,Sample Local Market,-42.50\n01/11/2026,Sample Corner Cafe,-9.80\n02/11/2026,Sample Book Shop,-35.00\n",
  );
  console.log(
    JSON.stringify({
      database,
      accounts: await db.account.count(),
      transactions: await db.transaction.count(),
      assets: await db.asset.count(),
      budgets: await db.budget.count(),
      schedules: await db.schedule.count(),
      rules: await db.rule.count(),
      sampleStatements: documents.length,
      sampleFiles: output,
    }),
  );
} finally {
  await db.$disconnect();
}
