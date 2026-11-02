import { spawnSync } from "node:child_process";
import {
  demoEnvironment,
  demoDatabase,
  PrismaClient,
} from "./demo-environment.mjs";
import { seedDemo } from "./seed-demo.mjs";
const { source, target, env } = demoEnvironment();
const adminUrl = new URL(source);
adminUrl.pathname = "/postgres";
const admin = new PrismaClient({
  datasources: { db: { url: adminUrl.toString() } },
});
try {
  const found = await admin.$queryRawUnsafe(
    "SELECT datname FROM pg_database WHERE datname=$1",
    demoDatabase,
  );
  if (!found.length)
    await admin.$executeRawUnsafe('CREATE DATABASE "finance_demo"');
} finally {
  await admin.$disconnect();
}
const migrated = spawnSync("pnpm", ["db:migrate:deploy"], {
  env,
  stdio: "inherit",
});
if (migrated.status) throw new Error("Demo migration failed.");
const regular = new PrismaClient({
  datasources: { db: { url: source.toString() } },
});
const demo = new PrismaClient({
  datasources: { db: { url: target.toString() } },
});
try {
  if (await demo.account.count()) {
    console.log(
      "Demo already contains data; nothing was overwritten. Start with pnpm dev:demo.",
    );
  } else {
    // Keep sign-in working at the same localhost origin without exposing any
    // credentials or bringing household transactions into the demo database.
    const users = await regular.user.findMany();
    if (!users.some((user) => user.state === "active" && user.role === "admin"))
      throw new Error(
        "Set up an admin in the regular local app before preparing the demo.",
      );
    const passkeys = await regular.passkey.findMany();
    const sessions = await regular.session.findMany({
      where: { expiresAt: { gt: new Date() } },
    });
    await demo.$transaction(
      async (tx) => {
        await tx.user.createMany({ data: users, skipDuplicates: true });
        await tx.passkey.createMany({ data: passkeys, skipDuplicates: true });
        await tx.session.createMany({ data: sessions, skipDuplicates: true });
        await tx.setup.upsert({
          where: { id: 1 },
          create: { id: 1, completedAt: new Date() },
          update: { completedAt: new Date() },
        });
        await seedDemo(tx, users);
      },
      { timeout: 30000 },
    );
    console.log(
      `Prepared a separate demo: ${await demo.transaction.count()} transactions, ${await demo.budget.count()} plans, ${await demo.schedule.count()} schedules. Regular household data was not changed.`,
    );
  }
} finally {
  await regular.$disconnect();
  await demo.$disconnect();
}
