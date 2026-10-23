import React, { useEffect, useMemo, useState } from 'react';
import { Plus, SquareTerminal, Trash2, X } from 'lucide-react';
import { useApp } from '../state/store';
import { buildTheme } from '../../shared/theme';
import { getTheme } from '../themes';
import { TerminalPane } from '../components/TerminalPane';
import { Badge, Button, EmptyState, IconButton } from '../components/ui';
import { shortPath } from '../../shared/format';

export function TerminalView(): React.ReactElement {
  const app = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const tokens = useMemo(() => buildTheme(getTheme(app.config?.theme)), [app.config?.theme]);

  useEffect(() => {
    if (app.terminalSessions.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !app.terminalSessions.some((session) => session.id === activeId)) {
      setActiveId(app.terminalSessions[app.terminalSessions.length - 1]?.id ?? null);
    }
  }, [activeId, app.terminalSessions]);

  useEffect(() => {
    void app.refreshTerminalSessions();
    // Terminal sessions are a native resource; refresh the list once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = app.terminalSessions.find((session) => session.id === activeId) ?? null;

  return (
    <div className="view view--terminal">
      <div className="view__header">
        <div>
          <h1>Terminal</h1>
          <p className="view__subtitle">Real PTY sessions in registered project folders. Shell commands are yours.</p>
        </div>
        <div className="view__actions">
          <Button variant="primary" onClick={() => void app.createTerminal()}>
            <Plus size={13} /> New terminal
          </Button>
        </div>
      </div>

      {app.terminalSessions.length === 0 ? (
        <EmptyState
          icon={<SquareTerminal size={28} />}
          title="No terminal sessions"
          description={
            app.selectedProjectData
              ? `Open a shell in ${app.selectedProjectData.name}.`
              : 'Select a project to open a shell in its folder, or use your home directory.'
          }
          actions={<Button variant="primary" onClick={() => void app.createTerminal()}>Open terminal</Button>}
        />
      ) : (
        <div className="terminal-view">
          <div className="terminal-view__tabs" role="tablist" aria-label="Terminal sessions">
            {app.terminalSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                role="tab"
                aria-selected={session.id === activeId}
                className={`terminal-view__tab${session.id === activeId ? ' is-active' : ''}`}
                onClick={() => setActiveId(session.id)}
              >
                <SquareTerminal size={12} />
                <span>{session.title}</span>
                <span className="terminal-view__tab-cwd">{shortPath(session.cwd, 24)}</span>
                <span
                  className="terminal-view__tab-close"
                  role="button"
                  tabIndex={0}
                  aria-label={`Close ${session.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void app.killTerminal(session.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.stopPropagation();
                      void app.killTerminal(session.id);
                    }
                  }}
                >
                  <X size={11} />
                </span>
              </button>
            ))}
            <IconButton label="New terminal" onClick={() => void app.createTerminal()}>
              <Plus size={13} />
            </IconButton>
          </div>

          <div className="terminal-view__meta">
            <div className="terminal-view__meta-left">
              <Badge tone="muted">host shell</Badge>
              <span className="mono">{active?.cwd ?? ''}</span>
              {active?.project ? <span className="mono">{active.project}</span> : null}
            </div>
            <Button variant="ghost" onClick={() => active && void app.killTerminal(active.id)} disabled={!active}>
              <Trash2 size={12} /> Close session
            </Button>
          </div>

          <div className="terminal-view__host">
            {app.terminalSessions.map((session) => (
              <TerminalPane
                key={session.id}
                session={session}
                tokens={tokens}
                active={session.id === activeId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
