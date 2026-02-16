import type { Task } from '../../shared/types';
import { PriorityTag } from './PriorityTag';

interface TaskCardPreviewProps {
  task: Task;
}

export function TaskCardPreview({ task }: TaskCardPreviewProps): JSX.Element {
  return (
    <article className="task-card drag-overlay-card" aria-hidden="true">
      <div className="task-main">
        <PriorityTag priority={task.priority} />
        <h4>{task.title}</h4>
        {task.notes ? <p>{task.notes}</p> : null}
      </div>
      {task.column === 'DONE' ? <div className="task-archive">Archive</div> : null}
    </article>
  );
}
