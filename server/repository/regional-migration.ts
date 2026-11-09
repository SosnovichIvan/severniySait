import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import names from "../../contracts/regional-divisions.json" with { type: "json" };
import transition from "../../contracts/regional-transition.json" with { type: "json" };

/** One-time, transactional regional cutover. Never deletes editorial rows or files. */
export function migrateRegion(db: Database.Database) {
  if (db.prepare("SELECT 1 FROM migrations WHERE version=9").get()) return;
  db.transaction(() => {
    db.exec(`ALTER TABLE division_links ADD COLUMN id TEXT;
      ALTER TABLE division_links ADD COLUMN region TEXT NOT NULL DEFAULT 'Москва' CHECK(region IN ('Москва','Московская область','Другой регион'));
      ALTER TABLE division_links ADD COLUMN type TEXT NOT NULL DEFAULT 'city' CHECK(type IN ('city','district'));
      ALTER TABLE division_links ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1));
      CREATE TABLE regional_transition_backup(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));`);
    const remember = db.prepare(
      "INSERT INTO regional_transition_backup VALUES(?,?,?)",
    );
    const rows = db.prepare("SELECT * FROM division_links").all() as {
      name: string;
    }[];
    for (const row of rows) {
      remember.run("divisions", row.name, JSON.stringify(row));
      const local = names.includes(row.name);
      db.prepare(
        "UPDATE division_links SET id=?,region=?,archived=?,published=CASE WHEN ? THEN published ELSE 0 END WHERE name=?",
      ).run(
        randomUUID(),
        row.name === "Москва"
          ? "Москва"
          : local
            ? "Московская область"
            : "Другой регион",
        +!local,
        +local,
        row.name,
      );
    }
    for (const name of names)
      db.prepare(
        "INSERT OR IGNORE INTO division_links(name,url,published,id,region) VALUES(?,'',1,?,?)",
      ).run(
        name,
        randomUUID(),
        name === "Москва" ? "Москва" : "Московская область",
      );
    db.exec(`CREATE UNIQUE INDEX division_identity ON division_links(id);
      CREATE TRIGGER division_id_insert BEFORE INSERT ON division_links WHEN NEW.id IS NULL OR NEW.id='' BEGIN SELECT RAISE(ABORT,'division id required'); END;
      CREATE TRIGGER division_id_update BEFORE UPDATE OF id ON division_links WHEN NEW.id IS NOT OLD.id BEGIN SELECT RAISE(ABORT,'division id immutable'); END;`);
    for (const source of transition.excludedMediaSources) {
      const media = db
        .prepare("SELECT * FROM media WHERE instr(description,?)>0")
        .all(source) as { id: string; description: string }[];
      for (const row of media) {
        // A source ending in /508 must not match a different post such as /5080.
        if (
          !row.description
            .split(/\s+/)
            .some((token) => token.replace(/[),.;]+$/u, "") === source)
        )
          continue;
        db.prepare(
          "INSERT OR IGNORE INTO regional_transition_backup VALUES('media',?,?)",
        ).run(row.id, JSON.stringify(row));
        db.prepare("UPDATE media SET published=0 WHERE id=?").run(row.id);
      }
    }
    const channel = db
      .prepare(
        "SELECT * FROM channels WHERE id='channel-1' AND url='https://t.me/sevchelrussia'",
      )
      .get();
    if (channel) {
      remember.run("channels", "channel-1", JSON.stringify(channel));
      db.prepare(
        "UPDATE channels SET url='https://t.me/moskvasevchelovek',note='Москва и Московская область' WHERE id='channel-1'",
      ).run();
    }
    db.exec(`UPDATE content_updates SET status='cancelled',detail='Региональный переход: каталог и материалы изменены. Проверьте черновики и назначьте публикацию заново.' WHERE status='scheduled';
      INSERT INTO migrations VALUES(9);`);
  }).immediate();
}
