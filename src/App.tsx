import React, { Component, useEffect, type ErrorInfo } from 'react';
import { ArrowRight, FolderKanban, Play, Plus, Settings2 } from 'lucide-react';
import { useApp, valet } from './state/store';
import { TitleBar } from './components/TitleBar';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { StatusBar } from './components/StatusBar';
import { Toasts } from './components/Toasts';
import { CommandPalette } from './components/CommandPalette';
import { ProjectsView } from './views/ProjectsView';
import { PhpView } from './views/PhpView';
import { ServicesView } from './views/ServicesView';
import { PortsView } from './views/PortsView';
import { DatabasesView } from './views/DatabasesView';
import { TerminalView } from './views/TerminalView';
import { LogsView } from './views/LogsView';
import { SettingsView } from './views/SettingsView';
import { Button, Spinner, StatusDot } from './components/ui';
import { ValetMark } from './components/TitleBar';
import type { ViewId } from '../shared/types';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[valet] renderer error', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <ValetMark size={28} />
        <h1>VALET hit an interface error</h1>
        <p>{this.state.error.message}</p>
        <Button onClick={() => window.location.reload()}>Reload interface</Button>
      </div>
    );
  }
}

function Welcome(): React.ReactElement {
  const app = useApp();
  const recent = (app.config?.recentProjects ?? [])
    .map((domain) => app.projects.find((project) => project.domain === domain))
    .filter((project): project is NonNullable<typeof project> => Boolean(project))
    .slice(0, 4);

  const add = async (): Promise<void> => {
    const picked = await valet().dialog.pickProject();
    if (picked) await app.addProject(picked);
  };

  return (
    <div className="welcome">
      <div className="welcome__inner">
        <div className="welcome__brand">
          <ValetMark size={42} />
          <div>
            <h1>VALET</h1>
            <p>Local PHP development, without the noise.</p>
          </div>
        </div>

        <div className="welcome__actions">
          <Button variant="primary" onClick={() => void add()} disabled={app.engine?.mode !== 'http'}>
            <Plus size={13} /> Add project folder
          </Button>
          <Button onClick={() => app.openView('projects')}><FolderKanban size={13} /> Open projects</Button>
          {app.engine?.mode !== 'http' && app.engine?.binary ? (
            <Button onClick={() => void app.runEngineCommand('start')}><Play size={13} /> Start engine</Button>
          ) : null}
          <Button variant="ghost" onClick={() => app.openView('settings')}><Settings2 size={13} /> Settings</Button>
        </div>

        <div className="welcome__status">
          <StatusDot tone={app.engine?.mode === 'http' ? 'ok' : app.engine?.mode === 'cli' ? 'warn' : 'error'} />
          <span>
            {app.engine?.mode === 'http'
              ? `Engine ${app.engine.version ?? ''} online at ${app.engine.apiBase}`
              : app.engine?.mode === 'cli'
                ? 'Engine installed, API offline'
                : 'Engine not detected'}
          </span>
        </div>

        {recent.length > 0 ? (
          <div className="welcome__recent">
            <div className="welcome__recent-title">Recent projects</div>
            {recent.map((project) => (
              <button
                key={project.domain}
                type="button"
                className="welcome__recent-row"
                onClick={() => {
                  app.selectProject(project.domain);
                  app.openView('projects');
                }}
              >
                <StatusDot tone={project.fpmRunning ? 'ok' : 'muted'} />
                <span>{project.name}</span>
                <span className="mono">{project.domain}</span>
                <ArrowRight size={12} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="welcome__shortcuts">
          <span><kbd>Ctrl</kbd><kbd>K</kbd> command palette</span>
          <span><kbd>Ctrl</kbd><kbd>`</kbd> terminal</span>
          <span><kbd>Ctrl</kbd><kbd>B</kbd> sidebar</span>
          <span><kbd>Ctrl</kbd><kbd>7</kbd> logs</span>
        </div>
      </div>
    </div>
  );
}

function ViewContent(): React.ReactElement {
  const app = useApp();
  switch (app.activeView) {
    case 'projects': return <ProjectsView />;
    case 'php': return <PhpView />;
    case 'services': return <ServicesView />;
    case 'ports': return <PortsView />;
    case 'databases': return <DatabasesView />;
    case 'terminal': return <TerminalView />;
    case 'logs': return <LogsView />;
    case 'settings': return <SettingsView />;
    default: return <ProjectsView />;
  }
}

const SHORTCUT_VIEWS: Record<string, ViewId> = {
  '1': 'projects',
  '2': 'php',
  '3': 'services',
  '4': 'ports',
  '5': 'databases',
  '6': 'terminal',
  '7': 'logs',
};

export function App(): React.ReactElement {
  const app = useApp();

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      if (event.key.toLowerCase() === 'k' || (event.shiftKey && event.key.toLowerCase() === 'p')) {
        event.preventDefault();
        app.setPaletteOpen(true);
        return;
      }
      if (typing) return;
      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        app.toggleSidebar();
        return;
      }
      if (event.key === ',') {
        event.preventDefault();
        app.openView('settings');
        return;
      }
      if (event.key === '`') {
        event.preventDefault();
        void app.createTerminal();
        return;
      }
      const view = SHORTCUT_VIEWS[event.key];
      if (view) {
        event.preventDefault();
        app.openView(view);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [app]);

  const style = {
    '--sidebar-w': `${app.config?.sidebarWidth ?? 248}px`,
  } as React.CSSProperties;

  return (
    <ErrorBoundary>
      <div className="app">
        <TitleBar />
        <div className={`workbench${app.sidebarVisible ? '' : ' workbench--no-sidebar'}`} style={style}>
          <ActivityBar />
          <Sidebar hidden={!app.sidebarVisible} />
          <main className="main">
            <TabBar />
            <div className="editor">
              <div className="editor__content">
                {app.loading ? (
                  <div className="loading-state"><Spinner label="Loading environment" /><span>Reading engine state…</span></div>
                ) : app.tabs.length === 0 ? (
                  <Welcome />
                ) : (
                  <ViewContent />
                )}
              </div>
            </div>
          </main>
        </div>
        <StatusBar />
        <Toasts />
        <CommandPalette />
      </div>
    </ErrorBoundary>
  );
}
