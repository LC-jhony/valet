import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  FolderOpen,
  Info,
  Lock,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useApp, valet } from '../state/store';
import { buildTheme } from '../../shared/theme';
import { DEFAULT_THEME_ID, THEME_DEFINITIONS, type ThemeId } from '../../shared/themes';
import { getTheme } from '../themes';
import { formatBytes, formatRelative } from '../../shared/format';
import { ENGINE_IDENTIFIERS } from '../../shared/mapping';
import { Badge, Button, InlineNote, Modal, StatusDot } from '../components/ui';
import { ValetMark } from '../components/TitleBar';
import { EngineBanner } from '../components/EngineBanner';

function ThemeCard({ id }: { id: ThemeId }): React.ReactElement {
  const app = useApp();
  const tokens = useMemo(() => buildTheme(getTheme(id)), [id]);
  const active = (app.config?.theme ?? DEFAULT_THEME_ID) === id;
  return (
    <button
      type="button"
      className={`theme-card${active ? ' is-active' : ''}`}
      onClick={() => void app.setTheme(id)}
      aria-pressed={active}
    >
      <div className="theme-card__preview" style={{ background: tokens.bg, borderColor: tokens.borderSubtle }}>
        <div className="theme-card__chrome" style={{ background: tokens.bgChrome }}>
          <span style={{ background: tokens.accent }} />
          <span style={{ background: tokens.fgMuted }} />
        </div>
        <div className="theme-card__body">
          <div className="theme-card__side" style={{ background: tokens.bgSidebar, borderColor: tokens.borderSubtle }} />
          <div className="theme-card__lines">
            <span style={{ background: tokens.fg, width: '58%' }} />
            <span style={{ background: tokens.fgMuted, width: '80%' }} />
            <span style={{ background: tokens.info, width: '38%' }} />
            <span style={{ background: tokens.fgDisabled, width: '66%' }} />
          </div>
        </div>
        <div className="theme-card__status" style={{ background: tokens.statusBg }}>
          <span style={{ background: tokens.success }} />
          <span style={{ background: tokens.fgMuted }} />
        </div>
      </div>
      <div className="theme-card__meta">
        <span>{tokens.name}</span>
        {active ? <CheckCircle2 size={14} /> : <span className="theme-card__type">{tokens.type}</span>}
      </div>
      <div className="theme-card__swatches">
        {[tokens.bg, tokens.bgChrome, tokens.fg, tokens.accent, tokens.success, tokens.error].map((color) => (
          <span key={color} style={{ background: color }} title={color} />
        ))}
      </div>
    </button>
  );
}

