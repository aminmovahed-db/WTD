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
  it('creates, updates, moves, archives, and restores', () => {
    const { db, repo } = createRepository();
    const task = repo.createTask({ title: 'Task 1', column: 'BACKLOG' });

    const updated = repo.updateTask({ id: task.id, notes: 'note' });
    expect(updated.notes).toBe('note');

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
