import path from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate';

export function initDatabase(userDataPath: string): Database.Database {
  const dbPath = path.join(userDataPath, 'kanban.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  runMigrations(db);
  return db;
}
