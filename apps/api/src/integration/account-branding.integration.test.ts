import "./fixtures.js";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { accountBrand } from "@finance/shared";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { agent, origin, post, put } from "./fixtures.js";

const input = {
  name: "Savings",
  type: "bank",
  institution: "",
  openingDate: "2026-01-01",
  openingBalanceCents: 12345,
};
const logoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9mQAAAAASUVORK5CYII=";

describe("persistent account branding", () => {
  it("accepts an existing account payload with null appearance when correcting its opening date", async () => {
    const created = await post("/accounts", input);
    expect(created.body.appearance).toBeNull();
    const updated = await put("/accounts/" + created.body.id, {
      ...created.body,
      openingDate: "2025-12-01",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.openingDate).toBe("2025-12-01");
    expect(updated.body.openingBalanceCents).toBe(12345);
  });
  it("requires authentication and persists a member's preset and overrides", async () => {
    expect(
      (
        await request(app)
          .post("/api/accounts")
          .set("Origin", origin)
          .send(input)
      ).status,
    ).toBe(401);
    const created = await post("/accounts", {
      ...input,
      institutionPreset: "cba",
      appearance: { color: "#123456", icon: "piggy-bank", tint: false },
    });
    expect(created.status).toBe(201);
    const stored = await prisma.account.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(stored.institution).toBe("CommBank");
    expect(stored.appearance).toMatchObject({
      color: "#123456",
      icon: "piggy-bank",
      tint: false,
    });
    expect(stored.openingBalanceCents).toBe(12345n);
    const edited = await put("/accounts/" + stored.id, {
      ...input,
      name: "Renamed",
      institution: "CommBank",
    });
    expect(edited.status).toBe(200);
    expect(edited.body.appearance).toEqual(created.body.appearance);
    expect(edited.body.institutionPreset).toBe("cba");
  });
  it("saves reusable custom branding atomically and keeps overrides local to one account", async () => {
    const created = await post("/accounts", {
      ...input,
      institution: "Community credit union",
      saveInstitution: true,
      appearance: { color: "#006633", icon: "landmark", logoDataUrl },
    });
    expect(created.status).toBe(201);
    expect(created.body.customInstitutionId).toBeTruthy();
    const another = await post("/accounts", {
      ...input,
      name: "Everyday",
      customInstitutionId: created.body.customInstitutionId,
    });
    expect(another.status).toBe(201);
    expect(
      (
        await put("/accounts/" + created.body.id, {
          ...input,
          customInstitutionId: created.body.customInstitutionId,
          appearance: { color: "#663399" },
        })
      ).status,
    ).toBe(200);
    const snapshot = (await agent()).body;
    expect(snapshot.institutions).toHaveLength(1);
    expect(
      accountBrand(
        snapshot.accounts.find((a: { id: string }) => a.id === created.body.id),
        snapshot.institutions,
      ),
    ).toMatchObject({ color: "#663399", logo: logoDataUrl });
    expect(
      accountBrand(
        snapshot.accounts.find((a: { id: string }) => a.id === another.body.id),
        snapshot.institutions,
      ),
    ).toMatchObject({ color: "#006633", logo: logoDataUrl });
    expect(
      (
        await post("/accounts", {
          ...input,
          institution: "COMMUNITY  CREDIT UNION",
          saveInstitution: true,
        })
      ).status,
    ).toBe(409);
    expect(await prisma.account.count()).toBe(2);
  });
  it("rejects invalid institution links, fake logos and oversized image dimensions without saving records", async () => {
    const png = Buffer.from(logoDataUrl.split(",")[1]!, "base64");
    png.writeUInt32BE(100000, 16);
    for (const extra of [
      { customInstitutionId: randomUUID() },
      { institutionPreset: "cba", customInstitutionId: randomUUID() },
      {
        appearance: {
          logoDataUrl:
            "data:image/png;base64," +
            Buffer.from("not an image").toString("base64"),
        },
      },
      {
        appearance: {
          logoDataUrl: "data:image/png;base64," + png.toString("base64"),
        },
      },
      { saveInstitution: true, institution: "CBA" },
      {
        saveInstitution: true,
        institution: "New bank",
        openingDate: "2999-01-01",
      },
    ])
      expect((await post("/accounts", { ...input, ...extra })).status).toBe(
        400,
      );
    expect(await prisma.account.count()).toBe(0);
    expect(await prisma.institution.count()).toBe(0);
  });
});
