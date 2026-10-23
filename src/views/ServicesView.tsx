import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, ExternalLink, Play, RefreshCw, RotateCw, ScrollText, Search, Square, X } from 'lucide-react';
import { useApp, valet } from '../state/store';
import type { Service } from '../../shared/types';
import { serviceStatus } from '../../shared/format';
import { Badge, Button, EmptyState, IconButton, InlineNote, Modal, SearchInput, StatusDot } from '../components/ui';
import { EngineBanner } from '../components/EngineBanner';

export function ServicesView(): React.ReactElement {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [portService, setPortService] = useState<Service | null>(null);
  const [portValue, setPortValue] = useState('');
  const [portCheck, setPortCheck] = useState<{ available: boolean; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (selectedName && !app.services.some((service) => service.name === selectedName)) setSelectedName(null);
  }, [app.services, selectedName]);

  const selected = app.services.find((service) => service.name === selectedName) ?? null;

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return app.services.filter((service) => {
      if (!`${service.name} ${service.category ?? ''} ${service.version ?? ''}`.toLowerCase().includes(term)) return false;
      const running = serviceStatus(service).tone === 'ok';
      if (filter === 'running') return running;
      if (filter === 'stopped') return !running;
      return true;
    });
  }, [app.services, filter, query]);

  const openPortModal = (service: Service): void => {
    setPortService(service);
    setPortValue(String(service.port ?? service.defaultPort ?? ''));
    setPortCheck(null);
  };

  const checkPort = async (): Promise<void> => {
    const port = Number(portValue);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setPortCheck({ available: false, error: 'Enter a port between 1 and 65535.' });
      return;
    }
    setChecking(true);
    try {
      setPortCheck(await valet().ports.check(port));
    } catch (err) {
      setPortCheck({ available: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setChecking(false);
    }
  };

  const savePort = async (): Promise<void> => {
    if (!portService) return;
    const port = Number(portValue);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setPortCheck({ available: false, error: 'Enter a port between 1 and 65535.' });
      return;
    }
    setChecking(true);
    try {
      const check = await valet().ports.check(port);
      if (!check.available) {
        setPortCheck(check);
        return;
      }
      await valet().engine.setServicePort(portService.name, port);
      app.notify('success', `${portService.name} now publishes host port ${port}. Container port is unchanged.`);
      setPortService(null);
      await app.refreshAll();
    } catch (err) {
      app.notify('error', err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  const suggest = async (): Promise<void> => {
    const start = Number(portValue) || 3000;
    setChecking(true);
    try {
      for (let offset = 1; offset <= 64; offset += 1) {
        const candidate = start + offset;
        if (candidate > 65535) break;
        const check = await valet().ports.check(candidate);
        if (check.available) {
          setPortValue(String(candidate));
          setPortCheck(null);
          return;
        }
      }
      app.notify('warning', 'No free port found in the next 64 numbers.');
    } catch (err) {
      app.notify('error', err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  const openLogs = (service: Service): void => {
    app.setLogUnit(`lerd-${service.name}`);
    app.openView('logs');
  };

  return (
    <div className="view">
      <div className="view__header">
        <div>
          <h1>Services</h1>
          <p className="view__subtitle">
            {app.services.filter((service) => serviceStatus(service).tone === 'ok').length} running · ports bind to 127.0.0.1 by default
          </p>
        </div>
        <div className="view__actions">
          <Button onClick={() => void app.refreshAll()} disabled={app.refreshing}>
            <RefreshCw size={12} className={app.refreshing ? 'spin' : ''} /> Refresh
          </Button>
        </div>
      </div>

      <EngineBanner />

      <div className="toolbar">
        <div className="toolbar__search">
          <SearchInput value={query} onChange={setQuery} placeholder="Search services" />
        </div>
        <div className="segmented" role="group" aria-label="Filter services">
          {(['all', 'running', 'stopped'] as const).map((value) => (
            <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>
              {value[0]?.toUpperCase()}{value.slice(1)}
            </button>
          ))}
        </div>
        <span className="toolbar__hint">{filtered.length} shown</span>
      </div>

      {app.services.length === 0 ? (
        <EmptyState
          icon={<Boxes size={28} />}
          title="No services installed"
          description="Start a database, cache, mail or search service from the engine. VALET never installs phpMyAdmin."
        />
      ) : (
        <div className={`view-split${selected ? ' has-detail' : ''}`}>
          <div className="table-wrap">
            {filtered.length === 0 ? (
              <EmptyState compact icon={<Search size={22} />} title="No services match" description="Adjust the search or filter." />
            ) : (
              <table className="data-table services-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Version</th>
                    <th>Host port</th>
                    <th>Sites</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((service) => {
                    const status = serviceStatus(service);
                    const running = status.tone === 'ok';
                    return (
                      <tr
                        key={service.name}
                        className={service.name === selectedName ? 'is-selected' : ''}
                        onClick={() => setSelectedName(service.name)}
                      >
                        <td>
                          <div className="cell-title">
                            <StatusDot tone={status.tone} />
                            <div className="cell-title__text">
                              <strong>{service.name}</strong>
                              <span>{service.category ?? (service.isDatabase ? 'database' : 'service')}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="badge-row">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            {service.portConflicts && service.portConflicts.length > 0 ? (
                              <Badge tone="error">port busy</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="mono">{service.version ?? '—'}</td>
                        <td className="mono">
                          {service.port
                            ? `127.0.0.1:${service.port}${service.secondaryPorts?.length ? ` +${service.secondaryPorts.length}` : ''}`
                            : '—'}
                        </td>
                        <td>{service.siteCount > 0 ? service.siteCount : '—'}</td>
                        <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                          <IconButton
                            label={running ? `Stop ${service.name}` : `Start ${service.name}`}
                            onClick={() => void app.runServiceAction(service.name, running ? 'stop' : 'start')}
                          >
                            {running ? <Square size={13} /> : <Play size={13} />}
                          </IconButton>
                          <IconButton label={`Restart ${service.name}`} onClick={() => void app.runServiceAction(service.name, 'restart')}>
                            <RotateCw size={13} />
                          </IconButton>
                          <IconButton label={`Open ${service.name} logs`} onClick={() => openLogs(service)}>
                            <ScrollText size={13} />
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
                  <span className="detail__domain">{selected.category ?? (selected.isDatabase ? 'database engine' : 'service')}</span>
                </div>
                <IconButton label="Close details" onClick={() => setSelectedName(null)}>
                  <X size={14} />
                </IconButton>
              </div>

              <div className="badge-row detail__badges">
                <Badge tone={serviceStatus(selected).tone}>{serviceStatus(selected).label}</Badge>
                {selected.custom ? <Badge tone="muted">custom</Badge> : <Badge tone="muted">preset</Badge>}
                {selected.isDatabase ? <Badge tone="info">database</Badge> : null}
              </div>

              <div className="detail__section">
                <div className="detail__label">Connection</div>
                <dl className="kv">
                  <div><dt>Version</dt><dd>{selected.version ?? '—'}</dd></div>
                  <div><dt>Host</dt><dd className="mono">{selected.port ? `127.0.0.1:${selected.port}` : 'not published'}</dd></div>
                  <div><dt>Default port</dt><dd className="mono">{selected.defaultPort ?? '—'}</dd></div>
                  {(selected.secondaryPorts ?? []).map((mapping) => (
                    <div key={`secondary-${mapping.container}`}>
                      <dt>Port {mapping.container}</dt>
                      <dd className="mono">127.0.0.1:{mapping.published || mapping.default}</dd>
                    </div>
                  ))}
                  {(selected.extraPorts ?? []).length > 0 ? (
                    <div><dt>Extra mappings</dt><dd className="mono">{selected.extraPorts?.join(', ')}</dd></div>
                  ) : null}
                  <div><dt>Projects</dt><dd>{selected.siteDomains.length > 0 ? selected.siteDomains.join(', ') : '—'}</dd></div>
                </dl>
                {selected.dashboard ? (
                  <Button onClick={() => void valet().shell.openExternal(selected.dashboard ?? '').catch((err: unknown) => app.notify('error', String(err)))}>
                    <ExternalLink size={12} /> Open dashboard
                  </Button>
                ) : null}
              </div>

              {selected.portConflicts && selected.portConflicts.length > 0 ? (
                <InlineNote tone="warn">
                  The engine sees these required ports in use:{' '}
                  {selected.portConflicts.map((conflict) => `${conflict.port}${conflict.label ? ` (${conflict.label})` : ''}`).join(', ')}.
                  Move a published port before starting. VALET will not stop the other process.
                </InlineNote>
              ) : null}

              <div className="detail__section">
                <div className="detail__label">Actions</div>
                <div className="button-row button-row--wrap">
                  {serviceStatus(selected).tone === 'ok' ? (
                    <Button onClick={() => void app.runServiceAction(selected.name, 'stop')}><Square size={12} /> Stop</Button>
                  ) : (
                    <Button variant="primary" onClick={() => void app.runServiceAction(selected.name, 'start')}><Play size={12} /> Start</Button>
                  )}
                  <Button onClick={() => void app.runServiceAction(selected.name, 'restart')}><RotateCw size={12} /> Restart</Button>
                  <Button onClick={() => openLogs(selected)}><ScrollText size={12} /> Logs</Button>
                  {selected.port ? <Button onClick={() => openPortModal(selected)}>Change port</Button> : null}
                  <Button onClick={() => app.openView('ports')}>Manage all ports</Button>
                </div>
              </div>

              <InlineNote tone="info">
                Host ports bind to loopback. Containers still reach <code>{selected.name}</code> on the engine
                network by name; moving a host port does not change the container-internal port.
              </InlineNote>
            </aside>
          ) : null}
        </div>
      )}

      {portService ? (
        <Modal
          title={`Host port for ${portService.name}`}
          onClose={() => setPortService(null)}
          footer={
            <>
              <Button onClick={() => setPortService(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => void savePort()}
                disabled={checking || (portCheck !== null && !portCheck.available)}
              >
                Apply port
              </Button>
            </>
          }
        >
          <p>
            Publish <strong>{portService.name}</strong> on a different host port. The container-internal port and every
            project connection stay the same.
          </p>
          <label className="field">
            <span>Host port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={portValue}
              onChange={(event) => {
                setPortValue(event.target.value);
                setPortCheck(null);
              }}
            />
          </label>
          <div className="button-row">
            <Button onClick={() => void checkPort()} disabled={checking}>
              {checking ? 'Checking…' : 'Check availability'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void suggest()}
              disabled={checking}
            >
              Suggest free port
            </Button>
          </div>
          {portCheck ? (
            <InlineNote tone={portCheck.available ? 'info' : 'error'}>
              {portCheck.available ? `Port ${portValue} is available.` : portCheck.error ?? `Port ${portValue} is in use.`}
            </InlineNote>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
