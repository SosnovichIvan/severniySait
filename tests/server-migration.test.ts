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
    ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
    expect(store.list().media).toHaveLength(1);
    store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
