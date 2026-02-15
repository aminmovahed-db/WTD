import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArchiveView } from './components/ArchiveView';
import { Board } from './components/Board';
import { TaskCardPreview } from './components/TaskCardPreview';
import { TaskEditor } from './components/TaskEditor';
import { Toolbar } from './components/Toolbar';
import { COLUMNS, type Column, type ImportResult, type Task } from '../shared/types';

function groupTasks(tasks: Task[]): Record<Column, Task[]> {
  const grouped: Record<Column, Task[]> = {
    BACKLOG: [],
    TODAY: [],
    DOING: [],
    DONE: []
  };

  tasks.forEach((task) => {
    grouped[task.column].push(task);
  });

  COLUMNS.forEach((column) => {
    grouped[column].sort((a, b) => a.position - b.position);
  });

  return grouped;
}

function getColumnByOverId(overId: string, tasks: Task[]): Column | null {
  if (overId.startsWith('column:')) {
    const column = overId.split(':')[1] as Column;
    return COLUMNS.includes(column) ? column : null;
  }

  const overTask = tasks.find((task) => task.id === overId);
  return overTask?.column ?? null;
}

export default function App(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragSnapshot, setDragSnapshot] = useState<Task[] | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const groupedTasks = useMemo(() => groupTasks(tasks), [tasks]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    try {
      const [active, archived] = await Promise.all([
        window.kanbanApi.listActiveTasks(),
        window.kanbanApi.listArchivedTasks()
      ]);
      setTasks(active);
      setArchivedTasks(archived);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll().catch(() => {
      // no-op: handled in loadAll
    });
  }, []);

  async function createTask(column: Column, title: string): Promise<void> {
    try {
      const created = await window.kanbanApi.createTask({ title, column });
      setTasks((prev) => [...prev, created]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  }

  async function saveTask(taskId: string, updates: { title?: string; notes?: string }): Promise<void> {
    const updated = await window.kanbanApi.updateTask({ id: taskId, ...updates });
    setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
  }

  async function deleteTask(taskId: string): Promise<void> {
    try {
      await window.kanbanApi.deleteTask({ id: taskId });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }

  async function archiveTask(taskId: string): Promise<void> {
    try {
      await window.kanbanApi.archiveTask({ id: taskId });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive task');
    }
  }

  async function restoreTask(taskId: string, column: Column): Promise<void> {
    try {
      await window.kanbanApi.restoreTask({ id: taskId, toColumn: column });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore task');
    }
  }

  async function handleExport(): Promise<void> {
    try {
      const filePath = await window.kanbanApi.pickExportPath();
      if (!filePath) {
        return;
      }

      await window.kanbanApi.exportJson({ filePath });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    }
  }

  async function handleImport(mode: 'merge' | 'replace'): Promise<void> {
    try {
      const filePath = await window.kanbanApi.pickImportPath();
      if (!filePath) {
        return;
      }

      if (mode === 'replace') {
        const confirmed = window.confirm('Replace will delete current board data before import. Continue?');
        if (!confirmed) {
          return;
        }
      }

      const summary = await window.kanbanApi.importJson({ filePath, mode });
      setImportSummary(summary);
      await loadAll();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import data');
    }
  }

  function handleDragStart(event: DragStartEvent): void {
    const task = event.active.data.current?.task as Task | undefined;
    setDraggingTask(task ?? null);
    setDragSnapshot(tasks);
  }

  function handleDragCancel(_event: DragCancelEvent): void {
    if (dragSnapshot) {
      setTasks(dragSnapshot);
    }
    setDraggingTask(null);
    setDragSnapshot(null);
  }

  function handleDragOver(event: DragOverEvent): void {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    setTasks((prev) => {
      const activeTask = prev.find((task) => task.id === activeId);
      if (!activeTask) {
        return prev;
      }

      const targetColumn = getColumnByOverId(overId, prev);
      if (!targetColumn || targetColumn === activeTask.column) {
        return prev;
      }

      const grouped = groupTasks(prev);
      const sourceList = grouped[activeTask.column];
      const targetList = grouped[targetColumn];
      const sourceIndex = sourceList.findIndex((task) => task.id === activeId);

      if (sourceIndex < 0) {
        return prev;
      }

      let targetIndex = targetList.findIndex((task) => task.id === overId);
      if (targetIndex < 0) {
        targetIndex = targetList.length;
      }

      const movingTask = sourceList[sourceIndex];
      const newSource = sourceList
        .filter((task) => task.id !== activeId)
        .map((task, idx) => ({ ...task, position: idx }));

      const inserted = {
        ...movingTask,
        column: targetColumn,
        position: Math.max(0, Math.min(targetIndex, targetList.length)),
        completed_at: targetColumn === 'DONE' ? movingTask.completed_at ?? new Date().toISOString() : null
      };

      const newTarget = [...targetList];
      newTarget.splice(inserted.position, 0, inserted);
      const normalizedTarget = newTarget.map((task, idx) => ({ ...task, position: idx }));

      const preview: Task[] = [];
      COLUMNS.forEach((column) => {
        if (column === activeTask.column) {
          preview.push(...newSource);
          return;
        }
        if (column === targetColumn) {
          preview.push(...normalizedTarget);
          return;
        }
        preview.push(...grouped[column]);
      });

      return preview;
    });
  }

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event;
    if (!over) {
      if (dragSnapshot) {
        setTasks(dragSnapshot);
      }
      setDraggingTask(null);
      setDragSnapshot(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const startTasks = dragSnapshot ?? tasks;
    const startTask = startTasks.find((task) => task.id === activeId);
    const finalTask = tasks.find((task) => task.id === activeId);
    if (!startTask || !finalTask) {
      setDraggingTask(null);
      setDragSnapshot(null);
      return;
    }

    const targetColumn = getColumnByOverId(overId, tasks);
    if (!targetColumn) {
      setDraggingTask(null);
      setDragSnapshot(null);
      return;
    }

    const sourceColumn = startTask.column;
    const finalColumn = finalTask.column;
    const targetList = groupedTasks[finalColumn];

    let targetIndex = targetList.findIndex((task) => task.id === overId);
    if (targetIndex < 0) {
      targetIndex = targetList.length;
    }

    const snapshot = dragSnapshot ?? tasks;

    try {
      if (sourceColumn === finalColumn) {
        const sourceList = groupedTasks[sourceColumn];
        const sourceIndex = sourceList.findIndex((task) => task.id === activeId);
        if (sourceIndex === -1) {
          setDraggingTask(null);
          setDragSnapshot(null);
          return;
        }

        const ids = sourceList.map((task) => task.id);
        const overIndex = ids.indexOf(overId);
        const finalTargetIndex = overIndex >= 0 ? overIndex : targetIndex;
        const reordered = arrayMove(sourceList, sourceIndex, finalTargetIndex).map((task, idx) => ({
          ...task,
          position: idx
        }));

        setTasks((prev) =>
          prev.map((task) => {
            const replacement = reordered.find((candidate) => candidate.id === task.id);
            return replacement ?? task;
          })
        );

        await window.kanbanApi.reorderColumn({
          column: sourceColumn,
          orderedIds: reordered.map((task) => task.id)
        });
      } else {
        const toPosition = targetList.findIndex((task) => task.id === activeId);
        await window.kanbanApi.moveTask({
          id: activeId,
          toColumn: finalColumn,
          toPosition: toPosition >= 0 ? toPosition : targetList.length
        });
      }

      setError(null);
      await loadAll();
    } catch (err) {
      setTasks(snapshot);
      setError(err instanceof Error ? err.message : 'Failed to move task');
    } finally {
      setDraggingTask(null);
      setDragSnapshot(null);
    }
  }

  return (
    <div className="app-shell">
      <Toolbar
        showingArchive={showArchive}
        onToggleView={setShowArchive}
        onExport={handleExport}
        onImport={handleImport}
        importSummary={importSummary}
      />

      {error ? (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => loadAll()}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="loading">Loading...</p>
      ) : showArchive ? (
        <ArchiveView tasks={archivedTasks} onRestore={restoreTask} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <Board
            groupedTasks={groupedTasks}
            onCreateTask={createTask}
            onEditTask={setSelectedTask}
            onArchiveTask={archiveTask}
            onDeleteTask={deleteTask}
          />
          <DragOverlay>
            {draggingTask ? <TaskCardPreview task={draggingTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskEditor
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={saveTask}
      />
    </div>
  );
}
