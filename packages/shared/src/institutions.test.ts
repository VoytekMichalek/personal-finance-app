import { describe, expect, it } from "vitest";
import {
  accountAppearanceSchema,
  accountBrand,
  matchInstitution,
  type Institution,
} from "./institutions.js";
import { accountSchema } from "./schemas.js";

describe("account branding", () => {
  it("recognises existing bank names without confusing unrelated institutions", () => {
    expect(matchInstitution("  COMMONWEALTH   BANK ")?.id).toBe("cba");
    expect(matchInstitution("BOQ")?.id).toBe("boq");
    expect(matchInstitution("up bank")?.id).toBe("up");
    expect(matchInstitution("My CBA savings club")).toBeUndefined();
    expect(accountBrand({ institution: "CBA", type: "bank" })).toMatchObject({
      color: "#ffcc00",
      logo: "/institutions/cba.svg",
    });
  });
  it("keeps generic accounts usable and renders explicit icons ahead of institution logos", () => {
    expect(accountBrand({ institution: "", type: "cash" })).toMatchObject({
      icon: "banknote",
      logo: null,
    });
    expect(
      accountBrand({
        institution: "Westpac",
        type: "credit",
        appearance: accountAppearanceSchema.parse({
          icon: "piggy-bank",
          color: "#123456",
          tint: false,
        }),
      }),
    ).toMatchObject({
      icon: "piggy-bank",
      logo: null,
      color: "#123456",
      tint: false,
    });
  });
  it("uses saved custom institutions and isolates account overrides", () => {
    const institutions: Institution[] = [
      {
        id: "custom",
        name: "My bank",
        color: "#246810",
        icon: "landmark",
        logoDataUrl: null,
      },
    ];
    const base = {
      institution: "CBA",
      type: "bank",
      customInstitutionId: "custom",
    };
    expect(accountBrand(base, institutions)).toMatchObject({
      name: "My bank",
      color: "#246810",
      logo: null,
    });
    expect(
      accountBrand(
        {
          ...base,
          appearance: accountAppearanceSchema.parse({ color: "#abcdef" }),
        },
        institutions,
      ).color,
    ).toBe("#abcdef");
    expect(accountBrand(base, institutions).color).toBe("#246810");
  });
  it("rejects executable/remote logos, arbitrary CSS and unsupported presets", () => {
    for (const logoDataUrl of [
      "https://example.test/logo.png",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "javascript:alert(1)",
    ])
      expect(accountAppearanceSchema.safeParse({ logoDataUrl }).success).toBe(
        false,
      );
    expect(
      accountAppearanceSchema.safeParse({ color: "url(https://example.test)" })
        .success,
    ).toBe(false);
    expect(
      accountAppearanceSchema.safeParse({
        logoDataUrl: "data:image/png;base64," + "a".repeat(100_000),
      }).success,
    ).toBe(false);
    expect(
      accountSchema.safeParse({
        name: "Test",
        type: "bank",
        institutionPreset: "unknown",
        openingDate: "2026-01-01",
        openingBalanceCents: 100,
      }).success,
    ).toBe(false);
  });
});
