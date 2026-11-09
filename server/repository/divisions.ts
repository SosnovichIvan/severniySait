import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { DivisionLink } from "../../contracts/content.js";

type Row = Omit<DivisionLink, "published" | "archived"> & {
  published: number;
  archived: number;
};
export class Divisions {
  constructor(private db: Database.Database) {}
  list(admin: boolean) {
    const rows = this.db
      .prepare(
        `SELECT ${admin ? "*" : "id,name,url,region,type"} FROM division_links ${admin ? "" : "WHERE published=1 AND archived=0 AND region!='Другой регион'"} ORDER BY name LIMIT 500`,
      )
      .all() as Row[];
    return rows.map(({ published, archived, ...row }) =>
      admin ? { ...row, published: !!published, archived: !!archived } : row,
    );
  }
  find(id: string) {
    return this.db
      .prepare("SELECT * FROM division_links WHERE id=? OR name=?")
      .get(id, id) as Row | undefined;
  }
  save(input: DivisionLink, id?: string) {
    const previous = id ? this.find(id) : this.find(input.name);
    const row = {
      coordinator: "",
      contact: "",
      vk: "",
      max: "",
      telegram: "",
      email: "",
      website: "",
      region: "Москва",
      type: "city",
      ...previous,
      ...input,
      id: previous?.id ?? randomUUID(),
      published:
        input.published === undefined
          ? (previous?.published ?? 1)
          : +input.published,
      archived: previous?.archived ?? 0,
    };
    if (row.archived || row.region === "Другой регион") row.published = 0;
    this.db
      .prepare(
        `INSERT INTO division_links(name,url,published,coordinator,contact,vk,max,telegram,email,website,id,region,type,archived)
      VALUES(@name,@url,@published,@coordinator,@contact,@vk,@max,@telegram,@email,@website,@id,@region,@type,@archived)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,published=excluded.published,coordinator=excluded.coordinator,contact=excluded.contact,
      vk=excluded.vk,max=excluded.max,telegram=excluded.telegram,email=excluded.email,website=excluded.website,region=excluded.region,type=excluded.type`,
      )
      .run(row);
    return row.id!;
  }
  archive(id: string, archived: boolean) {
    return this.db
      .prepare("UPDATE division_links SET archived=?,published=0 WHERE id=?")
      .run(+archived, id).changes;
  }
  publish(id: string, published: boolean) {
    return this.db
      .prepare(
        "UPDATE division_links SET published=? WHERE (id=? OR name=?) AND archived=0 AND region!='Другой регион'",
      )
      .run(+published, id, id).changes;
  }
}
