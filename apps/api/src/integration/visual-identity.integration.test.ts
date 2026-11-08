import "./fixtures.js";
import { expect, it } from "vitest";
import { account, agent, post, put } from "./fixtures.js";
import { prisma } from "../lib/db.js";
it("persists category appearance, preserves omitted fields and supports automatic icons", async () => {
  const input = {
    name: "Garden",
    kind: "expense",
    color: "#779966",
    icon: "home",
  };
  const created = await post("/categories", input);
  expect(created.status).toBe(200);
  const id = created.body.id;
  expect(
    (await agent()).body.categories.find((c: { id: string }) => c.id === id),
  ).toMatchObject(input);
  const { icon, ...legacy } = input;
  expect((await put(`/categories/${id}`, legacy)).body.icon).toBe(icon);
  expect(
    (await put(`/categories/${id}`, { ...input, icon: null })).body.icon,
  ).toBeNull();
  expect(
    (await put(`/categories/${id}`, { ...input, icon: "invalid" })).status,
  ).toBe(400);
  expect(
    (await prisma.category.findUniqueOrThrow({ where: { id } })).icon,
  ).toBeNull();
});
it("persists schedule icons and colours, retains old-client updates and validates overrides", async () => {
  const accountId = await account();
  const input = {
    name: "Streaming",
    accountId,
    kind: "expense",
    amountCents: 1599,
    startDate: "2026-11-01",
    frequency: "monthly",
    subscription: true,
    provider: "Example",
    icon: "tv",
    color: "#668899",
  };
  const created = await post("/schedules", input);
  expect(created.status).toBe(200);
  const id = created.body.id;
  expect(
    (await agent()).body.schedules.find((s: { id: string }) => s.id === id),
  ).toMatchObject(input);
  const { icon, color, ...legacy } = input;
  expect((await put(`/schedules/${id}`, legacy)).body).toMatchObject({
    icon,
    color,
  });
  for (const override of [{ icon: "invalid" }, { color: "red" }])
    expect(
      (await put(`/schedules/${id}`, { ...input, ...override })).status,
    ).toBe(400);
  expect(
    (await put(`/schedules/${id}`, { ...input, icon: null, color: null })).body,
  ).toMatchObject({ icon: null, color: null });
});
