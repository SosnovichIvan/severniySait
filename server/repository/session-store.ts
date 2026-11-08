import session from "express-session";
import type { Store } from "./store.js";
export class SqliteSessions extends session.Store {
  constructor(private storage: Store) {
    super();
  }
  get(
    sid: string,
    callback: (err: unknown, value?: session.SessionData | null) => void,
  ) {
    const row = this.storage.db
      .prepare("SELECT data FROM sessions WHERE sid=? AND expires>?")
      .get(sid, Date.now()) as { data: string } | undefined;
    callback(null, row ? JSON.parse(row.data) : null);
  }
  set(
    sid: string,
    value: session.SessionData,
    callback: (err?: unknown) => void,
  ) {
    this.storage.db
      .prepare("DELETE FROM sessions WHERE expires<?")
      .run(Date.now());
    this.storage.db
      .prepare("INSERT OR REPLACE INTO sessions VALUES(?,?,?)")
      .run(sid, JSON.stringify(value), Date.now() + 8 * 3600000);
    callback();
  }
  destroy(sid: string, callback: (err?: unknown) => void) {
    this.storage.db.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
    callback();
  }
}
declare module "express-session" {
  interface SessionData {
    admin?: boolean;
    csrf?: string;
  }
}
