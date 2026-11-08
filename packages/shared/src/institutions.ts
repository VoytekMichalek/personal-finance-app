import { z } from "zod";

export const institutionPresets = [
  {
    id: "anz",
    name: "ANZ",
    color: "#007dba",
    logo: "anz.png",
    aliases: ["anz", "anz bank", "australia and new zealand banking group"],
  },
  {
    id: "cba",
    name: "CommBank",
    color: "#ffcc00",
    logo: "cba.svg",
    aliases: [
      "cba",
      "commonwealth bank",
      "commonwealth bank of australia",
      "commbank",
    ],
  },
  {
    id: "boq",
    name: "BOQ",
    color: "#0075ad",
    logo: "boq.png",
    aliases: ["boq", "bank of queensland", "bank of queensland limited"],
  },
  {
    id: "hsbc",
    name: "HSBC",
    color: "#db0011",
    logo: "hsbc.svg",
    aliases: ["hsbc", "hsbc australia", "hsbc bank australia"],
  },
  {
    id: "ing",
    name: "ING",
    color: "#ff6200",
    logo: "ing.png",
    aliases: ["ing", "ing bank", "ing australia"],
  },
  {
    id: "macquarie",
    name: "Macquarie",
    color: "#59616b",
    logo: "macquarie.svg",
    aliases: ["macquarie", "macquarie bank", "macquarie bank limited"],
  },
  {
    id: "nab",
    name: "NAB",
    color: "#c20000",
    logo: "nab.png",
    aliases: ["nab", "national australia bank"],
  },
  {
    id: "up",
    name: "Up",
    color: "#ff6b57",
    logo: "up.png",
    aliases: ["up", "up bank", "up banking"],
  },
  {
    id: "westpac",
    name: "Westpac",
    color: "#d50032",
    logo: "westpac.png",
    aliases: ["westpac", "westpac banking corporation"],
  },
] as const;

export const accountIcons = [
  "landmark",
  "wallet",
  "banknote",
  "piggy-bank",
  "credit-card",
] as const;
export const brandColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Choose a six-digit colour, such as #FFCC00.");
export const logoDataSchema = z
  .string()
  .max(100_000, "Choose a smaller logo.")
  .regex(
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/,
    "Upload a PNG, JPEG or WebP logo using the logo picker.",
  );
export const accountAppearanceSchema = z.object({
  color: brandColorSchema.nullable().default(null),
  icon: z.enum(accountIcons).nullable().default(null),
  logoDataUrl: logoDataSchema.nullable().default(null),
  tint: z.boolean().default(true),
});
export type AccountAppearance = z.infer<typeof accountAppearanceSchema>;
export type Institution = {
  id: string;
  name: string;
  color: string;
  icon: (typeof accountIcons)[number];
  logoDataUrl: string | null;
};
export type BrandAccount = {
  institution: string;
  institutionPreset?: string | null;
  customInstitutionId?: string | null;
  appearance?: AccountAppearance | null;
  type: string;
};
export function matchInstitution(name: string) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return institutionPresets.find((p) =>
    p.aliases.some((alias) => alias === normalized),
  );
}
export function accountBrand(
  account: BrandAccount,
  institutions: Institution[] = [],
) {
  const custom = institutions.find((i) => i.id === account.customInstitutionId);
  const preset =
    !account.customInstitutionId &&
    (institutionPresets.find((p) => p.id === account.institutionPreset) ??
      matchInstitution(account.institution));
  const appearance = accountAppearanceSchema.parse(account.appearance ?? {});
  const icon =
    appearance.icon ??
    custom?.icon ??
    (account.type === "credit"
      ? "credit-card"
      : account.type === "cash"
        ? "banknote"
        : "wallet");
  return {
    name: custom?.name ?? (preset ? preset.name : account.institution),
    color:
      appearance.color ?? custom?.color ?? (preset ? preset.color : "#64748b"),
    icon,
    logo:
      appearance.logoDataUrl ??
      (appearance.icon
        ? null
        : (custom?.logoDataUrl ??
          (preset ? `/institutions/${preset.logo}` : null))),
    tint: appearance.tint,
  };
}
