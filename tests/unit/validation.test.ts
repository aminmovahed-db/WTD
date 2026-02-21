import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  assertColumn,
  createTaskInputSchema,
  normalizeTitle,
  taskValidationSchema,
  updateTaskInputSchema,
  validateTask
} from '../../src/main/db/validation';
import type { Task } from '../../src/shared/types';

describe('normalizeTitle', () => {
  it('trims whitespace from both ends', () => {
    expect(normalizeTitle('  task name  ')).toBe('task name');
  });

  it('returns empty string when given only whitespace', () => {
    expect(normalizeTitle('   ')).toBe('');
  });

  it('preserves internal whitespace', () => {
    expect(normalizeTitle('  hello   world  ')).toBe('hello   world');
  });
});

describe('createTaskInputSchema', () => {
  it('trims and validates title', () => {
    const valid = createTaskInputSchema.parse({ title: '  hello  ' });
    expect(valid.title).toBe('hello');
  });

  it('rejects empty title', () => {
    expect(() => createTaskInputSchema.parse({ title: '' })).toThrow();
    expect(() => createTaskInputSchema.parse({ title: '   ' })).toThrow();
  });

  it('rejects title over 200 characters', () => {
    expect(() => createTaskInputSchema.parse({ title: 'x'.repeat(201) })).toThrow();
  });

  it('accepts title at exactly 200 characters', () => {
    const result = createTaskInputSchema.parse({ title: 'x'.repeat(200) });
    expect(result.title).toHaveLength(200);
  });

  it('rejects invalid priority', () => {
    expect(() => createTaskInputSchema.parse({ title: 'ok', priority: 'URGENT' })).toThrow();
    expect(() => createTaskInputSchema.parse({ title: 'ok', priority: '' })).toThrow();
  });

  it('accepts all valid priorities', () => {
    for (const p of ['NONE', 'LOW', 'MEDIUM', 'HIGH']) {
      const result = createTaskInputSchema.parse({ title: 'task', priority: p });
      expect(result.priority).toBe(p);
    }
  });

  it('rejects invalid column', () => {
    expect(() => createTaskInputSchema.parse({ title: 'ok', column: 'INVALID' })).toThrow();
  });

  it('accepts all valid columns', () => {
    for (const col of ['BACKLOG', 'TODAY', 'DOING', 'DONE']) {
      const result = createTaskInputSchema.parse({ title: 'task', column: col });
      expect(result.column).toBe(col);
    }
  });

  it('accepts valid effort values', () => {
    for (const e of [0, 1, 2, 3, 5]) {
      const result = createTaskInputSchema.parse({ title: 'task', effort: e });
      expect(result.effort).toBe(e);
    }
  });

  it('rejects invalid effort values', () => {
    expect(() => createTaskInputSchema.parse({ title: 'ok', effort: 4 })).toThrow();
    expect(() => createTaskInputSchema.parse({ title: 'ok', effort: -1 })).toThrow();
    expect(() => createTaskInputSchema.parse({ title: 'ok', effort: 10 })).toThrow();
  });

  it('all optional fields default to undefined', () => {
    const result = createTaskInputSchema.parse({ title: 'minimal' });
    expect(result.notes).toBeUndefined();
    expect(result.tag).toBeUndefined();
    expect(result.effort).toBeUndefined();
    expect(result.priority).toBeUndefined();
    expect(result.column).toBeUndefined();
  });

  it('rejects notes over 5000 characters', () => {
    expect(() => createTaskInputSchema.parse({ title: 'ok', notes: 'x'.repeat(5001) })).toThrow();
  });

  it('accepts notes at exactly 5000 characters', () => {
    const result = createTaskInputSchema.parse({ title: 'ok', notes: 'x'.repeat(5000) });
    expect(result.notes).toHaveLength(5000);
  });

  it('rejects tag over 50 characters', () => {
    expect(() => createTaskInputSchema.parse({ title: 'ok', tag: 'x'.repeat(51) })).toThrow();
  });
});

