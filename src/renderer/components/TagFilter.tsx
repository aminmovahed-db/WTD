import { useState } from 'react';
import { tagColorStyle } from '../utils/tagColors';

interface TagFilterProps {
  availableTags: string[];
  activeTags: string[];
  onApply: (tags: string[]) => void;
  onClose: () => void;
}

export function TagFilter({ availableTags, activeTags, onApply, onClose }: TagFilterProps): JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(new Set(activeTags));

  function toggleTag(tag: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  function handleApply(): void {
    onApply(Array.from(selected));
  }

  function handleClear(): void {
    onApply([]);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card tag-filter-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Filter by Tag</h3>
        </header>
        {availableTags.length === 0 ? (
          <p className="tag-filter-empty">No tags found. Add tags to your tasks first.</p>
        ) : (
          <div className="tag-filter-list">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-filter-chip${selected.has(tag) ? ' tag-filter-chip--active' : ''}`}
                style={selected.has(tag) ? tagColorStyle(tag) : undefined}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        <div className="tag-filter-actions">
          <button type="button" className="tag-filter-clear" onClick={handleClear}>
            Clear
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="tag-filter-apply" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