export function SettingsView(): React.ReactElement {
  const app = useApp();
  const [enginePath, setEnginePath] = useState('');
  const [backingUp, setBackingUp] = useState(false);
  const [confirmAdminRemoval, setConfirmAdminRemoval] = useState(false);
  const [savingPath, setSavingPath] = useState(false);

  useEffect(() => {
    setEnginePath(app.engine?.binary ?? app.config?.enginePath ?? '');
  }, [app.engine?.binary, app.config?.enginePath]);

  useEffect(() => {
    void app.refreshAdoption();
    // Adoption status is loaded when the settings view is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = app.adoption?.plan;
  const manifest = app.adoption?.manifest;

  const browseEngine = async (): Promise<void> => {
    const picked = await valet().dialog.pickEngine();
    if (picked) setEnginePath(picked);
  };

  const saveEnginePath = async (): Promise<void> => {
    setSavingPath(true);
    try {
      await app.updateConfig({ enginePath: enginePath.trim() || null });
      await app.refreshEngine();
      app.notify('success', 'Engine path saved.');
    } catch (err) {
      app.notify('error', err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPath(false);
    }
  };

  const resetEnginePath = async (): Promise<void> => {
    setEnginePath('');
    await app.updateConfig({ enginePath: null });
    await app.refreshEngine();
  };

  const runDoctor = async (): Promise<void> => {
    app.openLogs('output');
    await app.runEngineCommand('doctor');
  };

  const createBackup = async (): Promise<void> => {
    setBackingUp(true);
    await app.applyAdoption();
    setBackingUp(false);
  };

  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      app.notify('success', 'Copied to clipboard.');
    } catch (err) {
      app.notify('error', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="view settings-view">
      <div className="view__header">
        <div>
          <h1>Settings</h1>
          <p className="view__subtitle">Appearance, engine connection, adoption, CLI and security boundaries.</p>
        </div>
      </div>

      <EngineBanner />

      <section className="settings-section" id="settings-appearance">
        <div className="settings-section__heading">
          <h2>Appearance</h2>
          <p>The bundled JSON themes are the single source of truth. Components consume semantic tokens, never raw colours.</p>
        </div>
        <div className="theme-grid">
          {THEME_DEFINITIONS.map((theme) => <ThemeCard key={theme.id} id={theme.id} />)}
        </div>
        <InlineNote tone="info">
          Theme files: <code>src/themes/*.json</code> ({THEME_DEFINITIONS.map((theme) => theme.name).join(', ')}). The
          adapter maps editor, chrome, list, tab, status and terminal keys to CSS variables.
        </InlineNote>
      </section>

      <section className="settings-section" id="settings-engine">
        <div className="settings-section__heading">
          <h2>Engine</h2>
          <p>VALET is the desktop product; the upstream engine keeps its identifiers for compatibility.</p>
        </div>
        <div className="settings-grid">
          <div className="settings-card">
            <div className="settings-card__title"><StatusDot tone={app.engine?.mode === 'http' ? 'ok' : app.engine?.mode === 'cli' ? 'warn' : 'error'} /> Connection</div>
            <dl className="kv">
              <div><dt>Mode</dt><dd><Badge tone={app.engine?.mode === 'http' ? 'ok' : app.engine?.mode === 'cli' ? 'warn' : 'error'}>{app.engine?.mode ?? 'unknown'}</Badge></dd></div>
              <div><dt>Version</dt><dd className="mono">{app.engine?.version ?? '—'}</dd></div>
              <div><dt>API base</dt><dd className="mono">{app.engine?.apiBase ?? '—'}</dd></div>
              <div><dt>Checked</dt><dd>{app.engine ? formatRelative(app.engine.checkedAt) : '—'}</dd></div>
            </dl>
          </div>
          <div className="settings-card">
            <div className="settings-card__title"><Terminal size={13} /> Binary</div>
            <label className="field">
              <span>Engine executable</span>
              <input value={enginePath} onChange={(event) => setEnginePath(event.target.value)} placeholder="Auto-detect lerd on PATH" spellCheck={false} />
            </label>
            <div className="button-row button-row--wrap">
              <Button onClick={() => void browseEngine()}><FolderOpen size={12} /> Browse</Button>
              <Button variant="primary" onClick={() => void saveEnginePath()} disabled={savingPath}>
                <Save size={12} /> Save path
              </Button>
              <Button variant="ghost" onClick={() => void resetEnginePath()}>Auto-detect</Button>
            </div>
            <p className="field-note">
              Environment override: <code>VALET_ENGINE_BIN</code>. The binary is never downloaded or executed with
              elevated privileges by VALET.
            </p>
          </div>
        </div>
        <div className="button-row">
          <Button onClick={() => void app.refreshEngine()}><RefreshCw size={12} /> Check connection</Button>
          <Button onClick={() => void app.runEngineCommand('start')} disabled={!app.engine?.binary}><Play size={12} /> Start engine</Button>
          <Button onClick={() => void runDoctor()} disabled={!app.engine?.binary}>Run doctor</Button>
        </div>
      </section>

      <section className="settings-section" id="settings-adoption">
        <div className="settings-section__heading">
          <h2>Adoption &amp; backup</h2>
          <p>Adopt an existing engine installation in place. No data is moved, renamed or duplicated.</p>
        </div>
        {!plan ? (
          <p className="field-note">Reading installation status…</p>
        ) : (
          <>
            <div className="settings-grid">
              <div className="settings-card">
                <div className="settings-card__title"><Database size={13} /> Legacy installation</div>
                <dl className="kv">
                  <div><dt>Detected</dt><dd>{plan.detected ? 'yes' : 'no'}</dd></div>
                  <div><dt>Binary</dt><dd className="mono">{plan.legacyEngine.binary ?? 'not found'}</dd></div>
                  <div><dt>Config</dt><dd className="mono">{plan.legacyEngine.configDir}</dd></div>
                  <div><dt>Data</dt><dd className="mono">{plan.legacyEngine.dataDir}</dd></div>
                  <div><dt>Projects</dt><dd>{plan.legacyEngine.siteCount}</dd></div>
                </dl>
              </div>
              <div className="settings-card">
                <div className="settings-card__title"><ShieldCheck size={13} /> Verified backup</div>
                {manifest ? (
                  <dl className="kv">
                    <div><dt>Adopted</dt><dd>{formatRelative(Date.parse(manifest.createdAt))}</dd></div>
                    <div><dt>Mode</dt><dd>{manifest.mode}</dd></div>
                    <div><dt>Backup</dt><dd className="mono">{manifest.backupDir}</dd></div>
                    <div><dt>Files</dt><dd>{manifest.files} · {formatBytes(manifest.bytes)}</dd></div>
                  </dl>
                ) : (
                  <p className="field-note">No adoption manifest yet. The backup is checksummed and only copied, never moved.</p>
                )}
                <Button variant="primary" onClick={() => void createBackup()} disabled={backingUp || !plan.detected}>
                  <ShieldCheck size={12} /> {backingUp ? 'Creating backup…' : 'Create verified backup'}
                </Button>
              </div>
            </div>

            {plan.entries.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Source</th><th>Backup destination</th><th>Files</th><th>Size</th></tr></thead>
                <tbody>
                  {plan.entries.map((entry) => (
                    <tr key={entry.source}>
                      <td className="mono">{entry.source}</td>
                      <td className="mono">{entry.destination}</td>
                      <td>{entry.exists ? entry.fileCount : '—'}</td>
                      <td>{entry.exists ? formatBytes(entry.bytes) : 'missing'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {plan.warnings.length > 0 ? (
              <ul className="warning-list">
                {plan.warnings.map((warning) => (
                  <li key={warning}><Info size={12} /> {warning}</li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>

      <section className="settings-section" id="settings-cli">
        <div className="settings-section__heading">
          <h2>Command line</h2>
          <p>The <code>valet</code> CLI shares the same engine adapter and validation rules as the desktop app.</p>
        </div>
        <div className="settings-card">
          <div className="settings-card__title"><Terminal size={13} /> Install from this checkout</div>
          <pre className="code-block">{'npm install\nnpm run build\n./scripts/install-cli.sh'}</pre>
          <div className="button-row">
            <Button onClick={() => void copy('npm install\nnpm run build\n./scripts/install-cli.sh')}><Copy size={12} /> Copy commands</Button>
            <Button variant="ghost" onClick={() => void valet().shell.openExternal('https://lerd.sh')}>Engine docs <ExternalLink size={11} /></Button>
          </div>
          <p className="field-note">
            The installer refuses to overwrite an unrelated <code>valet</code> executable. Use <code>--force</code> only
            after checking <code>command -v valet</code>.
          </p>
        </div>
      </section>

      <section className="settings-section" id="settings-security">
        <div className="settings-section__heading">
          <h2>Security</h2>
          <p>What is enforced here, and what remains the engine's responsibility.</p>
        </div>
        <div className="security-grid">
          <div className="security-item security-item--ok">
            <Lock size={14} />
            <div><strong>Renderer isolation</strong><span>Context isolation on, Node integration off, sandbox on. The renderer only sees a typed preload bridge.</span></div>
          </div>
          <div className="security-item security-item--ok">
            <ShieldCheck size={14} />
            <div><strong>Validated IPC</strong><span>Paths, domains, versions, service names, ports and log units are validated in the main process. There is no generic exec channel.</span></div>
          </div>
          <div className="security-item security-item--ok">
            <Database size={14} />
            <div><strong>No telemetry</strong><span>VALET sends nothing to a remote service. The config schema stores <code>telemetry: false</code>.</span></div>
          </div>
          <div className="security-item security-item--ok">
            <ShieldCheck size={14} />
            <div><strong>phpMyAdmin retired</strong><span>Filtered from every VALET list and rejected by the service IPC allow-list. Remove a legacy container below.</span></div>
          </div>
          <div className="security-item security-item--warn">
            <AlertTriangle size={14} />
            <div><strong>Terminal is a shell</strong><span>Terminals run with your user privileges. They are intentional, real PTYs. Treat pasted commands as code.</span></div>
          </div>
          <div className="security-item security-item--warn">
            <AlertTriangle size={14} />
            <div><strong>Upstream boundaries</strong><span>Engine plugins execute code by design, and engine update/install integrity is upstream. VALET does not auto-install or elevate.</span></div>
          </div>
        </div>

        <div className="settings-card settings-card--danger">
          <div className="settings-card__title"><Trash2 size={13} /> Legacy phpMyAdmin</div>
          <p>
            Status: <strong>{app.phpMyAdmin?.present ? `present (${app.phpMyAdmin.status ?? 'unknown'})` : 'not present'}</strong>.
            Removal stops and removes only the phpMyAdmin container. MySQL/PostgreSQL engines, volumes and databases
            are not touched.
          </p>
          <Button variant="danger" onClick={() => setConfirmAdminRemoval(true)} disabled={!app.phpMyAdmin?.present}>
            Remove phpMyAdmin container
          </Button>
        </div>
      </section>

      <section className="settings-section" id="settings-about">
        <div className="settings-section__heading">
          <h2>About</h2>
          <p>Product identity, build information and upstream provenance.</p>
        </div>
        <div className="about">
          <div className="about__brand">
            <ValetMark size={34} />
            <div>
              <div className="about__name">VALET</div>
              <div className="about__tagline">Local PHP development, without the noise.</div>
            </div>
          </div>
          <dl className="kv">
            <div><dt>Version</dt><dd>{app.appInfo?.version ?? '1.0.0'}</dd></div>
            <div><dt>Electron</dt><dd>{app.appInfo?.electron ?? '—'}</dd></div>
            <div><dt>Chromium</dt><dd>{app.appInfo?.chrome ?? '—'}</dd></div>
            <div><dt>Node</dt><dd>{app.appInfo?.node ?? '—'}</dd></div>
            <div><dt>Platform</dt><dd>{app.appInfo ? `${app.appInfo.platform} ${app.appInfo.arch}` : '—'}</dd></div>
            <div><dt>Config</dt><dd className="mono">{app.appInfo?.configDir ?? '—'}</dd></div>
            <div><dt>State</dt><dd className="mono">{app.appInfo?.logsDir ?? '—'}</dd></div>
            <div><dt>License</dt><dd>MIT</dd></div>
          </dl>
          <InlineNote tone="info">
            VALET Desktop is an independent interface built on the MIT-licensed Lerd engine. Upstream copyright and
            license notices are preserved in <code>NOTICE</code> and <code>LICENSE</code>. Engine identifiers retained
            for safe migration:
            <ul className="inline-list">
              {ENGINE_IDENTIFIERS.map((identifier) => <li key={identifier}><code>{identifier}</code></li>)}
            </ul>
          </InlineNote>
        </div>
      </section>

      {confirmAdminRemoval ? (
        <Modal
          title="Remove the legacy phpMyAdmin container?"
          onClose={() => setConfirmAdminRemoval(false)}
          footer={
            <>
              <Button onClick={() => setConfirmAdminRemoval(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmAdminRemoval(false);
                  void app.removePhpMyAdmin();
                }}
              >
                Remove container
              </Button>
            </>
          }
        >
          <p>
            VALET will ask the engine to stop and remove the <code>phpmyadmin</code> service container. Database
            engines, volumes, databases and project data remain untouched.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
