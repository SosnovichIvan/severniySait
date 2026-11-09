import { it, expect } from "vitest";
import supertest from "supertest";
import { hash } from "bcryptjs";
import { Store } from "../server/repository/store";
import { createApp } from "../server/transport/app";
const time = "2026-12-01T00:00:00.000Z";
const event = {
  title: "Событие",
  description: "Описание",
  city: "Москва",
  startsAt: time,
  published: false,
};
it("publishes all pending editorial changes including later saves, preserves explicit hiding and skips deleted records", () => {
  const store = new Store(":memory:");
  try {
    store.db.exec("DELETE FROM division_links");
    expect(() => store.contentUpdates.schedule(time, time)).toThrow(
      "Нет ожидающих",
    );
    const first = store.saveEvent(event);
    const media = store.addMedia({
      title: "Фото",
      description: "Описание",
      url: "/uploads/draft.jpg",
      kind: "image",
      published: false,
    });
    const division = store.saveDivision({
      name: "Москва",
      url: "",
      published: false,
    });
    store.saveChannel({
      name: "Канал",
      note: "",
      short: "TG",
      url: "https://example.org",
      published: false,
    });
    expect(store.contentUpdates.drafts()).toHaveLength(4);
    const job = store.contentUpdates.schedule(time, time);
    expect(() => store.contentUpdates.schedule(time, time)).toThrow("текущего");
    store.saveEvent({ ...event, title: "Изменённый текст" }, first);
    const later = store.saveEvent({
      ...event,
      title: "Добавлено после назначения",
    });
    store.addImage(media, "/uploads/gallery.jpg");
    expect(store.contentUpdates.process("2026-11-30T23:59:59.000Z")).toBe(
      false,
    );
    expect(store.contentUpdates.process(time)).toBe(true);
    expect(store.contentUpdates.process(time)).toBe(false);
    expect(store.contentUpdates.list()[0]).toMatchObject({
      id: job,
      count: 5,
      status: "succeeded",
    });
    expect(store.list().events.find((row) => row.id === first)?.title).toBe(
      "Изменённый текст",
    );
    expect(store.list().events.some((row) => row.id === later)).toBe(true);
    expect(store.list().divisions.some((row) => row.id === division)).toBe(
      true,
    );
    expect(store.contentUpdates.drafts()).toEqual([]);
    store.setPublication("events", first, false);
    store.setPublication("divisions", division, false);
    expect(store.contentUpdates.drafts()).toEqual([]);
    store.saveEvent({ ...event, title: "Новая редакция" }, first);
    const cancelled = store.contentUpdates.schedule(time, time);
    expect(store.contentUpdates.cancel(cancelled)).toBe(1);
    expect(store.contentUpdates.cancel(cancelled)).toBe(0);
    expect(store.contentUpdates.process(time)).toBe(false);
    store.contentUpdates.schedule(time, time);
    store.deleteEvent(first);
    store.contentUpdates.process(time);
    expect(store.contentUpdates.list()[0].status).toBe("cancelled");
    const missed = store.saveEvent(event);
    store.contentUpdates.schedule(time, time);
    store.contentUpdates.process("2026-12-01T00:10:01.000Z");
    expect(store.contentUpdates.list()[0].status).toBe("failed");
    store.setPublication("events", missed, true);
    expect(store.contentUpdates.drafts()).toEqual([]);
    store.updateMedia(media, {
      title: "Новый текст",
      description: "",
      published: false,
    });
    const image = store.addImage(media, "/uploads/another.jpg");
    store.deleteImage(media, image);
    expect(store.contentUpdates.drafts().some((row) => row.id === media)).toBe(
      true,
    );
    store.archiveMedia(media, true);
    expect(store.contentUpdates.drafts()).toEqual([]);
    expect(store.setPublication("media", media, true)).toBe(0);
    store.archiveMedia(media, false);
    expect(store.contentUpdates.drafts()).toEqual([]);
    store.updateMedia(media, {
      title: "Региональная редакция",
      description: "",
      published: false,
    });
    store.contentUpdates.schedule(time, time);
    store.contentUpdates.process(time);
    expect(store.list().media.some((row) => row.id === media)).toBe(true);
    expect(store.db.pragma("integrity_check", { simple: true })).toBe("ok");
  } finally {
    store.close();
  }
});
it("validates editor access, CSRF, time and overlap and rejects obsolete selective payloads", async () => {
  const store = new Store(":memory:");
  try {
    const app = createApp({
      store,
      uploadDir: ".preview/test-uploads",
      sessionSecret: "only-test-secret-with-more-than-32-characters",
      passwordHash: await hash("test-password", 4),
    });
    const agent = supertest.agent(app);
    let csrf = (await agent.get("/api/session")).body.csrf;
    const post = (body: object, token = csrf) =>
      agent
        .post("/api/admin/content-updates")
        .set("x-csrf-token", token)
        .send(body);
    const input = { scheduledAt: new Date(Date.now() + 120000).toISOString() };
    expect((await agent.get("/api/admin/content-updates")).status).toBe(401);
    expect((await post(input)).status).toBe(401);
    csrf = (
      await agent
        .post("/api/login")
        .set("x-csrf-token", csrf)
        .send({ password: "test-password" })
    ).body.csrf;
    expect((await post(input, "bad")).status).toBe(403);
    expect(
      (await post({ ...input, scheduledAt: new Date().toISOString() })).status,
    ).toBe(400);
    expect((await post({ ...input, targets: [] })).status).toBe(400);
    expect((await post(input)).status).toBe(409);
    const media = store.addMedia({
      title: "Архив",
      description: "",
      url: "/uploads/archive.jpg",
      kind: "image",
      published: true,
    });
    const archive = (id: string, archived: unknown) =>
      agent
        .patch(`/api/admin/media/${id}/archive`)
        .set("x-csrf-token", csrf)
        .send({ archived });
    expect((await archive(media, "yes")).status).toBe(400);
    expect((await archive("missing", true)).status).toBe(404);
    expect((await archive(media, true)).status).toBe(200);
    expect((await agent.get("/api/content")).body.media).toEqual([]);
    expect((await agent.get("/api/admin/content")).body.media[0]).toMatchObject(
      { archived: true, published: false },
    );
    expect((await archive(media, false)).status).toBe(200);
    expect(store.contentUpdates.drafts()).toEqual([]);
    store.saveEvent(event);
    const scheduled = await post(input);
    expect(scheduled.status).toBe(201);
    expect((await post(input)).status).toBe(409);
    const list = (await agent.get("/api/admin/content-updates")).body;
    expect(list.jobs[0]).toMatchObject({ count: 1, status: "scheduled" });
    expect(list.jobs[0]).not.toHaveProperty("payload");
    const cancel = () =>
      agent
        .delete(`/api/admin/content-updates/${scheduled.body.id}`)
        .set("x-csrf-token", csrf);
    expect((await cancel()).status).toBe(200);
    expect((await cancel()).status).toBe(409);
    expect(
      (
        await agent
          .post("/api/admin/deployments")
          .set("x-csrf-token", csrf)
          .send(input)
      ).status,
    ).toBe(410);
  } finally {
    store.close();
  }
});
