import "./fixtures.js";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { effectiveBudgets } from "@finance/shared";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { agent, memberCookie, origin, put } from "./fixtures.js";

async function input() {
  const category = await prisma.category.findFirstOrThrow({
    where: { kind: "expense", archived: false },
  });
  return { categoryId: category.id, month: "2026-11", amountCents: 50000 };
}
const remove = (id: string, cookie = memberCookie) =>
  request(app)
    .delete(`/api/budgets/overrides/${id}`)
    .set("Cookie", cookie)
    .set("Origin", origin);

describe("persisted budget periods and overrides", () => {
  it("defaults to one month and stores a finite repeat count inclusively", async () => {
    const body = await input();
    const one = await put("/budgets", body);
    expect(one.status).toBe(200);
    expect(one.body.endMonth).toBe("2026-11");
    const repeated = await put("/budgets", { ...body, repeatMonths: 3 });
    expect(repeated.status).toBe(200);
    expect(repeated.body).toMatchObject({
      id: one.body.id,
      month: "2026-11",
      endMonth: "2027-01",
      amountCents: 50000,
    });
    expect(await prisma.budget.count()).toBe(1);
  });
  it("keeps a first-month override separate, survives plan edits and restores the plan", async () => {
    const body = await input();
    await put("/budgets", { ...body, repeatMonths: 3 });
    const changed = await put("/budgets/overrides", {
      ...body,
      amountCents: 70000,
    });
    expect(changed.status).toBe(200);
    await put("/budgets", { ...body, amountCents: 60000, repeatMonths: 2 });
    const snapshot = (await agent()).body;
    expect(snapshot.budgetOverrides).toEqual([
      expect.objectContaining({ id: changed.body.id, amountCents: 70000 }),
    ]);
    expect(
      effectiveBudgets(
        snapshot.budgets,
        "2026-11",
        snapshot.budgetOverrides,
      )[0],
    ).toMatchObject({ amountCents: 70000, plannedAmountCents: 60000 });
    expect(
      effectiveBudgets(snapshot.budgets, "2026-12", snapshot.budgetOverrides)[0]
        ?.amountCents,
    ).toBe(60000);
    expect((await remove(changed.body.id)).status).toBe(200);
    expect((await remove(changed.body.id)).status).toBe(200);
    expect((await agent()).body.budgetOverrides).toEqual([]);
    expect((await prisma.budget.findFirstOrThrow()).amountCents).toBe(60000n);
  });
  it("accepts a zero override and preserves older ongoing plans", async () => {
    const body = await input();
    await prisma.budget.create({ data: { ...body, month: "2026-01" } });
    expect(
      (await put("/budgets/overrides", { ...body, amountCents: 0 })).status,
    ).toBe(200);
    expect((await prisma.budget.findFirstOrThrow()).endMonth).toBeNull();
    expect((await prisma.budgetOverride.findFirstOrThrow()).amountCents).toBe(
      0n,
    );
  });
  it("rejects invalid periods, categories, amounts and overrides without a plan", async () => {
    const body = await input();
    for (const repeatMonths of [0, 121, 1.5, -2])
      expect((await put("/budgets", { ...body, repeatMonths })).status).toBe(
        400,
      );
    for (const month of ["2026-00", "2026-13", "26-11"])
      expect((await put("/budgets", { ...body, month })).status).toBe(400);
    expect(
      (await put("/budgets", { ...body, month: "9999-12", repeatMonths: 2 }))
        .status,
    ).toBe(400);
    expect((await put("/budgets/overrides", body)).status).toBe(400);
    const income = await prisma.category.findFirstOrThrow({
      where: { kind: "income" },
    });
    expect(
      (await put("/budgets", { ...body, categoryId: income.id })).status,
    ).toBe(400);
    expect((await put("/budgets", { ...body, amountCents: -1 })).status).toBe(
      400,
    );
    expect(await prisma.budget.count()).toBe(0);
    expect(await prisma.budgetOverride.count()).toBe(0);
  });
  it("requires authentication for all budget changes", async () => {
    const body = await input();
    expect((await put("/budgets", body, "")).status).toBe(401);
    expect((await put("/budgets/overrides", body, "")).status).toBe(401);
    expect((await remove(body.categoryId, "")).status).toBe(401);
  });
  it("serializes competing overrides into one persisted monthly value", async () => {
    const body = await input();
    await put("/budgets", body);
    const results = await Promise.all([
      put("/budgets/overrides", { ...body, amountCents: 60000 }),
      put("/budgets/overrides", { ...body, amountCents: 70000 }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await prisma.budgetOverride.count()).toBe(1);
    expect([60000n, 70000n]).toContain(
      (await prisma.budgetOverride.findFirstOrThrow()).amountCents,
    );
    expect((await prisma.budget.findFirstOrThrow()).amountCents).toBe(50000n);
  });
});
