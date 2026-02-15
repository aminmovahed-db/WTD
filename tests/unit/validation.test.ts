import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTaskInputSchema, normalizeTitle, updateTaskInputSchema } from '../../src/main/db/validation';

describe('validation', () => {
  it('trims and validates title boundaries', () => {
    const valid = createTaskInputSchema.parse({ title: '  hello  ' });
    expect(valid.title).toBe('hello');

    expect(() => createTaskInputSchema.parse({ title: '   ' })).toThrow();
    expect(() => createTaskInputSchema.parse({ title: 'x'.repeat(201) })).toThrow();
  });

  it('normalizes title', () => {
    expect(normalizeTitle('  task name  ')).toBe('task name');
  });

  it('requires at least one update field', () => {
    expect(() => updateTaskInputSchema.parse({ id: randomUUID() })).toThrow();
    const parsed = updateTaskInputSchema.parse({ id: randomUUID(), notes: 'new note' });
    expect(parsed.notes).toBe('new note');
  });
});
