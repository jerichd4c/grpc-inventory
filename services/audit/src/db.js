import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const DB_PATH = process.env.AUDIT_DB_PATH ?? join(import.meta.dirname, '..', 'audit.db');

// The file is created automatically the first time.
const db = new DatabaseSync(DB_PATH);

// IF NOT EXISTS: safe to run on every start.
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    entity    TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action    TEXT NOT NULL,
    detail    TEXT NOT NULL,
    timestamp TEXT NOT NULL
  )
`);

// Prepared statements: the SQL is compiled once and the values travel
// separately, so user input is never executed as SQL (no SQL injection).
const insertStmt = db.prepare(`
  INSERT INTO events (entity, entity_id, action, detail, timestamp)
  VALUES (?, ?, ?, ?, ?)
`);
const listAllStmt = db.prepare(`
  SELECT * FROM events ORDER BY id DESC LIMIT ?
`);
const listByEntityStmt = db.prepare(`
  SELECT * FROM events WHERE entity = ? ORDER BY id DESC LIMIT ?
`);

export function insertEvent({ entity, entity_id, action, detail }) {
  const timestamp = new Date().toISOString();
  const result = insertStmt.run(entity, entity_id, action, detail, timestamp);
  return { id: Number(result.lastInsertRowid), timestamp };
}

export function listEvents(entity, limit) {
  return entity
    ? listByEntityStmt.all(entity, limit)
    : listAllStmt.all(limit);
}

export function closeDb() {
  db.close();
}
