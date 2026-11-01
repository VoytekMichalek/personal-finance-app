import request from "supertest";
import { expect, it } from "vitest";
import { account, post, memberCookie, origin } from "./fixtures.js";
import { prisma } from "../lib/db.js";
import { app } from "../app.js";

it("enforces every multiselect boundary when remembering existing transactions", async () => {
  const [a, b, c] = await Promise.all([account(), account(), account()]);
  const category = await prisma.category.findFirstOrThrow({
    where: { name: "Groceries" },
  });
  const rows = await Promise.all(
    [a, b, c, a].map((accountId, i) =>
      prisma.transaction.create({
        data: {
          accountId,
          owner: i === 3 ? "another" : "household",
          date: "2026-10-01",
          kind: "expense",
          description: "Scope test merchant",
          amountCents: -100n,
        },
      }),
    ),
  );
  const input = {
    source: { id: rows[0]!.id, version: 1 },
    records: rows.slice(0, 2).map((r) => ({ id: r.id, version: 1 })),
    categoryId: category.id,
    pattern: "scope test merchant",
    matchMode: "contains",
    filters: {
      accountIds: [a, b],
      owners: ["household"],
      categoryIds: ["none"],
      kinds: ["expense"],
      from: "2026-10-01",
      to: "2026-10-31",
    },
  };
  const result = await post("/transactions/remember", input);
  expect(result.status).toBe(200);
  expect(result.body.changed).toBe(2);
  const untouched = await prisma.transaction.findMany({
    where: { id: { in: rows.slice(2).map((r) => r.id) } },
  });
  expect(untouched.every((r) => r.categoryId === null && r.version === 1)).toBe(
    true,
  );
});
it("lists only uncommitted ready/failed statement reviews behind authentication", async () => {
  const accountId = await account();
  for (const [i, status] of ["ready", "failed", "queued", "ready"].entries())
    await prisma.statement.create({
      data: {
        account: { connect: { id: accountId } },
        filename: `sample-${i}.pdf`,
        content: Buffer.from("%PDF-"),
        pages: 0,
        details: {},
        status,
        stage: status,
        importBatch: {
          create: {
            accountId,
            fileHash: `pending-${i}`,
            mapping: {},
            preview: [],
            expiresAt: new Date("2200-01-01"),
            committedAt: i === 3 ? new Date() : null,
          },
        },
      },
    });
  const result = await request(app)
    .get("/api/statements/pending")
    .set("Cookie", memberCookie);
  expect(result.status).toBe(200);
  expect(
    result.body.map((r: { filename: string }) => r.filename).sort(),
  ).toEqual(["sample-0.pdf", "sample-1.pdf"]);
  expect(result.body[0]).not.toHaveProperty("content");
  expect((await request(app).get("/api/statements/pending")).status).toBe(401);
});

it("saves and undoes all category colours atomically without changing categories or past transactions", async () => {
  const { put } = await import("./fixtures.js");
  const { uniqueCategoryColours } = await import("@finance/shared");
  const rows = await prisma.category.findMany({ orderBy: { id: "asc" } });
  await prisma.category.update({
    where: { id: rows[0]!.id },
    data: { archived: true },
  });
  const changes = uniqueCategoryColours(rows).map((c) => ({
    ...c,
    expectedColor: rows.find((r) => r.id === c.id)!.color,
  }));
  expect((await put("/categories/colours", { changes })).status).toBe(200);
  const updated = await prisma.category.findMany({ orderBy: { id: "asc" } });
  expect(new Set(updated.map((r) => r.color)).size).toBe(rows.length);
  expect(updated[0]!.archived).toBe(true);
  expect(updated.map((r) => r.name)).toEqual(rows.map((r) => r.name));
  const undo = changes.map((c) => ({
    id: c.id,
    color: c.expectedColor,
    expectedColor: c.color,
  }));
  // A later category edit must cause a complete rejection, not a partial undo.
  await prisma.category.update({
    where: { id: rows[0]!.id },
    data: { color: "#112233" },
  });
  expect((await put("/categories/colours", { changes: undo })).status).toBe(
    409,
  );
  expect(
    (await prisma.category.findUniqueOrThrow({ where: { id: rows[1]!.id } }))
      .color,
  ).toBe(changes[1]!.color);
  undo[0]!.expectedColor = "#112233";
  expect((await put("/categories/colours", { changes: undo })).status).toBe(
    200,
  );
  expect(
    (await prisma.category.findMany({ orderBy: { id: "asc" } })).map(
      (r) => r.color,
    ),
  ).toEqual(rows.map((r) => r.color));
  expect(
    (await put("/categories/colours", { changes: [undo[0], undo[0]] })).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .put("/api/categories/colours")
        .set("Origin", origin)
        .send({ changes: undo })
    ).status,
  ).toBe(401);
});
