import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import type { ArchiveTaskInput, CreateTaskInput, DeleteTaskInput, ImportJsonInput, MoveTaskInput, ReorderColumnInput, RestoreTaskInput, UpdateTaskInput } from '../src/shared/types';
import { initDatabase } from '../src/main/db';
import { exportTasksToJson, importTasksFromJson } from '../src/main/db/exportImport';
import { TaskRepository } from '../src/main/db/taskRepo';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const appPath = app.getAppPath();
  const preloadPath = app.isPackaged
    ? path.join(__dirname, 'preload.js')
    : path.join(process.cwd(), 'dist-electron', 'electron', 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'Daily Kanban',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.error('Failed to load dev server URL', err);
    });
  } else {
    const indexPath = path.join(appPath, 'dist', 'index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load app', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(repo: TaskRepository, db: Database.Database): void {
  ipcMain.handle('task:listActive', () => repo.listActiveTasks());
  ipcMain.handle('task:listArchived', () => repo.listArchivedTasks());

  ipcMain.handle('task:create', (_event, input: CreateTaskInput) => repo.createTask(input));
  ipcMain.handle('task:update', (_event, input: UpdateTaskInput) => repo.updateTask(input));
  ipcMain.handle('task:move', (_event, input: MoveTaskInput) => repo.moveTask(input.id, input.toColumn, input.toPosition));
  ipcMain.handle('task:reorderColumn', (_event, input: ReorderColumnInput) => repo.reorderColumn(input));
  ipcMain.handle('task:archive', (_event, input: ArchiveTaskInput) => repo.archiveTask(input.id));
  ipcMain.handle('task:delete', (_event, input: DeleteTaskInput) => repo.deleteTask(input.id));
  ipcMain.handle('task:restore', (_event, input: RestoreTaskInput) => repo.restoreTask(input.id, input.toColumn));

  ipcMain.handle('task:exportJson', (_event, input: { filePath: string }) => {
    exportTasksToJson(db, input.filePath);
  });

  ipcMain.handle('task:importJson', (_event, input: ImportJsonInput) => {
    return importTasksFromJson(db, input.filePath, input.mode);
  });

  ipcMain.handle('dialog:pickExportPath', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Kanban Data',
      defaultPath: `daily-kanban-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('dialog:pickImportPath', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Kanban Data',
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}

app.whenReady().then(() => {
  const db = initDatabase(app.getPath('userData'));
  const repo = new TaskRepository(db);

  registerIpcHandlers(repo, db);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
