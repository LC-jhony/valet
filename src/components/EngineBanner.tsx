import React from 'react';
import { Play, RefreshCw, Settings2, TriangleAlert } from 'lucide-react';
import { useApp } from '../state/store';
import { Button } from './ui';

export function EngineBanner(): React.ReactElement | null {
  const app = useApp();
  if (!app.engine || app.engine.mode === 'http') return null;
  const idle = app.engine.mode === 'cli';
  return (
    <div className={`engine-banner engine-banner--${idle ? 'warn' : 'error'}`}>
      <TriangleAlert size={16} />
      <div className="engine-banner__body">
        <strong>{idle ? 'Engine installed, API not running' : 'VALET engine not found'}</strong>
        <span>
          {idle
            ? 'The engine binary is available, but the local API is offline. Start it to manage projects, services and logs.'
            : 'Install the engine or point VALET at an existing binary. VALET never downloads or runs unverified installers.'}
        </span>
        {app.engine.binary ? <code>{app.engine.binary}</code> : null}
      </div>
      <div className="engine-banner__actions">
        {idle ? (
          <Button variant="primary" onClick={() => void app.runEngineCommand('start')}>
            <Play size={12} /> Start engine
          </Button>
        ) : null}
        <Button onClick={() => void app.refreshEngine()}>
          <RefreshCw size={12} /> Retry
        </Button>
        <Button onClick={() => app.openView('settings')}>
          <Settings2 size={12} /> Engine settings
        </Button>
      </div>
    </div>
  );
}
