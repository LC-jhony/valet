import React, { useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Database,
  FolderKanban,
  Plus,
  RefreshCw,
  SquareTerminal,
  X,
} from 'lucide-react';
import { useApp } from '../state/store';
import { portTone, serviceStatus, shortPath } from '../../shared/format';
import { Badge, Button, EmptyState, SearchInput, SectionHeader, StatusDot } from './ui';
import { deriveLogSources } from '../../shared/log-sources';
import { VIEW_META } from '../../shared/format';

function ProjectsSidebar(): React.ReactElement {
  const app = useApp();
  const [query, setQuery] = useState('');
  const filtered = app.projects.filter((project) => {
    const text = `${project.name} ${project.domain} ${project.path} ${project.frameworkLabel}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const running = filtered.filter((project) => project.fpmRunning && !project.paused);
  const other = filtered.filter((project) => !project.fpmRunning || project.paused);

  const add = async (): Promise<void> => {
    const picked = await window.valet.dialog.pickProject();
    if (picked) await app.addProject(picked);
  };

  return (
    <>
      <SectionHeader
        title="Projects"
        count={app.projects.length}
        actions={
          <button type="button" className="sidebar-action" title="Add project" onClick={() => void add()}>
            <Plus size={14} />
          </button>
        }
      />
      <div className="sidebar__search">
        <SearchInput value={query} onChange={setQuery} placeholder="Filter projects" />
      </div>
      <div className="sidebar__scroll">
        {filtered.length === 0 ? (
          <EmptyState
            compact
            icon={<FolderKanban size={22} />}
            title={app.projects.length === 0 ? 'No projects yet' : 'No matches'}
            description={app.projects.length === 0 ? 'Register a folder served by the engine.' : 'Try a different filter.'}
            actions={app.projects.length === 0 ? <Button onClick={() => void add()}>Add folder</Button> : null}
          />
        ) : (
          <>
            {running.length > 0 ? (
              <div className="sidebar__group">
                <div className="sidebar__group-title">Running</div>
                {running.map((project) => (
                  <button
                    key={project.domain}
                    type="button"
                    className={`sidebar-row${app.selectedProject === project.domain ? ' is-selected' : ''}`}
                    onClick={() => {
                      app.selectProject(project.domain);
                      app.openView('projects');
                    }}
                    title={project.path}
                  >
                    <StatusDot tone="ok" />
                    <span className="sidebar-row__main">
                      <span className="sidebar-row__name">{project.name}</span>
                      <span className="sidebar-row__sub">{project.domain}</span>
                    </span>
                    <span className="sidebar-row__meta">PHP {project.phpVersion}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {other.length > 0 ? (
              <div className="sidebar__group">
                <div className="sidebar__group-title">{running.length > 0 ? 'Idle' : 'Registered'}</div>
                {other.map((project) => (
                  <button
                    key={project.domain}
                    type="button"
                    className={`sidebar-row${app.selectedProject === project.domain ? ' is-selected' : ''}`}
                    onClick={() => {
                      app.selectProject(project.domain);
                      app.openView('projects');
                    }}
                    title={project.path}
                  >
                    <StatusDot tone={project.paused ? 'muted' : 'warn'} />
                    <span className="sidebar-row__main">
                      <span className="sidebar-row__name">{project.name}</span>
                      <span className="sidebar-row__sub">{project.domain}</span>
                    </span>
                    <span className="sidebar-row__meta">PHP {project.phpVersion}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="sidebar__footer">
        <span className="sidebar__footer-text">{app.projects.length} registered</span>
        <button type="button" className="sidebar-action" title="Refresh" onClick={() => void app.refreshAll()}>
          <RefreshCw size={13} />
        </button>
      </div>
    </>
  );
}

function PhpSidebar(): React.ReactElement {
  const app = useApp();
  return (
    <>
      <SectionHeader title="PHP runtimes" count={app.php.filter((version) => version.installed).length} />
      <div className="sidebar__scroll">
        {app.php.length === 0 ? (
          <EmptyState compact icon={<span className="mono">PHP</span>} title="No runtimes found" description="Install a version from the PHP view." />
        ) : (
          app.php.map((version) => (
            <button
              key={version.version}
              type="button"
              className="sidebar-row"
              onClick={() => app.openView('php')}
            >
              <StatusDot tone={version.installed ? 'ok' : 'muted'} />
              <span className="sidebar-row__main">
                <span className="sidebar-row__name">PHP {version.version}</span>
                <span className="sidebar-row__sub">{version.installed ? 'installed' : 'available'}</span>
              </span>
              <Badge tone={version.installed ? 'ok' : 'muted'}>{version.installed ? 'FPM' : 'install'}</Badge>
            </button>
          ))
        )}
      </div>
    </>
  );
}

function ServicesSidebar(): React.ReactElement {
  const app = useApp();
  const [query, setQuery] = useState('');
  const filtered = app.services.filter((service) => service.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <SectionHeader title="Services" count={app.services.length} />
      <div className="sidebar__search">
        <SearchInput value={query} onChange={setQuery} placeholder="Filter services" />
      </div>
      <div className="sidebar__scroll">
        {filtered.length === 0 ? (
          <EmptyState compact icon={<Boxes size={22} />} title="No services" description="Start a service from the Services view." />
        ) : (
          filtered.map((service) => {
            const status = serviceStatus(service);
            return (
              <button key={service.name} type="button" className="sidebar-row" onClick={() => app.openView('services')}>
                <StatusDot tone={status.tone} />
                <span className="sidebar-row__main">
                  <span className="sidebar-row__name">{service.name}</span>
                  <span className="sidebar-row__sub">{service.version ?? service.category ?? 'service'}</span>
                </span>
                {service.port ? <span className="sidebar-row__meta">:{service.port}</span> : null}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

function PortsSidebar(): React.ReactElement {
  const app = useApp();
  const conflicts = app.ports.filter((port) => port.state === 'conflict');
  const listening = app.ports.filter((port) => port.state === 'listening');
  return (
    <>
      <SectionHeader
        title="Ports"
        count={app.ports.length}
        actions={
          <button type="button" className="sidebar-action" title="Rescan ports" onClick={() => void app.refreshPorts()}>
            <RefreshCw size={13} />
          </button>
        }
      />
      <div className="sidebar__stats">
        <div><span>{listening.length}</span><label>listening</label></div>
        <div><span>{conflicts.length}</span><label>conflicts</label></div>
      </div>
      <div className="sidebar__scroll">
        {conflicts.length > 0 ? (
          <div className="sidebar__group">
            <div className="sidebar__group-title"><AlertTriangle size={12} /> Conflicts</div>
            {conflicts.map((port) => (
              <button key={`${port.protocol}-${port.hostPort}-${port.address}-${port.service}`} type="button" className="sidebar-row" onClick={() => app.openView('ports')}>
                <StatusDot tone={portTone(port)} />
                <span className="sidebar-row__main">
                  <span className="sidebar-row__name">:{port.hostPort}</span>
                  <span className="sidebar-row__sub">{port.service}{port.project ? ` · ${port.project}` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<span className="mono">:</span>} title="No conflicts" description="Managed host ports are unique." />
        )}
        <div className="sidebar__group">
          <div className="sidebar__group-title">All managed</div>
          {app.ports.slice(0, 40).map((port) => (
            <button key={`${port.protocol}-${port.hostPort}-${port.address}-${port.service}-${port.project ?? ''}`} type="button" className="sidebar-row" onClick={() => app.openView('ports')}>
              <StatusDot tone={portTone(port)} />
              <span className="sidebar-row__main">
                <span className="sidebar-row__name">:{port.hostPort}</span>
                <span className="sidebar-row__sub">{port.service}</span>
              </span>
              <span className="sidebar-row__meta">{port.state}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function DatabasesSidebar(): React.ReactElement {
  const app = useApp();
  const engines = app.databases.engines;
  const dbServices = app.services.filter((service) => service.isDatabase);
  return (
    <>
      <SectionHeader title="Databases" count={engines.reduce((total, engine) => total + engine.databases.length, 0)} />
      <div className="sidebar__scroll">
        {engines.length === 0 && dbServices.length === 0 ? (
          <EmptyState compact icon={<Database size={22} />} title="No database engines" description="Install MySQL, MariaDB or PostgreSQL from Services." />
        ) : (
          <>
            {engines.map((engine) => (
              <div key={engine.name} className="sidebar__group">
                <div className="sidebar__group-title">{engine.name} · {engine.status}</div>
                {engine.databases.length === 0 ? (
                  <div className="sidebar__muted">No databases</div>
                ) : (
                  engine.databases.map((database) => (
                    <button key={`${engine.name}-${database.name}`} type="button" className="sidebar-row" onClick={() => app.openView('databases')}>
                      <StatusDot tone={engine.status === 'active' ? 'ok' : 'muted'} />
                      <span className="sidebar-row__main">
                        <span className="sidebar-row__name">{database.name}</span>
                        <span className="sidebar-row__sub">{database.site ?? database.engine}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ))}
            {dbServices.map((service) => (
              <button key={service.name} type="button" className="sidebar-row" onClick={() => app.openView('databases')}>
                <StatusDot tone={serviceStatus(service).tone} />
                <span className="sidebar-row__main">
                  <span className="sidebar-row__name">{service.name}</span>
                  <span className="sidebar-row__sub">{service.version ?? 'engine'}</span>
                </span>
              </button>
            ))}
          </>
        )}
      </div>
      <div className="sidebar__footer">
        <span className="sidebar__footer-text">phpMyAdmin is not bundled</span>
      </div>
    </>
  );
}

function TerminalSidebar(): React.ReactElement {
  const app = useApp();
  return (
    <>
      <SectionHeader
        title="Terminals"
        count={app.terminalSessions.length}
        actions={
          <button type="button" className="sidebar-action" title="New terminal" onClick={() => void app.createTerminal()}>
            <Plus size={14} />
          </button>
        }
      />
      <div className="sidebar__scroll">
        {app.terminalSessions.length === 0 ? (
          <EmptyState compact icon={<SquareTerminal size={22} />} title="No sessions" description="Open a shell in the selected project." actions={<Button onClick={() => void app.createTerminal()}>New terminal</Button>} />
        ) : (
          app.terminalSessions.map((session) => (
            <div key={session.id} className="sidebar-row sidebar-row--static">
              <StatusDot tone={session.alive ? 'ok' : 'muted'} />
              <span className="sidebar-row__main">
                <span className="sidebar-row__name">{session.title}</span>
                <span className="sidebar-row__sub">{shortPath(session.cwd, 30)}</span>
              </span>
              <button type="button" className="sidebar-action" title="Close terminal" onClick={() => void app.killTerminal(session.id)}>
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function LogsSidebar(): React.ReactElement {
  const app = useApp();
  const sources = deriveLogSources(app.services, app.php);
  return (
    <>
      <SectionHeader title="Log sources" count={sources.length} />
      <div className="sidebar__scroll">
        {sources.map((source) => (
          <button
            key={source.id}
            type="button"
            className={`sidebar-row${app.logUnit === source.unit ? ' is-selected' : ''}`}
            onClick={() => {
              app.setLogUnit(source.unit);
              app.openView('logs');
            }}
          >
            <StatusDot tone={source.kind === 'service' ? 'info' : 'muted'} />
            <span className="sidebar-row__main">
              <span className="sidebar-row__name">{source.label}</span>
              <span className="sidebar-row__sub">{source.kind}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function SettingsSidebar(): React.ReactElement {
  const app = useApp();
  const jump = (id: string): void => {
    app.openView('settings');
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const items: Array<[string, string]> = [
    ['settings-appearance', 'Appearance'],
    ['settings-engine', 'Engine'],
    ['settings-adoption', 'Adoption & backup'],
    ['settings-cli', 'Command line'],
    ['settings-security', 'Security'],
    ['settings-about', 'About'],
  ];
  return (
    <>
      <SectionHeader title="Settings" />
      <div className="sidebar__scroll">
        {items.map(([id, label]) => (
          <button key={id} type="button" className="sidebar-row" onClick={() => jump(id)}>
            <span className="sidebar-row__name">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function Sidebar({ hidden = false }: { hidden?: boolean }): React.ReactElement {
  const app = useApp();
  const content = (() => {
    switch (app.activeView) {
      case 'projects': return <ProjectsSidebar />;
      case 'php': return <PhpSidebar />;
      case 'services': return <ServicesSidebar />;
      case 'ports': return <PortsSidebar />;
      case 'databases': return <DatabasesSidebar />;
      case 'terminal': return <TerminalSidebar />;
      case 'logs': return <LogsSidebar />;
      case 'settings': return <SettingsSidebar />;
      default: return <ProjectsSidebar />;
    }
  })();

  return (
    <aside className={`sidebar${hidden ? ' is-hidden' : ''}`} aria-label={`${VIEW_META[app.activeView].label} sidebar`} aria-hidden={hidden}>
      {content}
      <div className="sidebar__engine">
        <StatusDot tone={app.engine?.mode === 'http' ? 'ok' : app.engine?.mode === 'cli' ? 'warn' : 'error'} />
        <span>
          {app.engine?.mode === 'http'
            ? `Engine ${app.engine.version ?? 'online'}`
            : app.engine?.mode === 'cli'
              ? 'Engine idle'
              : 'Engine offline'}
        </span>
        {app.engine?.mode !== 'http' ? (
          <button
            type="button"
            className="sidebar__engine-start"
            onClick={() => void app.runEngineCommand('start')}
            disabled={!app.engine?.binary}
            title={app.engine?.binary ? 'Start the engine' : 'No engine binary found'}
          >
            Start
          </button>
        ) : null}
      </div>
    </aside>
  );
}
