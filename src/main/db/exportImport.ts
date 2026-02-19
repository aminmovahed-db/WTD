import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { COLUMNS, type ImportResult, type Task } from '../../shared/types';
import { taskValidationSchema } from './validation';

interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  tasks: Task[];
}

const EXPORT_SCHEMA_VERSION = 2;
const SUPPORTED_IMPORT_SCHEMA_VERSIONS = new Set([1, 2]);

function parsePayload(raw: string): ExportPayload {
  const parsed = JSON.parse(raw) as Partial<ExportPayload>;

  if (!SUPPORTED_IMPORT_SCHEMA_VERSIONS.has(parsed.schemaVersion ?? -1)) {
    throw new Error(`Unsupported schemaVersion: ${String(parsed.schemaVersion)}`);
  }

  if (!Array.isArray(parsed.tasks)) {
    throw new Error('Invalid import payload: tasks must be an array');
  }

  const tasks = parsed.tasks.map((task, idx) => {
    const result = taskValidationSchema.safeParse(task);
    if (!result.success) {
      throw new Error(`Invalid task at index ${idx}: ${result.error.issues[0]?.message ?? 'unknown error'}`);
    }

    if (!COLUMNS.includes(result.data.column)) {
      throw new Error(`Invalid column at index ${idx}`);
    }

    return result.data;
  });

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    tasks
  };
}

export function exportTasksToJson(db: Database.Database, filePath: string): void {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all() as Task[];
  const payload: ExportPayload = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tasks
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

export function importTasksFromJson(
  db: Database.Database,
  filePath: string,
  mode: 'merge' | 'replace'
): ImportResult {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const payload = parsePayload(raw);

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: []
  };

  db.transaction(() => {
    if (mode === 'replace') {
      db.prepare('DELETE FROM tasks').run();
    }

    const insert = db.prepare(
      `INSERT INTO tasks (
        id, title, notes, tag, priority, column, position, created_at, updated_at, archived_at, completed_at
      ) VALUES (
        @id, @title, @notes, @tag, @priority, @column, @position, @created_at, @updated_at, @archived_at, @completed_at
      )`
    );

    const existingIds = new Set(
      (db.prepare('SELECT id FROM tasks').all() as Array<{ id: string }>).map((row) => row.id)
    );

    payload.tasks.forEach((task) => {
      if (mode === 'merge' && existingIds.has(task.id)) {
        result.skipped += 1;
        result.errors.push(`Skipped existing task id: ${task.id}`);
        return;
      }

      insert.run(task);
      result.imported += 1;
      existingIds.add(task.id);
    });
  })();

  return result;
}
