import "dotenv/config";
import { deploymentVersion } from "../contracts/content.js";
import { Store } from "./repository/store.js";
import { createApp } from "./transport/app.js";
const { SESSION_SECRET, ADMIN_PASSWORD_HASH } = process.env;
if (!SESSION_SECRET || SESSION_SECRET.length < 32 || !ADMIN_PASSWORD_HASH)
  throw new Error(
    "Задайте SESSION_SECRET (32+ символа) и ADMIN_PASSWORD_HASH в .env. См. README.",
  );
const store = new Store(process.env.DATABASE_PATH ?? "data/portal.sqlite");
const server = createApp({
  store,
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  sessionSecret: SESSION_SECRET,
  passwordHash: ADMIN_PASSWORD_HASH,
  production: process.env.NODE_ENV === "production",
  deploymentEnabled: process.env.DEPLOYMENT_SCHEDULER_ENABLED === "true",
  currentVersion: process.env.APP_VERSION,
  resolveDeploymentVersion: process.env.UPDATE_RELEASE_VERSION
    ? async () => deploymentVersion.parse(process.env.UPDATE_RELEASE_VERSION)
    : undefined,
}).listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
  console.log("API ready on port", process.env.PORT ?? 3001),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
