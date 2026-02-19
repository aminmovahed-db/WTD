import { useState } from 'react';
import { PRIORITIES, type Priority } from '../../shared/types';
import { tagColorStyle } from '../utils/tagColors';

const PRIORITY_LABELS: Record<Priority, string> = {
  NONE: 'None',
  LOW: '🔥 Low',
  MEDIUM: '🔥🔥 Medium',
  HIGH: '🔥🔥🔥 High'
};

export interface FilterState {
  tags: string[];
  priorities: Priority[];
}

interface TagFilterProps {
  availableTags: string[];
  activeFilters: FilterState;
  onApply: (filters: FilterState) => void;
  onClose: () => void;
}

export function TagFilter({ availableTags, activeFilters, onApply, onClose }: TagFilterProps): JSX.Element {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(activeFilters.tags));
  const [selectedPriorities, setSelectedPriorities] = useState<Set<Priority>>(new Set(activeFilters.priorities));

  function toggleTag(tag: string): void {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  function togglePriority(priority: Priority): void {
    setSelectedPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
  }

  function handleApply(): void {
    onApply({
      tags: Array.from(selectedTags),
      priorities: Array.from(selectedPriorities)
    });
  }

  function handleClear(): void {
    onApply({ tags: [], priorities: [] });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card tag-filter-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Filters</h3>
        </header>

        <div className="filter-section">
          <h4 className="filter-section-title">Priority</h4>
          <div className="tag-filter-list">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={`tag-filter-chip${selectedPriorities.has(p) ? ` tag-filter-chip--active priority-tag--${p.toLowerCase()}` : ''}`}
                onClick={() => togglePriority(p)}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h4 className="filter-section-title">Tags</h4>
          {availableTags.length === 0 ? (
            <p className="tag-filter-empty">No tags found. Add tags to your tasks first.</p>
          ) : (
            <div className="tag-filter-list">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-filter-chip${selectedTags.has(tag) ? ' tag-filter-chip--active' : ''}`}
                  style={selectedTags.has(tag) ? tagColorStyle(tag) : undefined}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

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
