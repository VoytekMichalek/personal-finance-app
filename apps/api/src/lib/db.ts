import { PrismaClient, Prisma } from "@prisma/client";
export const prisma = new PrismaClient({ log: [] });
export type DB = PrismaClient | Prisma.TransactionClient;
export async function accessLock(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(87164231)");
}
export function json<T>(value: unknown): T {
  return JSON.parse(
    JSON.stringify(value, (_, v: unknown) => {
      if (typeof v === "bigint") {
        const number = Number(v);
        if (!Number.isSafeInteger(number))
          throw new Error("Stored monetary value exceeds safe range");
        return number;
      }
      return v;
    }),
  ) as T;
}
