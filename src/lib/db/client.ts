import Database from "better-sqlite3";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), "data", "orchestration.db");
const SCHEMA_PATH = join(process.cwd(), "src", "lib", "db", "schema.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
  _db = db;
  return db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
