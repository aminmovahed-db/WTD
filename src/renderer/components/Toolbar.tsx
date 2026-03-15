import type { ImportResult } from '../../shared/types';

interface ToolbarProps {
  showingArchive: boolean;
  onToggleView: (showArchive: boolean) => void;
  onExport: () => Promise<void>;
  onImport: (mode: 'merge' | 'replace') => Promise<void>;
  importSummary: ImportResult | null;
  onAbout: () => void;
}

export function Toolbar({
  showingArchive,
  onToggleView,
  onExport,
  onImport,
  importSummary,
  onAbout
}: ToolbarProps): JSX.Element {
  return (
    <div className="toolbar-row">
      <button type="button" className="toolbar-icon-btn" onClick={onAbout} aria-label="About WTD">
        <img src="./icon.png" alt="WTD" className="toolbar-icon" />
      </button>
      <header className="toolbar">
        <div className="view-switch">
          <button type="button" onClick={() => onToggleView(false)} data-active={!showingArchive || undefined}>
            Board
          </button>
          <button type="button" onClick={() => onToggleView(true)} data-active={showingArchive || undefined}>
            Archive
          </button>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={() => onExport()}>
            Export JSON
          </button>
          <button type="button" onClick={() => onImport('merge')}>
            Import Merge
          </button>
          <button type="button" onClick={() => onImport('replace')}>
            Import Replace
          </button>
        </div>
        {importSummary ? (
          <p className="import-summary">
            Imported {importSummary.imported}, skipped {importSummary.skipped}
            {importSummary.errors.length > 0 ? `, issues: ${importSummary.errors.slice(0, 3).join(' | ')}` : ''}
          </p>
        ) : null}
      </header>
    </div>
  );
}
