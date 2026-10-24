import { prisma, accessLock } from "./lib/db.js";
import { config } from "./lib/config.js";
import { newGrant } from "./modules/access/grants.js";
const [email, confirmation] = process.argv.slice(2);
if (!email || confirmation !== "--confirm-revoke-access")
  throw new Error(
    "Usage: recover-access EMAIL --confirm-revoke-access. This revokes existing credentials.",
  );
try {
  const result = await prisma.$transaction(async (tx) => {
    await accessLock(tx);
    const user = await tx.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || user.state === "deleted")
      throw new Error("Existing household identity required");
    if (!(await tx.setup.findUnique({ where: { id: 1 } }))?.completedAt)
      throw new Error("Complete initial setup first");
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.passkey.deleteMany({ where: { userId: user.id } });
    await tx.registrationGrant.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { state: "recovering" },
    });
    const grant = await newGrant(tx, user.id, "invite", 1);
    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "operator.recover",
        subjectId: user.id,
      },
    });
    return config.BETTER_AUTH_URL + "/enrol#" + grant.token;
  });
  console.log(result);
} finally {
  await prisma.$disconnect();
}
