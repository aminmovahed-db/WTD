import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron';
import type Database from 'better-sqlite3';
import type { AppInfo, ArchiveTaskInput, CreateTaskInput, DeleteTaskInput, ImportJsonInput, MoveTaskInput, ReorderColumnInput, RestoreTaskInput, UpdateTaskInput } from '../src/shared/types';
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
    minWidth: 1100,
    minHeight: 700,
    title: 'WTD',
    icon: path.join(app.isPackaged ? process.resourcesPath : process.cwd(), 'build', 'icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.error('Failed to load dev server URL', err);
    });
  } else {
    const indexPath = path.join(appPath, 'dist', 'index.html');
    console.log('Loading index from:', indexPath);
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
      title: 'Export WTD Data',
      defaultPath: `wtd-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('dialog:pickImportPath', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import WTD Data',
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      return shell.openExternal(url);
    }
  });

  ipcMain.handle('app:getInfo', (): AppInfo => ({
    name: 'WTD',
    version: app.getVersion(),
    description: 'Local-first task board',
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node
  }));
}

app.whenReady().then(() => {
  try {
    const db = initDatabase(app.getPath('userData'));
    const repo = new TaskRepository(db);

    const iconPath = path.join(app.isPackaged ? process.resourcesPath : process.cwd(), 'build', 'icon.png');
    if (process.platform === 'darwin') {
      app.dock?.setIcon(nativeImage.createFromPath(iconPath));
    }

    registerIpcHandlers(repo, db);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (err) {
    console.error('Failed to initialize app:', err);
    dialog.showErrorBox('Startup Error', String(err));
  }
}).catch((err) => {
  console.error('app.whenReady() failed:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
