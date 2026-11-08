import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  EventRecord,
  MediaRecord,
  DivisionLink,
} from "../../contracts/content.js";
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
      if (!this.db.prepare("SELECT 1 FROM migrations WHERE version=2").get()) {
        this.db.exec(
          "ALTER TABLE media ADD COLUMN eventDate TEXT NOT NULL DEFAULT ''; INSERT INTO migrations VALUES(2);",
        );
      }
      this.db.exec(`CREATE TABLE IF NOT EXISTS media_images(
        id TEXT PRIMARY KEY, mediaId TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
        url TEXT NOT NULL UNIQUE);
        CREATE INDEX IF NOT EXISTS media_images_owner ON media_images(mediaId);
        INSERT OR IGNORE INTO migrations VALUES(3);`);
      this.db
        .exec(`CREATE TABLE IF NOT EXISTS division_links(name TEXT PRIMARY KEY, url TEXT NOT NULL);
        INSERT OR IGNORE INTO migrations VALUES(4);`);
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
      divisions: this.db
        .prepare("SELECT name,url FROM division_links ORDER BY name")
        .all() as DivisionLink[],
      events: events.map((e) => ({ ...e, published: !!e.published })),
      media: media.map((e) => ({
        ...e,
        published: !!e.published,
        images: this.images(e.id),
      })),
    };
  }
  saveDivision(input: DivisionLink) {
    this.db
      .prepare(
        "INSERT INTO division_links(name,url) VALUES(@name,@url) ON CONFLICT(name) DO UPDATE SET url=excluded.url",
      )
      .run(input);
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
        "INSERT INTO media(id,title,description,url,kind,published,eventDate) VALUES(@id,@title,@description,@url,@kind,@published,@eventDate)",
      )
      .run({
        ...input,
        eventDate: input.eventDate ?? "",
        id,
        published: +input.published,
      });
    return id;
  }
  updateMedia(
    id: string,
    input: Pick<
      MediaRecord,
      "title" | "description" | "published" | "eventDate"
    >,
  ) {
    return this.db
      .prepare(
        "UPDATE media SET title=@title,description=@description,published=@published,eventDate=coalesce(@eventDate,eventDate) WHERE id=@id",
      )
      .run({
        ...input,
        eventDate: input.eventDate ?? null,
        id,
        published: +input.published,
      }).changes;
  }
  deleteEvent(id: string) {
    return this.db.prepare("DELETE FROM events WHERE id=?").run(id).changes;
  }
  deleteMedia(id: string) {
    const row = this.db.prepare("SELECT url FROM media WHERE id=?").get(id) as
      { url: string } | undefined;
    const images = this.images(id);
    this.db.prepare("DELETE FROM media WHERE id=?").run(id);
    return row && { ...row, images };
  }
  images(mediaId: string) {
    return this.db
      .prepare("SELECT id,url FROM media_images WHERE mediaId=? ORDER BY rowid")
      .all(mediaId) as { id: string; url: string }[];
  }
  addImage(mediaId: string, url: string) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO media_images(id,mediaId,url) VALUES(?,?,?)")
      .run(id, mediaId, url);
    return id;
  }
  deleteImage(mediaId: string, id: string) {
    return this.db
      .prepare(
        "DELETE FROM media_images WHERE mediaId=? AND id=? RETURNING url",
      )
      .get(mediaId, id) as { url: string } | undefined;
  }
  close() {
    this.db.close();
  }
}
