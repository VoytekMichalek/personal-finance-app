import { spawn } from "node:child_process";
const children = ["@finance/api", "@finance/web"].map((name) =>
  spawn("pnpm", ["--filter", name, "dev"], { stdio: "inherit" }),
);
function stop() {
  children.forEach((child) => child.kill("SIGTERM"));
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((child) =>
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  }),
);
