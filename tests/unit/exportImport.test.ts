import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { exportTasksToJson, importTasksFromJson } from '../../src/main/db/exportImport';
import { runMigrations } from '../../src/main/db/migrate';
import { TaskRepository } from '../../src/main/db/taskRepo';

const tempPaths: string[] = [];

function makeDb(): Database.Database {
  const dbPath = path.join(os.tmpdir(), `kanban-test-${randomUUID()}.sqlite`);
  tempPaths.push(dbPath);
  const db = new Database(dbPath);
  runMigrations(db);
  return db;
}

function makeExportPath(): string {
  const exportPath = path.join(os.tmpdir(), `kanban-export-${randomUUID()}.json`);
  tempPaths.push(exportPath);
  return exportPath;
}

afterEach(() => {
  tempPaths.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
  tempPaths.length = 0;
});

describe('export/import', () => {
  it('exports and imports tasks with merge conflict reporting', () => {
    const dbA = makeDb();
    const repoA = new TaskRepository(dbA);
    const task = repoA.createTask({ title: 'task A', priority: 'HIGH' });

    const exportPath = makeExportPath();
    exportTasksToJson(dbA, exportPath);

    const dbB = makeDb();
    const repoB = new TaskRepository(dbB);
    repoB.createTask({ title: 'existing' });

    const firstImport = importTasksFromJson(dbB, exportPath, 'merge');
    expect(firstImport.imported).toBe(1);
    expect(repoB.listActiveTasks().find((t) => t.id === task.id)?.priority).toBe('HIGH');

    const secondImport = importTasksFromJson(dbB, exportPath, 'merge');
    expect(secondImport.imported).toBe(0);
    expect(secondImport.skipped).toBe(1);
    expect(secondImport.errors[0]).toContain(task.id);

    dbA.close();
    dbB.close();
  });

  it('replace mode swaps dataset', () => {
    const sourceDb = makeDb();
    const sourceRepo = new TaskRepository(sourceDb);
    sourceRepo.createTask({ title: 'from source' });

    const exportPath = makeExportPath();
    exportTasksToJson(sourceDb, exportPath);

    const targetDb = makeDb();
    const targetRepo = new TaskRepository(targetDb);
    targetRepo.createTask({ title: 'old data' });

    const result = importTasksFromJson(targetDb, exportPath, 'replace');
    expect(result.imported).toBe(1);
    expect(targetRepo.listActiveTasks().map((t) => t.title)).toEqual(['from source']);

    sourceDb.close();
    targetDb.close();
  });

  it('exports an empty database without error', () => {
    const db = makeDb();
    const exportPath = makeExportPath();
    exportTasksToJson(db, exportPath);

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    expect(raw.tasks).toEqual([]);
    expect(raw.schemaVersion).toBe(2);
    expect(raw.exportedAt).toBeDefined();

    db.close();
  });

  it('preserves all task fields through export and import', () => {
    const db = makeDb();
    const repo = new TaskRepository(db);
    const task = repo.createTask({
      title: 'Full task',
      notes: 'Some notes here',
      tag: 'feature',
      priority: 'HIGH',
      column: 'DOING'
    });
    repo.updateTask({ id: task.id, effort: 3 });

    const exportPath = makeExportPath();
    exportTasksToJson(db, exportPath);

    const targetDb = makeDb();
    importTasksFromJson(targetDb, exportPath, 'replace');
    const imported = new TaskRepository(targetDb).listActiveTasks();

    expect(imported).toHaveLength(1);
    expect(imported[0].title).toBe('Full task');
    expect(imported[0].notes).toBe('Some notes here');
    expect(imported[0].tag).toBe('feature');
    expect(imported[0].priority).toBe('HIGH');
    expect(imported[0].column).toBe('DOING');
    expect(imported[0].effort).toBe(3);

    db.close();
    targetDb.close();
  });

  it('exports multiple tasks in creation order', () => {
    const db = makeDb();
    const repo = new TaskRepository(db);
    repo.createTask({ title: 'first' });
    repo.createTask({ title: 'second' });
    repo.createTask({ title: 'third' });

    const exportPath = makeExportPath();
    exportTasksToJson(db, exportPath);

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    expect(raw.tasks.map((t: any) => t.title)).toEqual(['first', 'second', 'third']);

    db.close();
  });

  it('includes archived tasks in export', () => {
    const db = makeDb();
    const repo = new TaskRepository(db);
    const task = repo.createTask({ title: 'will archive', column: 'DONE' });
    repo.archiveTask(task.id);

    const exportPath = makeExportPath();
    exportTasksToJson(db, exportPath);

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    expect(raw.tasks).toHaveLength(1);
    expect(raw.tasks[0].archived_at).not.toBeNull();

    db.close();
  });
});

describe('import error handling', () => {
  it('rejects invalid JSON', () => {
    const db = makeDb();
    const importPath = makeExportPath();
    fs.writeFileSync(importPath, 'not valid json', 'utf-8');

    expect(() => importTasksFromJson(db, importPath, 'merge')).toThrow();

    db.close();
  });

  it('rejects unsupported schema version', () => {
    const db = makeDb();
    const importPath = makeExportPath();
    fs.writeFileSync(importPath, JSON.stringify({
      schemaVersion: 999,
      exportedAt: new Date().toISOString(),
      tasks: []
    }), 'utf-8');

    expect(() => importTasksFromJson(db, importPath, 'merge')).toThrow(/schemaVersion/);

    db.close();
  });

  it('rejects missing schema version', () => {
    const db = makeDb();
    const importPath = makeExportPath();
    fs.writeFileSync(importPath, JSON.stringify({
      exportedAt: new Date().toISOString(),
      tasks: []
    }), 'utf-8');

    expect(() => importTasksFromJson(db, importPath, 'merge')).toThrow(/schemaVersion/);

    db.close();
  });

  it('rejects payload where tasks is not an array', () => {
    const db = makeDb();
    const importPath = makeExportPath();
    fs.writeFileSync(importPath, JSON.stringify({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      tasks: 'not an array'
    }), 'utf-8');

    expect(() => importTasksFromJson(db, importPath, 'merge')).toThrow(/array/);

    db.close();
  });

  it('rejects a task with invalid fields', () => {
    const db = makeDb();
    const importPath = makeExportPath();
    fs.writeFileSync(importPath, JSON.stringify({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      tasks: [{ id: 'not-a-uuid', title: '' }]
    }), 'utf-8');

    expect(() => importTasksFromJson(db, importPath, 'merge')).toThrow(/Invalid task/);

    db.close();
  });

  it('accepts schema version 1', () => {
    const db = makeDb();
    const repo = new TaskRepository(db);
    const task = repo.createTask({ title: 'v1 test' });

    const exportPath = makeExportPath();
    exportTasksToJson(db, exportPath);

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    raw.schemaVersion = 1;
    const v1Path = makeExportPath();
    fs.writeFileSync(v1Path, JSON.stringify(raw), 'utf-8');

    const targetDb = makeDb();
    const result = importTasksFromJson(targetDb, v1Path, 'replace');
    expect(result.imported).toBe(1);

    db.close();
    targetDb.close();
  });

  it('replace mode on empty target imports all tasks', () => {
    const db = makeDb();
    const repo = new TaskRepository(db);
    repo.createTask({ title: 'one' });
    repo.createTask({ title: 'two' });

    const exportPath = makeExportPath();
    exportTasksToJson(db, exportPath);

    const targetDb = makeDb();
    const result = importTasksFromJson(targetDb, exportPath, 'replace');
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);

    db.close();
    targetDb.close();
  });
});
