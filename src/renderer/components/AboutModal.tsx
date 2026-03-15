import { useEffect, useState } from 'react';
import type { AppInfo } from '../../shared/types';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    window.kanbanApi.getAppInfo().then(setInfo).catch(() => {});
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <img src="./icon.png" alt="WTD" className="about-icon" />
          <div className="about-title-group">
            <h2 className="about-name">{info?.name ?? 'WTD'}</h2>
            <span className="about-version">v{info?.version ?? '...'}</span>
          </div>
        </div>

        <p className="about-description">{info?.description ?? ''}</p>

        {info ? (
          <dl className="about-details">
            <div className="about-detail-row">
              <dt>Electron</dt>
              <dd>{info.electronVersion}</dd>
            </div>
            <div className="about-detail-row">
              <dt>Chrome</dt>
              <dd>{info.chromeVersion}</dd>
            </div>
            <div className="about-detail-row">
              <dt>Node</dt>
              <dd>{info.nodeVersion}</dd>
            </div>
          </dl>
        ) : null}

        <div className="about-footer">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
