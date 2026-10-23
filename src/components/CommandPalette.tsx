import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useApp, valet } from '../state/store';
import { THEME_DEFINITIONS } from '../../shared/themes';
import { VIEW_META } from '../../shared/format';
import type { ViewId } from '../../shared/types';

interface PaletteCommand {
  id: string;
  label: string;
  detail?: string;
  shortcut?: string;
  category: string;
  run: () => void;
}

export function CommandPalette(): React.ReactElement | null {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!app.paletteOpen) return;
    setQuery('');
    setIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [app.paletteOpen]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const views = (Object.keys(VIEW_META) as ViewId[]).map((view) => ({
      id: `view-${view}`,
      label: `Open ${VIEW_META[view].label}`,
      category: 'Navigation',
      shortcut: VIEW_META[view].shortcut,
      run: () => app.openView(view),
    }));
    return [
      ...views,
      {
        id: 'add-project',
        label: 'Add project folder…',
        category: 'Projects',
        run: () => {
          void (async () => {
            const picked = await valet().dialog.pickProject();
            if (picked) await app.addProject(picked);
          })();
        },
      },
      {
        id: 'new-terminal',
        label: 'New terminal in selected project',
        category: 'Terminal',
        shortcut: 'Ctrl+`',
        run: () => void app.createTerminal(),
      },
      {
        id: 'refresh',
        label: 'Refresh environment',
        category: 'Engine',
        run: () => void app.refreshAll(),
      },
      {
        id: 'check-engine',
        label: 'Check engine status',
        category: 'Engine',
        run: () => void app.refreshEngine(),
      },
      {
        id: 'start-engine',
        label: 'Start engine',
        category: 'Engine',
        run: () => void app.runEngineCommand('start'),
      },
      {
        id: 'doctor',
        label: 'Run environment doctor',
        category: 'Engine',
        run: () => {
          app.openLogs('output');
          void app.runEngineCommand('doctor');
        },
      },
      ...THEME_DEFINITIONS.map((theme) => ({
        id: `theme-${theme.id}`,
        label: `Use ${theme.name} theme`,
        category: 'Appearance',
        run: () => void app.setTheme(theme.id),
      })),
      {
        id: 'toggle-sidebar',
        label: 'Toggle sidebar',
        category: 'View',
        shortcut: 'Ctrl+B',
        run: app.toggleSidebar,
      },
      {
        id: 'settings',
        label: 'Open settings',
        category: 'Navigation',
        shortcut: 'Ctrl+,',
        run: () => app.openView('settings'),
      },
      {
        id: 'docs',
        label: 'Open upstream engine documentation',
        category: 'Help',
        run: () => void valet().shell.openExternal('https://lerd.sh'),
      },
    ];
  }, [app]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((command) => `${command.label} ${command.category}`.toLowerCase().includes(term));
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const item = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!app.paletteOpen) return null;

  const execute = (command: PaletteCommand | undefined): void => {
    if (!command) return;
    app.setPaletteOpen(false);
    command.run();
  };

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) app.setPaletteOpen(false);
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette__input">
          <Search size={15} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Type a command…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                app.setPaletteOpen(false);
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setIndex((current) => Math.min(filtered.length - 1, current + 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setIndex((current) => Math.max(0, current - 1));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                execute(filtered[index]);
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette__list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette__empty">No commands match “{query}”.</div>
          ) : (
            filtered.map((command, commandIndex) => (
              <button
                key={command.id}
                type="button"
                data-index={commandIndex}
                className={`palette__item${commandIndex === index ? ' is-selected' : ''}`}
                onMouseEnter={() => setIndex(commandIndex)}
                onClick={() => execute(command)}
              >
                <span className="palette__category">{command.category}</span>
                <span className="palette__label">{command.label}</span>
                {command.shortcut ? <kbd>{command.shortcut}</kbd> : <ArrowRight size={12} className="palette__arrow" />}
              </button>
            ))
          )}
        </div>
        <div className="palette__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
