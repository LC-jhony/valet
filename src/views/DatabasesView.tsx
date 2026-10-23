import React from 'react';
import { Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { useApp } from '../state/store';
import { serviceStatus } from '../../shared/format';
import { Badge, Button, EmptyState, InlineNote, StatusDot } from '../components/ui';
import { EngineBanner } from '../components/EngineBanner';
import { Boxes } from 'lucide-react';

export function DatabasesView(): React.ReactElement {
  const app = useApp();
  const engines = app.databases.engines;
  const dbServices = app.services.filter((service) => service.isDatabase);
  const databases = engines.flatMap((engine) => engine.databases.map((database) => ({ ...database, status: engine.status })));

  return (
    <div className="view">
      <div className="view__header">
        <div>
          <h1>Databases</h1>
          <p className="view__subtitle">Database engines, projects and data. No bundled administration panel.</p>
        </div>
        <div className="view__actions">
          <Button onClick={() => void app.refreshAll()} disabled={app.refreshing}>
            <RefreshCw size={12} className={app.refreshing ? 'spin' : ''} /> Refresh
          </Button>
          <Button onClick={() => app.openView('services')}>
            <Boxes size={13} /> Manage services
          </Button>
        </div>
      </div>

      <EngineBanner />

      <InlineNote tone="info">
        <ShieldCheck size={13} /> phpMyAdmin was removed from VALET's active surface. Database engines, volumes and
        project data stay intact. Use your application's <code>.env</code> or the engine CLI for administrative access.
      </InlineNote>

      {engines.length === 0 && dbServices.length === 0 ? (
        <EmptyState
          icon={<Database size={28} />}
          title="No database engines"
          description="Install MySQL, MariaDB or PostgreSQL from the Services view. VALET lists their databases but never bundles phpMyAdmin."
          actions={<Button variant="primary" onClick={() => app.openView('services')}>Open services</Button>}
        />
      ) : (
        <>
          <section className="section-block section-block--full">
            <div className="section-block__header">
              <h2>Engines</h2>
              <span>{engines.length} reported · {dbServices.length} services</span>
            </div>
            {engines.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Engine</th><th>Status</th><th>Databases</th><th>Host port</th><th>Version</th></tr></thead>
                <tbody>
                  {engines.map((engine) => {
                    const service = dbServices.find((entry) => entry.name === engine.name);
                    const tone = service ? serviceStatus(service).tone : engine.status === 'active' ? 'ok' : 'muted';
                    return (
                      <tr key={engine.name}>
                        <td>
                          <div className="cell-title">
                            <StatusDot tone={tone} />
                            <div className="cell-title__text"><strong>{engine.name}</strong><span>{service?.category ?? 'database engine'}</span></div>
                          </div>
                        </td>
                        <td><Badge tone={tone}>{service ? serviceStatus(service).label : engine.status}</Badge></td>
                        <td>{engine.databases.length}</td>
                        <td className="mono">{service?.port ? `127.0.0.1:${service.port}` : '—'}</td>
                        <td className="mono">{service?.version ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="engine-list">
                {dbServices.map((service) => (
                  <div key={service.name} className="engine-row">
                    <StatusDot tone={serviceStatus(service).tone} />
                    <div><strong>{service.name}</strong><span>{service.category ?? 'database'}</span></div>
                    <Badge tone={serviceStatus(service).tone}>{serviceStatus(service).label}</Badge>
                    <span className="mono">{service.port ? `127.0.0.1:${service.port}` : 'not published'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section-block section-block--full">
            <div className="section-block__header">
              <h2>Databases</h2>
              <span>{databases.length} databases</span>
            </div>
            {databases.length === 0 ? (
              <EmptyState compact icon={<Database size={22} />} title="No databases reported" description="The engine did not return database names. Engines may be stopped or have no databases yet." />
            ) : (
              <table className="data-table">
                <thead><tr><th>Database</th><th>Engine</th><th>Project</th><th>Size</th><th>Engine status</th></tr></thead>
                <tbody>
                  {databases.map((database) => (
                    <tr key={`${database.engine}-${database.name}`}>
                      <td className="mono"><strong>{database.name}</strong></td>
                      <td>{database.engine}</td>
                      <td className="mono">{database.site ?? '—'}</td>
                      <td className="mono">{database.size ?? '—'}</td>
                      <td><Badge tone={database.status === 'active' ? 'ok' : 'muted'}>{database.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <div className="info-grid">
        <div className="info-tile">
          <h3>Connection details</h3>
          <p>Read the project's <code>.env</code> for credentials. The engine keeps the database host and port stable when a service moves.</p>
        </div>
        <div className="info-tile">
          <h3>Backups</h3>
          <p>Database exports and snapshots remain engine operations. VALET does not copy or rewrite database volumes.</p>
        </div>
        <div className="info-tile">
          <h3>phpMyAdmin</h3>
          <p>
            {app.phpMyAdmin?.present
              ? 'A legacy phpMyAdmin container was detected. It is hidden from VALET; remove it from Settings.'
              : 'Not installed, not exposed, and never offered by VALET.'}
          </p>
        </div>
      </div>
    </div>
  );
}
