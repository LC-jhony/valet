import React from 'react';
import { AlertTriangle, Boxes, Moon, Network, RefreshCw, Sun } from 'lucide-react';
import { useApp } from '../state/store';
import { StatusDot } from './ui';
import { serviceStatus } from '../../shared/format';
import { DEFAULT_THEME_ID, THEME_IDS, themeDefinition } from '../../shared/themes';

export function StatusBar(): React.ReactElement {
  const app = useApp();
  const running = app.services.filter((service) => serviceStatus(service).tone === 'ok').length;
  const conflicts = app.ports.filter((port) => port.state === 'conflict').length;
  const themeId = app.config?.theme ?? DEFAULT_THEME_ID;
  const theme = themeDefinition(themeId);
  const nextTheme = THEME_IDS[(THEME_IDS.indexOf(themeId) + 1) % THEME_IDS.length] ?? DEFAULT_THEME_ID;

  return (
    <footer className="statusbar">
      <div className="statusbar__group">
        <button
          type="button"
          className="statusbar__item"
          title={app.engine?.error ?? 'Check the engine'}
          onClick={() => void app.refreshEngine()}
        >
          <StatusDot tone={app.engine?.mode === 'http' ? 'ok' : app.engine?.mode === 'cli' ? 'warn' : 'error'} />
          <span>
            {app.engine?.mode === 'http'
              ? `Engine ${app.engine.version ?? 'online'}`
              : app.engine?.mode === 'cli'
                ? 'Engine idle'
                : 'Engine offline'}
          </span>
        </button>
        {app.selectedProjectData ? (
          <button type="button" className="statusbar__item" onClick={() => app.openView('projects')}>
            <span className="statusbar__muted">Project</span> {app.selectedProjectData.name}
          </button>
        ) : null}
        {app.selectedProjectData?.phpVersion ? (
          <button type="button" className="statusbar__item" onClick={() => app.openView('php')}>
            PHP {app.selectedProjectData.phpVersion}
          </button>
        ) : null}
        {app.refreshing ? (
          <span className="statusbar__item statusbar__item--static">
            <RefreshCw size={11} className="spin" /> refreshing
          </span>
        ) : null}
      </div>

      <div className="statusbar__group statusbar__group--right">
        {conflicts > 0 ? (
          <button type="button" className="statusbar__item statusbar__item--error" onClick={() => app.openView('ports')} title="Port conflicts">
            <AlertTriangle size={11} /> {conflicts} conflict{conflicts === 1 ? '' : 's'}
          </button>
        ) : (
          <button type="button" className="statusbar__item" onClick={() => app.openView('ports')} title="Open ports">
            <Network size={11} /> ports ok
          </button>
        )}
        <button type="button" className="statusbar__item" onClick={() => app.openView('services')} title="Open services">
          <Boxes size={11} /> {running}/{app.services.length} services
        </button>
        <button
          type="button"
          className="statusbar__item"
          onClick={() => void app.setTheme(nextTheme)}
          title={`Switch theme (current: ${theme?.name ?? themeId})`}
        >
          {theme?.type === 'light' ? <Sun size={11} /> : <Moon size={11} />}
          {theme?.name ?? themeId}
        </button>
        <button type="button" className="statusbar__item" onClick={() => app.openView('settings')} title="About VALET">
          VALET {app.appInfo?.version ?? '1.0.0'}
        </button>
      </div>
    </footer>
  );
}
