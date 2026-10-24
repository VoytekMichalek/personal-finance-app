import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { statementUploadSchema } from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { statementPreview, commitStatement } from "./service.js";
import { savedRecurring, acceptSavedRecurring } from "./recurring.js";
import { uploadStatement, retryStatement } from "./queue.js";
export const statementRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});
statementRouter.get("/accounts/:id/statements", async (req, res) => {
  const records = await prisma.statement.findMany({
    where: { accountId: z.uuid().parse(req.params.id) },
    select: {
      id: true,
      filename: true,
      pages: true,
      status: true,
      stage: true,
      processingError: true,
      createdAt: true,
      importBatch: { select: { committedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    records.map(({ importBatch, processingError, ...r }) => ({
      error: processingError,
      ...r,
      committedAt: importBatch.committedAt,
    })),
  );
});
statementRouter.post("/statements", upload.single("file"), async (req, res) => {
  const input = statementUploadSchema.parse(req.body);
  if (!req.file) throw new HttpError(400, "Choose a PDF statement.");
  res
    .status(202)
    .json(
      await uploadStatement(input.accountId, req.file, input.year, input.useAi),
    );
});
statementRouter.get("/statements/:id", async (req, res) =>
  res.json(await statementPreview(z.uuid().parse(req.params.id))),
);
statementRouter.post("/statements/:id/retry", async (req, res) =>
  res.status(202).json(await retryStatement(z.uuid().parse(req.params.id))),
);
statementRouter.post("/statements/:id/commit", async (req, res) =>
  res.json(await commitStatement(z.uuid().parse(req.params.id), req.body)),
);
statementRouter.get("/statements/:id/recurring", async (req, res) =>
  res.json(await savedRecurring(z.uuid().parse(req.params.id))),
);
statementRouter.post("/statements/:id/recurring", async (req, res) =>
  res.json(await acceptSavedRecurring(z.uuid().parse(req.params.id), req.body)),
);
statementRouter.get("/statements/:id/file", async (req, res) => {
  const file = await prisma.statement.findUnique({
    where: { id: z.uuid().parse(req.params.id) },
    select: { content: true, filename: true },
  });
  if (!file) throw new HttpError(404, "Statement not found.");
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    "X-Content-Type-Options": "nosniff",
  });
  res.send(Buffer.from(file.content));
});