describe('updateTaskInputSchema', () => {
  it('requires at least one update field besides id', () => {
    expect(() => updateTaskInputSchema.parse({ id: randomUUID() })).toThrow();
  });

  it('accepts update with only notes', () => {
    const parsed = updateTaskInputSchema.parse({ id: randomUUID(), notes: 'new note' });
    expect(parsed.notes).toBe('new note');
  });

  it('accepts update with only priority', () => {
    const parsed = updateTaskInputSchema.parse({ id: randomUUID(), priority: 'MEDIUM' });
    expect(parsed.priority).toBe('MEDIUM');
  });

  it('accepts update with only title', () => {
    const parsed = updateTaskInputSchema.parse({ id: randomUUID(), title: 'new title' });
    expect(parsed.title).toBe('new title');
  });

  it('accepts update with only tag', () => {
    const parsed = updateTaskInputSchema.parse({ id: randomUUID(), tag: 'bug' });
    expect(parsed.tag).toBe('bug');
  });

  it('accepts update with only effort', () => {
    const parsed = updateTaskInputSchema.parse({ id: randomUUID(), effort: 3 });
    expect(parsed.effort).toBe(3);
  });

  it('accepts multiple fields together', () => {
    const parsed = updateTaskInputSchema.parse({
      id: randomUUID(),
      title: 'new',
      notes: 'updated',
      tag: 'feature',
      effort: 2,
      priority: 'HIGH'
    });
    expect(parsed.title).toBe('new');
    expect(parsed.notes).toBe('updated');
    expect(parsed.tag).toBe('feature');
    expect(parsed.effort).toBe(2);
    expect(parsed.priority).toBe('HIGH');
  });

  it('rejects invalid uuid for id', () => {
    expect(() => updateTaskInputSchema.parse({ id: 'not-a-uuid', title: 'x' })).toThrow();
  });

  it('trims title on update', () => {
    const parsed = updateTaskInputSchema.parse({ id: randomUUID(), title: '  trimmed  ' });
    expect(parsed.title).toBe('trimmed');
  });

  it('rejects empty title on update', () => {
    expect(() => updateTaskInputSchema.parse({ id: randomUUID(), title: '   ' })).toThrow();
  });
});

describe('assertColumn', () => {
  it('returns the column for valid columns', () => {
    expect(assertColumn('BACKLOG')).toBe('BACKLOG');
    expect(assertColumn('TODAY')).toBe('TODAY');
    expect(assertColumn('DOING')).toBe('DOING');
    expect(assertColumn('DONE')).toBe('DONE');
  });

  it('throws for invalid column strings', () => {
    expect(() => assertColumn('INVALID')).toThrow();
    expect(() => assertColumn('')).toThrow();
    expect(() => assertColumn('backlog')).toThrow();
  });
});

describe('validateTask', () => {
  function makeTask(overrides: Partial<Task> = {}): Task {
    return {
      id: randomUUID(),
      title: 'Test task',
      notes: '',
      tag: '',
      effort: 0,
      priority: 'NONE',
      column: 'BACKLOG',
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
      completed_at: null,
      ...overrides
    };
  }

  it('accepts a valid complete task', () => {
    const task = makeTask();
    expect(validateTask(task)).toEqual(task);
  });

  it('accepts a task with all fields populated', () => {
    const now = new Date().toISOString();
    const task = makeTask({
      notes: 'Some notes',
      tag: 'feature',
      effort: 5,
      priority: 'HIGH',
      column: 'DONE',
      position: 3,
      archived_at: now,
      completed_at: now
    });
    expect(validateTask(task)).toEqual(task);
  });

  it('rejects a task with invalid id', () => {
    expect(() => validateTask(makeTask({ id: 'bad' }))).toThrow();
  });

  it('rejects a task with empty title', () => {
    expect(() => validateTask(makeTask({ title: '' }))).toThrow();
  });

  it('rejects a task with invalid column', () => {
    expect(() => validateTask(makeTask({ column: 'INVALID' as any }))).toThrow();
  });

  it('rejects a task with invalid priority', () => {
    expect(() => validateTask(makeTask({ priority: 'URGENT' as any }))).toThrow();
  });

  it('rejects a task with invalid effort', () => {
    expect(() => validateTask(makeTask({ effort: 4 as any }))).toThrow();
  });

  it('rejects a task with negative position', () => {
    expect(() => validateTask(makeTask({ position: -1 }))).toThrow();
  });
});

describe('taskValidationSchema', () => {
  it('provides defaults for tag, effort, and priority', () => {
    const result = taskValidationSchema.parse({
      id: randomUUID(),
      title: 'test',
      notes: '',
      column: 'BACKLOG',
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
      completed_at: null
    });
    expect(result.tag).toBe('');
    expect(result.effort).toBe(0);
    expect(result.priority).toBe('NONE');
  });
});
