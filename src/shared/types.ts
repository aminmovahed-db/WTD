export const COLUMNS = ['BACKLOG', 'TODAY', 'DOING', 'DONE'] as const;
export const PRIORITIES = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const;
export const EFFORTS = [0, 1, 2, 3, 5] as const;
export type Effort = (typeof EFFORTS)[number];

export type Column = (typeof COLUMNS)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  notes: string;
  tag: string;
  effort: Effort;
  priority: Priority;
  column: Column;
  position: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  completed_at: string | null;
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  tag?: string;
  priority?: Priority;
  column?: Column;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  notes?: string;
  tag?: string;
  effort?: Effort;
  priority?: Priority;
}

export interface MoveTaskInput {
  id: string;
  toColumn: Column;
  toPosition: number;
}

export interface ReorderColumnInput {
  column: Column;
  orderedIds: string[];
}

export interface ArchiveTaskInput {
  id: string;
}

export interface DeleteTaskInput {
  id: string;
}

export interface RestoreTaskInput {
  id: string;
  toColumn?: Column;
}

export interface ExportJsonInput {
  filePath: string;
}

export interface ImportJsonInput {
  filePath: string;
  mode: 'merge' | 'replace';
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface KanbanApi {
  listActiveTasks(): Promise<Task[]>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(input: UpdateTaskInput): Promise<Task>;
  moveTask(input: MoveTaskInput): Promise<void>;
  reorderColumn(input: ReorderColumnInput): Promise<void>;
  archiveTask(input: ArchiveTaskInput): Promise<void>;
  deleteTask(input: DeleteTaskInput): Promise<void>;
  listArchivedTasks(): Promise<Task[]>;
  restoreTask(input: RestoreTaskInput): Promise<void>;
  exportJson(input: ExportJsonInput): Promise<void>;
  importJson(input: ImportJsonInput): Promise<ImportResult>;
  pickExportPath(): Promise<string | null>;
  pickImportPath(): Promise<string | null>;
  openExternal(url: string): Promise<void>;
}
