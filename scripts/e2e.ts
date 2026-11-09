import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash } from "bcryptjs";
const dir = await mkdtemp(join(tmpdir(), "sever-e2e-"));
const env = {
  ...process.env,
  NODE_ENV: "test",
  PORT: "3002",
  DATABASE_PATH: join(dir, "db.sqlite"),
  UPLOAD_DIR: join(dir, "uploads"),
  UPDATE_RELEASE_VERSION: "1.2.3",
  SESSION_SECRET: "test-only-session-secret-with-32-characters",
  ADMIN_PASSWORD_HASH: await hash("e2e-password", 4),
  API_TARGET: "http://127.0.0.1:3002",
};
const api = spawn("node", ["--import", "tsx", "server/start.ts"], {
  env,
  stdio: "inherit",
});
const web = spawn(
  "node",
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5180",
    "--strictPort",
  ],
  { env, stdio: "inherit" },
);
try {
  for (const url of [
    "http://127.0.0.1:3002/api/health",
    "http://127.0.0.1:5180",
  ]) {
    const end = Date.now() + 30000;
    while (true) {
      try {
        if ((await fetch(url)).ok) break;
      } catch {}
      if (Date.now() > end) throw new Error(`Readiness timeout: ${url}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  const code = await new Promise<number>((resolve, reject) => {
    const runner = spawn(
      "node",
      ["node_modules/cypress/bin/cypress", "run", ...process.argv.slice(2)],
      {
        env,
        stdio: "inherit",
      },
    );
    runner.on("error", reject);
    runner.on("exit", (c) => resolve(c ?? 1));
  });
  process.exitCode = code;
} finally {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 400));
  await rm(dir, { recursive: true, force: true });
}
