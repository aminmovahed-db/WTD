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

    const exportPath = path.join(os.tmpdir(), `kanban-export-${randomUUID()}.json`);
    tempPaths.push(exportPath);
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

    const exportPath = path.join(os.tmpdir(), `kanban-export-${randomUUID()}.json`);
    tempPaths.push(exportPath);
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
});
