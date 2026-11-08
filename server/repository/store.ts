import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { EventRecord, MediaRecord } from "../../contracts/content.js";
export class Store {
  db: Database.Database;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db.transaction(() => {
      this.db
        .exec(`CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,city TEXT NOT NULL,startsAt TEXT NOT NULL,published INTEGER NOT NULL CHECK(published IN (0,1)));
      CREATE INDEX IF NOT EXISTS events_date ON events(published,startsAt,id);
      CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,url TEXT NOT NULL UNIQUE,kind TEXT NOT NULL CHECK(kind IN ('image','video')),published INTEGER NOT NULL CHECK(published IN (0,1)));
      CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,data TEXT NOT NULL,expires INTEGER NOT NULL);
      INSERT OR IGNORE INTO migrations VALUES(1);`);
    })();
  }
  list(admin = false) {
    const events = this.db
      .prepare(
        `SELECT * FROM events ${admin ? "" : "WHERE published=1"} ORDER BY startsAt,id LIMIT 500`,
      )
      .all() as (Omit<EventRecord, "published"> & { published: number })[];
    const media = this.db
      .prepare(
        `SELECT * FROM media ${admin ? "" : "WHERE published=1"} ORDER BY rowid DESC LIMIT 500`,
      )
      .all() as (Omit<MediaRecord, "published"> & { published: number })[];
    return {
      events: events.map((e) => ({ ...e, published: !!e.published })),
      media: media.map((e) => ({ ...e, published: !!e.published })),
    };
  }
  saveEvent(input: Omit<EventRecord, "id">, id: string = randomUUID()) {
    this.db
      .prepare(
        "INSERT INTO events VALUES(@id,@title,@description,@city,@startsAt,@published) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,city=excluded.city,startsAt=excluded.startsAt,published=excluded.published",
      )
      .run({
        ...input,
        id,
        startsAt: new Date(input.startsAt).toISOString(),
        published: +input.published,
      });
    return id;
  }
  addMedia(input: Omit<MediaRecord, "id">) {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO media VALUES(@id,@title,@description,@url,@kind,@published)",
      )
      .run({ ...input, id, published: +input.published });
    return id;
  }
  updateMedia(
    id: string,
    input: Pick<MediaRecord, "title" | "description" | "published">,
  ) {
    return this.db
      .prepare(
        "UPDATE media SET title=@title,description=@description,published=@published WHERE id=@id",
      )
      .run({ ...input, id, published: +input.published }).changes;
  }
  deleteEvent(id: string) {
    return this.db.prepare("DELETE FROM events WHERE id=?").run(id).changes;
  }
  deleteMedia(id: string) {
    const row = this.db.prepare("SELECT url FROM media WHERE id=?").get(id) as
      { url: string } | undefined;
    this.db.prepare("DELETE FROM media WHERE id=?").run(id);
    return row;
  }
  close() {
    this.db.close();
  }
}
