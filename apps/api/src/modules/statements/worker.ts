import { randomUUID } from "node:crypto";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { processStatement } from "./process.js";
const leaseMs = 120_000;
const leaseExpiry = () => new Date(Date.now() + leaseMs);
export async function claimStatement() {
  // A lease is durable across navigation and server restarts; the token fences stale workers.
  const available = {
    OR: [
      { status: "queued" },
      { status: "processing", leaseUntil: { lt: new Date() } },
    ],
  };
  const item = await prisma.statement.findFirst({
    where: available,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!item) return null;
  const token = randomUUID();
  const claimed = await prisma.statement.updateMany({
    where: { id: item.id, ...available },
    data: {
      status: "processing",
      stage: "reading",
      leaseToken: token,
      leaseUntil: leaseExpiry(),
      processingError: null,
    },
  });
  return claimed.count ? { id: item.id, token } : null;
}
export async function processClaimedStatement(job: {
  id: string;
  token: string;
}) {
  const where = { id: job.id, leaseToken: job.token, status: "processing" };
  const heartbeat = setInterval(() => {
    void prisma.statement
      .updateMany({ where, data: { leaseUntil: leaseExpiry() } })
      .catch(() => {
        console.error(
          JSON.stringify({
            level: "error",
            event: "statement_lease_failed",
            statementId: job.id,
          }),
        );
      });
  }, 30_000);
  heartbeat.unref();
  try {
    const item = await prisma.statement.findFirst({ where });
    if (!item) return;
    const result = await processStatement(
      item.accountId,
      Buffer.from(item.content),
      item.processingOptions as {
        year?: number;
        useAi?: boolean;
        modelId?: string | null;
      },
      async (pages) => {
        const changed = await prisma.statement.updateMany({
          where,
          data: { pages, stage: "analysing" },
        });
        if (!changed.count)
          throw new HttpError(409, "Processing moved to another worker.");
      },
    );
    await prisma.$transaction(async (tx) => {
      const completed = await tx.statement.updateMany({
        where,
        data: {
          status: "ready",
          stage: "ready",
          pages: result.pages,
          details: json(result.details),
          leaseToken: null,
          leaseUntil: null,
          processingError: null,
        },
      });
      if (!completed.count) return;
      await tx.importBatch.update({
        where: { id: item.importBatchId },
        data: {
          preview: json(result.rows),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof HttpError
        ? error.message
        : "We could not process this PDF. Try again or upload a clearer statement.";
    await prisma.statement.updateMany({
      where,
      data: {
        status: "failed",
        stage: "failed",
        processingError: message,
        leaseToken: null,
        leaseUntil: null,
      },
    });
    if (!(error instanceof HttpError))
      console.error(
        JSON.stringify({
          level: "error",
          event: "statement_processing_failed",
          statementId: job.id,
        }),
      );
  } finally {
    clearInterval(heartbeat);
  }
}
export function startStatementWorker() {
  let stopped = false;
  let busy = false;
  let active: { id: string; token: string } | null = null;
  async function tick() {
    if (stopped || busy) return;
    busy = true;
    try {
      active = await claimStatement();
      if (active && !stopped) await processClaimedStatement(active);
    } catch {
      console.error(
        JSON.stringify({ level: "error", event: "statement_worker_failed" }),
      );
    } finally {
      active = null;
      busy = false;
    }
  }
  const timer = setInterval(() => void tick(), 2000);
  timer.unref();
  void tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    if (active)
      await prisma.statement.updateMany({
        where: { id: active.id, leaseToken: active.token },
        data: {
          status: "queued",
          stage: "queued",
          leaseToken: null,
          leaseUntil: null,
        },
      });
  };
}
