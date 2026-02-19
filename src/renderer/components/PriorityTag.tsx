import type { Priority } from '../../shared/types';

interface PriorityTagProps {
  priority: Priority;
}

const PRIORITY_META: Record<Priority, { label: string; arrows: number }> = {
  LOW: { label: 'Low', arrows: 1 },
  MEDIUM: { label: 'Medium', arrows: 2 },
  HIGH: { label: 'High', arrows: 3 }
};

function priorityStars(count: number): string {
  return Array.from({ length: count }, () => '⭐️').join(' ');
}

export function PriorityTag({ priority }: PriorityTagProps): JSX.Element {
  const meta = PRIORITY_META[priority];
  return (
    <span className={`priority-tag priority-tag--${priority.toLowerCase()}`} title={`${meta.label} priority`}>
      <span className="priority-tag-arrows" aria-hidden="true">
        {priorityStars(meta.arrows)}
      </span>
      <span className="priority-tag-label sr-only">{meta.label}</span>
    </span>
  );
}
