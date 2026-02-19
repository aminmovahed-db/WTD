import type Database from 'better-sqlite3';

const LATEST_SCHEMA_VERSION = 5;
const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
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

CREATE INDEX IF NOT EXISTS idx_tasks_column_position
  ON tasks(column, position)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_archived_at
  ON tasks(archived_at)
  WHERE archived_at IS NOT NULL;
`;

export function runMigrations(db: Database.Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

  const currentVersionRow = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;

  const currentVersion = currentVersionRow ? Number(currentVersionRow.value) : 0;

  if (currentVersion >= LATEST_SCHEMA_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    db.exec(INITIAL_SCHEMA_SQL);
  }

  if (currentVersion < 2) {
    db.exec(
      `ALTER TABLE tasks
       ADD COLUMN priority TEXT NOT NULL DEFAULT 'LOW'
       CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'))`
    );
  }

  if (currentVersion < 3) {
    db.exec(`ALTER TABLE tasks ADD COLUMN tag TEXT NOT NULL DEFAULT ''`);
  }

  if (currentVersion < 4) {
    db.exec(`ALTER TABLE tasks ADD COLUMN effort INTEGER NOT NULL DEFAULT 0`);
  }

  if (currentVersion < 5) {
    db.exec(`
      CREATE TABLE tasks_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        tag TEXT NOT NULL DEFAULT '',
        effort INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'NONE'
          CHECK (priority IN ('NONE', 'LOW', 'MEDIUM', 'HIGH')),
        column TEXT NOT NULL CHECK (column IN ('BACKLOG', 'TODAY', 'DOING', 'DONE')),
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        completed_at TEXT
      );
      INSERT INTO tasks_new SELECT id, title, notes, tag, effort, priority, column, position, created_at, updated_at, archived_at, completed_at FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks(column, position) WHERE archived_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON tasks(archived_at) WHERE archived_at IS NOT NULL;
    `);
  }

  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run({ value: String(LATEST_SCHEMA_VERSION) });
}
