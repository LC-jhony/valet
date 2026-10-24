import React from 'react';
import { Boxes, Braces, Database, FolderKanban, Network, ScrollText, Settings, SquareTerminal } from 'lucide-react';
import type { ViewId } from '../../shared/types';
import { VIEW_META } from '../../shared/format';
import { useApp } from '../state/store';

const ITEMS: Array<{ view: ViewId; icon: React.ReactNode; badge?: 'conflicts' }> = [
  { view: 'projects', icon: <FolderKanban size={20} /> },
  { view: 'php', icon: <Braces size={20} /> },
  { view: 'services', icon: <Boxes size={20} /> },
  { view: 'ports', icon: <Network size={20} />, badge: 'conflicts' },
  { view: 'databases', icon: <Database size={20} /> },
  { view: 'terminal', icon: <SquareTerminal size={20} /> },
  { view: 'logs', icon: <ScrollText size={20} /> },
];

export function ActivityBar(): React.ReactElement {
  const app = useApp();
  const conflicts = app.ports.filter((port) => port.state === 'conflict').length;

  return (
    <nav className="activitybar" aria-label="Primary navigation">
      <div className="activitybar__items">
        {ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            className={`activitybar__item${app.activeView === item.view ? ' is-active' : ''}`}
            aria-label={VIEW_META[item.view].label}
            title={`${VIEW_META[item.view].label} (${VIEW_META[item.view].shortcut})`}
            onClick={() => app.openView(item.view)}
          >
            {item.icon}
            {item.badge === 'conflicts' && conflicts > 0 ? (
              <span className="activitybar__badge" aria-label={`${conflicts} port conflicts`}>{conflicts > 9 ? '9+' : conflicts}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="activitybar__bottom">
        <button
          type="button"
          className={`activitybar__item${app.activeView === 'settings' ? ' is-active' : ''}`}
          aria-label="Settings"
          title={`Settings (${VIEW_META.settings.shortcut})`}
          onClick={() => app.openView('settings')}
        >
          <Settings size={20} />
        </button>
      </div>
    </nav>
  );
}
