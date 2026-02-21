import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/main/db/migrate';

const tempPaths: string[] = [];

function makeTempDb(): Database.Database {
  const dbPath = path.join(os.tmpdir(), `kanban-migrate-${randomUUID()}.sqlite`);
  tempPaths.push(dbPath);
  return new Database(dbPath);
}

function getSchemaVersion(db: Database.Database): number {
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;
  return row ? Number(row.value) : 0;
}

function getColumnNames(db: Database.Database, table: string): string[] {
  return db.pragma(`table_info(${table})`).map((col: any) => col.name);
}

afterEach(() => {
  tempPaths.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
  tempPaths.length = 0;
});

describe('migrations', () => {
  it('creates schema from scratch on empty database', () => {
    const db = makeTempDb();
    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(5);

    const columns = getColumnNames(db, 'tasks');
    expect(columns).toContain('id');
    expect(columns).toContain('title');
    expect(columns).toContain('notes');
    expect(columns).toContain('tag');
    expect(columns).toContain('effort');
    expect(columns).toContain('priority');
    expect(columns).toContain('column');
    expect(columns).toContain('position');
    expect(columns).toContain('created_at');
    expect(columns).toContain('updated_at');
    expect(columns).toContain('archived_at');
    expect(columns).toContain('completed_at');

    db.close();
  });

  it('is idempotent - running twice does nothing extra', () => {
    const db = makeTempDb();
    runMigrations(db);
    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(5);

    db.close();
  });

  it('migrates from v1 to latest adding priority, tag, effort columns', () => {
    const db = makeTempDb();

    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        column TEXT NOT NULL CHECK (column IN ('BACKLOG', 'TODAY', 'DOING', 'DONE')),
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        completed_at TEXT
      );
      INSERT INTO meta(key, value) VALUES ('schema_version', '1');
    `);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tasks (id, title, notes, column, position, created_at, updated_at, archived_at, completed_at)
       VALUES (?, 'v1 task', '', 'BACKLOG', 0, ?, ?, NULL, NULL)`
    ).run(randomUUID(), now, now);

    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(5);
    const row = db.prepare('SELECT priority, tag, effort FROM tasks LIMIT 1').get() as any;
    expect(row.priority).toBe('LOW');
    expect(row.tag).toBe('');
    expect(row.effort).toBe(0);

    db.close();
  });

  it('migrates from v2 to latest adding tag and effort', () => {
    const db = makeTempDb();

    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        column TEXT NOT NULL CHECK (column IN ('BACKLOG', 'TODAY', 'DOING', 'DONE')),
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        completed_at TEXT,
        priority TEXT NOT NULL DEFAULT 'LOW' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'))
      );
      INSERT INTO meta(key, value) VALUES ('schema_version', '2');
    `);

    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(5);
    const columns = getColumnNames(db, 'tasks');
    expect(columns).toContain('tag');
    expect(columns).toContain('effort');

    db.close();
  });

  it('migrates from v3 to latest adding effort', () => {
    const db = makeTempDb();

    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        tag TEXT NOT NULL DEFAULT '',
        column TEXT NOT NULL CHECK (column IN ('BACKLOG', 'TODAY', 'DOING', 'DONE')),
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        completed_at TEXT,
        priority TEXT NOT NULL DEFAULT 'LOW' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'))
      );
      INSERT INTO meta(key, value) VALUES ('schema_version', '3');
    `);

    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(5);
    const columns = getColumnNames(db, 'tasks');
    expect(columns).toContain('effort');

    db.close();
  });

  it('migrates from v4 to v5 adding NONE priority', () => {
    const db = makeTempDb();

    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        tag TEXT NOT NULL DEFAULT '',
        effort INTEGER NOT NULL DEFAULT 0,
        column TEXT NOT NULL CHECK (column IN ('BACKLOG', 'TODAY', 'DOING', 'DONE')),
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        completed_at TEXT,
        priority TEXT NOT NULL DEFAULT 'LOW' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'))
      );
      INSERT INTO meta(key, value) VALUES ('schema_version', '4');
    `);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tasks (id, title, notes, tag, effort, priority, column, position, created_at, updated_at, archived_at, completed_at)
       VALUES (?, 'v4 task', '', '', 0, 'HIGH', 'BACKLOG', 0, ?, ?, NULL, NULL)`
    ).run(randomUUID(), now, now);

    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(5);
    const row = db.prepare('SELECT priority FROM tasks LIMIT 1').get() as any;
    expect(row.priority).toBe('HIGH');

    db.prepare(
      `INSERT INTO tasks (id, title, notes, tag, effort, priority, column, position, created_at, updated_at, archived_at, completed_at)
       VALUES (?, 'none task', '', '', 0, 'NONE', 'BACKLOG', 1, ?, ?, NULL, NULL)`
    ).run(randomUUID(), now, now);
    const noneRow = db.prepare("SELECT priority FROM tasks WHERE title = 'none task'").get() as any;
    expect(noneRow.priority).toBe('NONE');

    db.close();
  });

  it('preserves existing data through full migration chain', () => {
    const db = makeTempDb();
    const taskId = randomUUID();
    const now = new Date().toISOString();

    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        column TEXT NOT NULL CHECK (column IN ('BACKLOG', 'TODAY', 'DOING', 'DONE')),
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        completed_at TEXT
      );
      INSERT INTO meta(key, value) VALUES ('schema_version', '1');
    `);

    db.prepare(
      `INSERT INTO tasks (id, title, notes, column, position, created_at, updated_at, archived_at, completed_at)
       VALUES (?, 'Preserved', 'my notes', 'DOING', 2, ?, ?, NULL, NULL)`
    ).run(taskId, now, now);

    runMigrations(db);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    expect(task.title).toBe('Preserved');
    expect(task.notes).toBe('my notes');
    expect(task.column).toBe('DOING');
    expect(task.position).toBe(2);
    expect(task.created_at).toBe(now);

    db.close();
  });
});
