import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import type { Task } from '../../shared/types';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onArchive: (id: string) => void;
}

export function TaskCard({ task, onEdit, onArchive }: TaskCardProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task }
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.1 : 1
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="task-card"
      data-dragging={isDragging || undefined}
      {...attributes}
      {...listeners}
    >
      <button className="task-main" onClick={() => onEdit(task)} type="button">
        <h4>{task.title}</h4>
        {task.notes ? <p>{task.notes}</p> : null}
      </button>
      {task.column === 'DONE' ? (
        <button className="task-archive" onClick={() => onArchive(task.id)} type="button">
          Archive
        </button>
      ) : null}
    </article>
  );
}
