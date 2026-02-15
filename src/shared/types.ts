export const COLUMNS = ['BACKLOG', 'TODAY', 'DOING', 'DONE'] as const;

export type Column = (typeof COLUMNS)[number];

export interface Task {
  id: string;
  title: string;
  notes: string;
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
  column?: Column;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  notes?: string;
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
  listArchivedTasks(): Promise<Task[]>;
  restoreTask(input: RestoreTaskInput): Promise<void>;
  exportJson(input: ExportJsonInput): Promise<void>;
  importJson(input: ImportJsonInput): Promise<ImportResult>;
  pickExportPath(): Promise<string | null>;
  pickImportPath(): Promise<string | null>;
}
