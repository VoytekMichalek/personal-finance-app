import { prisma } from "../../lib/db.js";

export async function pendingStatements() {
  const records = await prisma.statement.findMany({
    where: {
      status: { in: ["ready", "failed"] },
      importBatch: { committedAt: null },
    },
    select: { id: true, accountId: true, filename: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  return records;
}
