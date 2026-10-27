import { createHash } from "node:crypto";
import { statementRetrySchema } from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateAccount } from "../finance/service.js";
import { statementPreview } from "./service.js";
export async function uploadStatement(
  accountId: string,
  file: Express.Multer.File,
  year?: number,
  useAi = false,
) {
  if (!file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new HttpError(400, "Choose a valid PDF statement.");
  const hash = createHash("sha256").update(file.buffer).digest("hex");
  const modelId = (await prisma.setup.findUnique({ where: { id: 1 } }))
    ?.modelId;
  if (useAi && !modelId)
    throw new HttpError(400, "Choose an AI model in Settings → AI first.");
  const id = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      accountId,
    );
    await validateAccount(tx, accountId);
    const previous = await tx.statement.findFirst({
      where: { accountId, importBatch: { fileHash: hash } },
      select: { id: true },
    });
    if (previous) return previous.id;
    const item = await tx.statement.create({
      data: {
        account: { connect: { id: accountId } },
        filename: file.originalname.replace(/[^\w .()-]/g, "_").slice(0, 180),
        content: new Uint8Array(file.buffer),
        pages: 0,
        details: {},
        status: "queued",
        stage: "queued",
        processingOptions: {
          ...(year ? { year } : {}),
          useAi,
          modelId: modelId ?? null,
        },
        importBatch: {
          create: {
            accountId,
            fileHash: hash,
            mapping: {},
            preview: [],
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
        },
      },
      select: { id: true },
    });
    return item.id;
  });
  return statementPreview(id);
}
export async function retryStatement(id: string, body: unknown = {}) {
  const input = statementRetrySchema.parse(body);
  const modelId = (await prisma.setup.findUnique({ where: { id: 1 } }))
    ?.modelId;
  await prisma.$transaction(async (tx) => {
    const saved = await tx.statement.findUnique({
      where: { id },
      select: { accountId: true },
    });
    if (!saved) throw new HttpError(404, "Statement not found.");
    // Share the import account lock with commit: a ready review may be reread
    // or committed, but must never be both requeued and posted concurrently.
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      saved.accountId,
    );
    const item = await tx.statement.findUniqueOrThrow({
      where: { id },
      include: { importBatch: { select: { committedAt: true } } },
    });
    if (item.importBatch.committedAt)
      throw new HttpError(
        409,
        "This statement has already been imported and cannot be read again.",
      );
    if (item.status !== "failed" && item.status !== "ready")
      throw new HttpError(409, "This statement is already processing.");
    if (item.status === "ready" && !input.discardReview)
      throw new HttpError(
        400,
        "Confirm that the current review can be discarded before reading this statement again.",
      );
    await validateAccount(tx, item.accountId);
    const options = item.processingOptions as {
      year?: number;
      useAi?: boolean;
    };
    if (options.useAi && !modelId)
      throw new HttpError(400, "Choose an AI model in Settings → AI first.");
    const updated = await tx.statement.updateMany({
      where: { id, status: item.status, importBatch: { committedAt: null } },
      data: {
        status: "queued",
        stage: "queued",
        pages: 0,
        details: {},
        processingError: null,
        leaseToken: null,
        leaseUntil: null,
        processingOptions: { ...options, modelId: modelId ?? null },
      },
    });
    if (!updated.count)
      throw new HttpError(409, "Statement processing has already restarted.");
    await tx.importBatch.update({
      where: { id: item.importBatchId },
      data: { preview: [], expiresAt: new Date(Date.now() + 7 * 86400000) },
    });
  });
  return statementPreview(id);
}
