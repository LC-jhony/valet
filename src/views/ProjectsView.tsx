import React, { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  FolderOpen,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Shield,
  ShieldOff,
  SquareTerminal,
  Trash2,
  X,
} from 'lucide-react';
import { useApp, valet } from '../state/store';
import type { Project } from '../../shared/types';
import { formatRelative, projectStatus, serviceStatus, shortPath } from '../../shared/format';
import { satisfiesPhpConstraint } from '../../shared/php';
import { Badge, Button, EmptyState, IconButton, InlineNote, Modal, SearchInput, StatusDot } from '../components/ui';
import { EngineBanner } from '../components/EngineBanner';

function siteUrl(project: Project): string {
  return `${project.tls ? 'https' : 'http'}://${project.domains[0] ?? project.domain}`;
}

function versionParts(version: string): [number, number] {
  const [major = '0', minor = '0'] = version.split('.');
  return [Number(major) || 0, Number(minor) || 0];
}

function compareVersion(a: string, b: string): number {
  const [aMajor, aMinor] = versionParts(a);
  const [bMajor, bMinor] = versionParts(b);
  return aMajor === bMajor ? aMinor - bMinor : aMajor - bMajor;
}

function outOfRange(version: string, min?: string, max?: string): boolean {
  if (min && compareVersion(version, min) < 0) return true;
  if (max && compareVersion(version, max) > 0) return true;
  return false;
}

type ServiceAction = 'add' | 'remove' | 'declare' | 'dismiss';

interface ServicePrompt {
  domain: string;
  project: string;
  name: string;
  action: ServiceAction;
  reason?: string;
}

