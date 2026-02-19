import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/main/db/migrate';
import { TaskRepository } from '../../src/main/db/taskRepo';

const tempPaths: string[] = [];

function createRepository(): { db: Database.Database; repo: TaskRepository } {
  const dbPath = path.join(os.tmpdir(), `kanban-integration-${randomUUID()}.sqlite`);
  tempPaths.push(dbPath);
  const db = new Database(dbPath);
  runMigrations(db);
  const repo = new TaskRepository(db);
  return { db, repo };
}

afterEach(() => {
  tempPaths.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
  tempPaths.length = 0;
});

describe('TaskRepository lifecycle', () => {
  it('migrates a v1 database and backfills LOW priority', () => {
    const dbPath = path.join(os.tmpdir(), `kanban-migration-${randomUUID()}.sqlite`);
    tempPaths.push(dbPath);
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
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
      `INSERT INTO tasks (
        id, title, notes, column, position, created_at, updated_at, archived_at, completed_at
      ) VALUES (
        @id, @title, @notes, @column, @position, @created_at, @updated_at, @archived_at, @completed_at
      )`
    ).run({
      id: randomUUID(),
      title: 'Legacy task',
      notes: '',
      column: 'BACKLOG',
      position: 0,
      created_at: now,
      updated_at: now,
      archived_at: null,
      completed_at: null
    });

    runMigrations(db);
    const row = db.prepare('SELECT priority FROM tasks LIMIT 1').get() as { priority: string };
    expect(row.priority).toBe('LOW');

    const repo = new TaskRepository(db);
    const created = repo.createTask({ title: 'New task', priority: 'MEDIUM' });
    expect(created.priority).toBe('MEDIUM');

    db.close();
  });

  it('creates, updates, moves, archives, and restores', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task 1', column: 'BACKLOG' });
    expect(task.priority).toBe('NONE');

    const updated = repo.updateTask({ id: task.id, notes: 'note', priority: 'HIGH' });
    expect(updated.notes).toBe('note');
    expect(updated.priority).toBe('HIGH');

    repo.moveTask(task.id, 'TODAY', 0);
    expect(repo.listActiveTasks().find((t) => t.id === task.id)?.column).toBe('TODAY');

    repo.moveTask(task.id, 'DONE', 0);
    const movedToDone = repo.listActiveTasks().find((t) => t.id === task.id);
    expect(movedToDone?.completed_at).not.toBeNull();

    repo.archiveTask(task.id);
    expect(repo.listArchivedTasks().length).toBe(1);

    repo.restoreTask(task.id, 'BACKLOG');
    expect(repo.listArchivedTasks().length).toBe(0);
    expect(repo.listActiveTasks().find((t) => t.id === task.id)?.column).toBe('BACKLOG');

    db.close();
  });

  it('reorders tasks in a column', () => {
    const { db, repo } = createRepository();
    const a = repo.createTask({ title: 'a', column: 'BACKLOG' });
    const b = repo.createTask({ title: 'b', column: 'BACKLOG' });
    const c = repo.createTask({ title: 'c', column: 'BACKLOG' });

    repo.reorderColumn({ column: 'BACKLOG', orderedIds: [c.id, a.id, b.id] });
    const titles = repo
      .listActiveTasks()
      .filter((task) => task.column === 'BACKLOG')
      .map((task) => task.title);

    expect(titles).toEqual(['c', 'a', 'b']);

    db.close();
  });
});
