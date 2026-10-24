import { createHash } from "node:crypto";
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
export async function retryStatement(id: string) {
  const modelId = (await prisma.setup.findUnique({ where: { id: 1 } }))
    ?.modelId;
  await prisma.$transaction(async (tx) => {
    const item = await tx.statement.findUnique({ where: { id } });
    if (!item) throw new HttpError(404, "Statement not found.");
    if (item.status !== "failed")
      throw new HttpError(
        409,
        "This statement is already processing or ready to review.",
      );
    await validateAccount(tx, item.accountId);
    const options = item.processingOptions as {
      year?: number;
      useAi?: boolean;
    };
    if (options.useAi && !modelId)
      throw new HttpError(400, "Choose an AI model in Settings → AI first.");
    const updated = await tx.statement.updateMany({
      where: { id, status: "failed" },
      data: {
        status: "queued",
        stage: "queued",
        processingError: null,
        leaseToken: null,
        leaseUntil: null,
        processingOptions: { ...options, modelId: modelId ?? null },
      },
    });
    if (!updated.count)
      throw new HttpError(409, "Statement processing has already restarted.");
  });
  return statementPreview(id);
}
