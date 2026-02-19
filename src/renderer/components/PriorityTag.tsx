import type { JSX } from 'react';
import type { Priority } from '../../shared/types';

interface PriorityTagProps {
  priority: Priority;
}

const PRIORITY_META: Record<Priority, { label: string; flames: number }> = {
  NONE: { label: 'None', flames: 0 },
  LOW: { label: 'Low', flames: 1 },
  MEDIUM: { label: 'Medium', flames: 2 },
  HIGH: { label: 'High', flames: 3 }
};

function priorityFlames(count: number): string {
  return Array.from({ length: count }, () => '🔥').join('');
}

export function PriorityTag({ priority }: PriorityTagProps): JSX.Element | null {
  if (priority === 'NONE') return null;
  const meta = PRIORITY_META[priority];
  return (
    <span className={`priority-tag priority-tag--${priority.toLowerCase()}`} title={`${meta.label} priority`}>
      <span className="priority-tag-arrows" aria-hidden="true">
        {priorityFlames(meta.flames)}
      </span>
      <span className="priority-tag-label sr-only">{meta.label}</span>
    </span>
  );
}
