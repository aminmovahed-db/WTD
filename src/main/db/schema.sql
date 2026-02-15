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
