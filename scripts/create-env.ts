import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { hash } from "bcryptjs";
const password = randomBytes(20).toString("base64url");
await writeFile(
  ".env",
  `SESSION_SECRET=${randomBytes(48).toString("hex")}\nADMIN_PASSWORD_HASH='${await hash(password, 12)}'\nPORT=3001\nDATABASE_PATH=data/portal.sqlite\nUPLOAD_DIR=uploads\n`,
  { mode: 0o600, flag: "wx" },
);
await writeFile(".local-admin-password", password + "\n", {
  mode: 0o600,
  flag: "wx",
});
console.log(
  "Local configuration created. Password: .local-admin-password (not tracked by Git).",
);
