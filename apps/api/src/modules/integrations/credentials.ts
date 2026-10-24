import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { config } from "../../lib/config.js";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
// Domain-separated encryption key: no extra operator configuration is needed.
const encryptionKey = () =>
  Buffer.from(
    hkdfSync(
      "sha256",
      config.BETTER_AUTH_SECRET,
      "personal-finance",
      "openrouter-credentials-v1",
      32,
    ),
  );
export function encryptKey(value: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}
export function decryptKey(value: string) {
  try {
    const [version, nonce, tag, encrypted] = value.split(":");
    if (version !== "v1" || !nonce || !tag || !encrypted) throw new Error();
    const cipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(nonce, "base64"),
    );
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      cipher.update(Buffer.from(encrypted, "base64")),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    throw new HttpError(
      503,
      "Re-enter your OpenRouter API key in Settings → AI.",
    );
  }
}
export async function getOpenRouterKey() {
  const setup = await prisma.setup.findUnique({
    where: { id: 1 },
    select: { openrouterKeyEncrypted: true },
  });
  return setup?.openrouterKeyEncrypted
    ? decryptKey(setup.openrouterKeyEncrypted)
    : config.OPENROUTER_API_KEY;
}
