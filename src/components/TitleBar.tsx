import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp, valet } from '../state/store';
import { THEME_DEFINITIONS } from '../../shared/themes';
import { StatusDot } from './ui';
import type { Tone } from './ui';

export function ValetMark({ size = 18 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="valet-mark">
      <path d="M2.5 3.5 10 17l7.5-13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.1 3.5 10 10.6l3.9-7.1" stroke="var(--v-accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface MenuItem {
  label?: string;
  shortcut?: string;
  onClick?: () => void;
  separator?: boolean;
  danger?: boolean;
}

function Dropdown({ label, items }: { label: string; items: MenuItem[] }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="titlebar-menu" ref={ref}>
      <button type="button" className={`titlebar-menu__trigger${open ? ' is-open' : ''}`} onClick={() => setOpen((value) => !value)}>
        {label}
        <ChevronDown size={11} />
      </button>
      {open ? (
        <div className="dropdown" role="menu">
          {items.map((item, index) =>
            item.separator ? (
              <div key={`sep-${index}`} className="dropdown__separator" role="separator" />
            ) : (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role="menuitem"
                className={`dropdown__item${item.danger ? ' dropdown__item--danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                <span>{item.label}</span>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function engineTone(mode: string | undefined): Tone {
  if (mode === 'http') return 'ok';
  if (mode === 'cli') return 'warn';
  return 'error';
}

export function TitleBar(): React.ReactElement {
  const app = useApp();
  const isMac = app.appInfo?.platform === 'darwin';

  const engineLabel = app.engine?.mode === 'http'
    ? `Engine ${app.engine.version ?? ''}`.trim()
    : app.engine?.mode === 'cli'
      ? 'Engine idle'
      : 'Engine offline';

  return (
    <header className={`titlebar${isMac ? ' titlebar--mac' : ''}`}>
      <div className="titlebar__brand">
        <ValetMark />
        <span className="titlebar__wordmark">VALET</span>
      </div>

      <nav className="titlebar__menus">
        <Dropdown
          label="VALET"
          items={[
            { label: 'Settings', shortcut: 'Ctrl+,', onClick: () => app.openView('settings') },
            { label: 'Command palette', shortcut: 'Ctrl+K', onClick: () => app.setPaletteOpen(true) },
            { separator: true },
            { label: 'Check engine', onClick: () => void app.refreshEngine() },
            { label: 'Quit VALET', shortcut: 'Alt+F4', danger: true, onClick: () => void valet().app.quit() },
          ]}
        />
        <Dropdown
          label="View"
          items={[
            { label: 'Projects', shortcut: 'Ctrl+1', onClick: () => app.openView('projects') },
            { label: 'Services', shortcut: 'Ctrl+3', onClick: () => app.openView('services') },
            { label: 'Terminal', shortcut: 'Ctrl+6', onClick: () => app.openView('terminal') },
            { separator: true },
            { label: app.sidebarVisible ? 'Hide sidebar' : 'Show sidebar', shortcut: 'Ctrl+B', onClick: app.toggleSidebar },
            { separator: true },
            ...THEME_DEFINITIONS.map((theme) => ({
              label: theme.name,
              onClick: () => void app.setTheme(theme.id),
            })),
          ]}
        />
        <Dropdown
          label="Help"
          items={[
            { label: 'Upstream engine documentation', onClick: () => void valet().shell.openExternal('https://lerd.sh') },
            { separator: true },
            { label: 'About VALET', onClick: () => app.openView('settings') },
          ]}
        />
      </nav>

      <div className="titlebar__project">
        <span className="titlebar__project-label">Project</span>
        <select
          value={app.selectedProject ?? ''}
          onChange={(event) => {
            app.selectProject(event.target.value || null);
            app.openView('projects');
          }}
          aria-label="Active project"
        >
          <option value="">No project selected</option>
          {app.projects.map((project) => (
            <option key={project.domain} value={project.domain}>
              {project.name} — {project.domain}
            </option>
          ))}
        </select>
      </div>

      <div className="titlebar__actions">
        <button type="button" className="engine-pill" onClick={() => void app.refreshEngine()} title="Check engine status">
          <StatusDot tone={engineTone(app.engine?.mode)} pulse={app.engine?.mode === 'http'} />
          <span>{engineLabel}</span>
        </button>
      </div>
    </header>
  );
}
