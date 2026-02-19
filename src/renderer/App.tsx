import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragOverEvent,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArchiveView } from './components/ArchiveView';
import { Board } from './components/Board';
import { TagFilter } from './components/TagFilter';
import { TaskCardPreview } from './components/TaskCardPreview';
import { TaskEditor } from './components/TaskEditor';
import { Toolbar } from './components/Toolbar';
import { COLUMNS, type Column, type Effort, type ImportResult, type Priority, type Task } from '../shared/types';
import { tagColorStyle } from './utils/tagColors';

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

// closestCorners works well when every column has cards — it finds the
// nearest task card for precise reorder positioning. But when a column
// is empty, its large section rect has corners far from the pointer, so
// closestCorners picks a task card from an adjacent column instead and
// the empty column is never detected as a drop target.
//
// This strategy uses pointerWithin to detect which column the pointer is
// physically inside, then checks whether closestCorners agrees. When they
// disagree (pointer over an empty column, closestCorners chose a card in
// a neighbour), we override with the column droppable.
const multiContainerCollision: CollisionDetection = (args) => {
  const cornerCollisions = closestCorners(args);
  const pointerCollisions = pointerWithin(args);

  const pointerColumn = pointerCollisions.find((c) =>
    String(c.id).startsWith('column:')
  );

  if (pointerColumn && cornerCollisions.length > 0) {
    const topId = String(cornerCollisions[0].id);
    if (topId === String(pointerColumn.id)) {
      return cornerCollisions;
    }

    const pointerColumnName = String(pointerColumn.id).split(':')[1];
    const topData = cornerCollisions[0].data?.droppableContainer?.data?.current;
    const topResultColumn: string | undefined =
      topData?.task?.column ?? topData?.column;

    if (topResultColumn === pointerColumnName) {
      return cornerCollisions;
    }

    return [pointerColumn, ...cornerCollisions];
  }

  return cornerCollisions.length > 0 ? cornerCollisions : pointerCollisions;
};

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
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    tasks.forEach((t) => { if (t.tag) tags.add(t.tag); });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filterTags.length === 0) return tasks;
    const tagSet = new Set(filterTags);
    return tasks.filter((t) => tagSet.has(t.tag));
  }, [tasks, filterTags]);

  const groupedTasks = useMemo(() => groupTasks(filteredTasks), [filteredTasks]);

  const dragSnapshotRef = useRef<Task[]>([]);

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

  async function saveTask(taskId: string, updates: { title?: string; notes?: string; tag?: string; effort?: Effort; priority?: Priority }): Promise<void> {
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
    dragSnapshotRef.current = tasks;
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

    // Force React to synchronously process any pending setTasks from
    // handleDragOver. The functional updater is guaranteed to receive
    // the state after all queued updates have been applied, so
    // latestTasks reflects the optimistic column change even when the
    // closure's `tasks` is stale.
    let latestTasks = tasks;
    flushSync(() => {
      setTasks((prev) => {
        latestTasks = prev;
        return prev;
      });
    });

    const startTasks = dragSnapshotRef.current;
    const startTask = startTasks.find((task) => task.id === activeId);
    const currentTask = latestTasks.find((task) => task.id === activeId);
    if (!startTask || !currentTask) {
      setDraggingTask(null);
      setDragSnapshot(null);
      return;
    }

    const sourceColumn = startTask.column;
    const targetColumn = currentTask.column;

    try {
      if (sourceColumn === targetColumn) {
        const grouped = groupTasks(startTasks);
        const sourceList = grouped[sourceColumn];
        const sourceIndex = sourceList.findIndex((task) => task.id === activeId);
        if (sourceIndex === -1) {
          setDraggingTask(null);
          setDragSnapshot(null);
          return;
        }

        const ids = sourceList.map((task) => task.id);
        const overIndex = ids.indexOf(overId);
        const finalTargetIndex = overIndex >= 0 ? overIndex : sourceList.length;
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
        const targetGrouped = groupTasks(latestTasks);
        const targetList = targetGrouped[targetColumn];
        const currentIndex = targetList.findIndex((t) => t.id === activeId);

        let toPosition: number;

        if (overId !== activeId && !overId.startsWith('column:')) {
          const overIndex = targetList.findIndex((t) => t.id === overId);
          if (currentIndex >= 0 && overIndex >= 0) {
            const reordered = arrayMove(targetList, currentIndex, overIndex);
            toPosition = reordered.findIndex((t) => t.id === activeId);
          } else {
            toPosition = currentIndex >= 0 ? currentIndex : targetList.length;
          }
        } else {
          toPosition = currentIndex >= 0 ? currentIndex : targetList.length;
        }

        await window.kanbanApi.moveTask({
          id: activeId,
          toColumn: targetColumn,
          toPosition
        });
      }

      setError(null);
      await loadAll();
    } catch (err) {
      setTasks(startTasks);
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

      {!loading && !showArchive ? (
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-btn${filterTags.length > 0 ? ' filter-btn--active' : ''}`}
            onClick={() => setShowTagFilter(true)}
          >
            Filter{filterTags.length > 0 ? ` (${filterTags.length})` : ''}
          </button>
          {filterTags.length > 0 ? (
            <div className="filter-active-tags">
              {filterTags.map((tag) => (
                <span key={tag} className="filter-active-chip" style={tagColorStyle(tag)}>{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="loading">Loading...</p>
      ) : showArchive ? (
        <ArchiveView tasks={archivedTasks} onRestore={restoreTask} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={multiContainerCollision}
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

      {showTagFilter ? (
        <TagFilter
          availableTags={availableTags}
          activeTags={filterTags}
          onApply={(tags) => { setFilterTags(tags); setShowTagFilter(false); }}
          onClose={() => setShowTagFilter(false)}
        />
      ) : null}
    </div>
  );
}
