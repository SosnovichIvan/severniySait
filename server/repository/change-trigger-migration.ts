import type Database from "better-sqlite3";
/** UPSERT's conflict policy overrides trigger OR IGNORE: avoid conflicting rows explicitly. */
export function migrateChangeTriggers(db: Database.Database) {
  if (db.prepare("SELECT 1 FROM migrations WHERE version=12").get()) return;
  db.transaction(() => {
    const triggers = db
      .prepare(
        "SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'changes_%'",
      )
      .all() as { name: string; sql: string }[];
    for (const trigger of triggers) {
      const sql = trigger.sql.replace(
        /INSERT OR IGNORE INTO content_changes VALUES\('([^']+)',((?:NEW|OLD)\.(?:id|mediaId))\)/g,
        (_, kind: string, id: string) =>
          `INSERT INTO content_changes SELECT '${kind}',${id} WHERE NOT EXISTS(SELECT 1 FROM content_changes WHERE kind='${kind}' AND id=${id})`,
      );
      db.exec(`DROP TRIGGER ${trigger.name};${sql}`);
    }
    db.exec("INSERT INTO migrations VALUES(12)");
  }).immediate();
}
