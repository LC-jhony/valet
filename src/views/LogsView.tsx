import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Pause, Play, ScrollText, SquareTerminal, Trash2 } from 'lucide-react';
import { useApp, valet } from '../state/store';
import { deriveLogSources } from '../../shared/log-sources';
import type { LogsTab } from '../../shared/types';
import { Badge, Button, EmptyState, StatusDot } from '../components/ui';
import { EngineBanner } from '../components/EngineBanner';

const TABS: Array<{ id: LogsTab; label: string; icon: React.ReactNode }> = [
  { id: 'container', label: 'Container logs', icon: <ScrollText size={12} /> },
  { id: 'output', label: 'Engine output', icon: <SquareTerminal size={12} /> },
  { id: 'problems', label: 'Problems', icon: <AlertTriangle size={12} /> },
];

export function LogsView(): React.ReactElement {
  const app = useApp();
  const sources = useMemo(() => deriveLogSources(app.services, app.php), [app.php, app.services]);
  const unit = app.logUnit && sources.some((source) => source.unit === app.logUnit) ? app.logUnit : sources[0]?.unit ?? null;
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLPreElement>(null);
  const unitRef = useRef<string | null>(unit);
  const containerTab = app.logsTab === 'container';

  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);

  useEffect(() => {
    const removeData = valet().logs.onData((event) => {
      if (event.unit !== unitRef.current) return;
      setLines((current) => [...current.slice(-2_500), event.line]);
    });
    const removeError = valet().logs.onError((event) => {
      setError(event.message);
      app.notify('error', event.message);
    });
    return () => {
      removeData();
      removeError();
    };
    // The subscriptions are global; the current unit is filtered via a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLines([]);
    setError(null);
    setPaused(false);
  }, [unit, app.engine?.mode]);

  useEffect(() => {
    if (!containerTab || !unit || app.engine?.mode !== 'http' || paused) return;
    void valet().logs.start(unit).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      app.notify('error', message);
    });
    return () => {
      void valet().logs.stop();
    };
    // Starting the stream is tied to the selected unit, tab and engine mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, app.engine?.mode, containerTab, paused]);

  useEffect(() => {
    if (!follow || !containerTab) return;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines, follow, containerTab]);

  const runDoctor = async (): Promise<void> => {
    app.setLogsTab('output');
    await app.runEngineCommand('doctor');
  };

  return (
    <div className="view view--logs">
      <div className="view__header">
        <div>
          <h1>Logs &amp; diagnostics</h1>
          <p className="view__subtitle">Live container logs, engine command output and read-only checks. Nothing leaves this machine.</p>
        </div>
        <div className="view__actions">
          {containerTab ? (
            <>
              <Button onClick={() => setPaused((value) => !value)} disabled={!unit || app.engine?.mode !== 'http'}>
                {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button onClick={() => setLines([])} disabled={lines.length === 0}>
                <Trash2 size={12} /> Clear
              </Button>
            </>
          ) : null}
          {app.logsTab === 'output' ? (
            <Button onClick={app.clearOutput} disabled={app.output.length === 0}>
              <Trash2 size={12} /> Clear output
            </Button>
          ) : null}
        </div>
      </div>

      <EngineBanner />

      <div className="selection-strip log-diagnostics" role="status">
        <Badge tone={app.engine?.mode === 'http' ? 'ok' : app.engine?.mode === 'cli' ? 'warn' : 'error'}>
          <StatusDot tone={app.engine?.mode === 'http' ? 'ok' : app.engine?.mode === 'cli' ? 'warn' : 'error'} />
          {app.engine?.mode === 'http' ? 'API online' : app.engine?.mode === 'cli' ? 'binary only' : 'offline'}
        </Badge>
        <span className="mono">{app.engine?.version ? `v${app.engine.version}` : 'no version'}</span>
        <span>API <code>{app.engine?.apiBase ?? '—'}</code></span>
        <button
          type="button"
          className={`log-diagnostics__problems${app.problems.length > 0 ? ' is-error' : ''}`}
          onClick={() => app.setLogsTab('problems')}
        >
          {app.problems.length} problem{app.problems.length === 1 ? '' : 's'}
        </button>
        <div className="log-diagnostics__spacer" />
        <Button size="sm" onClick={() => void runDoctor()} disabled={!app.engine?.binary}>
          Run doctor
        </Button>
      </div>

      <div className="logs-tabs" role="tablist" aria-label="Logs and diagnostics views">
        {TABS.map((tab) => {
          const count = tab.id === 'output' ? app.output.length : tab.id === 'problems' ? app.problems.length : 0;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={app.logsTab === tab.id}
              className={`logs-tab${app.logsTab === tab.id ? ' is-active' : ''}`}
              onClick={() => app.setLogsTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {count > 0 ? <span className={`logs-tab__count${tab.id === 'problems' ? ' is-error' : ''}`}>{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="logs-panel" role="tabpanel">
        {containerTab ? (
          sources.length === 0 ? (
            <EmptyState
              icon={<ScrollText size={28} />}
              title="No log sources"
              description="Log units appear once the engine reports services or PHP runtimes."
            />
          ) : (
            <div className="logs-view">
              <div className="logs-view__toolbar">
                <label className="field field--inline">
                  <span>Source</span>
                  <select
                    value={unit ?? ''}
                    onChange={(event) => {
                      app.setLogUnit(event.target.value);
                    }}
                  >
                    {sources.map((source) => (
                      <option key={source.id} value={source.unit}>{source.label}</option>
                    ))}
                  </select>
                </label>
                <Badge tone={paused ? 'warn' : error ? 'error' : 'ok'}>{paused ? 'paused' : error ? 'error' : 'live'}</Badge>
                <span className="mono logs-view__unit">{unit ?? '—'}</span>
                <div className="logs-view__spacer" />
                <label className="checkbox">
                  <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
                  Follow output
                </label>
              </div>

              {error ? <div className="inline-error">{error}</div> : null}

              <pre className="log-stream" ref={scrollRef} aria-live="polite">
                {lines.length === 0 ? (
                  <span className="log-stream__empty">
                    {app.engine?.mode === 'http'
                      ? paused
                        ? 'Stream paused.'
                        : 'Waiting for output…'
                      : 'Start the engine to stream logs.'}
                  </span>
                ) : (
                  lines.join('\n')
                )}
              </pre>
            </div>
          )
        ) : null}

        {app.logsTab === 'output' ? (
          app.output.length === 0 ? (
            <div className="logs-tab-empty">Engine command output appears here.</div>
          ) : (
            <pre className="output-log" aria-live="polite">{app.output.join('\n')}</pre>
          )
        ) : null}

        {app.logsTab === 'problems' ? (
          app.problems.length === 0 ? (
            <div className="logs-tab-empty">No problems detected.</div>
          ) : (
            <ul className="problems-list">
              {app.problems.map((problem, index) => (
                <li key={`${problem}-${index}`}>
                  <span className="problems-list__icon">!</span>
                  <span>{problem}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
