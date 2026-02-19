import type { Column as ColumnType, Priority, Task } from '../../shared/types';
import { Column } from './Column';

const COLUMN_TITLES: Record<ColumnType, string> = {
  BACKLOG: 'Backlog',
  TODAY: 'Today',
  DOING: 'Doing',
  DONE: 'Done'
};

interface BoardProps {
  groupedTasks: Record<ColumnType, Task[]>;
  onCreateTask: (column: ColumnType, title: string) => Promise<void>;
  onEditTask: (task: Task) => void;
  onArchiveTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onSaveTask: (taskId: string, updates: { title?: string; notes?: string; priority?: Priority }) => Promise<void>;
}

export function Board({ groupedTasks, onCreateTask, onEditTask, onArchiveTask, onDeleteTask, onSaveTask }: BoardProps): JSX.Element {
  return (
    <main className="board-grid">
      {(Object.keys(COLUMN_TITLES) as ColumnType[]).map((column) => (
        <Column
          key={column}
          column={column}
          title={COLUMN_TITLES[column]}
          tasks={groupedTasks[column]}
          onCreateTask={onCreateTask}
          onEditTask={onEditTask}
          onArchiveTask={onArchiveTask}
          onDeleteTask={onDeleteTask}
          onSaveTask={onSaveTask}
        />
      ))}
    </main>
  );
}
