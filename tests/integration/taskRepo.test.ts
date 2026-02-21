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

describe('TaskRepository - create task', () => {
  it('creates task with default values', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Simple task' });

    expect(task.title).toBe('Simple task');
    expect(task.column).toBe('BACKLOG');
    expect(task.notes).toBe('');
    expect(task.tag).toBe('');
    expect(task.effort).toBe(0);
    expect(task.priority).toBe('NONE');
    expect(task.position).toBe(0);
    expect(task.archived_at).toBeNull();
    expect(task.completed_at).toBeNull();
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);

    db.close();
  });

  it('creates task in DONE column with completed_at set', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Done task', column: 'DONE' });

    expect(task.column).toBe('DONE');
    expect(task.completed_at).not.toBeNull();

    db.close();
  });

  it('creates task in non-DONE column with completed_at null', () => {
    const { db, repo } = createRepository();
    for (const col of ['BACKLOG', 'TODAY', 'DOING'] as const) {
      const task = repo.createTask({ title: `task in ${col}`, column: col });
      expect(task.completed_at).toBeNull();
    }

    db.close();
  });

  it('assigns sequential positions within a column', () => {
    const { db, repo } = createRepository();
    const t1 = repo.createTask({ title: 'first', column: 'TODAY' });
    const t2 = repo.createTask({ title: 'second', column: 'TODAY' });
    const t3 = repo.createTask({ title: 'third', column: 'TODAY' });

    expect(t1.position).toBe(0);
    expect(t2.position).toBe(1);
    expect(t3.position).toBe(2);

    db.close();
  });

  it('positions are independent across columns', () => {
    const { db, repo } = createRepository();
    const backlog = repo.createTask({ title: 'backlog', column: 'BACKLOG' });
    const today = repo.createTask({ title: 'today', column: 'TODAY' });

    expect(backlog.position).toBe(0);
    expect(today.position).toBe(0);

    db.close();
  });

  it('trims title whitespace', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: '  spaces around  ' });
    expect(task.title).toBe('spaces around');

    db.close();
  });

  it('rejects empty title', () => {
    const { db, repo } = createRepository();
    expect(() => repo.createTask({ title: '' })).toThrow();
    expect(() => repo.createTask({ title: '   ' })).toThrow();

    db.close();
  });

  it('creates task with all optional fields', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({
      title: 'Full task',
      notes: 'Some notes',
      tag: 'feature',
      priority: 'HIGH',
      column: 'DOING'
    });

    expect(task.notes).toBe('Some notes');
    expect(task.tag).toBe('feature');
    expect(task.priority).toBe('HIGH');
    expect(task.column).toBe('DOING');

    db.close();
  });
});

describe('TaskRepository - update task', () => {
  it('updates only specified fields', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Original', notes: 'orig notes', tag: 'bug' });

    const updated = repo.updateTask({ id: task.id, title: 'Changed' });
    expect(updated.title).toBe('Changed');
    expect(updated.notes).toBe('orig notes');
    expect(updated.tag).toBe('bug');

    db.close();
  });

  it('updates updated_at timestamp', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task' });
    const updated = repo.updateTask({ id: task.id, notes: 'changed' });

    expect(updated.updated_at).not.toBe(task.updated_at);

    db.close();
  });

  it('throws for non-existent task id', () => {
    const { db, repo } = createRepository();
    expect(() => repo.updateTask({ id: randomUUID(), title: 'nope' })).toThrow(/not found/);

    db.close();
  });

  it('updates effort value', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task' });

    const updated = repo.updateTask({ id: task.id, effort: 5 });
    expect(updated.effort).toBe(5);

    db.close();
  });

  it('updates tag to empty string', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Tagged', tag: 'bug' });

    const updated = repo.updateTask({ id: task.id, tag: '' });
    expect(updated.tag).toBe('');

    db.close();
  });
});

