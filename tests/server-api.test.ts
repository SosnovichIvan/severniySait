import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import supertest from "supertest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash } from "bcryptjs";
import defaultChannels from "../contracts/channels.json";
import { Store } from "../server/repository/store";
import { createApp } from "../server/transport/app";
import { identifyMedia } from "../server/domain/media-file";
import { SqliteSessions } from "../server/repository/session-store";
let dir: string,
  store: Store,
  agent: ReturnType<typeof supertest.agent>,
  csrf: string;
const resolvedVersion = vi.fn<() => Promise<string | null>>();
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
  resolvedVersion.mockReset().mockResolvedValue("1.2.3");
  dir = await mkdtemp(join(tmpdir(), "sever-test-"));
  store = new Store(join(dir, "test.sqlite"));
  // API scenarios isolate their records; regional initial catalogue is tested in migration tests.
  store.db.exec("DELETE FROM division_links");
  agent = supertest.agent(
    createApp({
      store,
      uploadDir: join(dir, "uploads"),
      sessionSecret: "test-secret-only-32-characters-long",
      passwordHash: await hash("test-password", 4),
      deploymentEnabled: true,
      currentVersion: "1.0.0",
      resolveDeploymentVersion: resolvedVersion,
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
      divisions: [],
      channels: defaultChannels,
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
    expect(second.db.prepare("SELECT * FROM migrations").all()).toHaveLength(
      12,
    );
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

it("owns gallery photos, hides drafts, validates uploads and removes associated files", async () => {
  const url = (id: string) => `/api/admin/media/${id}/images`;
  expect(
    (await agent.post(url("missing")).set("x-csrf-token", csrf)).status,
  ).toBe(401);
  await login();
  const id = (await upload()).body.id;
  const add = (owner: string, bytes = png) =>
    agent
      .post(url(owner))
      .set("x-csrf-token", csrf)
      .attach("file", bytes, "photo.png");
  expect((await add("missing")).status).toBe(404);
  expect((await agent.post(url(id)).set("x-csrf-token", csrf)).status).toBe(
    400,
  );
  expect((await add(id, Buffer.from("not-an-image"))).status).toBe(400);
  expect((await add(id, Buffer.from("0000ftypisom"))).status).toBe(400);
  const response = await add(id);
  expect(response.status).toBe(201);
  const image = store.images(id)[0];
  expect((await agent.get(image.url)).status).toBe(200);
  const anonymous = supertest(
    createApp({
      store,
      uploadDir: join(dir, "uploads"),
      sessionSecret: "test-secret-only-32-characters-long",
      passwordHash: "unused",
    }),
  );
  expect((await anonymous.get(image.url)).status).toBe(404);
  expect((await anonymous.get("/api/content")).body.media).toEqual([]);
  store.updateMedia(id, {
    title: "Опубликованная галерея",
    description: "Полный текст",
    published: true,
  });
  expect((await anonymous.get(image.url)).status).toBe(200);
  expect((await anonymous.get("/api/content")).body.media[0].images).toEqual([
    image,
  ]);
  expect(
    (
      await agent
        .delete(`${url("wrong")}/${image.id}`)
        .set("x-csrf-token", csrf)
    ).status,
  ).toBe(404);
  expect(
    (await agent.delete(`${url(id)}/${image.id}`).set("x-csrf-token", csrf))
      .status,
  ).toBe(200);
  expect((await agent.get(image.url)).status).toBe(404);
  await add(id);
  const remaining = store.images(id)[0];
  await agent
    .delete(`/api/admin/media/${id}`)
    .set("x-csrf-token", csrf)
    .expect(200);
  expect(store.images(id)).toEqual([]);
  expect((await agent.get(remaining.url)).status).toBe(404);
  expect(store.db.pragma("foreign_key_check")).toEqual([]);
});

it("limits galleries and cleans up photos when persistence fails", async () => {
  await login();
  const id = (await upload()).body.id;
  for (let i = 0; i < 30; i++) store.addImage(id, `/uploads/limit-${i}.jpg`);
  const add = () =>
    agent
      .post(`/api/admin/media/${id}/images`)
      .set("x-csrf-token", csrf)
      .attach("file", png, "photo.png");
  expect((await add()).status).toBe(400);
  store.deleteImage(id, store.images(id)[0].id);
  const fail = vi.spyOn(store, "addImage").mockImplementationOnce(() => {
    throw new Error("storage");
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await add()).status).toBe(500);
  fail.mockRestore();
  const photo = store.images(id)[0];
  vi.spyOn(store, "deleteImage").mockImplementationOnce(() => {
    throw new Error("storage");
  });
  expect(
    (
      await agent
        .delete(`/api/admin/media/${id}/images/${photo.id}`)
        .set("x-csrf-token", csrf)
    ).status,
  ).toBe(500);
  log.mockRestore();
});

it("persists editorial division links, validates destinations and protects changes", async () => {
  const update = (body: object, token = csrf) =>
    agent.put("/api/admin/divisions").set("x-csrf-token", token).send(body);
  expect(
    (await update({ name: "Москва", url: "https://example.org" })).status,
  ).toBe(401);
  await login();
  expect(
    (await update({ name: "Москва", url: "https://example.org" }, "wrong"))
      .status,
  ).toBe(403);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "ftp://example.org",
    "https://",
    "not-a-url",
  ]) {
    expect((await update({ name: "Москва", url })).status).toBe(400);
  }
  expect((await update({ name: "", url: "https://example.org" })).status).toBe(
    400,
  );
  for (const url of [
    "https://example.org/moscow",
    "http://example.org/new",
    "",
  ]) {
    expect((await update({ name: "Москва", url })).status).toBe(200);
    expect((await agent.get("/api/content")).body.divisions).toMatchObject([
      { name: "Москва", url },
    ]);
    expect(
      (await agent.get("/api/admin/content")).body.divisions,
    ).toMatchObject([{ name: "Москва", url }]);
  }
  store.close();
  store = new Store(join(dir, "test.sqlite"));
  expect(store.list().divisions).toMatchObject([{ name: "Москва", url: "" }]);
});

it("validates optional division contacts, preserves omissions and clears explicitly", async () => {
  await login();
  const fields = {
    coordinator: "Иван Иванов",
    contact: "+7 900 000-00-00",
    vk: "https://vk.com/example",
    max: "https://max.ru/example",
    telegram: "https://t.me/example",
    email: "editor@example.org",
    website: "https://example.org",
  };
  const update = (body: object) =>
    agent.put("/api/admin/divisions").set("x-csrf-token", csrf).send(body);
  for (const [key, value] of Object.entries({
    vk: "javascript:alert(1)",
    max: "https://",
    telegram: "t.me/example",
    email: "bad-address",
    website: "data:text/html,x",
    coordinator: "x".repeat(121),
    contact: "x".repeat(301),
  })) {
    expect(
      (await update({ name: "Москва", url: "", [key]: value })).status,
    ).toBe(400);
  }
  expect((await update({ name: "Москва", url: "", ...fields })).status).toBe(
    200,
  );
  expect(
    (await agent.get("/api/admin/content")).body.divisions[0],
  ).toMatchObject({
    name: "Москва",
    url: "",
    published: true,
    ...fields,
  });
  expect((await agent.get("/api/content")).body.divisions[0]).toMatchObject({
    name: "Москва",
    url: "",
  });
  expect(
    (await update({ name: "Москва", url: "https://example.org/card" })).status,
  ).toBe(200);
  expect(
    (await agent.get("/api/admin/content")).body.divisions[0],
  ).toMatchObject(fields);
  store.close();
  store = new Store(join(dir, "test.sqlite"));
  expect(store.list(true).divisions[0]).toMatchObject(fields);
  const cleared = Object.fromEntries(
    Object.keys(fields).map((key) => [key, ""]),
  );
  store.saveDivision({ name: "Москва", url: "", ...cleared });
  expect(store.list(true).divisions[0]).toMatchObject(cleared);
});

it("publishes and unpublishes every entity without deleting data or exposing drafts", async () => {
  const publication = (
    kind: string,
    id: string,
    published: unknown,
    token = csrf,
  ) =>
    agent
      .patch(`/api/admin/${kind}/${encodeURIComponent(id)}/publication`)
      .set("x-csrf-token", token)
      .send({ published });
  expect((await publication("channels", "channel-1", false)).status).toBe(401);
  await login();
  expect((await publication("events", "missing", true, "bad")).status).toBe(
    403,
  );
  expect((await publication("sessions", "missing", true)).status).toBe(400);
  expect((await publication("events", "missing", "true")).status).toBe(400);
  expect((await publication("events", "missing", true)).status).toBe(404);
  const eventId = store.saveEvent(event);
  const mediaId = (await upload(false)).body.id;
  store.saveDivision({
    name: "Москва",
    url: "https://example.org/moscow",
    published: false,
    coordinator: "Иван",
  });
  const channelId = store.saveChannel({
    name: "Новый канал",
    note: "Описание",
    short: "НК",
    url: "https://example.org/channel",
    published: false,
  });
  const entries = [
    ["events", eventId],
    ["media", mediaId],
    ["divisions", "Москва"],
    ["channels", channelId],
  ] as const;
  for (const [kind, id] of entries) {
    const isMatch = (item: { id?: string; name?: string }) =>
      (kind === "divisions" ? item.name : item.id) === id;
    expect(store.list()[kind].some(isMatch)).toBe(false);
    for (const published of [true, true, false, false, true]) {
      expect((await publication(kind, id, published)).status).toBe(200);
      expect(store.list()[kind].some(isMatch)).toBe(published);
      expect(store.list(true)[kind].find(isMatch)).toMatchObject({ published });
    }
    await publication(kind, id, false);
  }
  const media = store.list(true).media[0];
  expect((await agent.get(media.url)).status).toBe(200);
  await agent.post("/api/logout").set("x-csrf-token", csrf);
  expect((await agent.get(media.url)).status).toBe(404);
  store.close();
  store = new Store(join(dir, "test.sqlite"));
  expect(store.list(true).events[0].description).toBe(event.description);
  expect(store.list(true).divisions[0]).toMatchObject({
    coordinator: "Иван",
    published: false,
  });
  expect(store.list().divisions).toEqual([]);
});

it("manages channels with validation, authentication, persistence and one-time seeding", async () => {
  const body = {
    name: "Площадка",
    note: "Описание",
    short: "ПЛ",
    url: "https://example.org",
    published: false,
  };
  const create = (input: object) =>
    agent.post("/api/admin/channels").set("x-csrf-token", csrf).send(input);
  expect((await create(body)).status).toBe(401);
  await login();
  for (const invalid of [
    { url: "" },
    { url: "javascript:alert(1)" },
    { url: "https://" },
    { name: "" },
    { short: "12345" },
    { published: "true" },
  ]) {
    expect((await create({ ...body, ...invalid })).status).toBe(400);
  }
  const created = await create(body);
  expect(created.status).toBe(201);
  const id = created.body.id;
  expect(store.list().channels.some((c) => c.id === id)).toBe(false);
  expect(
    (
      await agent
        .put(`/api/admin/channels/${id}`)
        .set("x-csrf-token", csrf)
        .send({ ...body, name: "Новое имя", published: true })
    ).status,
  ).toBe(200);
  expect(store.list().channels.find((c) => c.id === id)?.name).toBe(
    "Новое имя",
  );
  expect(
    (
      await agent
        .put("/api/admin/channels/missing")
        .set("x-csrf-token", csrf)
        .send(body)
    ).status,
  ).toBe(404);
  expect(
    (await agent.delete(`/api/admin/channels/${id}`).set("x-csrf-token", csrf))
      .status,
  ).toBe(200);
  expect(
    (await agent.delete(`/api/admin/channels/${id}`).set("x-csrf-token", csrf))
      .status,
  ).toBe(404);
  expect(
    (
      await agent
        .delete("/api/admin/channels/channel-1")
        .set("x-csrf-token", csrf)
    ).status,
  ).toBe(200);
  store.close();
  store = new Store(join(dir, "test.sqlite"));
  expect(store.list(true).channels).toHaveLength(3);
  expect(store.list().channels.some((c) => c.id === "channel-1")).toBe(false);
  expect(store.db.pragma("integrity_check", { simple: true })).toBe("ok");
});

it("schedules updates only for editors, prevents overlap, persists and cancels", async () => {
  expect((await agent.get("/api/admin/deployments")).status).toBe(401);
  const input = {
    scheduledAt: new Date(Date.now() + 120000).toISOString(),
  };
  const schedule = (body: object, token = csrf) =>
    agent.post("/api/admin/deployments").set("x-csrf-token", token).send(body);
  expect((await schedule(input)).status).toBe(401);
  await login();
  expect((await agent.get("/api/admin/deployments")).body).toEqual({
    enabled: true,
    currentVersion: "1.0.0",
    jobs: [],
  });
  expect((await schedule(input, "wrong")).status).toBe(403);
  for (const invalid of [
    { scheduledAt: "bad" },
    { scheduledAt: new Date().toISOString() },
  ])
    expect((await schedule({ ...input, ...invalid })).status).toBe(400);
  const result = await schedule(input);
  expect(result.status).toBe(201);
  const id = result.body.id;
  expect((await schedule(input)).status).toBe(409);
  expect(
    (await agent.get("/api/admin/deployments")).body.jobs[0],
  ).toMatchObject({ ...input, version: "1.2.3", id, status: "scheduled" });
  expect((await agent.get("/api/content")).body).not.toHaveProperty("jobs");
  expect(
    (
      await agent
        .delete(`/api/admin/deployments/${id}`)
        .set("x-csrf-token", csrf)
    ).status,
  ).toBe(200);
  expect(
    (
      await agent
        .delete(`/api/admin/deployments/${id}`)
        .set("x-csrf-token", csrf)
    ).status,
  ).toBe(409);
  expect((await schedule(input)).status).toBe(201);
  store.close();
  store = new Store(join(dir, "test.sqlite"));
  expect(store.deployments().find((job) => job.id === id)?.status).toBe(
    "cancelled",
  );
});

it("keeps public API available during editorial publication changes", async () => {
  await login();
  const id = store.saveEvent(event);
  const results = await Promise.all(
    Array.from({ length: 60 }, (_, i) =>
      i % 3 === 0
        ? agent
            .patch(`/api/admin/events/${id}/publication`)
            .set("x-csrf-token", csrf)
            .send({ published: i % 2 === 0 })
        : agent.get(i % 3 === 1 ? "/api/health" : "/api/content"),
    ),
  );
  expect(results.every((result) => result.status === 200)).toBe(true);
  expect(store.list(true).events[0].id).toBe(id);
});

it("does not schedule unavailable, identical or older releases, and hides registry failures", async () => {
  await login();
  const body = { scheduledAt: new Date(Date.now() + 120000).toISOString() };
  const schedule = () =>
    agent.post("/api/admin/deployments").set("x-csrf-token", csrf).send(body);
  for (const version of [null, "1.0.0", "0.9.9"]) {
    resolvedVersion.mockResolvedValue(version);
    expect((await schedule()).status).toBe(409);
  }
  resolvedVersion.mockRejectedValue(new Error("private registry internals"));
  const failed = await schedule();
  expect(failed.status).toBe(503);
  expect(failed.body.error).not.toContain("private registry");
  expect(store.deployments()).toEqual([]);
});
