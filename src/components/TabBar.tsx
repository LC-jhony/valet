import React from 'react';
import { Boxes, Braces, Database, FolderKanban, Network, Plus, ScrollText, Settings, SquareTerminal, X } from 'lucide-react';
import type { ViewId } from '../../shared/types';
import { useApp } from '../state/store';

const ICONS: Record<ViewId, React.ReactNode> = {
  projects: <FolderKanban size={13} />,
  php: <Braces size={13} />,
  services: <Boxes size={13} />,
  ports: <Network size={13} />,
  databases: <Database size={13} />,
  terminal: <SquareTerminal size={13} />,
  logs: <ScrollText size={13} />,
  settings: <Settings size={13} />,
};

export function TabBar(): React.ReactElement {
  const app = useApp();

  return (
    <div className="tabsbar" role="tablist" aria-label="Open views">
      <div className="tabsbar__scroll">
        {app.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab${tab.id === app.activeTabId ? ' is-active' : ''}`}
            role="tab"
            aria-selected={tab.id === app.activeTabId}
            tabIndex={0}
            onClick={() => app.selectTab(tab.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') app.selectTab(tab.id);
            }}
          >
            <span className="tab__icon">{ICONS[tab.view]}</span>
            <span className="tab__label">{tab.title}</span>
            <button
              type="button"
              className="tab__close"
              aria-label={`Close ${tab.title}`}
              onClick={(event) => {
                event.stopPropagation();
                app.closeTab(tab.id);
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="tabsbar__actions">
        <button type="button" className="tabsbar__action" title="Open command palette" onClick={() => app.setPaletteOpen(true)}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
