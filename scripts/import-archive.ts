import { readFile } from "node:fs/promises";
import archive from "../content/archive.json";
import { contentSchema } from "../contracts/content";
// Deliberately local: importing a production archive is a separate deployment step.
const base = "http://127.0.0.1:3001";
let cookie = "";
async function call(path: string, options: RequestInit = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { ...options.headers, cookie },
    signal: AbortSignal.timeout(30000),
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!response.ok)
    throw new Error(`Archive import ${path}: ${response.status}`);
  return response.json();
}
let session = await call("/api/session");
session = await call("/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-csrf-token": session.csrf },
  body: JSON.stringify({
    password: (await readFile(".local-admin-password", "utf8")).trim(),
  }),
});
try {
  const current = contentSchema.parse(await call("/api/admin/content"));
  for (const entry of [...archive].reverse()) {
    if (current.media.some((m) => m.description.includes(entry.sourceUrl))) {
      console.log(`Already imported: ${entry.key}`);
      continue;
    }
    const body = new FormData();
    body.set("title", entry.title);
    body.set("description", entry.description);
    body.set("published", "true");
    body.set(
      "file",
      new Blob([await readFile(`content/media/${entry.file}`)], {
        type: entry.file.endsWith(".webp") ? "image/webp" : "image/jpeg",
      }),
      entry.file,
    );
    await call("/api/admin/media", {
      method: "POST",
      headers: { "x-csrf-token": session.csrf },
      body,
    });
    console.log(`Imported: ${entry.key}`);
  }
} finally {
  await call("/api/logout", {
    method: "POST",
    headers: { "x-csrf-token": session.csrf },
  });
}
