import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import supertest from "supertest";
import { hash } from "bcryptjs";
import { Store } from "../server/repository/store";
import { createApp } from "../server/transport/app";
import transition from "../contracts/regional-transition.json";

it("upgrades populated v8 atomically, preserves contacts and files, cancels obsolete jobs, and never repeats the content cutover", () => {
  const dir = mkdtempSync(join(tmpdir(), "regional-upgrade-"));
  let store = new Store(join(dir, "db.sqlite"));
  try {
    store.db.exec("DELETE FROM division_links");
    store.saveDivision({
      name: "Москва",
      url: "https://example.org/moscow",
      coordinator: "Иван",
      email: "editor@example.org",
      published: false,
    });
    store.saveDivision({
      name: "Самара",
      url: "https://example.org/samara",
      contact: "Сохранить контакт",
      published: true,
    });
    const excluded = store.addMedia({
      title: "Самара",
      description: transition.excludedMediaSources.find((s) =>
        s.includes("samarasevchelovek"),
      )!,
      url: "/uploads/retained.jpg",
      kind: "image",
      published: true,
    });
    const similarSource = store.addMedia({
      title: "Different post",
      description: transition.excludedMediaSources[0] + "0",
      url: "/uploads/different.jpg",
      kind: "image",
      published: true,
    });
    const retained = store.addMedia({
      title: "Авторская московская запись",
      description: "Не из импортируемого архива",
      url: "/uploads/local.jpg",
      kind: "image",
      published: true,
    });
    for (const row of store.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'changes_%'",
      )
      .all() as { name: string }[])
      store.db.exec(`DROP TRIGGER ${row.name}`);
    store.db.exec(
      "DROP TABLE content_changes; ALTER TABLE media DROP COLUMN archived; DELETE FROM migrations WHERE version>=10",
    );
    store.db
      .exec(`INSERT INTO content_updates VALUES('old','2026-12-01','2026-11-01','scheduled',1,'[]','');
      DROP TRIGGER division_id_insert; DROP TRIGGER division_id_update; DROP INDEX division_identity;
      ALTER TABLE division_links DROP COLUMN id; ALTER TABLE division_links DROP COLUMN region;
      ALTER TABLE division_links DROP COLUMN type; ALTER TABLE division_links DROP COLUMN archived;
      DROP TABLE regional_transition_backup; DELETE FROM migrations WHERE version=9;
      UPDATE channels SET url='https://t.me/sevchelrussia' WHERE id='channel-1';`);
    store.close();
    store = new Store(join(dir, "db.sqlite"));
    expect(store.list().divisions).toHaveLength(10);
    expect(
      store.list(true).divisions.find((d) => d.name === "Москва"),
    ).toMatchObject({
      coordinator: "Иван",
      email: "editor@example.org",
      published: false,
      archived: false,
      region: "Москва",
    });
    const samara = store.list(true).divisions.find((d) => d.name === "Самара")!;
    expect(samara).toMatchObject({
      archived: true,
      published: false,
      contact: "Сохранить контакт",
      region: "Другой регион",
    });
    expect(store.list().media.map((m) => m.id)).toEqual([
      retained,
      similarSource,
    ]);
    expect(store.list(true).media.find((m) => m.id === excluded)?.url).toBe(
      "/uploads/retained.jpg",
    );
    expect(
      store.db
        .prepare(
          "SELECT payload FROM regional_transition_backup WHERE kind='media' AND id=?",
        )
        .get(excluded),
    ).toBeDefined();
    expect(store.contentUpdates.list()[0]).toMatchObject({
      status: "cancelled",
      detail: expect.stringContaining("Региональный переход"),
    });
    expect(store.list().channels[0].url).toBe("https://t.me/moskvasevchelovek");
    expect(store.setPublication("media", excluded, true)).toBe(0);
    store.archiveMedia(excluded, false);
    store.setPublication("media", excluded, true);
    store.close();
    store = new Store(join(dir, "db.sqlite"));
    expect(store.list().media.some((m) => m.id === excluded)).toBe(true);
    expect(store.db.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(store.db.pragma("foreign_key_check")).toEqual([]);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("manages new divisions by immutable id, validates access/conflicts, hides drafts and archives and restores contacts", async () => {
  const store = new Store(":memory:");
  const app = createApp({
    store,
    uploadDir: "/tmp/regional-test-uploads",
    sessionSecret: "test-only-session-secret-with-32-characters",
    passwordHash: await hash("fixture-password", 4),
  });
  const agent = supertest.agent(app);
  const input = {
    name: "ВАО",
    url: "",
    region: "Москва",
    type: "district",
    published: false,
    coordinator: "Иван",
    telegram: "https://t.me/example",
  };
  try {
    const first = await agent.get("/api/session");
    expect(
      (
        await agent
          .post("/api/admin/divisions")
          .set("x-csrf-token", first.body.csrf)
          .send(input)
      ).status,
    ).toBe(401);
    const login = await agent
      .post("/api/login")
      .set("x-csrf-token", first.body.csrf)
      .send({ password: "fixture-password" });
    const csrf = login.body.csrf;
    const call = (
      method: "post" | "put" | "patch" | "delete",
      path: string,
      body: object = {},
    ) => agent[method](path).set("x-csrf-token", csrf).send(body);
    expect((await agent.post("/api/admin/divisions").send(input)).status).toBe(
      403,
    );
    expect(
      (await call("post", "/api/admin/divisions", { ...input, name: "" }))
        .status,
    ).toBe(400);
    expect(
      (
        await call("post", "/api/admin/divisions", {
          ...input,
          region:
            "\u041c\u043e\u0441\u043a\u043e\u0432\u0441\u043a\u0430\u044f \u043e\u0431\u043b\u0430\u0441\u0442\u044c",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("post", "/api/admin/divisions", {
          ...input,
          region:
            "\u0414\u0440\u0443\u0433\u043e\u0439 \u0440\u0435\u0433\u0438\u043e\u043d",
        })
      ).status,
    ).toBe(400);
    const created = await call("post", "/api/admin/divisions", input);
    expect(created.status).toBe(201);
    const id = created.body.id;
    const path = `/api/admin/divisions/${id}`;
    expect(store.list().divisions.some((d) => d.id === id)).toBe(false);
    expect((await call("post", "/api/admin/divisions", input)).status).toBe(
      409,
    );
    expect((await call("put", path, { ...input, name: "Москва" })).status).toBe(
      409,
    );
    expect(
      (
        await call("put", path, {
          name: "Восточный округ",
          url: "",
          published: true,
          region: "Москва",
          type: "district",
        })
      ).status,
    ).toBe(200);
    expect(store.divisionCatalog.find(id)).toMatchObject({
      id,
      name: "Восточный округ",
      coordinator: "Иван",
    });
    const publicRow = store.list().divisions.find((d) => d.id === id)!;
    expect(publicRow).toMatchObject({ url: "", name: "Восточный округ" });
    expect(publicRow).not.toHaveProperty("coordinator");
    expect(
      (await call("patch", `${path}/publication`, { published: false })).status,
    ).toBe(200);
    store.saveDivision(
      {
        ...store.list(true).divisions.find((d) => d.id === id)!,
        name: "Updated draft",
      },
      id,
    );
    store.contentUpdates.schedule(
      "2026-12-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );
    expect((await call("delete", path)).status).toBe(200);
    expect(store.contentUpdates.drafts().some((d) => d.id === id)).toBe(false);
    store.contentUpdates.process("2026-12-01T00:00:00.000Z");
    expect(store.contentUpdates.list()[0].status).toBe("cancelled");
    expect(
      (await call("patch", `${path}/publication`, { published: true })).status,
    ).toBe(404);
    expect((await call("patch", `${path}/archive`)).status).toBe(200);
    expect(store.divisionCatalog.find(id)).toMatchObject({
      published: 0,
      archived: 0,
      coordinator: "Иван",
    });
    store.saveDivision(
      {
        ...store.list(true).divisions.find((d) => d.id === id)!,
        name: "Restored draft",
      },
      id,
    );
    store.contentUpdates.schedule(
      "2026-12-02T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );
    store.contentUpdates.process("2026-12-02T00:00:00.000Z");
    expect(store.list().divisions.some((d) => d.id === id)).toBe(true);
    for (const [method, suffix] of [
      ["put", ""],
      ["delete", ""],
      ["patch", "/archive"],
    ] as const)
      expect(
        (await call(method, `/api/admin/divisions/missing${suffix}`, input))
          .status,
      ).toBe(404);
    const outside = store.saveDivision({
      name: "Другой город",
      url: "",
      region: "Другой регион",
      published: true,
    });
    expect(store.list().divisions.some((d) => d.id === outside)).toBe(false);
  } finally {
    store.close();
  }
});
