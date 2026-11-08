import { z } from "zod";
import { contentSchema } from "../../../contracts/content";
export { default as divisions } from "./divisions.json";
export async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(path, options);
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body === "object" && body && "error" in body
        ? String(body.error)
        : "Не удалось загрузить данные.",
    );
  return body;
}
export async function loadContent(admin = false) {
  return contentSchema.parse(
    await request(admin ? "/api/admin/content" : "/api/content"),
  );
}
const sessionSchema = z.object({ admin: z.boolean(), csrf: z.string() });
export type Session = z.infer<typeof sessionSchema>;
export function parseSession(value: unknown) {
  return sessionSchema.parse(value);
}
export async function loadSession(): Promise<Session> {
  return parseSession(await request("/api/session"));
}
export function send(
  path: string,
  method: string,
  body: unknown,
  csrf: string,
) {
  return request(path, {
    method,
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
}
