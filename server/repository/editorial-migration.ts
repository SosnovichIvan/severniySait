import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/** Track only editorial draft writes, never previously hidden archive rows. */
export function migrateEditorialChanges(db: Database.Database) {
  if (db.prepare("SELECT 1 FROM migrations WHERE version=10").get()) return;
  db.transaction(() => {
    db.exec(`CREATE TABLE content_changes(kind TEXT NOT NULL CHECK(kind IN ('events','media','divisions','channels')),id TEXT NOT NULL,PRIMARY KEY(kind,id));
      UPDATE content_updates SET status='cancelled',detail='Изменён порядок обновления: назначьте публикацию всех ожидающих изменений заново.' WHERE status='scheduled';`);
    db.prepare(
      "INSERT OR IGNORE INTO division_links(name,url,published,id,region,type) VALUES(?,'',1,?,'Московская область','city')",
    ).run("Люберцы", randomUUID());
    const specs = [
      ["events", "events", ["title", "description", "city", "startsAt"]],
      ["media", "media", ["title", "description", "url", "eventDate"]],
      [
        "divisions",
        "division_links",
        [
          "name",
          "url",
          "region",
          "type",
          "coordinator",
          "contact",
          "vk",
          "max",
          "telegram",
          "email",
          "website",
          "archived",
        ],
      ],
      ["channels", "channels", ["name", "note", "short", "url"]],
    ] as const;
    for (const [kind, table, columns] of specs) {
      const eligible = `NEW.published=0${kind === "divisions" ? " AND NEW.archived=0 AND NEW.region!='Другой регион'" : ""}`;
      const changed = columns
        .map((column) => `NEW.${column} IS NOT OLD.${column}`)
        .join(" OR ");
      db.exec(`CREATE TRIGGER changes_${kind}_insert AFTER INSERT ON ${table} WHEN ${eligible} BEGIN INSERT OR IGNORE INTO content_changes VALUES('${kind}',NEW.id); END;
        CREATE TRIGGER changes_${kind}_edit AFTER UPDATE ON ${table} WHEN ${eligible} AND (${changed}) BEGIN INSERT OR IGNORE INTO content_changes VALUES('${kind}',NEW.id); END;
        CREATE TRIGGER changes_${kind}_clear AFTER UPDATE ON ${table} WHEN NEW.published=1${kind === "divisions" ? " OR NEW.archived=1 OR NEW.region='Другой регион'" : ""} BEGIN DELETE FROM content_changes WHERE kind='${kind}' AND id=NEW.id; END;
        CREATE TRIGGER changes_${kind}_delete AFTER DELETE ON ${table} BEGIN DELETE FROM content_changes WHERE kind='${kind}' AND id=OLD.id; END;`);
    }
    for (const action of ["INSERT", "DELETE"] as const) {
      const row = action === "INSERT" ? "NEW" : "OLD";
      db.exec(
        `CREATE TRIGGER changes_media_images_${action.toLowerCase()} AFTER ${action} ON media_images WHEN EXISTS(SELECT 1 FROM media WHERE id=${row}.mediaId AND published=0) BEGIN INSERT OR IGNORE INTO content_changes VALUES('media',${row}.mediaId); END;`,
      );
    }
    db.exec("INSERT INTO migrations VALUES(10)");
  }).immediate();
}
