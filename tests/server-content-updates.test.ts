import { it, expect } from "vitest";
import supertest from "supertest";
import { hash } from "bcryptjs";
import { Store } from "../server/repository/store";
import { createApp } from "../server/transport/app";
import type { ContentTarget } from "../contracts/content";
const time = "2026-12-01T00:00:00.000Z";
const event = {
  title: "Событие",
  description: "Описание",
  city: "Москва",
  startsAt: time,
  published: false,
};
it("publishes only selected unchanged drafts atomically, once, at the due time; persists, cancels and rejects conflicts", () => {
  const store = new Store(":memory:");
  try {
    store.db.exec("DELETE FROM division_links");
    const eventId = store.saveEvent(event);
    const mediaId = store.addMedia({
      title: "Медиа",
      description: "Фото",
      url: "/uploads/a.jpg",
      kind: "image",
      published: false,
    });
    store.saveDivision({
      name: "Москва",
      url: "https://example.com",
      published: false,
    });
    const channelId = store.saveChannel({
      name: "Новый канал",
      short: "НК",
      note: "",
      url: "https://example.com",
      published: false,
    });
    const targets: ContentTarget[] = [
      { kind: "events", id: eventId },
      { kind: "media", id: mediaId },
      { kind: "divisions", id: "Москва" },
      { kind: "channels", id: channelId },
    ];
    expect(store.contentUpdates.drafts()).toHaveLength(4);
    expect(() =>
      store.contentUpdates.schedule([...targets, targets[0]], time, time),
    ).toThrow("повторяться");
    expect(() =>
      store.contentUpdates.schedule(
        [{ kind: "events", id: "missing" }],
        time,
        time,
      ),
    ).toThrow("черновики");
    const id = store.contentUpdates.schedule(targets, time, time);
    expect(() => store.contentUpdates.schedule(targets, time, time)).toThrow(
      "текущей",
    );
    expect(store.contentUpdates.process("2026-11-30T23:59:59.000Z")).toBe(
      false,
    );
    expect(store.list().events).toHaveLength(0);
    expect(store.contentUpdates.process(time)).toBe(true);
    expect(store.contentUpdates.process(time)).toBe(false);
    expect(store.contentUpdates.list()[0]).toMatchObject({
      id,
      count: 4,
      status: "succeeded",
    });
    expect(store.list().events).toHaveLength(1);
    expect(store.list().media).toHaveLength(1);
    expect(store.list().divisions).toHaveLength(1);
    expect(store.list().channels).toHaveLength(5);
    expect(store.contentUpdates.cancel(id)).toBe(0);
    expect(() => store.contentUpdates.schedule(targets, time, time)).toThrow(
      "черновики",
    );
    store.setPublication("events", eventId, false);
    const cancelled = store.contentUpdates.schedule([targets[0]], time, time);
    expect(store.contentUpdates.cancel(cancelled)).toBe(1);
    expect(store.contentUpdates.process(time)).toBe(false);
    expect(store.contentUpdates.list()[0].status).toBe("cancelled");
    store.contentUpdates.schedule([targets[0]], time, time);
    store.saveEvent({ ...event, title: "Другой текст" }, eventId);
    expect(store.contentUpdates.process(time)).toBe(true);
    expect(store.contentUpdates.list()[0].status).toBe("failed");
    expect(store.list().events).toHaveLength(0);
    store.contentUpdates.schedule([targets[0]], time, time);
    store.contentUpdates.process("2026-12-01T00:10:01.000Z");
    expect(store.contentUpdates.list()[0].detail).toContain("пропущено");
    store.contentUpdates.schedule([targets[0]], time, time);
    store.db.prepare("DELETE FROM events WHERE id=?").run(eventId);
    store.contentUpdates.process(time);
    expect(store.contentUpdates.list()[0].detail).toContain("удалены");
    expect(store.db.pragma("integrity_check", { simple: true })).toBe("ok");
  } finally {
    store.close();
  }
});
it("validates editor permissions, CSRF, time, selection, overlap and cancellation; disables code deployment API", async () => {
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
    const id = store.saveEvent(event);
    const input = {
      targets: [{ kind: "events", id }],
      scheduledAt: new Date(Date.now() + 120000).toISOString(),
    };
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
    expect(
      (await post({ ...input, targets: [{ kind: "events", id: "missing" }] }))
        .status,
    ).toBe(409);
    const scheduled = await post(input);
    expect(scheduled.status).toBe(201);
    expect((await post(input)).status).toBe(409);
    const list = (await agent.get("/api/admin/content-updates")).body;
    expect(list.jobs[0]).toMatchObject({ count: 1, status: "scheduled" });
    expect(list.jobs[0]).not.toHaveProperty("payload");
    expect((await agent.get("/api/content")).body.events).toHaveLength(0);
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
          .send({ scheduledAt: input.scheduledAt })
      ).status,
    ).toBe(410);
  } finally {
    store.close();
  }
});
