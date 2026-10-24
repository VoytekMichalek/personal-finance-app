import "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { today } from "@finance/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { account, memberCookie, origin, post, storage } from "./fixtures.js";
describe("private receipt lifecycle and quiet logs", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6S8AAAAASUVORK5CYII=",
    "base64",
  );
  async function transaction() {
    return (
      await post("/transactions", {
        accountId: await account(),
        date: today(),
        description: "Receipt shop",
        amountCents: 1000,
        kind: "expense",
      })
    ).body.id as string;
  }
  it("requires authentication and rejects disguised executable files", async () => {
    const id = await transaction();
    expect(
      (
        await request(app)
          .post("/api/transactions/" + id + "/receipts")
          .set("Origin", origin)
          .attach("file", png, "receipt.png")
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/transactions/" + id + "/receipts")
          .set("Cookie", memberCookie)
          .set("Origin", origin)
          .attach(
            "file",
            Buffer.from("<script>alert(1)</script>"),
            "receipt.png",
          )
      ).status,
    ).toBe(400);
  });
  it("stores private objects and supports authorized preview/download/deletion", async () => {
    const id = await transaction();
    const response = await request(app)
      .post("/api/transactions/" + id + "/receipts")
      .set("Cookie", memberCookie)
      .set("Origin", origin)
      .attach("file", png, "receipt.png");
    expect(response.status).toBe(201);
    expect(response.body.objectKey).toBeUndefined();
    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { id: response.body.id },
    });
    expect(receipt.objectKey).toMatch(/^receipts\/[a-f0-9-]{36}$/);
    expect(
      (await request(app).get("/api/receipts/" + receipt.id + "/content"))
        .status,
    ).toBe(401);
    const download = await request(app)
      .get("/api/receipts/" + receipt.id + "/content?download=1")
      .set("Cookie", memberCookie);
    expect(download.status).toBe(200);
    expect(download.headers["cache-control"]).toContain("no-store");
    expect(
      (
        await request(app)
          .delete("/api/receipts/" + receipt.id)
          .set("Cookie", memberCookie)
          .set("Origin", origin)
      ).status,
    ).toBe(200);
    expect(await prisma.receipt.count()).toBe(0);
  });
  it("keeps failed upload/delete operations recoverable and redacts errors", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const id = await transaction();
    storage.put.mockRejectedValueOnce(
      new Error("synthetic secret must not leak"),
    );
    expect(
      (
        await request(app)
          .post("/api/transactions/" + id + "/receipts")
          .set("Cookie", memberCookie)
          .set("Origin", origin)
          .attach("file", png, "receipt.png")
      ).status,
    ).toBe(500);
    expect(await prisma.receipt.count()).toBe(0);
    const uploaded = await request(app)
      .post("/api/transactions/" + id + "/receipts")
      .set("Cookie", memberCookie)
      .set("Origin", origin)
      .attach("file", png, "receipt.png");
    storage.remove.mockRejectedValueOnce(
      new Error("synthetic secret must not leak"),
    );
    expect(
      (
        await request(app)
          .delete("/api/receipts/" + uploaded.body.id)
          .set("Cookie", memberCookie)
          .set("Origin", origin)
      ).status,
    ).toBe(500);
    expect(await prisma.receipt.count()).toBe(1);
    expect(errorLog.mock.calls.flat().join(" ")).not.toContain(
      "synthetic secret",
    );
    errorLog.mockRestore();
  });
  it("does not warn or error for expected denials, validation or readiness polls", async () => {
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");
    await request(app).get("/api/snapshot");
    await request(app).get("/ready");
    await post("/accounts", {});
    await request(app).get("/api/no-such-route").set("Cookie", memberCookie);
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
    errors.mockRestore();
    warnings.mockRestore();
  });
});
