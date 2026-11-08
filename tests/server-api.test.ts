import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import supertest from "supertest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash } from "bcryptjs";
import { Store } from "../server/repository/store";
import { createApp } from "../server/transport/app";
import { identifyMedia } from "../server/domain/media-file";
import { SqliteSessions } from "../server/repository/session-store";
let dir: string,
  store: Store,
  agent: ReturnType<typeof supertest.agent>,
  csrf: string;
const event = {
  title: "Открытая встреча",
  city: "Москва",
  description: "Описание события",
  startsAt: "2026-11-20T18:00:00+03:00",
  published: false,
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
  "base64",
);
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sever-test-"));
  store = new Store(join(dir, "test.sqlite"));
  agent = supertest.agent(
    createApp({
      store,
      uploadDir: join(dir, "uploads"),
      sessionSecret: "test-secret-only-32-characters-long",
      passwordHash: await hash("test-password", 4),
    }),
  );
  csrf = (await agent.get("/api/session")).body.csrf;
});
afterEach(async () => {
  store.close();
  await rm(dir, { recursive: true, force: true });
});
async function login() {
  const r = await agent
    .post("/api/login")
    .set("x-csrf-token", csrf)
    .send({ password: "test-password" });
  expect(r.status).toBe(200);
  csrf = r.body.csrf;
}
async function upload(published = false) {
  return agent
    .post("/api/admin/media")
    .set("x-csrf-token", csrf)
    .field("title", "Фото события")
    .field("description", "Тестовое фото")
    .field("published", String(published))
    .attach("file", png, "one.png");
}
describe("API and storage", () => {
  it("health, session, CSRF, authentication, login rotation, logout", async () => {
    expect((await agent.get("/api/health")).status).toBe(200);
    expect((await agent.get("/api/content")).body).toEqual({
      events: [],
      media: [],
    });
    expect((await agent.get("/api/session")).body.admin).toBe(false);
    expect(
      (await agent.post("/api/login").send({ password: "test-password" }))
        .status,
    ).toBe(403);
    expect((await agent.get("/api/admin/content")).status).toBe(401);
    expect(
      (
        await agent
          .post("/api/login")
          .set("x-csrf-token", csrf)
          .send({ password: "wrong" })
      ).status,
    ).toBe(401);
    expect(
      (
        await agent
          .post("/api/login")
          .set("x-csrf-token", csrf)
          .send({ password: 3 })
      ).status,
    ).toBe(401);
    await login();
    expect((await agent.get("/api/session")).body.admin).toBe(true);
    expect((await agent.get("/api/admin/content")).status).toBe(200);
    expect(
      (await agent.post("/api/logout").set("x-csrf-token", csrf)).status,
    ).toBe(200);
    expect((await agent.get("/api/admin/content")).status).toBe(401);
  });
  it("validates and persists events, keeps drafts private, updates and deletes", async () => {
    await login();
    expect(
      (
        await agent
          .post("/api/admin/events")
          .set("x-csrf-token", csrf)
          .send({ ...event, title: "x" })
      ).status,
    ).toBe(400);
    const r = await agent
      .post("/api/admin/events")
      .set("x-csrf-token", csrf)
      .send(event);
    expect(r.status).toBe(201);
    const id = r.body.id;
    expect((await agent.get("/api/content")).body.events).toHaveLength(0);
    expect(
      (await agent.get("/api/admin/content")).body.events[0].published,
    ).toBe(false);
    expect(
      (
        await agent
          .put(`/api/admin/events/${id}`)
          .set("x-csrf-token", csrf)
          .send({ ...event, published: true })
      ).status,
    ).toBe(200);
    expect((await agent.get("/api/content")).body.events[0]).toMatchObject({
      title: event.title,
      published: true,
      startsAt: "2026-11-20T15:00:00.000Z",
    });
    expect(
      (
        await agent
          .put("/api/admin/events/missing")
          .set("x-csrf-token", csrf)
          .send(event)
      ).status,
    ).toBe(404);
    expect(
      (await agent.delete(`/api/admin/events/${id}`).set("x-csrf-token", csrf))
        .status,
    ).toBe(200);
    expect(
      (await agent.delete(`/api/admin/events/${id}`).set("x-csrf-token", csrf))
        .status,
    ).toBe(404);
  });
  it("uploads media, hides unpublished files, publishes, edits and removes", async () => {
    await login();
    const r = await upload();
    expect(r.status).toBe(201);
    let item = store.list(true).media[0];
    expect(
      (
        await supertest(
          createApp({
            store,
            uploadDir: join(dir, "uploads"),
            sessionSecret: "another-32-character-secret-long",
            passwordHash: "unused",
          }),
        ).get(item.url)
      ).status,
    ).toBe(404);
    expect((await agent.get(item.url)).status).toBe(200);
    expect((await agent.get("/uploads/missing.png")).status).toBe(404);
    expect(
      (
        await agent
          .put(`/api/admin/media/${item.id}`)
          .set("x-csrf-token", csrf)
          .send({
            title: "Новый заголовок",
            description: "Изменено",
            published: true,
          })
      ).status,
    ).toBe(200);
    item = store.list().media[0];
    expect(item.title).toBe("Новый заголовок");
    expect((await agent.get(item.url)).status).toBe(200);
    expect(
      (
        await agent
          .put("/api/admin/media/missing")
          .set("x-csrf-token", csrf)
          .send({ title: "Фото", description: "", published: false })
      ).status,
    ).toBe(404);
    expect(
      (
        await agent
          .delete(`/api/admin/media/${item.id}`)
          .set("x-csrf-token", csrf)
      ).status,
    ).toBe(200);
    expect((await agent.get(item.url)).status).toBe(404);
    expect(
      (await agent.delete("/api/admin/media/missing").set("x-csrf-token", csrf))
        .status,
    ).toBe(404);
  });
  it("rejects unsupported, missing, oversized and malformed uploads", async () => {
    await login();
    expect(
      (
        await agent
          .post("/api/admin/media")
          .set("x-csrf-token", csrf)
          .field("title", "Файл")
          .field("description", "")
          .attach("file", Buffer.from("<svg/>"), "image.png")
      ).status,
    ).toBe(400);
    expect(
      (
        await agent
          .post("/api/admin/media")
          .set("x-csrf-token", csrf)
          .field("title", "Файл")
          .field("description", "")
      ).status,
    ).toBe(400);
    expect(
      (
        await agent
          .post("/api/admin/media")
          .set("x-csrf-token", csrf)
          .field("title", "Файл")
          .field("description", "")
          .attach("file", Buffer.alloc(30 * 1024 * 1024 + 1), "large.png")
      ).status,
    ).toBe(400);
    expect(
      (
        await agent
          .post("/api/admin/events")
          .set("x-csrf-token", csrf)
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    expect((await agent.get("/api/unknown")).status).toBe(404);
  });
  it("rolls back uploaded file when database write fails and maps server errors", async () => {
    await login();
    vi.spyOn(store, "addMedia").mockImplementation(() => {
      throw new Error("DB failed");
    });
    expect((await upload()).status).toBe(500);
    await expect(
      (await import("node:fs/promises")).readdir(join(dir, "uploads")),
    ).resolves.toEqual([]);
  });
  it("handles filesystem failure and missing file cleanup", async () => {
    await login();
    await writeFile(join(dir, "uploads"), "blocking file");
    expect((await upload()).status).toBe(500);
    await rm(join(dir, "uploads"));
    const r = await upload(true);
    const item = store.list().media.find((m) => m.id === r.body.id)!;
    await rm(join(dir, "uploads", item.url.split("/").pop()!));
    expect(
      (
        await agent
          .delete(`/api/admin/media/${item.id}`)
          .set("x-csrf-token", csrf)
      ).status,
    ).toBe(200);
    vi.spyOn(store, "deleteMedia").mockImplementation(() => {
      throw "failure";
    });
    expect(
      (await agent.delete("/api/admin/media/x").set("x-csrf-token", csrf))
        .status,
    ).toBe(500);
  });
  it("runs repeat migrations and preserves data and sqlite invariants", () => {
    store.saveEvent(event);
    store.db.prepare("INSERT INTO sessions VALUES(?,?,?)").run("old", "{}", 0);
    const second = new Store(join(dir, "test.sqlite"));
    expect(second.list(true).events).toHaveLength(1);
    expect(second.db.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(second.db.pragma("foreign_key_check")).toEqual([]);
    expect(second.db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(second.db.prepare("SELECT * FROM migrations").all()).toHaveLength(2);
    second.close();
    const sessions = new SqliteSessions(store);
    sessions.get("missing", (_e, v) => expect(v).toBeNull());
    sessions.set("live", { cookie: {} } as never, () => {});
    sessions.get("live", (_e, v) => expect(v).toEqual({ cookie: {} }));
    expect(
      store.db.prepare("SELECT * FROM sessions WHERE sid=?").get("old"),
    ).toBeUndefined();
    sessions.destroy("live", () => {});
    sessions.get("live", (_e, v) => expect(v).toBeNull());
  });
  it("detects supported media signatures and rejects spoofing", () => {
    expect(identifyMedia(png)?.extension).toBe("png");
    expect(identifyMedia(Buffer.from([255, 216, 255]))?.extension).toBe("jpg");
    expect(identifyMedia(Buffer.from("RIFF0000WEBP"))?.extension).toBe("webp");
    expect(identifyMedia(Buffer.from("0000ftypisom"))?.kind).toBe("video");
    expect(identifyMedia(Buffer.from("0000ftypzzzz"))).toBeNull();
    expect(identifyMedia(Buffer.alloc(0))).toBeNull();
    expect(identifyMedia(Buffer.from("RIFF0000BAD!"))).toBeNull();
  });
  it("rate limits failed logins", async () => {
    for (let i = 0; i < 10; i++)
      await agent
        .post("/api/login")
        .set("x-csrf-token", csrf)
        .send({ password: "wrong" });
    expect(
      (
        await agent
          .post("/api/login")
          .set("x-csrf-token", csrf)
          .send({ password: "wrong" })
      ).status,
    ).toBe(429);
  });
});

it("validates archive dates, persists them and preserves them for older editors", async () => {
  await login();
  const response = await agent
    .post("/api/admin/media")
    .set("x-csrf-token", csrf)
    .field("title", "Архивная встреча")
    .field("description", "Описание")
    .field("published", "true")
    .field("eventDate", "2022-12-25")
    .attach("file", png, "archive.png");
  expect(response.status).toBe(201);
  const id = response.body.id;
  const input = {
    title: "Обновлённый архив",
    description: "Текст",
    published: true,
  };
  expect(store.list().media[0].eventDate).toBe("2022-12-25");
  expect(
    (
      await agent
        .put(`/api/admin/media/${id}`)
        .set("x-csrf-token", csrf)
        .send(input)
    ).status,
  ).toBe(200);
  expect(store.list().media[0].eventDate).toBe("2022-12-25");
  expect(
    (
      await agent
        .put(`/api/admin/media/${id}`)
        .set("x-csrf-token", csrf)
        .send({ ...input, eventDate: "2023-02-30" })
    ).status,
  ).toBe(400);
  expect(
    (
      await agent
        .put(`/api/admin/media/${id}`)
        .set("x-csrf-token", csrf)
        .send({ ...input, eventDate: "" })
    ).status,
  ).toBe(200);
  expect(store.list().media[0].eventDate).toBe("");
});
