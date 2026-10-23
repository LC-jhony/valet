import type { LogSource, PhpVersion, Service } from './types';

/**
 * Derive the log units the engine actually exposes. Kept platform-neutral so
 * the desktop sidebar and `valet logs` show the same sources.
 */
export function deriveLogSources(services: Service[], php: PhpVersion[]): LogSource[] {
  const sources: LogSource[] = [
    { id: 'lerd-nginx', label: 'Nginx', kind: 'nginx', unit: 'lerd-nginx' },
    { id: 'lerd-watcher', label: 'Watcher', kind: 'app', unit: 'lerd-watcher' },
    { id: 'lerd-ui', label: 'Dashboard / API', kind: 'app', unit: 'lerd-ui' },
  ];
  for (const version of php) {
    if (!version.installed) continue;
    const short = version.version.replace(/\./g, '');
    sources.push({
      id: `lerd-php${short}-fpm`,
      label: `PHP ${version.version} FPM`,
      kind: 'php',
      unit: `lerd-php${short}-fpm`,
    });
  }
  for (const service of services) {
    sources.push({
      id: `lerd-${service.name}`,
      label: service.name,
      kind: 'service',
      unit: `lerd-${service.name}`,
    });
  }
  return sources;
}
