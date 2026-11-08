import { Prisma } from "@prisma/client";
import { fileTypeFromBuffer } from "file-type";
import {
  accountAppearanceSchema,
  accountSchema,
  institutionPresets,
  matchInstitution,
  today,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateOwner } from "./service.js";

async function validateLogo(value: string | null | undefined) {
  if (!value) return;
  const bytes = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
  const type = await fileTypeFromBuffer(bytes).catch(() => undefined);
  if (
    type?.mime !== "image/png" ||
    bytes.length < 33 ||
    bytes.toString("ascii", 12, 16) !== "IHDR" ||
    bytes.readUInt32BE(16) < 1 ||
    bytes.readUInt32BE(20) < 1 ||
    bytes.readUInt32BE(16) > 128 ||
    bytes.readUInt32BE(20) > 128
  ) {
    throw new HttpError(
      400,
      "The logo could not be read. Remove it or choose another PNG, JPEG or WebP using the logo picker.",
    );
  }
}

export async function saveAccount(body: unknown, id?: string) {
  const {
    saveInstitution,
    appearance: suppliedAppearance,
    ...input
  } = accountSchema.parse(body);
  await validateLogo(suppliedAppearance?.logoDataUrl);
  if (input.openingDate > today())
    throw new HttpError(400, "Choose today or an earlier opening date.");
  try {
    return await prisma.$transaction(async (tx) => {
      const current = id
        ? await tx.account.findUnique({ where: { id } })
        : null;
      if (id && !current)
        throw new HttpError(
          404,
          "Account not found. Return to Accounts and choose an existing account.",
        );
      if (current?.assetId)
        throw new HttpError(
          400,
          "Edit this item's details and valuations in Assets & Liabilities.",
        );
      await validateOwner(tx, input.owner);
      if (
        id &&
        (await tx.transaction.findFirst({
          where: { accountId: id, date: { lt: input.openingDate } },
        }))
      )
        throw new HttpError(
          409,
          "Opening date would exclude existing transactions. Choose an earlier opening date and save again.",
        );
      let institutionPreset =
        input.institutionPreset === undefined
          ? (current?.institutionPreset ?? null)
          : input.institutionPreset;
      let customInstitutionId =
        input.customInstitutionId === undefined
          ? (current?.customInstitutionId ?? null)
          : input.customInstitutionId;
      let institution = input.institution;
      let appearance =
        suppliedAppearance === null
          ? accountAppearanceSchema.parse({})
          : suppliedAppearance;
      if (institutionPreset && customInstitutionId)
        throw new HttpError(400, "Choose one institution and save again.");
      if (saveInstitution) {
        if (
          institutionPreset ||
          customInstitutionId ||
          matchInstitution(institution)
        )
          throw new HttpError(
            400,
            "Choose the existing institution, or enter a different name for your custom institution.",
          );
        if (!institution)
          throw new HttpError(
            400,
            "Enter an institution name before saving reusable branding.",
          );
        const brand = accountAppearanceSchema.parse(
          appearance ?? current?.appearance ?? {},
        );
        const saved = await tx.institution.create({
          data: {
            name: institution,
            nameKey: institution.toLowerCase().replace(/\s+/g, " "),
            color: brand.color ?? "#64748b",
            icon:
              brand.icon ??
              (input.type === "credit"
                ? "credit-card"
                : input.type === "cash"
                  ? "banknote"
                  : "wallet"),
            logoDataUrl: brand.logoDataUrl,
          },
        });
        customInstitutionId = saved.id;
        institutionPreset = null;
        appearance = accountAppearanceSchema.parse({ tint: brand.tint });
      } else if (customInstitutionId) {
        const saved = await tx.institution.findUnique({
          where: { id: customInstitutionId },
        });
        if (!saved)
          throw new HttpError(
            400,
            "This institution is no longer available. Choose another institution and save again.",
          );
        institution = saved.name;
      } else if (institutionPreset) {
        institution = institutionPresets.find(
          (p) => p.id === institutionPreset,
        )!.name;
      }
      const data = {
        ...input,
        institution,
        institutionPreset,
        customInstitutionId,
        ...(appearance ? { appearance } : {}),
        openingBalanceCents: BigInt(input.openingBalanceCents),
      };
      return json(
        id
          ? await tx.account.update({ where: { id }, data })
          : await tx.account.create({ data }),
      );
    });
  } catch (error) {
    if (
      saveInstitution &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new HttpError(
        409,
        "An institution with this name already exists. Choose it in the institution picker or enter a different name.",
      );
    throw error;
  }
}
