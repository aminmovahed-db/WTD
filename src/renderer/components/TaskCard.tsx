import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Priority, Task } from '../../shared/types';
import { PriorityTag } from './PriorityTag';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveTask: (taskId: string, updates: { title?: string; notes?: string; priority?: Priority }) => Promise<void>;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export function TaskCard({ task, onEdit, onArchive, onDelete, onSaveTask }: TaskCardProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task }
  });

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [expanded, setExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState(task.notes);
  const cardRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalNotes(task.notes);
  }, [task.notes]);

  // Combine dnd-kit ref with our own ref
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

  async function handleNotesBlur(): Promise<void> {
    if (localNotes === task.notes) return;
    try {
      await onSaveTask(task.id, { notes: localNotes });
    } catch {
      setLocalNotes(task.notes);
    }
  }

  function handleToggleExpand(): void {
    setExpanded((prev) => !prev);
  }

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [expanded]);

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
        className={`task-card${expanded ? ' task-card--expanded' : ''}`}
        data-dragging={isDragging || undefined}
        {...attributes}
        {...listeners}
      >
        <button className="task-main" onClick={handleToggleExpand} type="button">
          <PriorityTag priority={task.priority} />
          <div className="task-title-row">
            <h4>{task.title}</h4>
            {!expanded && task.notes ? <span className="notes-indicator" title="Has notes" aria-label="Has notes" /> : null}
          </div>
        </button>
        {expanded ? (
          <div className="task-expanded" onPointerDown={(e) => e.stopPropagation()}>
            <textarea
              ref={textareaRef}
              className="task-notes-editor"
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes..."
              maxLength={5000}
              rows={3}
            />
            <div className="task-expanded-actions">
              <button
                type="button"
                className="edit-details-btn"
                onClick={() => onEdit(task)}
              >
                Edit details
              </button>
            </div>
          </div>
        ) : null}
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
