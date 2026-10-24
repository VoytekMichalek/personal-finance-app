import { afterEach, expect, it, vi } from "vitest";
const processor = vi.hoisted(() => vi.fn());
vi.mock("../modules/statements/process.js", () => ({
  processStatement: processor,
}));
import { account, memberCookie, origin, post } from "./fixtures.js";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import {
  claimStatement,
  processClaimedStatement,
} from "../modules/statements/worker.js";
import { HttpError } from "../lib/errors.js";
const result = {
  pages: 1,
  rows: [],
  details: {
    lines: [],
    opening: null,
    closing: null,
    warnings: [],
    recurring: [],
  },
};
async function upload(accountId: string) {
  return request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", accountId)
    .attach("file", Buffer.from("%PDF-synthetic-worker-fixture"), "saved.pdf");
}
const read = (id: string) =>
  request(app)
    .get("/api/statements/" + id)
    .set("Cookie", memberCookie);
afterEach(() => processor.mockReset());
it("persists and lists the PDF before processing; work completes independently of the upload request", async () => {
  const accountId = await account();
  const uploaded = await upload(accountId);
  expect(uploaded.status).toBe(202);
  expect(uploaded.body.status).toBe("queued");
  const id = uploaded.body.id;
  const files = await request(app)
    .get("/api/accounts/" + accountId + "/statements")
    .set("Cookie", memberCookie);
  expect(files.body).toHaveLength(1);
  expect(files.body[0]).toMatchObject({ id, status: "queued" });
  expect(
    (
      await request(app)
        .get("/api/statements/" + id + "/file")
        .set("Cookie", memberCookie)
    ).status,
  ).toBe(200);
  expect((await request(app).get("/api/statements/" + id)).status).toBe(401);
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  processor.mockImplementation(
    async (_account, _content, _options, progress) => {
      await progress(1);
      started();
      await barrier;
      return result;
    },
  );
  const job = await claimStatement();
  const running = processClaimedStatement(job!);
  try {
    await entered;
    expect((await read(id)).body).toMatchObject({
      status: "processing",
      stage: "analysing",
    });
    expect(
      (
        await post("/statements/" + id + "/commit", {
          rows: [
            {
              rowNumber: 1,
              date: "2026-01-01",
              description: "Pending row",
              amountCents: -100,
              categoryId: null,
              owner: "household",
              include: true,
              allowDuplicate: false,
            },
          ],
          reviewed: true,
          applyOpening: false,
          opening: null,
          schedules: [],
        })
      ).status,
    ).toBe(409);
    expect((await upload(accountId)).body.id).toBe(id);
    expect(await prisma.statement.count()).toBe(1);
  } finally {
    release();
    await running;
  }
  expect((await read(id)).body).toMatchObject({
    status: "ready",
    pages: 1,
    rows: [],
  });
  expect(await prisma.transaction.count()).toBe(0);
});
it("reclaims expired work after a restart and fences stale workers", async () => {
  const uploaded = await upload(await account());
  const first = await claimStatement();
  expect(await claimStatement()).toBeNull();
  await prisma.statement.update({
    where: { id: uploaded.body.id },
    data: { leaseUntil: new Date(0) },
  });
  const replacement = await claimStatement();
  expect(replacement?.token).not.toBe(first?.token);
  processor.mockResolvedValue(result);
  await processClaimedStatement(first!);
  expect(processor).not.toHaveBeenCalled();
  await processClaimedStatement(replacement!);
  expect((await read(uploaded.body.id)).body.status).toBe("ready");
});
it("keeps failed PDFs visible, sanitises unexpected errors and retries the saved source", async () => {
  const uploaded = await upload(await account());
  const id = uploaded.body.id;
  processor.mockRejectedValueOnce(
    new HttpError(400, "This PDF is password protected."),
  );
  await processClaimedStatement((await claimStatement())!);
  expect((await read(id)).body).toMatchObject({
    status: "failed",
    error: "This PDF is password protected.",
  });
  expect((await post("/statements/" + id + "/retry", {})).status).toBe(202);
  processor.mockRejectedValueOnce(new Error("sensitive-provider-payload"));
  const logging = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await processClaimedStatement((await claimStatement())!);
    expect((await read(id)).text).not.toContain("sensitive-provider-payload");
    expect(JSON.stringify(logging.mock.calls)).not.toContain(
      "sensitive-provider-payload",
    );
  } finally {
    logging.mockRestore();
  }
  expect((await post("/statements/" + id + "/retry", {})).status).toBe(202);
  processor.mockResolvedValueOnce(result);
  await processClaimedStatement((await claimStatement())!);
  expect((await read(id)).body.status).toBe("ready");
  expect(await prisma.statement.count()).toBe(1);
});
it("deduplicates concurrent uploads durably and rejects non-PDF data", async () => {
  const accountId = await account();
  const files = await Promise.all([upload(accountId), upload(accountId)]);
  expect(files.map((r) => r.status)).toEqual([202, 202]);
  expect(files[0]!.body.id).toBe(files[1]!.body.id);
  const invalid = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", accountId)
    .attach("file", Buffer.from("not a pdf"), "wrong.pdf");
  expect(invalid.status).toBe(400);
  expect(await prisma.statement.count()).toBe(1);
});
