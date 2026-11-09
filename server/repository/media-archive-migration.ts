import type Database from "better-sqlite3";
/** Preserve nonregional material and files outside the active editorial collection. */
export function migrateMediaArchive(db: Database.Database) {
  if (db.prepare("SELECT 1 FROM migrations WHERE version=11").get()) return;
  db.transaction(() => {
    db.exec(`ALTER TABLE media ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1) AND (archived=0 OR published=0));
    UPDATE media SET archived=1 WHERE published=0 AND id IN (SELECT id FROM regional_transition_backup WHERE kind='media');
    DELETE FROM content_changes WHERE kind='media' AND id IN (SELECT id FROM media WHERE archived=1);
    DROP TRIGGER changes_media_insert;DROP TRIGGER changes_media_edit;DROP TRIGGER changes_media_clear;
    CREATE TRIGGER changes_media_insert AFTER INSERT ON media WHEN NEW.published=0 AND NEW.archived=0 BEGIN INSERT OR IGNORE INTO content_changes VALUES('media',NEW.id);END;
    CREATE TRIGGER changes_media_edit AFTER UPDATE ON media WHEN NEW.published=0 AND NEW.archived=0 AND (NEW.title IS NOT OLD.title OR NEW.description IS NOT OLD.description OR NEW.url IS NOT OLD.url OR NEW.eventDate IS NOT OLD.eventDate) BEGIN INSERT OR IGNORE INTO content_changes VALUES('media',NEW.id);END;
    CREATE TRIGGER changes_media_clear AFTER UPDATE ON media WHEN NEW.published=1 OR NEW.archived=1 BEGIN DELETE FROM content_changes WHERE kind='media' AND id=NEW.id;END;
    DROP TRIGGER changes_media_images_insert;DROP TRIGGER changes_media_images_delete;`);
    for (const action of ["INSERT", "DELETE"] as const) {
      const row = action === "INSERT" ? "NEW" : "OLD";
      db.exec(
        `CREATE TRIGGER changes_media_images_${action.toLowerCase()} AFTER ${action} ON media_images WHEN EXISTS(SELECT 1 FROM media WHERE id=${row}.mediaId AND published=0 AND archived=0) BEGIN INSERT OR IGNORE INTO content_changes VALUES('media',${row}.mediaId);END;`,
      );
    }
    db.exec("INSERT INTO migrations VALUES(11)");
  }).immediate();
}
