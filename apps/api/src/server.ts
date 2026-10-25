import { app } from "./app.js";
import { prisma } from "./lib/db.js";
import { config } from "./lib/config.js";
import { toggleDiagnostics } from "./lib/diagnostics.js";
import { startStatementWorker } from "./modules/statements/worker.js";
await prisma.$connect();
const setup = await prisma.setup.upsert({
  where: { id: 1 },
  create: { id: 1 },
  update: {},
});
if (!setup.completedAt && !config.FIRST_USER_TOKEN)
  throw new Error("FIRST_USER_TOKEN is required until setup completes.");
const server = app.listen(3000, "0.0.0.0", () =>
  console.info(
    JSON.stringify({ level: "info", event: "server_ready", port: 3000 }),
  ),
);
const stopWorker = startStatementWorker();
process.on("SIGUSR2", toggleDiagnostics);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      void stopWorker()
        .finally(() => prisma.$disconnect())
        .finally(() => process.exit(0));
    });
  });
