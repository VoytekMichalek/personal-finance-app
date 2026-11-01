import { assetSchema } from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateOwner } from "./service.js";

export async function saveAsset(body: unknown, id?: string) {
  const input = assetSchema.parse(body);
  return prisma.$transaction(async (tx) => {
    await validateOwner(tx, input.owner);
    const ledger = { name: input.name, type: input.kind, owner: input.owner };
    if (!id)
      return tx.asset.create({
        data: {
          ...input,
          account: {
            create: {
              ...ledger,
              openingDate: "0001-01-01",
              openingBalanceCents: 0n,
            },
          },
        },
      });
    const asset = await tx.asset.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!asset)
      throw new HttpError(
        404,
        "Asset not found. Return to Assets & Liabilities and choose an existing item.",
      );
    if (
      asset.kind !== input.kind &&
      asset.account &&
      (await tx.transaction.count({ where: { accountId: asset.account.id } }))
    )
      throw new HttpError(
        409,
        "This item already has transactions. Keep its current type, or create a separate asset or liability to preserve its history.",
      );
    return tx.asset.update({
      where: { id },
      data: {
        ...input,
        account: { update: ledger },
      },
    });
  });
}
