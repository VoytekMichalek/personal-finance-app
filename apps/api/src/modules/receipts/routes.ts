import { Router } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { storage } from "../../integrations/storage.js";
export const receiptRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});
const publicFields = {
  id: true,
  transactionId: true,
  filename: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;
receiptRouter.get("/transactions/:id/receipts", async (req, res) =>
  res.json(
    await prisma.receipt.findMany({
      where: { transactionId: z.uuid().parse(req.params.id) },
      select: publicFields,
      orderBy: { createdAt: "asc" },
    }),
  ),
);
receiptRouter.post(
  "/transactions/:id/receipts",
  upload.single("file"),
  async (req, res) => {
    const transactionId = z.uuid().parse(req.params.id);
    if (
      !(await prisma.transaction.findUnique({ where: { id: transactionId } }))
    )
      throw new HttpError(404, "Transaction not found.");
    if (!req.file) throw new HttpError(400, "Choose a receipt to upload.");
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (
      !detected ||
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        detected.mime,
      )
    )
      throw new HttpError(400, "Upload a JPEG, PNG, WebP image or PDF.");
    const objectKey = "receipts/" + randomUUID();
    await storage.put(objectKey, req.file.buffer, detected.mime);
    try {
      res.status(201).json(
        await prisma.receipt.create({
          data: {
            transactionId,
            objectKey,
            filename: req.file.originalname
              .replace(/[\r\n"\\/]/g, "_")
              .slice(0, 200),
            mimeType: detected.mime,
            size: req.file.size,
          },
          select: publicFields,
        }),
      );
    } catch (error) {
      try {
        await storage.remove(objectKey);
      } catch {
        console.error(
          JSON.stringify({
            level: "error",
            event: "receipt_cleanup_required",
            objectKey,
          }),
        );
      }
      throw error;
    }
  },
);
receiptRouter.get("/receipts/:id/content", async (req, res) => {
  const receipt = await prisma.receipt.findUnique({
    where: { id: z.uuid().parse(req.params.id) },
  });
  if (!receipt) throw new HttpError(404, "Receipt not found.");
  const object = await storage.get(receipt.objectKey);
  if (!object.Body)
    throw new HttpError(502, "Receipt is temporarily unavailable.");
  res.set({
    "Content-Type": receipt.mimeType,
    "Content-Disposition":
      (req.query.download ? "attachment" : "inline") +
      '; filename="' +
      receipt.filename +
      '"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(Buffer.from(await object.Body.transformToByteArray()));
});
receiptRouter.delete("/receipts/:id", async (req, res) => {
  const receipt = await prisma.receipt.findUnique({
    where: { id: z.uuid().parse(req.params.id) },
  });
  if (!receipt) throw new HttpError(404, "Receipt not found.");
  await storage.remove(receipt.objectKey);
  await prisma.receipt.delete({ where: { id: receipt.id } });
  res.json({ ok: true });
});
