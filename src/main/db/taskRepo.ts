import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  COLUMNS,
  type Column,
  type CreateTaskInput,
  type ReorderColumnInput,
  type Task,
  type UpdateTaskInput
} from '../../shared/types';
import { createTaskInputSchema, normalizeTitle, updateTaskInputSchema } from './validation';

export class TaskRepository {
  constructor(private readonly db: Database.Database) {}

  listActiveTasks(): Task[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE archived_at IS NULL
         ORDER BY CASE column
           WHEN 'BACKLOG' THEN 1
           WHEN 'TODAY' THEN 2
           WHEN 'DOING' THEN 3
           WHEN 'DONE' THEN 4
         END ASC, position ASC`
      )
      .all() as Task[];

    return rows;
  }

  listArchivedTasks(): Task[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE archived_at IS NOT NULL
         ORDER BY archived_at DESC`
      )
      .all() as Task[];

    return rows;
  }

  createTask(input: CreateTaskInput): Task {
    const parsed = createTaskInputSchema.parse(input);
    const now = new Date().toISOString();
    const column: Column = parsed.column ?? 'BACKLOG';
    const position = this.nextPosition(column);

    const task: Task = {
      id: uuidv4(),
      title: normalizeTitle(parsed.title),
      notes: parsed.notes ?? '',
      priority: parsed.priority ?? 'LOW',
      column,
      position,
      created_at: now,
      updated_at: now,
      archived_at: null,
      completed_at: column === 'DONE' ? now : null
    };

    this.db
      .prepare(
        `INSERT INTO tasks (
          id, title, notes, priority, column, position, created_at, updated_at, archived_at, completed_at
        ) VALUES (
          @id, @title, @notes, @priority, @column, @position, @created_at, @updated_at, @archived_at, @completed_at
        )`
      )
      .run(task);

    return task;
  }

  updateTask(input: UpdateTaskInput): Task {
    const parsed = updateTaskInputSchema.parse(input);
    const existing = this.getTask(parsed.id);

    const updated: Task = {
      ...existing,
      title: parsed.title !== undefined ? normalizeTitle(parsed.title) : existing.title,
      notes: parsed.notes !== undefined ? parsed.notes : existing.notes,
      priority: parsed.priority !== undefined ? parsed.priority : existing.priority,
      updated_at: new Date().toISOString()
    };

    this.db
      .prepare(
        `UPDATE tasks
         SET title = @title,
             notes = @notes,
             priority = @priority,
             updated_at = @updated_at
         WHERE id = @id`
      )
      .run(updated);

    return updated;
  }

  moveTask(id: string, toColumn: Column, toPosition: number): void {
    if (!COLUMNS.includes(toColumn)) {
      throw new Error(`Invalid column: ${toColumn}`);
    }

    const task = this.getTask(id);
    const sourceColumn = task.column;

    this.db.transaction(() => {
      const targetIds = this.db
        .prepare(
          `SELECT id FROM tasks
           WHERE archived_at IS NULL AND column = ? AND id != ?
           ORDER BY position ASC`
        )
        .all(toColumn, id)
        .map((row) => (row as { id: string }).id);

      const clampedPosition = Math.max(0, Math.min(toPosition, targetIds.length));
      targetIds.splice(clampedPosition, 0, id);

      targetIds.forEach((taskId, index) => {
        const completedAt =
          taskId === id
            ? toColumn === 'DONE'
              ? sourceColumn === 'DONE'
                ? task.completed_at
                : new Date().toISOString()
              : null
            : undefined;

        if (taskId === id) {
          this.db
            .prepare(
              `UPDATE tasks
               SET column = ?, position = ?, completed_at = ?, updated_at = ?
               WHERE id = ?`
            )
            .run(toColumn, index, completedAt, new Date().toISOString(), taskId);
        } else {
          this.db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(index, taskId);
        }
      });

      if (sourceColumn !== toColumn) {
        this.normalizeColumnPositions(sourceColumn);
      }
    })();
  }

  reorderColumn(input: ReorderColumnInput): void {
    if (!COLUMNS.includes(input.column)) {
      throw new Error(`Invalid column: ${input.column}`);
    }

    this.db.transaction(() => {
      input.orderedIds.forEach((id, idx) => {
        this.db
          .prepare(
            `UPDATE tasks
             SET position = ?, updated_at = ?
             WHERE id = ? AND column = ? AND archived_at IS NULL`
          )
          .run(idx, new Date().toISOString(), id, input.column);
      });

      this.normalizeColumnPositions(input.column);
    })();
  }

  archiveTask(id: string): void {
    const now = new Date().toISOString();
    const task = this.getTask(id);

    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE tasks
           SET archived_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(now, now, id);

      this.normalizeColumnPositions(task.column);
    })();
  }

  deleteTask(id: string): void {
    const task = this.getTask(id);

    this.db.transaction(() => {
      this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      this.normalizeColumnPositions(task.column);
    })();
  }

  restoreTask(id: string, toColumn: Column = 'BACKLOG'): void {
    if (!COLUMNS.includes(toColumn)) {
      throw new Error(`Invalid column: ${toColumn}`);
    }

    const now = new Date().toISOString();
    const position = this.nextPosition(toColumn);
    const completedAt = toColumn === 'DONE' ? now : null;

    this.db
      .prepare(
        `UPDATE tasks
         SET archived_at = NULL,
             column = ?,
             position = ?,
             updated_at = ?,
             completed_at = ?
         WHERE id = ?`
      )
      .run(toColumn, position, now, completedAt, id);
  }

  private getTask(id: string): Task {
    const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    return task;
  }

  private nextPosition(column: Column): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) AS maxPosition FROM tasks WHERE column = ? AND archived_at IS NULL')
      .get(column) as { maxPosition: number };

    return row.maxPosition + 1;
  }

  private normalizeColumnPositions(column: Column): void {
    const ids = this.db
      .prepare(
        `SELECT id FROM tasks
         WHERE column = ? AND archived_at IS NULL
         ORDER BY position ASC`
      )
      .all(column)
      .map((row) => (row as { id: string }).id);

    ids.forEach((id, idx) => {
      this.db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(idx, id);
    });
  }
}
