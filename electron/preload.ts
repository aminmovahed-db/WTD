import { contextBridge, ipcRenderer } from 'electron';
import type {
  ArchiveTaskInput,
  CreateTaskInput,
  DeleteTaskInput,
  ExportJsonInput,
  ImportJsonInput,
  ImportResult,
  KanbanApi,
  MoveTaskInput,
  ReorderColumnInput,
  RestoreTaskInput,
  Task,
  UpdateTaskInput
} from '../src/shared/types';

const api: KanbanApi = {
  listActiveTasks: () => ipcRenderer.invoke('task:listActive') as Promise<Task[]>,
  createTask: (input: CreateTaskInput) => ipcRenderer.invoke('task:create', input) as Promise<Task>,
  updateTask: (input: UpdateTaskInput) => ipcRenderer.invoke('task:update', input) as Promise<Task>,
  moveTask: (input: MoveTaskInput) => ipcRenderer.invoke('task:move', input) as Promise<void>,
  reorderColumn: (input: ReorderColumnInput) => ipcRenderer.invoke('task:reorderColumn', input) as Promise<void>,
  archiveTask: (input: ArchiveTaskInput) => ipcRenderer.invoke('task:archive', input) as Promise<void>,
  deleteTask: (input: DeleteTaskInput) => ipcRenderer.invoke('task:delete', input) as Promise<void>,
  listArchivedTasks: () => ipcRenderer.invoke('task:listArchived') as Promise<Task[]>,
  restoreTask: (input: RestoreTaskInput) => ipcRenderer.invoke('task:restore', input) as Promise<void>,
  exportJson: (input: ExportJsonInput) => ipcRenderer.invoke('task:exportJson', input) as Promise<void>,
  importJson: (input: ImportJsonInput) => ipcRenderer.invoke('task:importJson', input) as Promise<ImportResult>,
  pickExportPath: () => ipcRenderer.invoke('dialog:pickExportPath') as Promise<string | null>,
  pickImportPath: () => ipcRenderer.invoke('dialog:pickImportPath') as Promise<string | null>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>
};

contextBridge.exposeInMainWorld('kanbanApi', api);
