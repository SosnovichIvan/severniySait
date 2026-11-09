import type Database from "better-sqlite3";
import { randomUUID, createHash } from "node:crypto";
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
  private row(target: ContentTarget) {
    return this.db
      .prepare(
        `SELECT * FROM ${tables[target.kind]} WHERE ${target.kind === "divisions" ? "(id=? OR name=?) AND archived=0 AND region!='Другой регион'" : "id=?"}`,
      )
      .get(
        ...(target.kind === "divisions" ? [target.id, target.id] : [target.id]),
      ) as Record<string, unknown> | undefined;
  }
  private fingerprint(target: ContentTarget) {
    const row = this.row(target);
    if (!row || row.published !== 0) return null;
    const images =
      target.kind === "media"
        ? this.db
            .prepare("SELECT * FROM media_images WHERE mediaId=? ORDER BY id")
            .all(target.id)
        : [];
    return createHash("sha256")
      .update(JSON.stringify([row, images]))
      .digest("hex");
  }
  drafts() {
    return (Object.keys(tables) as ContentTarget["kind"][]).flatMap((kind) =>
      (
        this.db
          .prepare(
            `SELECT ${kind === "divisions" ? "id,name" : kind === "channels" ? "id,name" : "id,title AS name"} FROM ${tables[kind]} WHERE published=0 ${kind === "divisions" ? "AND archived=0 AND region!='Другой регион'" : ""} ORDER BY rowid`,
          )
          .all() as { id: string; name: string }[]
      ).map((row) => ({ kind, id: row.id, title: row.name })),
    );
  }
  list() {
    return this.db
      .prepare(
        "SELECT id,scheduledAt,createdAt,status,count,detail FROM content_updates ORDER BY createdAt DESC,rowid DESC LIMIT 50",
      )
      .all() as ContentUpdate[];
  }
  schedule(targets: ContentTarget[], scheduledAt: string, now: string) {
    return this.db
      .transaction(() => {
        if (
          this.db
            .prepare("SELECT 1 FROM content_updates WHERE status='scheduled'")
            .get()
        )
          throw new Error("Сначала отмените или дождитесь текущей публикации.");
        const keys = targets.map((target) => `${target.kind}:${target.id}`);
        if (new Set(keys).size !== keys.length)
          throw new Error("Материалы не должны повторяться.");
        const payload = targets.map((target) => {
          const fingerprint = this.fingerprint(target);
          if (!fingerprint) throw new Error("Выберите существующие черновики.");
          return { ...target, fingerprint };
        });
        const id = randomUUID();
        this.db
          .prepare(
            "INSERT INTO content_updates(id,scheduledAt,createdAt,status,count,payload) VALUES(?,?,?,'scheduled',?,?)",
          )
          .run(id, scheduledAt, now, targets.length, JSON.stringify(payload));
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
          .get(now) as (ContentUpdate & { payload: string }) | undefined;
        if (!job) return false;
        const targets = JSON.parse(job.payload) as (ContentTarget & {
          fingerprint: string;
        })[];
        const changed = targets.some(
          (target) => this.fingerprint(target) !== target.fingerprint,
        );
        const missed =
          Date.parse(now) - Date.parse(job.scheduledAt) > 10 * 60000;
        if (changed || missed) {
          this.db
            .prepare(
              "UPDATE content_updates SET status='failed',detail=? WHERE id=?",
            )
            .run(
              changed
                ? "Черновики изменены или удалены. Проверьте их и назначьте публикацию заново."
                : "Время публикации пропущено. Назначьте её заново.",
              job.id,
            );
          return true;
        }
        for (const target of targets)
          this.db
            .prepare(
              `UPDATE ${tables[target.kind]} SET published=1 WHERE ${target.kind === "divisions" ? "(id=? OR name=?) AND archived=0 AND region!='Другой регион'" : "id=?"}`,
            )
            .run(
              ...(target.kind === "divisions"
                ? [target.id, target.id]
                : [target.id]),
            );
        this.db
          .prepare(
            "UPDATE content_updates SET status='succeeded',detail='Выбранные материалы опубликованы. Код сайта не изменён.' WHERE id=?",
          )
          .run(job.id);
        return true;
      })
      .immediate();
  }
}