describe('TaskRepository - move task', () => {
  it('sets completed_at when moving to DONE', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task', column: 'BACKLOG' });

    repo.moveTask(task.id, 'DONE', 0);
    const moved = repo.listActiveTasks().find((t) => t.id === task.id);
    expect(moved?.completed_at).not.toBeNull();
    expect(moved?.column).toBe('DONE');

    db.close();
  });

  it('clears completed_at when moving out of DONE', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task', column: 'DONE' });
    expect(task.completed_at).not.toBeNull();

    repo.moveTask(task.id, 'BACKLOG', 0);
    const moved = repo.listActiveTasks().find((t) => t.id === task.id);
    expect(moved?.completed_at).toBeNull();

    db.close();
  });

  it('preserves completed_at when moving within DONE', () => {
    const { db, repo } = createRepository();
    const t1 = repo.createTask({ title: 'first', column: 'DONE' });
    repo.createTask({ title: 'second', column: 'DONE' });

    const originalCompletedAt = t1.completed_at;
    repo.moveTask(t1.id, 'DONE', 1);
    const moved = repo.listActiveTasks().find((t) => t.id === t1.id);
    expect(moved?.completed_at).toBe(originalCompletedAt);

    db.close();
  });

  it('normalizes positions in source column after move', () => {
    const { db, repo } = createRepository();
    const a = repo.createTask({ title: 'a', column: 'BACKLOG' });
    const b = repo.createTask({ title: 'b', column: 'BACKLOG' });
    const c = repo.createTask({ title: 'c', column: 'BACKLOG' });

    repo.moveTask(b.id, 'TODAY', 0);

    const backlogTasks = repo.listActiveTasks().filter((t) => t.column === 'BACKLOG');
    expect(backlogTasks.map((t) => t.position)).toEqual([0, 1]);
    expect(backlogTasks.map((t) => t.title)).toEqual(['a', 'c']);

    db.close();
  });

  it('clamps position to valid range', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task', column: 'BACKLOG' });

    repo.moveTask(task.id, 'TODAY', 999);
    const moved = repo.listActiveTasks().find((t) => t.id === task.id);
    expect(moved?.column).toBe('TODAY');
    expect(moved?.position).toBe(0);

    db.close();
  });

  it('throws for non-existent task', () => {
    const { db, repo } = createRepository();
    expect(() => repo.moveTask(randomUUID(), 'TODAY', 0)).toThrow(/not found/);

    db.close();
  });

  it('throws for invalid column', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task' });
    expect(() => repo.moveTask(task.id, 'INVALID' as any, 0)).toThrow(/Invalid column/);

    db.close();
  });
});

describe('TaskRepository - delete task', () => {
  it('removes task from active list', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Doomed' });

    repo.deleteTask(task.id);
    expect(repo.listActiveTasks()).toHaveLength(0);

    db.close();
  });

  it('normalizes positions after deletion', () => {
    const { db, repo } = createRepository();
    const a = repo.createTask({ title: 'a', column: 'BACKLOG' });
    const b = repo.createTask({ title: 'b', column: 'BACKLOG' });
    const c = repo.createTask({ title: 'c', column: 'BACKLOG' });

    repo.deleteTask(b.id);
    const remaining = repo.listActiveTasks().filter((t) => t.column === 'BACKLOG');
    expect(remaining.map((t) => t.title)).toEqual(['a', 'c']);
    expect(remaining.map((t) => t.position)).toEqual([0, 1]);

    db.close();
  });

  it('throws for non-existent task', () => {
    const { db, repo } = createRepository();
    expect(() => repo.deleteTask(randomUUID())).toThrow(/not found/);

    db.close();
  });
});

