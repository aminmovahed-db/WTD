import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { FormEvent } from 'react';
import type { Column as ColumnType, Task } from '../../shared/types';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  column: ColumnType;
  title: string;
  tasks: Task[];
  onCreateTask: (column: ColumnType, title: string) => Promise<void>;
  onEditTask: (task: Task) => void;
  onArchiveTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

export function Column({
  column,
  title,
  tasks,
  onCreateTask,
  onEditTask,
  onArchiveTask,
  onDeleteTask
}: ColumnProps): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column}`,
    data: { column }
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('task-title') as HTMLInputElement | null;
    const value = input?.value.trim() ?? '';

    if (!value) {
      return;
    }

    await onCreateTask(column, value);
    form.reset();
  }

  return (
    <section className="kanban-column" ref={setNodeRef} data-over={isOver || undefined}>
      <header>
        <h3>{title}</h3>
        <span>{tasks.length}</span>
      </header>
      <form onSubmit={handleSubmit} className="quick-add-form">
        <input name="task-title" placeholder="Add task" maxLength={200} />
        <button type="submit">Add</button>
      </form>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEditTask} onArchive={onArchiveTask} onDelete={onDeleteTask} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
