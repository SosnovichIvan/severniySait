import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { ContentTarget, ContentUpdate } from "../../contracts/content.js";
const tables = {
  events: "events",
  media: "media",
  divisions: "division_links",
  channels: "channels",
};
export class ContentUpdates {
  constructor(private db: Database.Database) {
    db.transaction(() =>
      db.exec(`CREATE TABLE IF NOT EXISTS content_updates(
      id TEXT PRIMARY KEY,scheduledAt TEXT NOT NULL,createdAt TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('scheduled','succeeded','failed','cancelled')),
      count INTEGER NOT NULL CHECK(count>0),payload TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '');
      CREATE UNIQUE INDEX IF NOT EXISTS content_updates_active ON content_updates((1)) WHERE status='scheduled';
      INSERT OR IGNORE INTO migrations VALUES(8);`),
    )();
  }
  drafts() {
    return (Object.keys(tables) as ContentTarget["kind"][]).flatMap((kind) =>
      (
        this.db
          .prepare(
            `SELECT t.id,${kind === "channels" || kind === "divisions" ? "t.name" : "t.title"} AS title FROM ${tables[kind]} t JOIN content_changes c ON c.id=t.id AND c.kind=? WHERE t.published=0 ${kind === "divisions" ? "AND t.archived=0 AND t.region!='Другой регион'" : kind === "media" ? "AND t.archived=0" : ""} ORDER BY t.rowid`,
          )
          .all(kind) as { id: string; title: string }[]
      ).map((row) => ({ kind, ...row })),
    );
  }
  list() {
    return this.db
      .prepare(
        "SELECT id,scheduledAt,createdAt,status,count,detail FROM content_updates ORDER BY createdAt DESC,rowid DESC LIMIT 50",
      )
      .all() as ContentUpdate[];
  }
  discard(kind: ContentTarget["kind"], id: string) {
    this.db
      .prepare("DELETE FROM content_changes WHERE kind=? AND id=?")
      .run(kind, id);
  }
  schedule(scheduledAt: string, now: string) {
    return this.db
      .transaction(() => {
        if (
          this.db
            .prepare("SELECT 1 FROM content_updates WHERE status='scheduled'")
            .get()
        )
          throw new Error(
            "Сначала отмените или дождитесь текущего обновления.",
          );
        const pending = this.drafts();
        if (!pending.length)
          throw new Error(
            "Нет ожидающих изменений. Сохраните новый или изменённый черновик.",
          );
        const id = randomUUID();
        this.db
          .prepare(
            "INSERT INTO content_updates(id,scheduledAt,createdAt,status,count,payload) VALUES(?,?,?,'scheduled',?,'all-pending')",
          )
          .run(id, scheduledAt, now, pending.length);
        return id;
      })
      .immediate();
  }
  cancel(id: string) {
    return this.db
      .prepare(
        "UPDATE content_updates SET status='cancelled' WHERE id=? AND status='scheduled'",
      )
      .run(id).changes;
  }
  process(now: string) {
    return this.db
      .transaction(() => {
        const job = this.db
          .prepare(
            "SELECT * FROM content_updates WHERE status='scheduled' AND scheduledAt<=? LIMIT 1",
          )
          .get(now) as ContentUpdate | undefined;
        if (!job) return false;
        if (Date.parse(now) - Date.parse(job.scheduledAt) > 10 * 60000) {
          this.db
            .prepare(
              "UPDATE content_updates SET status='failed',detail='Время публикации пропущено. Назначьте её заново.' WHERE id=?",
            )
            .run(job.id);
          return true;
        }
        const targets = this.drafts();
        if (!targets.length) {
          this.db
            .prepare(
              "UPDATE content_updates SET status='cancelled',detail='Ожидающих изменений больше нет. Публикация не требуется.' WHERE id=?",
            )
            .run(job.id);
          return true;
        }
        for (const target of targets)
          this.db
            .prepare(`UPDATE ${tables[target.kind]} SET published=1 WHERE id=?`)
            .run(target.id);
        this.db
          .prepare(
            "UPDATE content_updates SET status='succeeded',count=?,detail='Все ожидающие изменения опубликованы. Код сайта не изменён.' WHERE id=?",
          )
          .run(targets.length, job.id);
        return true;
      })
      .immediate();
  }
}
