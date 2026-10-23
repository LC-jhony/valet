import type { PhpVersion, PortEntry, Project, Service, ViewId } from './types';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatRelative(timestamp: number | undefined, now = Date.now()): string {
  if (!timestamp) return 'never';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export function shortPath(value: string, max = 48): string {
  if (value.length <= max) return value;
  const parts = value.split(/[\\/]/);
  if (parts.length <= 2) return `…${value.slice(-max + 1)}`;
  return `${parts[0]}/…/${parts.slice(-2).join('/')}`;
}

export function projectStatus(project: Project): { label: string; tone: 'ok' | 'warn' | 'error' | 'muted' } {
  if (project.paused) return { label: 'paused', tone: 'muted' };
  if (project.fpmRunning) return { label: 'running', tone: 'ok' };
  if (project.usesPhp) return { label: 'stopped', tone: 'warn' };
  return { label: 'registered', tone: 'muted' };
}

export function serviceStatus(service: Service): { label: string; tone: 'ok' | 'warn' | 'error' | 'muted' } {
  const status = service.status.toLowerCase();
  if (status === 'active' || status === 'running') return { label: 'running', tone: 'ok' };
  if (status === 'inactive' || status === 'stopped') return { label: 'stopped', tone: 'muted' };
  if (status === 'failed' || status === 'error') return { label: status, tone: 'error' };
  return { label: status || 'unknown', tone: 'warn' };
}

export function portTone(port: PortEntry): 'ok' | 'warn' | 'error' | 'muted' {
  if (port.state === 'conflict') return 'error';
  if (port.state === 'listening') return 'ok';
  return 'warn';
}

export function phpLabel(version: PhpVersion): string {
  return `PHP ${version.version}`;
}

export const VIEW_META: Record<ViewId, { label: string; shortcut: string }> = {
  projects: { label: 'Projects', shortcut: 'Ctrl+1' },
  php: { label: 'PHP', shortcut: 'Ctrl+2' },
  services: { label: 'Services', shortcut: 'Ctrl+3' },
  ports: { label: 'Ports', shortcut: 'Ctrl+4' },
  databases: { label: 'Databases', shortcut: 'Ctrl+5' },
  terminal: { label: 'Terminal', shortcut: 'Ctrl+6' },
  logs: { label: 'Logs & diagnostics', shortcut: 'Ctrl+7' },
  settings: { label: 'Settings', shortcut: 'Ctrl+,' },
};

export function summarizeProjects(projects: Project[]): { running: number; stopped: number; paused: number } {
  let running = 0;
  let stopped = 0;
  let paused = 0;
  for (const project of projects) {
    if (project.paused) paused += 1;
    else if (project.fpmRunning) running += 1;
    else stopped += 1;
  }
  return { running, stopped, paused };
}