describe('TaskRepository - archive and restore', () => {
  it('archived task disappears from active and appears in archived', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Archive me', column: 'DONE' });

    repo.archiveTask(task.id);
    expect(repo.listActiveTasks()).toHaveLength(0);
    expect(repo.listArchivedTasks()).toHaveLength(1);
    expect(repo.listArchivedTasks()[0].archived_at).not.toBeNull();

    db.close();
  });

  it('restoring to DONE sets completed_at', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task', column: 'DONE' });
    repo.archiveTask(task.id);

    repo.restoreTask(task.id, 'DONE');
    const restored = repo.listActiveTasks().find((t) => t.id === task.id);
    expect(restored?.completed_at).not.toBeNull();
    expect(restored?.archived_at).toBeNull();

    db.close();
  });

  it('restoring to non-DONE column clears completed_at', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task', column: 'DONE' });
    repo.archiveTask(task.id);

    repo.restoreTask(task.id, 'BACKLOG');
    const restored = repo.listActiveTasks().find((t) => t.id === task.id);
    expect(restored?.completed_at).toBeNull();

    db.close();
  });

  it('restoring defaults to BACKLOG', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task', column: 'DONE' });
    repo.archiveTask(task.id);

    repo.restoreTask(task.id);
    const restored = repo.listActiveTasks().find((t) => t.id === task.id);
    expect(restored?.column).toBe('BACKLOG');

    db.close();
  });

  it('throws for invalid column on restore', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task', column: 'DONE' });
    repo.archiveTask(task.id);

    expect(() => repo.restoreTask(task.id, 'INVALID' as any)).toThrow(/Invalid column/);

    db.close();
  });

  it('normalizes positions in column after archiving', () => {
    const { db, repo } = createRepository();
    const a = repo.createTask({ title: 'a', column: 'BACKLOG' });
    const b = repo.createTask({ title: 'b', column: 'BACKLOG' });
    const c = repo.createTask({ title: 'c', column: 'BACKLOG' });

    repo.archiveTask(b.id);
    const remaining = repo.listActiveTasks().filter((t) => t.column === 'BACKLOG');
    expect(remaining.map((t) => t.position)).toEqual([0, 1]);

    db.close();
  });
});

describe('TaskRepository - reorder column', () => {
  it('throws for invalid column', () => {
    const { db, repo } = createRepository();
    expect(() => repo.reorderColumn({ column: 'INVALID' as any, orderedIds: [] })).toThrow(/Invalid column/);

    db.close();
  });

  it('handles empty column reorder', () => {
    const { db, repo } = createRepository();
    repo.reorderColumn({ column: 'BACKLOG', orderedIds: [] });
    expect(repo.listActiveTasks().filter((t) => t.column === 'BACKLOG')).toHaveLength(0);

    db.close();
  });

  it('reorder with single task', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'solo', column: 'TODAY' });

    repo.reorderColumn({ column: 'TODAY', orderedIds: [task.id] });
    const tasks = repo.listActiveTasks().filter((t) => t.column === 'TODAY');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].position).toBe(0);

    db.close();
  });
});

describe('TaskRepository - listing', () => {
  it('listActiveTasks returns tasks ordered by column then position', () => {
    const { db, repo } = createRepository();
    repo.createTask({ title: 'backlog-1', column: 'BACKLOG' });
    repo.createTask({ title: 'doing-1', column: 'DOING' });
    repo.createTask({ title: 'today-1', column: 'TODAY' });
    repo.createTask({ title: 'done-1', column: 'DONE' });

    const tasks = repo.listActiveTasks();
    const columns = tasks.map((t) => t.column);
    expect(columns).toEqual(['BACKLOG', 'TODAY', 'DOING', 'DONE']);

    db.close();
  });

  it('listActiveTasks excludes archived tasks', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Will archive', column: 'DONE' });
    repo.createTask({ title: 'Active' });

    repo.archiveTask(task.id);
    expect(repo.listActiveTasks()).toHaveLength(1);
    expect(repo.listActiveTasks()[0].title).toBe('Active');

    db.close();
  });

  it('listArchivedTasks returns only archived tasks sorted by archived_at desc', () => {
    const { db, repo } = createRepository();
    const t1 = repo.createTask({ title: 'first', column: 'DONE' });
    const t2 = repo.createTask({ title: 'second', column: 'DONE' });

    repo.archiveTask(t1.id);
    repo.archiveTask(t2.id);

    const archived = repo.listArchivedTasks();
    expect(archived).toHaveLength(2);
    expect(archived[0].title).toBe('second');
    expect(archived[1].title).toBe('first');

    db.close();
  });

  it('returns empty arrays when no tasks exist', () => {
    const { db, repo } = createRepository();
    expect(repo.listActiveTasks()).toEqual([]);
    expect(repo.listArchivedTasks()).toEqual([]);

    db.close();
  });
});
