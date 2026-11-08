import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { Store } from "../server/repository/store";
it("upgrades a populated v1 archive without losing data and reopens safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sever-v1-"));
  try {
    const path = join(dir, "db.sqlite");
    const old = new Database(path);
    old.exec(
      "CREATE TABLE migrations(version INTEGER PRIMARY KEY); INSERT INTO migrations VALUES(1); CREATE TABLE media(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,url TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,published INTEGER NOT NULL); INSERT INTO media VALUES('old','Архив','Текст','/uploads/old.jpg','image',1)",
    );
    old.close();
    let store = new Store(path);
    expect(store.list().media[0]).toMatchObject({
      id: "old",
      title: "Архив",
      eventDate: "",
    });
    expect(store.db.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(store.db.pragma("foreign_key_check")).toEqual([]);
    store.close();
    store = new Store(path);
    expect(
      store.db.prepare("SELECT version FROM migrations ORDER BY version").all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
      { version: 6 },
    ]);
    expect(store.list().media).toHaveLength(1);
    store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("upgrades v4 division links while retaining existing destinations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sever-v4-"));
  try {
    const path = join(dir, "db.sqlite");
    const old = new Database(path);
    old.exec(`CREATE TABLE migrations(version INTEGER PRIMARY KEY); INSERT INTO migrations VALUES(1),(2),(3),(4);
   CREATE TABLE media(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,url TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,published INTEGER NOT NULL,eventDate TEXT NOT NULL DEFAULT '');
   CREATE TABLE division_links(name TEXT PRIMARY KEY,url TEXT NOT NULL);INSERT INTO division_links VALUES('Москва','https://example.org/moscow');`);
    old.close();
    let store = new Store(path);
    expect(store.list(true).divisions).toEqual([
      {
        name: "Москва",
        url: "https://example.org/moscow",
        published: true,
        coordinator: "",
        contact: "",
        vk: "",
        max: "",
        telegram: "",
        email: "",
        website: "",
      },
    ]);
    store.saveDivision({
      name: "Москва",
      url: "https://example.org/moscow",
      coordinator: "Иван",
    });
    store.close();
    store = new Store(path);
    expect(store.list(true).divisions[0].coordinator).toBe("Иван");
    expect(store.db.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(store.db.pragma("foreign_key_check")).toEqual([]);
    store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
