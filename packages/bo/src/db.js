import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const DB_PATH = process.env.INVENTORY_DB_PATH ?? join(import.meta.dirname, '..', 'inventory.db');

export const db = new DatabaseSync(DB_PATH);

// CHECK constraints are a second line of defense: even if the JavaScript
// validation had a bug, the database would refuse a negative stock.
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS products (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    price      REAL    NOT NULL CHECK (price > 0),
    stock      INTEGER NOT NULL CHECK (stock >= 0),
    created_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products (id),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL    NOT NULL,
    total      REAL    NOT NULL,
    created_at TEXT    NOT NULL
  );
`);

// Runs fn inside a transaction: either all its changes are saved, or none.
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function closeDb() {
  db.close();
}
