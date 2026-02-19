import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Task } from '../../shared/types';
import { PriorityTag } from './PriorityTag';
import { tagColorStyle } from '../utils/tagColors';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export function TaskCard({ task, onEdit, onArchive, onDelete }: TaskCardProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task }
  });

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const cardRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      cardRef.current = node;
    },
    [setNodeRef]
  );

  const closeMenu = useCallback(() => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  // Attach native contextmenu listener to bypass React/dnd-kit synthetic events
  useEffect(() => {
    const node = cardRef.current;
    if (!node) {
      return;
    }

    const handleContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
    };

    node.addEventListener('contextmenu', handleContextMenu);
    return () => node.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Close menu on outside click / right-click / blur
  useEffect(() => {
    if (!contextMenu.visible) {
      return;
    }

    const handleClickOutside = (e: Event): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('contextmenu', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('blur', closeMenu);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('blur', closeMenu);
    };
  }, [contextMenu.visible, closeMenu]);

  function handleArchive(): void {
    closeMenu();
    onArchive(task.id);
  }

  function handleDelete(): void {
    closeMenu();
    onDelete(task.id);
  }

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.1 : 1
  };

  return (
    <>
      <article
        ref={setRefs}
        style={style}
        className="task-card"
        data-dragging={isDragging || undefined}
        {...attributes}
        {...listeners}
      >
        {task.tag ? <span className="task-tag" style={tagColorStyle(task.tag)}>{task.tag}</span> : null}
        <button className="task-main" onClick={() => onEdit(task)} type="button">
          <div className="task-priority-row">
            <PriorityTag priority={task.priority} />
            {task.notes ? <span className="notes-indicator" title="Has notes" aria-label="Has notes">ℹ️</span> : null}
          </div>
          <div className="task-title-row">
            <h4>{task.title}</h4>
          </div>
        </button>
      </article>

      {contextMenu.visible
        ? createPortal(
            <div
              ref={menuRef}
              className="context-menu"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              {task.column === 'DONE' ? (
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={handleArchive}
                >
                  Archive
                </button>
              ) : null}
              <button
                type="button"
                className="context-menu-item context-menu-item--danger"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
