import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Network, RefreshCw, Search } from 'lucide-react';
import { useApp, valet } from '../state/store';
import { portTone } from '../../shared/format';
import { Badge, Button, EmptyState, InlineNote, Modal, SearchInput, StatusDot } from '../components/ui';
import { EngineBanner } from '../components/EngineBanner';
import type { PortEntry } from '../../shared/types';

type PortFilter = 'all' | 'listening' | 'configured' | 'conflicts';

export function PortsView(): React.ReactElement {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PortFilter>('all');
  const [checkPort, setCheckPort] = useState('3000');
  const [checkAddress, setCheckAddress] = useState('127.0.0.1');
  const [checkResult, setCheckResult] = useState<{ available: boolean; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState<PortEntry | null>(null);
  const [newPort, setNewPort] = useState('');
  const [suggesting, setSuggesting] = useState(false);

  const stats = useMemo(() => ({
    total: app.ports.length,
    listening: app.ports.filter((port) => port.state === 'listening').length,
    configured: app.ports.filter((port) => port.state === 'configured').length,
    conflicts: app.ports.filter((port) => port.state === 'conflict').length,
  }), [app.ports]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return app.ports.filter((port) => {
      const text = `${port.hostPort} ${port.containerPort ?? ''} ${port.service} ${port.project ?? ''} ${port.process ?? ''} ${port.address}`.toLowerCase();
      if (!text.includes(term)) return false;
      if (filter === 'conflicts') return port.state === 'conflict';
      if (filter === 'listening') return port.state === 'listening';
      if (filter === 'configured') return port.state === 'configured';
      return true;
    });
  }, [app.ports, filter, query]);

  const runCheck = async (): Promise<void> => {
    const port = Number(checkPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setCheckResult({ available: false, error: 'Enter a port between 1 and 65535.' });
      return;
    }
    setChecking(true);
    try {
      setCheckResult(await valet().ports.check(port, checkAddress));
    } catch (err) {
      setCheckResult({ available: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setChecking(false);
    }
  };

  const openEdit = (port: PortEntry): void => {
    setEditing(port);
    setNewPort(String(port.hostPort));
  };

  const suggest = async (): Promise<void> => {
    const start = Number(newPort) || 3000;
    setSuggesting(true);
    try {
      for (let offset = 1; offset <= 64; offset += 1) {
        const candidate = start + offset;
        if (candidate > 65535) break;
        const check = await valet().ports.check(candidate);
        if (check.available) {
          setNewPort(String(candidate));
          return;
        }
      }
      app.notify('warning', 'No free port found in the next 64 numbers. Enter one manually.');
    } catch (err) {
      app.notify('error', err instanceof Error ? err.message : String(err));
    } finally {
      setSuggesting(false);
    }
  };

  const saveEdit = async (): Promise<void> => {
    if (!editing) return;
    const port = Number(newPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      app.notify('error', 'Enter a port between 1 and 65535.');
      return;
    }
    const check = await valet().ports.check(port).catch(() => ({ available: false, error: 'could not check port' }));
    if (!check.available) {
      app.notify('warning', check.error ?? `Port ${port} is not available.`);
      return;
    }
    const saved = await app.setServicePort(editing.service, port, editing.containerPort);
    if (saved) setEditing(null);
  };

  const editable = (port: PortEntry): boolean => {
    const service = app.services.find((entry) => entry.name === port.service);
    if (!service) return false;
    if (port.containerPort) {
      return (service.secondaryPorts ?? []).some((mapping) => mapping.container === port.containerPort);
    }
    return service.port !== undefined;
  };

  return (
    <div className="view">
      <div className="view__header">
        <div>
          <h1>Ports</h1>
          <p className="view__subtitle">Host listeners and managed mappings. External processes are never terminated.</p>
        </div>
        <div className="view__actions">
          <Button onClick={() => void app.refreshPorts()}>
            <RefreshCw size={12} /> Rescan
          </Button>
        </div>
      </div>

      <EngineBanner />

      <div className="stat-grid">
        <div className="stat"><span className="stat__value">{stats.total}</span><span className="stat__label">host entries</span></div>
        <div className="stat"><span className="stat__value stat__value--ok">{stats.listening}</span><span className="stat__label">listening</span></div>
        <div className="stat"><span className="stat__value">{stats.configured}</span><span className="stat__label">configured</span></div>
        <div className={`stat${stats.conflicts > 0 ? ' stat--error' : ''}`}>
          <span className="stat__value stat__value--error">{stats.conflicts}</span><span className="stat__label">conflicts</span>
        </div>
      </div>

      {stats.conflicts > 0 ? (
        <InlineNote tone="error">
          <AlertTriangle size={13} /> {stats.conflicts} conflicting port{stats.conflicts === 1 ? '' : 's'}. VALET shows the
          owning services so you can move a managed port. It will not stop external processes.
        </InlineNote>
      ) : null}

      <div className="port-check">
        <div className="port-check__text">
          <strong>Check a port</strong>
          <span>Binds without privileges to confirm availability.</span>
        </div>
        <input
          value={checkAddress}
          onChange={(event) => setCheckAddress(event.target.value)}
          aria-label="Address"
          className="port-check__address"
          list="valet-port-addresses"
        />
        <datalist id="valet-port-addresses">
          <option value="127.0.0.1" />
          <option value="0.0.0.0" />
        </datalist>
        <input value={checkPort} onChange={(event) => setCheckPort(event.target.value)} aria-label="Port" className="port-check__port" inputMode="numeric" />
        <Button onClick={() => void runCheck()} disabled={checking}>{checking ? 'Checking…' : 'Check'}</Button>
        {checkResult ? (
          <span className={`port-check__result${checkResult.available ? ' is-ok' : ' is-error'}`}>
            {checkResult.available ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {checkResult.available ? 'available' : checkResult.error ?? 'in use'}
          </span>
        ) : null}
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <SearchInput value={query} onChange={setQuery} placeholder="Search port, service or project" />
        </div>
        <div className="segmented" role="group" aria-label="Filter ports">
          {(['all', 'listening', 'configured', 'conflicts'] as const).map((value) => (
            <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>
              {value[0]?.toUpperCase()}{value.slice(1)}
            </button>
          ))}
        </div>
        <span className="toolbar__hint">{filtered.length} shown</span>
      </div>

      {app.ports.length === 0 ? (
        <EmptyState
          icon={<Network size={28} />}
          title="No host ports found"
          description="Start the engine or a service, then rescan. You can still check an arbitrary port above."
        />
      ) : filtered.length === 0 ? (
        <EmptyState compact icon={<Search size={22} />} title="No ports match" description="Adjust the search or filter." />
      ) : (
        <div className="table-wrap">
          <table className="data-table ports-table">
            <thead>
              <tr><th>Port</th><th>Internal</th><th>Address</th><th>Proto</th><th>Owner</th><th>Project</th><th>Process</th><th>State</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {filtered.map((port) => (
                <tr key={`${port.protocol}-${port.hostPort}-${port.service}-${port.project ?? ''}-${port.address}`}>
                  <td className="mono"><strong>:{port.hostPort}</strong></td>
                  <td className="mono">{port.containerPort ? `:${port.containerPort}` : '—'}</td>
                  <td className="mono">{port.address}</td>
                  <td className="mono">{port.protocol}</td>
                  <td>{port.service}</td>
                  <td className="mono">{port.project ?? '—'}</td>
                  <td className="mono">{port.process ? `${port.process}${port.pid ? ` (${port.pid})` : ''}` : '—'}</td>
                  <td><Badge tone={portTone(port)}><StatusDot tone={portTone(port)} /> {port.state}</Badge></td>
                  <td className="row-actions">
                    {editable(port) ? <Button size="sm" onClick={() => openEdit(port)}>Change port</Button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InlineNote tone="info">
        Default binding is <code>127.0.0.1</code>. LAN features may bind <code>0.0.0.0</code>; the engine shows those
        separately. VALET does not expose ports publicly on its own.
      </InlineNote>

      {editing ? (
        <Modal
          title={editing.containerPort
            ? `Move ${editing.service} container port ${editing.containerPort}`
            : `Move ${editing.service} to another host port`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => void saveEdit()}>Apply</Button>
            </>
          }
        >
          <p>
            The container keeps its internal port. Only the host mapping changes. Connections from other containers
            continue to use the service name.
          </p>
          <label className="field">
            <span>New host port</span>
            <div className="button-row">
              <input value={newPort} onChange={(event) => setNewPort(event.target.value)} inputMode="numeric" />
              <Button onClick={() => void suggest()} disabled={suggesting} title="Check real availability on 127.0.0.1">
                {suggesting ? 'Checking…' : 'Suggest free port'}
              </Button>
            </div>
          </label>
        </Modal>
      ) : null}
    </div>
  );
}