export function ProjectsView(): React.ReactElement {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'running' | 'idle'>('all');
  const [confirmRemove, setConfirmRemove] = useState<Project | null>(null);
  const [servicePrompt, setServicePrompt] = useState<ServicePrompt | null>(null);

  const selected = app.selectedProjectData;
  const installedPhp = app.php.filter((version) => version.installed);
  const inspection = app.inspection?.path === selected?.path ? app.inspection : null;
  const composerCompatibility = inspection?.composerPhp && selected?.phpVersion
    ? satisfiesPhpConstraint(selected.phpVersion, inspection.composerPhp)
    : null;

  useEffect(() => {
    if (selected) void app.inspectProject(selected.path);
    // The path is the stable identity for the inspection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.path]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return app.projects.filter((project) => {
      const matches = `${project.name} ${project.domain} ${project.path} ${project.frameworkLabel}`.toLowerCase().includes(term);
      if (!matches) return false;
      if (filter === 'running') return project.fpmRunning && !project.paused;
      if (filter === 'idle') return !project.fpmRunning || project.paused;
      return true;
    });
  }, [app.projects, filter, query]);

  const addProject = async (): Promise<void> => {
    const picked = await valet().dialog.pickProject();
    if (!picked) return;
    await app.addProject(picked);
  };

  const openFolder = async (project: Project): Promise<void> => {
    const error = await valet().shell.openPath(project.path);
    if (error) app.notify('error', error);
  };

  const openSite = async (project: Project): Promise<void> => {
    try {
      await valet().shell.openExternal(siteUrl(project));
    } catch (err) {
      app.notify('error', err instanceof Error ? err.message : String(err));
    }
  };

  const openTerminal = (project: Project): void => {
    app.selectProject(project.domain);
    void app.createTerminal(project.path, project.domain);
  };

  const promptService = (project: Project, name: string, action: ServiceAction, reason?: string): void => {
    setServicePrompt({ domain: project.domain, project: project.name, name, action, reason });
  };

  const runServicePrompt = async (): Promise<void> => {
    const prompt = servicePrompt;
    if (!prompt) return;
    const completed = await app.runSiteAction(prompt.domain, `service:${prompt.action}`, { name: prompt.name });
    if (completed) setServicePrompt(null);
  };

  return (
    <div className="view">
      <div className="view__header">
        <div>
          <h1>Projects</h1>
          <p className="view__subtitle">
            {app.projects.length} registered · {app.projects.filter((project) => project.fpmRunning && !project.paused).length} running
          </p>
        </div>
        <div className="view__actions">
          <Button onClick={() => void app.refreshAll()} disabled={app.refreshing}>
            <RefreshCw size={12} className={app.refreshing ? 'spin' : ''} /> Refresh
          </Button>
          <Button variant="primary" onClick={() => void addProject()}>
            <Plus size={13} /> Add project
          </Button>
        </div>
      </div>

      <EngineBanner />

      <div className="toolbar">
        <div className="toolbar__search">
          <SearchInput value={query} onChange={setQuery} placeholder="Search projects" />
        </div>
        <div className="segmented" role="group" aria-label="Filter projects">
          {(['all', 'running', 'idle'] as const).map((value) => (
            <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>
              {value === 'all' ? 'All' : value === 'running' ? 'Running' : 'Idle'}
            </button>
          ))}
        </div>
        <span className="toolbar__hint">{filtered.length} shown</span>
      </div>

      {app.projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={28} />}
          title={app.engine?.mode === 'http' ? 'No projects registered' : 'Connect the engine to list projects'}
          description={
            app.engine?.mode === 'http'
              ? 'Register an existing folder. VALET asks the engine to serve it; files stay exactly where they are.'
              : 'VALET reads projects from the engine registry. Start the engine or choose a binary in Settings.'
          }
          actions={
            <>
              <Button variant="primary" onClick={() => void addProject()} disabled={app.engine?.mode !== 'http'}>
                <Plus size={13} /> Add project folder
              </Button>
              <Button onClick={() => app.openView('settings')}>Open settings</Button>
            </>
          }
        />
      ) : (
        <div className={`view-split${selected ? ' has-detail' : ''}`}>
          <div className="table-wrap">
            {filtered.length === 0 ? (
              <EmptyState compact icon={<Search size={22} />} title="No projects match" description="Adjust the search or filter." />
            ) : (
              <table className="data-table projects-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>PHP</th>
                    <th>Framework</th>
                    <th>Status</th>
                    <th>Path</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((project) => {
                    const status = projectStatus(project);
                    return (
                      <tr
                        key={project.domain}
                        className={project.domain === app.selectedProject ? 'is-selected' : ''}
                        onClick={() => app.selectProject(project.domain)}
                        onDoubleClick={() => openTerminal(project)}
                      >
                        <td>
                          <div className="cell-title">
                            <StatusDot tone={status.tone} />
                            <div className="cell-title__text">
                              <strong>{project.name}</strong>
                              <span>
                                {project.domain}
                                {project.tls ? <Lock size={9} aria-label="TLS" /> : null}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="mono">
                          {project.phpVersion ? `PHP ${project.phpVersion}` : '—'}
                        </td>
                        <td>{project.frameworkLabel || '—'}</td>
                        <td>
                          <div className="badge-row">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            {project.queueRunning ? <Badge tone="info">queue</Badge> : null}
                          </div>
                        </td>
                        <td className="mono path-cell" title={project.path}>{shortPath(project.path, 34)}</td>
                        <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                          <IconButton label="Open folder" onClick={() => void openFolder(project)}>
                            <FolderOpen size={14} />
                          </IconButton>
                          <IconButton label="Open site" onClick={() => void openSite(project)}>
                            <ExternalLink size={14} />
                          </IconButton>
                          <IconButton label="Open terminal" onClick={() => openTerminal(project)}>
                            <SquareTerminal size={14} />
                          </IconButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selected ? (
            <aside className="detail" aria-label={`${selected.name} details`}>
              <div className="detail__header">
                <div>
                  <h2>{selected.name}</h2>
                  <span className="detail__domain">{selected.domain}</span>
                </div>
                <IconButton label="Close details" onClick={() => app.selectProject(null)}>
                  <X size={14} />
                </IconButton>
              </div>

              <div className="badge-row detail__badges">
                <Badge tone={projectStatus(selected).tone}>{projectStatus(selected).label}</Badge>
                <Badge tone={selected.tls ? 'ok' : 'muted'}>{selected.tls ? 'TLS' : 'HTTP'}</Badge>
                <Badge tone="muted">{selected.frameworkLabel}</Badge>
              </div>

              <div className="detail__section">
                <div className="detail__label">Project</div>
                <dl className="kv">
                  <div><dt>Path</dt><dd className="mono" title={selected.path}>{selected.path}</dd></div>
                  <div><dt>Domains</dt><dd className="mono">{selected.domains.join(', ')}</dd></div>
                  <div><dt>Node</dt><dd>{selected.nodeVersion || '—'}</dd></div>
                  <div><dt>Last active</dt><dd>{formatRelative(selected.lastActive)}</dd></div>
                  <div><dt>Requests</dt><dd>{selected.requestCount ?? '—'}</dd></div>
                </dl>
                {selected.workers && selected.workers.length > 0 ? (
                  <div className="badge-row">
                    {selected.workers.map((worker) => (
                      <Badge key={worker.name} tone={worker.failing ? 'error' : worker.running ? 'ok' : 'muted'}>
                        {worker.label}: {worker.failing ? 'failing' : worker.running ? 'running' : 'stopped'}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="button-row">
                  <Button onClick={() => void openFolder(selected)}><FolderOpen size={12} /> Folder</Button>
                  <Button onClick={() => void openSite(selected)}><ExternalLink size={12} /> Site</Button>
                  <Button onClick={() => openTerminal(selected)}><SquareTerminal size={12} /> Terminal</Button>
                </div>
              </div>

              <div className="detail__section">
                <div className="detail__label">Services</div>
                {(selected.services ?? []).length === 0 && (selected.suggestedServices ?? []).length === 0 ? (
                  <p className="field-note">No services attached or suggested for this project.</p>
                ) : (
                  <ul className="service-list">
                    {(selected.services ?? []).map((name) => {
                      const service = app.services.find((entry) => entry.name === name);
                      const status = service ? serviceStatus(service) : null;
                      const declared = (selected.declaredServices ?? []).includes(name);
                      return (
                        <li key={`attached-${name}`} className="service-list__item">
                          <div className="service-list__name">
                            <Badge tone={status?.tone ?? 'muted'}>{status?.label ?? 'not installed'}</Badge>
                            <span className="mono">{name}</span>
                            <span className="service-list__hint">{declared ? 'declared' : 'detected in env'}</span>
                          </div>
                          <div className="button-row">
                            {declared ? (
                              <Button size="sm" onClick={() => promptService(selected, name, 'remove')}>
                                <X size={11} /> Detach
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => promptService(selected, name, 'declare')}
                                title="Record this env-wired service in .lerd.yaml"
                              >
                                <Plus size={11} /> Declare
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                    {(selected.suggestedServices ?? []).map((suggestion) => (
                      <li key={`suggested-${suggestion.name}`} className="service-list__item service-list__item--suggested">
                        <div className="service-list__name">
                          <Badge tone="muted">suggested</Badge>
                          <span className="mono">{suggestion.name}</span>
                          <span
                            className="service-list__hint"
                            title={suggestion.reason ?? suggestion.package ?? 'Suggested by the framework'}
                          >
                            {suggestion.reason ?? suggestion.package ?? 'Suggested by the framework'}
                          </span>
                        </div>
                        <div className="button-row">
                          <Button size="sm" onClick={() => promptService(selected, suggestion.name, 'add', suggestion.reason)}>
                            <Plus size={11} /> Add
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => promptService(selected, suggestion.name, 'dismiss')}>
                            <X size={11} /> Dismiss
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="detail__section">
                <div className="detail__label">PHP runtime</div>
                <label className="field">
                  <span>Project version</span>
                  <select
                    value={selected.phpVersion}
                    onChange={(event) => void app.setProjectPhp(selected.domain, event.target.value)}
                    disabled={!selected.usesPhp}
                  >
                    {selected.phpVersion && !installedPhp.some((version) => version.version === selected.phpVersion) ? (
                      <option value={selected.phpVersion}>{selected.phpVersion} (not installed)</option>
                    ) : null}
                    {installedPhp.map((version) => (
                      <option
                        key={version.version}
                        value={version.version}
                        disabled={outOfRange(version.version, selected.phpMin, selected.phpMax)}
                      >
                        PHP {version.version}
                        {outOfRange(version.version, selected.phpMin, selected.phpMax) ? ' — outside framework range' : ''}
                        {inspection?.composerPhp && satisfiesPhpConstraint(version.version, inspection.composerPhp) === false
                          ? ' — outside composer constraint'
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="field-note">Only this project changes. The host PHP and other projects are untouched.</p>
                <p className="field-note">Engine runtime: {selected.runtime === 'frankenphp' ? 'FrankenPHP' : 'PHP-FPM'} · CLI and Composer shims use the same pin.</p>
                {selected.queueRunning ? (
                  <p className="field-note">Background queue worker is running{selected.queueFailing ? ' but failing.' : '.'}</p>
                ) : null}
                {selected.phpMin || selected.phpMax ? (
                  <p className="field-note">Framework range: {selected.phpMin || 'any'} – {selected.phpMax || 'any'}</p>
                ) : null}
                {!selected.usesPhp ? <InlineNote tone="warn">This project does not run PHP.</InlineNote> : null}
              </div>

              <div className="detail__section">
                <div className="detail__label">Composer</div>
                {inspection ? (
                  <dl className="kv">
                    <div><dt>composer.json</dt><dd>{inspection.hasComposer ? 'yes' : 'not found'}</dd></div>
                    <div><dt>PHP constraint</dt><dd className="mono">{inspection.composerPhp ?? '—'}</dd></div>
                    <div><dt>Detected</dt><dd>{inspection.framework ?? selected.frameworkLabel ?? '—'}</dd></div>
                    <div><dt>Node</dt><dd>{inspection.hasNode ? inspection.packageManager ?? 'yes' : 'no'}</dd></div>
                    <div><dt>Git</dt><dd>{inspection.hasGit ? 'repository' : 'not a repository'}</dd></div>
                  </dl>
                ) : (
                  <p className="field-note">Inspecting…</p>
                )}
                {composerCompatibility === false && inspection?.composerPhp ? (
                  <InlineNote tone="warn">
                    PHP {selected.phpVersion} does not satisfy composer.json (<code>{inspection.composerPhp}</code>).
                    Composer and framework commands can fail until the project uses a compatible runtime.
                  </InlineNote>
                ) : null}
                {composerCompatibility === true && inspection?.composerPhp ? (
                  <p className="field-note">The current PHP pin satisfies composer.json.</p>
                ) : null}
              </div>

              <div className="detail__section">
                <div className="detail__label">Actions</div>
                <div className="button-row button-row--wrap">
                  <Button onClick={() => void app.runSiteAction(selected.domain, selected.paused ? 'unpause' : 'pause')}>
                    {selected.paused ? <Play size={12} /> : <Pause size={12} />} {selected.paused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button onClick={() => void app.runSiteAction(selected.domain, selected.tls ? 'unsecure' : 'secure')}>
                    {selected.tls ? <ShieldOff size={12} /> : <Shield size={12} />} {selected.tls ? 'Remove TLS' : 'Enable TLS'}
                  </Button>
                  <Button onClick={() => void app.runSiteAction(selected.domain, 'restart')}>
                    <RotateCw size={12} /> Restart
                  </Button>
                </div>
              </div>

              <div className="detail__section detail__section--danger">
                <div className="detail__label">Registration</div>
                <Button variant="danger" onClick={() => setConfirmRemove(selected)}>
                  <Trash2 size={12} /> Unregister project
                </Button>
                <p className="field-note">Removes the site from the engine registry. Files, databases and volumes are preserved.</p>
              </div>
            </aside>
          ) : null}
        </div>
      )}

      {confirmRemove ? (
        <Modal
          title={`Unregister ${confirmRemove.name}?`}
          onClose={() => setConfirmRemove(null)}
          footer={
            <>
              <Button onClick={() => setConfirmRemove(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const project = confirmRemove;
                  setConfirmRemove(null);
                  void app.removeProject(project);
                }}
              >
                Unregister
              </Button>
            </>
          }
        >
          <p>
            The engine stops serving <strong>{confirmRemove.domain}</strong>. The project folder and its database
            data stay untouched. You can register the folder again at any time.
          </p>
        </Modal>
      ) : null}
      {servicePrompt ? (
        <Modal
          title={
            servicePrompt.action === 'add' ? `Add ${servicePrompt.name} to ${servicePrompt.project}?`
              : servicePrompt.action === 'remove' ? `Detach ${servicePrompt.name}?`
                : servicePrompt.action === 'declare' ? `Declare ${servicePrompt.name}?`
                  : `Dismiss ${servicePrompt.name}?`
          }
          onClose={() => setServicePrompt(null)}
          footer={
            <>
              <Button onClick={() => setServicePrompt(null)}>Cancel</Button>
              <Button
                variant={servicePrompt.action === 'remove' ? 'danger' : 'primary'}
                onClick={() => void runServicePrompt()}
              >
                {servicePrompt.action === 'add' ? 'Add service'
                  : servicePrompt.action === 'remove' ? 'Detach'
                    : servicePrompt.action === 'declare' ? 'Declare'
                      : 'Dismiss'}
              </Button>
            </>
          }
        >
          {servicePrompt.action === 'add' ? (
            <>
              <p>
                The engine installs and starts <strong>{servicePrompt.name}</strong>, then wires the project's
                engine marker and environment file. No existing database volume is removed.
              </p>
              {servicePrompt.reason ? <p className="field-note">Why: {servicePrompt.reason}</p> : null}
            </>
          ) : servicePrompt.action === 'remove' ? (
            <p>
              <strong>{servicePrompt.name}</strong> is removed from the project's engine marker and environment.
              The service container, its database and its volumes stay available to other projects.
            </p>
          ) : servicePrompt.action === 'declare' ? (
            <p>
              VALET records <strong>{servicePrompt.name}</strong> in <code>.lerd.yaml</code> because the project
              already reaches it through its environment. Nothing is installed or restarted.
            </p>
          ) : (
            <p>
              VALET stops suggesting <strong>{servicePrompt.name}</strong> for this project. The service, project
              files and data are not changed.
            </p>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
