import React, { useState } from 'react';
import { Braces, Check, Download, Globe2, Pin, Puzzle, RefreshCw } from 'lucide-react';
import { useApp, valet } from '../state/store';
import { Badge, Button, EmptyState, InlineNote, Modal, StatusDot } from '../components/ui';
import { EngineBanner } from '../components/EngineBanner';
import type { PhpExtensionsReport, PhpVersion } from '../../shared/types';

function compareVersion(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split('.').map(Number);
  const [bMajor = 0, bMinor = 0] = b.split('.').map(Number);
  return aMajor === bMajor ? aMinor - bMinor : aMajor - bMajor;
}

function inRange(version: string, min?: string, max?: string): boolean {
  if (min && compareVersion(version, min) < 0) return false;
  if (max && compareVersion(version, max) > 0) return false;
  return true;
}

function TokenList({ values, empty }: { values: string[]; empty: string }): React.ReactElement {
  if (values.length === 0) return <p className="field-note">{empty}</p>;
  return (
    <div className="badge-row token-list">
      {values.map((value) => <Badge key={value} tone="muted">{value}</Badge>)}
    </div>
  );
}

export function PhpView(): React.ReactElement {
  const app = useApp();
  const [installing, setInstalling] = useState<string | null>(null);
  const [globalChoice, setGlobalChoice] = useState<string | null>(null);
  const [extensionsFor, setExtensionsFor] = useState<string | null>(null);
  const [extensions, setExtensions] = useState<PhpExtensionsReport | null>(null);
  const [extensionsError, setExtensionsError] = useState<string | null>(null);
  const [extensionsLoading, setExtensionsLoading] = useState(false);
  const installed = app.php.filter((version) => version.installed);
  const available = app.php.filter((version) => !version.installed);
  const selected = app.selectedProjectData;

  const openExtensions = async (version: string): Promise<void> => {
    setExtensionsFor(version);
    setExtensions(null);
    setExtensionsError(null);
    setExtensionsLoading(true);
    try {
      setExtensions(await valet().engine.phpExtensions(version));
    } catch (err) {
      setExtensionsError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtensionsLoading(false);
    }
  };

  const closeExtensions = (): void => {
    setExtensionsFor(null);
    setExtensions(null);
    setExtensionsError(null);
  };

  const pin = (version: PhpVersion): void => {
    if (!selected) {
      app.notify('warning', 'Select a project first, then pin its PHP version.');
      app.openView('projects');
      return;
    }
    void app.setProjectPhp(selected.domain, version.version);
  };

  const install = async (version: PhpVersion): Promise<void> => {
    setInstalling(version.version);
    app.openLogs('output');
    await app.installPhp(version.version);
    setInstalling(null);
  };

  const confirmGlobal = async (): Promise<void> => {
    if (!globalChoice) return;
    const version = globalChoice;
    setGlobalChoice(null);
    await app.runEngineCommand('use-php', [version]);
  };

  return (
    <div className="view">
      <div className="view__header">
        <div>
          <h1>PHP</h1>
          <p className="view__subtitle">Isolated runtimes per project. The host system PHP is never replaced.</p>
        </div>
        <div className="view__actions">
          <Button onClick={() => void app.refreshAll()} disabled={app.refreshing}>
            <RefreshCw size={12} className={app.refreshing ? 'spin' : ''} /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setGlobalChoice(installed[0]?.version ?? null)} disabled={installed.length === 0}>
            <Globe2 size={13} /> Global default
          </Button>
        </div>
      </div>

      <EngineBanner />

      {selected ? (
        <div className="selection-strip">
          <Braces size={14} />
          <span>
            Selected project <strong>{selected.name}</strong> ({selected.domain}) uses <strong>PHP {selected.phpVersion || '—'}</strong>
          </span>
          {selected.phpMin || selected.phpMax ? (
            <Badge tone="muted">range {selected.phpMin || 'any'} – {selected.phpMax || 'any'}</Badge>
          ) : null}
        </div>
      ) : (
        <InlineNote tone="info">Select a project in Projects to pin a specific PHP runtime to it.</InlineNote>
      )}

      <div className="two-column">
        <section className="section-block">
          <div className="section-block__header">
            <h2>Installed</h2>
            <span>{installed.length} runtimes</span>
          </div>
          {installed.length === 0 ? (
            <EmptyState
              compact
              icon={<Braces size={22} />}
              title="No PHP runtimes installed"
              description="Build a runtime from the available list. The engine streams real build output into Logs → Engine output."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Version</th><th>Projects</th><th>Status</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {installed.map((version) => {
                  const users = app.projects.filter((project) => project.phpVersion === version.version);
                  return (
                    <tr key={version.version}>
                      <td className="mono"><strong>PHP {version.version}</strong></td>
                      <td>{users.length === 0 ? '—' : `${users.length} project${users.length === 1 ? '' : 's'}`}</td>
                      <td>
                        <div className="badge-row">
                          <Badge tone={version.running ? 'ok' : 'muted'} title={version.running === undefined ? 'The engine status endpoint did not report this runtime.' : undefined}>
                            <StatusDot tone={version.running ? 'ok' : 'muted'} />
                            {version.running ? 'FPM running' : version.running === false ? 'FPM stopped' : 'FPM state unknown'}
                          </Badge>
                          {version.default ? <Badge tone="accent">engine default</Badge> : null}
                          {version.xdebugMode ? <Badge tone="muted">xdebug {version.xdebugMode}</Badge> : null}
                          {version.updateAvailable ? <Badge tone="warn">rebuild available</Badge> : null}
                        </div>
                        {version.patch ? <span className="field-note mono">patch {version.patch}</span> : null}
                        {version.ports?.length ? <span className="field-note mono">FPM ports {version.ports.join(', ')}</span> : null}
                      </td>
                      <td className="row-actions">
                        <Button size="sm" onClick={() => pin(version)} disabled={!selected} title={selected ? `Pin PHP ${version.version} to ${selected.domain}` : 'Select a project first'}>
                          <Pin size={11} /> Pin to project
                        </Button>
                        <Button size="sm" onClick={() => setGlobalChoice(version.version)} title="Set the engine global PHP default">
                          <Globe2 size={11} /> Global
                        </Button>
                        <Button size="sm" onClick={() => void openExtensions(version.version)} title={`Inspect modules in the PHP ${version.version} runtime`}>
                          <Puzzle size={11} /> Extensions
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="section-block">
          <div className="section-block__header">
            <h2>Available</h2>
            <span>{available.length} versions</span>
          </div>
          {available.length === 0 ? (
            <EmptyState compact icon={<Check size={22} />} title="Everything supported is installed" description="The engine reports no further installable PHP versions." />
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Version</th><th>Status</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {available.map((version) => (
                  <tr key={version.version}>
                    <td className="mono">PHP {version.version}</td>
                    <td><Badge tone="muted">not installed</Badge></td>
                    <td className="row-actions">
                      <Button
                        size="sm"
                        onClick={() => void install(version)}
                        disabled={installing !== null || app.engine?.mode !== 'http'}
                        title={app.engine?.mode === 'http' ? 'Build this runtime' : 'Engine API is required'}
                      >
                        <Download size={11} /> {installing === version.version ? 'Building…' : 'Install'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="section-block section-block--full">
        <div className="section-block__header">
          <h2>Project assignments</h2>
          <span>{app.projects.length} projects</span>
        </div>
        {app.projects.length === 0 ? (
          <EmptyState compact icon={<Braces size={22} />} title="No projects registered" description="Register a project to assign a PHP runtime." />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Project</th><th>Runtime</th><th>Framework range</th><th>Change</th></tr>
            </thead>
            <tbody>
              {app.projects.map((project) => (
                <tr key={project.domain}>
                  <td>
                    <div className="cell-title">
                      <StatusDot tone={project.fpmRunning ? 'ok' : 'muted'} />
                      <div className="cell-title__text">
                        <strong>{project.name}</strong>
                        <span>{project.domain}</span>
                      </div>
                    </div>
                  </td>
                  <td className="mono">PHP {project.phpVersion || '—'}</td>
                  <td className="mono">{project.phpMin || project.phpMax ? `${project.phpMin || 'any'} – ${project.phpMax || 'any'}` : '—'}</td>
                  <td>
                    <select
                      className="inline-select"
                      value={project.phpVersion}
                      onChange={(event) => void app.setProjectPhp(project.domain, event.target.value)}
                      disabled={!project.usesPhp || installed.length === 0}
                    >
                      {!installed.some((version) => version.version === project.phpVersion) && project.phpVersion ? (
                        <option value={project.phpVersion}>{project.phpVersion} (not installed)</option>
                      ) : null}
                      {installed.map((version) => (
                        <option key={version.version} value={version.version} disabled={!inRange(version.version, project.phpMin, project.phpMax)}>
                          PHP {version.version}
                          {!inRange(version.version, project.phpMin, project.phpMax) ? ' — outside range' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="section-block section-block--full">
        <div className="section-block__header">
          <h2>Runtime surfaces</h2>
          <span>one project pin, three consumers</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Surface</th><th>What it runs</th><th>Isolation</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>PHP-FPM</strong></td>
              <td>Web requests through the project's engine vhost.</td>
              <td>Per-project container and pin; other sites are unaffected.</td>
            </tr>
            <tr>
              <td><strong>PHP CLI</strong></td>
              <td><code>php</code> inside a VALET terminal opened in the project folder.</td>
              <td>Engine shim directory first on PATH; the host binary is never replaced.</td>
            </tr>
            <tr>
              <td><strong>Composer</strong></td>
              <td><code>composer</code> through the engine shim, using the same pin.</td>
              <td>Project files only; no global Composer or host PHP mutation.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <InlineNote tone="info">
        Pinning a runtime writes the project's engine pin and reloads FPM for that site only. If the switch fails, VALET asks the
        engine to restore the previous pin and reports both results. It never runs <code>update-alternatives</code> and never
        changes the PHP shipped by the operating system.
      </InlineNote>

      {globalChoice ? (
        <Modal
          title="Set the engine global PHP default"
          onClose={() => setGlobalChoice(null)}
          footer={
            <>
              <Button onClick={() => setGlobalChoice(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => void confirmGlobal()}>Set global default</Button>
            </>
          }
        >
          <p>
            The engine uses this version for its CLI shims outside a project. Projects with a pin keep their own
            version. The host package manager is not touched.
          </p>
          <label className="field">
            <span>Global version</span>
            <select value={globalChoice} onChange={(event) => setGlobalChoice(event.target.value)}>
              {installed.map((version) => <option key={version.version} value={version.version}>PHP {version.version}</option>)}
            </select>
          </label>
        </Modal>
      ) : null}

      {extensionsFor ? (
        <Modal
          title={`PHP ${extensionsFor} runtime contents`}
          onClose={closeExtensions}
          footer={<Button variant="primary" onClick={closeExtensions}>Close</Button>}
        >
          <p className="field-note">
            Read from the engine runtime image. Every entry below is reported by the engine, not by VALET's package list.
          </p>
          {extensionsLoading ? <InlineNote tone="info">Reading <code>php -m</code> from the runtime…</InlineNote> : null}
          {extensionsError ? <InlineNote tone="error">{extensionsError}</InlineNote> : null}
          {extensions ? (
            <>
              <div className="badge-row">
                <Badge tone={extensions.built ? 'ok' : 'muted'}>{extensions.built ? 'image built' : 'image not built'}</Badge>
                {extensions.needsRebuild ? <Badge tone="warn">rebuild recommended</Badge> : null}
                <Badge tone="muted">{extensions.modules.length} modules</Badge>
              </div>

              {extensions.modulesError ? <InlineNote tone="warn">{extensions.modulesError}</InlineNote> : null}

              <div className="detail__section">
                <div className="detail__label">Loaded modules (php -m)</div>
                <TokenList values={extensions.modules} empty="The engine did not report modules. The image may not be built yet." />
              </div>

              <div className="detail__section">
                <div className="detail__label">Extensions</div>
                <p className="field-note">Declared for all runtimes</p>
                <TokenList values={extensions.extensions.declared} empty="No global extension declarations." />
                <p className="field-note">Present in this image</p>
                <TokenList values={extensions.extensions.has} empty="Nothing reported as present." />
                {extensions.extensions.cannot.length > 0 ? (
                  <>
                    <p className="field-note">Cannot build on this PHP version</p>
                    <TokenList values={extensions.extensions.cannot} empty="" />
                  </>
                ) : null}
              </div>

              <div className="detail__section">
                <div className="detail__label">System packages</div>
                <p className="field-note">Declared</p>
                <TokenList values={extensions.packages.declared} empty="No package declarations." />
                <p className="field-note">Present</p>
                <TokenList values={extensions.packages.has} empty="Nothing reported as present." />
              </div>
            </>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
