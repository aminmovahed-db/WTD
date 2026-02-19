import { z } from 'zod';
import { COLUMNS, PRIORITIES, type Column, type Task } from '../../shared/types';

const columnSchema = z.enum(COLUMNS);
const prioritySchema = z.enum(PRIORITIES);

export const taskValidationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(5000),
  tag: z.string().max(50).default(''),
  priority: prioritySchema.default('LOW'),
  column: columnSchema,
  position: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable(),
  completed_at: z.string().nullable()
});

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(5000).optional(),
  tag: z.string().max(50).optional(),
  priority: prioritySchema.optional(),
  column: columnSchema.optional()
});

export const updateTaskInputSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    notes: z.string().max(5000).optional(),
    tag: z.string().max(50).optional(),
    priority: prioritySchema.optional()
  })
  .refine((v) => v.title !== undefined || v.notes !== undefined || v.tag !== undefined || v.priority !== undefined, {
    message: 'At least one field must be provided'
  });

export function assertColumn(column: string): Column {
  return columnSchema.parse(column);
}

export function validateTask(task: Task): Task {
  return taskValidationSchema.parse(task);
}

export function normalizeTitle(title: string): string {
  return title.trim();
}
