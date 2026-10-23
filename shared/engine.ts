/**
 * Engine adapter.
 *
 * VALET never re-implements the development environment. It talks to the
 * existing Lerd engine through its loopback HTTP API and, when the API is not
 * running, through a small allow-list of CLI commands. All user-visible names
 * are VALET; engine identifiers stay `lerd` for compatibility.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatBytes } from './format';
import type {
  CommandResult,
  DatabaseOverview,
  EngineCommand,
  EngineStatus,
  PhpExtensionsReport,
  PhpVersion,
  Project,
  Service,
} from './types';

export const DEFAULT_API_BASE = 'http://127.0.0.1:7073';
const MAX_OUTPUT = 1_000_000;
const REQUEST_TIMEOUT_MS = 12_000;
const PROBE_TIMEOUT_MS = 900;

export class EngineError extends Error {
  readonly status: number;
  readonly path: string;
  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'EngineError';
    this.status = status;
    this.path = path;
  }
}

/** phpMyAdmin is not an active VALET feature. Never surface it. */
export function isRemovedService(name: string): boolean {
  return name.toLowerCase().replace(/[^a-z]/g, '') === 'phpmyadmin';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function mapProject(raw: unknown): Project {
  const r = isRecord(raw) ? raw : {};
  const domain = str(r.domain) || str(r.name);
  return {
    id: domain,
    name: str(r.app_name) || str(r.name) || domain,
    domain,
    domains: strArray(r.domains).length > 0 ? strArray(r.domains) : domain ? [domain] : [],
    path: str(r.path),
    phpVersion: str(r.php_version),
    phpMin: str(r.php_min) || undefined,
    phpMax: str(r.php_max) || undefined,
    nodeVersion: str(r.node_version),
    framework: str(r.framework),
    frameworkLabel: str(r.framework_label) || str(r.framework) || 'PHP',
    tls: bool(r.tls),
    paused: bool(r.paused),
    fpmRunning: bool(r.fpm_running),
    usesPhp: bool(r.uses_php, true),
    lastActive: num(r.last_active) || undefined,
    requestCount: num(r.request_count) || undefined,
    queueRunning: bool(r.queue_running),
    queueFailing: bool(r.queue_failing),
    scheduleRunning: bool(r.schedule_running),
    hasQueueWorker: bool(r.has_queue_worker),
    hasScheduleWorker: bool(r.has_schedule_worker),
    runtime: str(r.runtime) || undefined,
    services: strArray(r.services),
    declaredServices: strArray(r.declared_services),
    suggestedServices: (Array.isArray(r.suggested_services) ? r.suggested_services : []).map((suggestion) => {
      const s = isRecord(suggestion) ? suggestion : {};
      return {
        name: str(s.name),
        reason: str(s.reason) || undefined,
        package: str(s.package) || undefined,
      };
    }).filter((suggestion) => suggestion.name),
    workers: (Array.isArray(r.framework_workers) ? r.framework_workers : []).map((worker) => {
      const w = isRecord(worker) ? worker : {};
      return {
        name: str(w.name),
        label: str(w.label) || str(w.name),
        running: bool(w.running),
        failing: bool(w.failing),
        unreachable: bool(w.unreachable),
      };
    }).filter((worker) => worker.name),
    lanPort: num(r.lan_port) || undefined,
    publicPort: num(r.public_port) || undefined,
    devServerPort: num(r.dev_server_port) || undefined,
  };
}

export function mapService(raw: unknown): Service {
  const r = isRecord(raw) ? raw : {};
  const name = str(r.name);
  const secondaryRaw = Array.isArray(r.secondary_ports) ? r.secondary_ports : [];
  return {
    name,
    status: str(r.status, 'unknown'),
    version: str(r.version) || undefined,
    port: num(r.port) || undefined,
    defaultPort: num(r.default_port) || undefined,
    publishedPort: num(r.published_port) || undefined,
    secondaryPorts: secondaryRaw.flatMap((entry) => {
      const mapping = isRecord(entry) ? entry : {};
      const container = num(mapping.container);
      const fallback = num(mapping.default);
      if (container <= 0 || fallback <= 0) return [];
      return [{
        container,
        default: fallback,
        published: num(mapping.published) || undefined,
      }];
    }),
    extraPorts: strArray(r.extra_ports),
    portConflicts: (Array.isArray(r.port_conflicts) ? r.port_conflicts : []).flatMap((conflict) => {
      const c = isRecord(conflict) ? conflict : {};
      const port = str(c.port);
      if (!port) return [];
      return [{ port, label: str(c.label) || undefined }];
    }),
    dashboard: str(r.dashboard) || undefined,
    category: str(r.category) || undefined,
    isDatabase: bool(r.is_database),
    siteCount: num(r.site_count),
    siteDomains: strArray(r.site_domains),
    custom: bool(r.custom),
    preset: bool(r.preset_owned),
  };
}

export function mapDatabaseOverview(raw: unknown): DatabaseOverview {
  // The engine returns a bare array of database engines on /api/databases.
  // Accept an { engines: [...] } envelope as well so fixtures from earlier
  // engine versions keep working.
  const r = isRecord(raw) ? raw : {};
  const enginesRaw = Array.isArray(raw) ? raw : Array.isArray(r.engines) ? r.engines : [];
  const engines = enginesRaw.map((engine) => {
    const e = isRecord(engine) ? engine : {};
    const name = str(e.service) || str(e.name, 'database');
    const family = str(e.family) || name;
    const dbs = Array.isArray(e.databases) ? e.databases : [];
    return {
      name,
      status: str(e.status, 'unknown'),
      databases: dbs.map((db) => {
        const d = isRecord(db) ? db : {};
        const sizeBytes = typeof d.size_bytes === 'number' ? d.size_bytes : null;
        return {
          name: str(d.name),
          engine: str(d.engine) || family,
          site: str(d.site) || undefined,
          size: sizeBytes === null ? str(d.size) || undefined : formatBytes(sizeBytes),
        };
      }),
    };
  });
  return { engines };
}

export function mapPhpExtensions(raw: unknown, fallbackVersion = ''): PhpExtensionsReport {
  const r = isRecord(raw) ? raw : {};
  const report = isRecord(r.report) ? r.report : r;
  const set = (value: unknown): { declared: string[]; has: string[]; cannot: string[] } => {
    const s = isRecord(value) ? value : {};
    return { declared: strArray(s.declared), has: strArray(s.has), cannot: strArray(s.cannot) };
  };
  return {
    version: str(report.version) || fallbackVersion,
    built: bool(report.built),
    needsRebuild: bool(report.needs_rebuild),
    extensions: set(report.extensions),
    packages: set(report.packages),
    modules: strArray(report.modules),
    modulesError: str(r.modules_error) || undefined,
  };
}

export function validateEngineArgs(command: EngineCommand): string[] {
  const serviceName = (value: string | undefined): string => {
    if (!value || !/^[a-z0-9][a-z0-9._-]*$/.test(value) || value.length > 64) {
      throw new EngineError('invalid service name', 400, 'engine');
    }
    if (isRemovedService(value)) {
      throw new EngineError('phpMyAdmin is not managed by VALET', 400, 'engine');
    }
    return value;
  };
  const version = (value: string | undefined): string => {
    if (!value || !/^\d+\.\d+$/.test(value)) {
      throw new EngineError('invalid PHP version', 400, 'engine');
    }
    return value;
  };

  switch (command.id) {
    case 'start':
    case 'stop':
    case 'doctor':
    case 'version':
      return [command.id];
    case 'remove-phpmyadmin':
      return ['service', 'remove', 'phpmyadmin'];
    case 'restart':
      return ['restart'];
    case 'link':
      return ['link'];
    case 'unlink':
      return ['unlink'];
    case 'open':
      return ['dashboard'];
    case 'use-php':
      return ['use', version(command.args?.[0])];
    case 'isolate-php':
      return ['isolate', version(command.args?.[0])];
    case 'logs': {
      const unit = command.args?.[0];
      if (unit && !/^[a-z0-9][a-z0-9._-]*$/.test(unit)) {
        throw new EngineError('invalid log unit', 400, 'engine');
      }
      return unit ? ['logs', unit] : ['logs'];
    }
    case 'service-start':
    case 'service-stop':
    case 'service-restart':
    case 'service-remove': {
      const action = command.id.replace('service-', '');
      return ['service', action, serviceName(command.args?.[0])];
    }
    default:
      throw new EngineError('unsupported engine command', 400, 'engine');
  }
}

export function findBinaryCandidates(): string[] {
  const candidates: string[] = [];
  if (process.env.VALET_ENGINE_BIN) candidates.push(process.env.VALET_ENGINE_BIN);
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    candidates.push(path.join(entry, 'lerd'));
    candidates.push(path.join(entry, 'valet-engine'));
  }
  const home = os.homedir();
  candidates.push(
    path.join(home, '.local', 'bin', 'lerd'),
    '/usr/local/bin/lerd',
    '/usr/bin/lerd',
    '/opt/homebrew/bin/lerd',
    path.join(home, '.local', 'bin', 'valet-engine'),
  );
  return [...new Set(candidates)];
}

export function findEngineBinary(): string | null {
  for (const candidate of findBinaryCandidates()) {
    const valid = validateEngineBinary(candidate);
    if (valid) return valid;
  }
  return null;
}

/**
 * Only an executable named like the upstream engine may be invoked with the
 * command allow-list. This keeps a renderer-supplied `enginePath` from turning
 * the adapter into a generic process launcher.
 */
export function validateEngineBinary(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    if (!path.isAbsolute(candidate) || candidate.includes('\0')) return null;
    const resolved = path.resolve(candidate);
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return null;
    fs.accessSync(resolved, fs.constants.X_OK);
    const base = path.basename(resolved).toLowerCase();
    if (!/^(lerd|valet-engine)(\.exe)?$/.test(base)) return null;
    return resolved;
  } catch {
    return null;
  }
}

export async function probeHttp(apiBase = DEFAULT_API_BASE, timeoutMs = PROBE_TIMEOUT_MS): Promise<{ version: string; latest?: string } | null> {
  try {
    const res = await fetch(new URL('/api/version', apiBase), {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const record = isRecord(body) ? body : {};
    const version = str(record.current) || str(record.version);
    if (!version) return null;
    return { version, latest: str(record.latest) || undefined };
  } catch {
    return null;
  }
}

export async function detectEngine(binaryOverride?: string | null): Promise<EngineStatus> {
  const apiBase = process.env.VALET_ENGINE_URL || DEFAULT_API_BASE;
  const binary = binaryOverride ? validateEngineBinary(binaryOverride) : findEngineBinary();
  const platform = process.platform;
  const wsl = platform === 'linux' && Boolean(process.env.WSL_DISTRO_NAME);
  const now = Date.now();
  const http = await probeHttp(apiBase);
  if (http) {
    return { mode: 'http', version: http.version, apiBase, binary, checkedAt: now, platform, wsl };
  }
  if (binary) {
    const version = await readBinaryVersion(binary);
    return { mode: 'cli', version, apiBase, binary, checkedAt: now, platform, wsl };
  }
  return {
    mode: 'offline',
    version: null,
    apiBase,
    binary: null,
    checkedAt: now,
    platform,
    wsl,
    error: 'No engine API and no lerd/valet-engine binary found',
  };
}

export async function readBinaryVersion(binary: string): Promise<string | null> {
  try {
    const result = await runProcess(binary, ['--version'], undefined, 5_000);
    if (result.code !== 0) return null;
    const match = result.stdout.match(/(?:lerd|valet-engine|version)\s+v?(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/i);
    return match?.[1] ?? result.stdout.trim().split('\n')[0] ?? null;
  } catch {
    return null;
  }
}

export function runProcess(binary: string, args: string[], cwd: string | undefined, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(binary, args, {
      cwd,
      env: { ...process.env, NO_COLOR: '1', CLICOLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finish = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 1_000).unref();
      }
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT) stdout += chunk.toString('utf8').slice(0, MAX_OUTPUT - stdout.length);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT) stderr += chunk.toString('utf8').slice(0, MAX_OUTPUT - stderr.length);
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => finish({ code, stdout, stderr }));
  });
}

export class EngineClient {
  readonly apiBase: string;
  readonly binary: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { apiBase?: string; binary?: string | null; fetchImpl?: typeof fetch } = {}) {
    this.apiBase = options.apiBase ?? process.env.VALET_ENGINE_URL ?? DEFAULT_API_BASE;
    this.binary = options.binary === undefined ? findEngineBinary() : options.binary ? validateEngineBinary(options.binary) : null;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static async create(): Promise<{ client: EngineClient; status: EngineStatus }> {
    const status = await detectEngine();
    return { client: new EngineClient({ apiBase: status.apiBase, binary: status.binary }), status };
  }

  async request<T>(apiPath: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    if (!apiPath.startsWith('/api/')) throw new EngineError('invalid API path', 400, apiPath);
    const method = init.method ?? 'GET';
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
      throw new EngineError('method not allowed', 405, apiPath);
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    // The upstream engine rejects state-changing requests without this header
    // when no browser Sec-Fetch metadata is present (Node's fetch sends none).
    if (method !== 'GET') headers['x-lerd-csrf'] = '1';
    let body: string | undefined;
    if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(init.body);
    }
    let res: Response;
    try {
      res = await this.fetchImpl(new URL(apiPath, this.apiBase), {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new EngineError(`engine unreachable: ${err instanceof Error ? err.message : String(err)}`, 0, apiPath);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new EngineError(text.trim() || `engine returned ${res.status}`, res.status, apiPath);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async sites(): Promise<Project[]> {
    const raw = await this.request<unknown>('/api/sites');
    if (!Array.isArray(raw)) return [];
    return raw.map(mapProject).filter((project) => project.domain && project.path);
  }

  async services(): Promise<Service[]> {
    const raw = await this.request<unknown>('/api/services');
    if (!Array.isArray(raw)) return [];
    return raw.map(mapService).filter((service) => service.name && !isRemovedService(service.name));
  }

  async phpVersions(): Promise<PhpVersion[]> {
    const [installedResult, installableResult, statusResult] = await Promise.allSettled([
      this.request<unknown>('/api/php-versions'),
      this.request<unknown>('/api/php-installable'),
      this.request<unknown>('/api/status'),
    ]);
    if (installedResult.status === 'rejected' && installableResult.status === 'rejected') {
      throw installedResult.reason;
    }
    const installedRaw = installedResult.status === 'fulfilled' ? installedResult.value : [];
    const installableRaw = installableResult.status === 'fulfilled' ? installableResult.value : [];
    const installed = Array.isArray(installedRaw) ? installedRaw.filter((v): v is string => typeof v === 'string') : [];
    const installable = Array.isArray(installableRaw) ? installableRaw.filter((v): v is string => typeof v === 'string') : [];
    const statusRaw = statusResult.status === 'fulfilled' && isRecord(statusResult.value) ? statusResult.value : null;
    const defaultVersion = statusRaw ? str(statusRaw.php_default) : '';
    const fpmByVersion = new Map<string, Record<string, unknown>>();
    if (statusRaw && Array.isArray(statusRaw.php_fpms)) {
      for (const fpm of statusRaw.php_fpms) {
        if (isRecord(fpm) && str(fpm.version)) fpmByVersion.set(str(fpm.version), fpm);
      }
    }
    const versions = new Map<string, PhpVersion>();
    for (const version of installed) {
      const fpm = fpmByVersion.get(version);
      versions.set(version, {
        version,
        installed: true,
        running: fpm ? bool(fpm.running) : undefined,
        default: defaultVersion === version,
        patch: fpm ? str(fpm.patch) || undefined : undefined,
        xdebugMode: fpm ? str(fpm.xdebug_mode) || undefined : undefined,
        ports: fpm && strArray(fpm.ports).length > 0 ? strArray(fpm.ports) : undefined,
        updateAvailable: fpm ? bool(fpm.update_available) : undefined,
      });
    }
    for (const version of installable) if (!versions.has(version)) versions.set(version, { version, installed: false });
    return [...versions.values()].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  }

  async phpExtensions(version: string): Promise<PhpExtensionsReport> {
    if (!/^\d+\.\d+$/.test(version)) throw new EngineError('invalid PHP version', 400, version);
    const raw = await this.request<unknown>(`/api/php-versions/${encodeURIComponent(version)}/extensions`);
    if (isRecord(raw) && raw.ok === false) {
      throw new EngineError(str(raw.error, 'PHP extensions unavailable'), 502, '/api/php-versions/extensions');
    }
    return mapPhpExtensions(raw, version);
  }

  async databases(): Promise<DatabaseOverview> {
    const raw = await this.request<unknown>('/api/databases');
    return mapDatabaseOverview(raw);
  }

  async siteAction(domain: string, action: string, query: Record<string, string> = {}): Promise<unknown> {
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(domain)) throw new EngineError('invalid site domain', 400, domain);
    const allowed = new Set([
      'php', 'unlink', 'pause', 'unpause', 'secure', 'unsecure', 'restart', 'rebuild',
      'service:add', 'service:remove', 'service:declare', 'service:dismiss',
    ]);
    if (!allowed.has(action)) throw new EngineError('unsupported site action', 400, action);
    const serviceAction = action.startsWith('service:');
    for (const key of Object.keys(query)) {
      if (serviceAction && key !== 'name') throw new EngineError('unsupported site action parameter', 400, key);
      if (!serviceAction && key !== 'version' && key !== 'branch') {
        throw new EngineError('unsupported site action parameter', 400, key);
      }
    }
    if (serviceAction) {
      const name = query.name ?? '';
      if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || isRemovedService(name)) {
        throw new EngineError('invalid or unmanaged service name', 400, name);
      }
    }
    const search = new URLSearchParams(query).toString();
    const result = await this.request<unknown>(`/api/sites/${encodeURIComponent(domain)}/${action}${search ? `?${search}` : ''}`, { method: 'POST' });
    if (isRecord(result) && result.ok === false) {
      throw new EngineError(str(result.error, `${domain}: ${action} failed`), 502, `/api/sites/${domain}/${action}`);
    }
    if (isRecord(result) && typeof result.error === 'string' && result.error) {
      throw new EngineError(result.error, 502, `/api/sites/${domain}/${action}`);
    }
    return result;
  }

  async setSitePhp(domain: string, version: string): Promise<unknown> {
    if (!/^\d+\.\d+$/.test(version)) throw new EngineError('invalid PHP version', 400, version);
    // Read the effective pin before touching the project. If the switch fails
    // after the engine has written configuration, the previous version is
    // restored through the same shared engine path.
    const before = (await this.sites()).find((site) => site.domain === domain);
    if (!before) throw new EngineError(`site ${domain} was not found`, 404, '/api/sites');
    try {
      return await this.siteAction(domain, 'php', { version });
    } catch (err) {
      if (before.phpVersion && before.phpVersion !== version) {
        try {
          await this.siteAction(domain, 'php', { version: before.phpVersion });
        } catch (rollbackError) {
          const original = err instanceof Error ? err.message : String(err);
          const rollback = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          throw new EngineError(
            `${original}. Restoring PHP ${before.phpVersion} also failed: ${rollback}`,
            err instanceof EngineError ? err.status : 502,
            `/api/sites/${domain}/php`,
          );
        }
      }
      throw err;
    }
  }

  async serviceAction(name: string, action: 'start' | 'stop' | 'restart'): Promise<unknown> {
    if (isRemovedService(name)) throw new EngineError('phpMyAdmin is not managed by VALET', 400, name);
    const result = await this.request<unknown>(`/api/services/${encodeURIComponent(name)}/${action}`, { method: 'POST' });
    if (isRecord(result) && result.ok === false) {
      throw new EngineError(str(result.error, `${name}: ${action} failed`), 502, `/api/services/${name}/${action}`);
    }
    return result;
  }

  async setServicePort(name: string, port: number): Promise<unknown> {
    if (isRemovedService(name)) throw new EngineError('phpMyAdmin is not managed by VALET', 400, name);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new EngineError('invalid port', 400, String(port));
    // The engine's ports endpoint replaces the full extra-port list. Reading it
    // first keeps `service expose` mappings from being cleared by a primary-port
    // move made in VALET.
    const current = await this.findService(name);
    const result = await this.request<unknown>(`/api/services/${encodeURIComponent(name)}/ports`, {
      method: 'POST',
      body: { published_port: port, extra_ports: current.extraPorts ?? [] },
    });
    if (isRecord(result) && result.ok === false) {
      throw new EngineError(str(result.error, `could not move ${name} to port ${port}`), 502, `/api/services/${name}/ports`);
    }
    return result;
  }

  /**
   * Move one secondary published port of a multi-port service. The primary
   * override is sent back as-is so the engine neither pins it nor loses it.
   */
  async setServiceSecondaryPort(name: string, containerPort: number, port: number): Promise<unknown> {
    if (isRemovedService(name)) throw new EngineError('phpMyAdmin is not managed by VALET', 400, name);
    if (!Number.isInteger(containerPort) || containerPort < 1 || containerPort > 65535) {
      throw new EngineError('invalid container port', 400, String(containerPort));
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new EngineError('invalid port', 400, String(port));
    const current = await this.findService(name);
    if (!current.secondaryPorts?.some((mapping) => mapping.container === containerPort)) {
      throw new EngineError(`${name} has no published container port ${containerPort}`, 400, `/api/services/${name}/ports`);
    }
    const result = await this.request<unknown>(`/api/services/${encodeURIComponent(name)}/ports`, {
      method: 'POST',
      body: {
        published_port: current.publishedPort ?? 0,
        published_ports: { [String(containerPort)]: port },
        extra_ports: current.extraPorts ?? [],
      },
    });
    if (isRecord(result) && result.ok === false) {
      throw new EngineError(str(result.error, `could not move ${name} port ${containerPort} to ${port}`), 502, `/api/services/${name}/ports`);
    }
    return result;
  }

  private async findService(name: string): Promise<Service> {
    const service = (await this.services()).find((entry) => entry.name === name);
    if (!service) throw new EngineError(`service ${name} was not found`, 404, '/api/services');
    return service;
  }

  /**
   * Install a PHP runtime. The engine answers with SSE build lines and a final
   * `event: done` payload; lines are forwarded so the UI can show real progress.
   */
  async installPhp(version: string, onLine?: (line: string) => void): Promise<{ ok: boolean; error?: string }> {
    if (!/^\d+\.\d+$/.test(version)) throw new EngineError('invalid PHP version', 400, version);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30 * 60 * 1000);
    try {
      const res = await this.fetchImpl(new URL(`/api/php-versions/install?version=${encodeURIComponent(version)}`, this.apiBase), {
        method: 'POST',
        headers: { accept: 'text/event-stream', 'x-lerd-csrf': '1' },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new EngineError(`PHP install failed: engine returned ${res.status}`, res.status, '/api/php-versions/install');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let result: { ok: boolean; error?: string } | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const blocks = pending.split('\n\n');
        pending = blocks.pop() ?? '';
        for (const block of blocks) {
          const lines = block.split('\n');
          const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
          const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
          if (!data) continue;
          if (event === 'done') {
            try {
              const parsed: unknown = JSON.parse(data);
              if (parsed && typeof parsed === 'object') {
                const record = parsed as Record<string, unknown>;
                result = { ok: Boolean(record.ok), error: typeof record.error === 'string' ? record.error : undefined };
              }
            } catch {
              result = { ok: false, error: 'invalid install response' };
            }
          } else {
            onLine?.(data);
          }
        }
      }
      return result ?? { ok: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async runCommand(command: EngineCommand): Promise<CommandResult> {
    if (!this.binary) throw new EngineError('engine binary not found', 404, 'engine');
    const args = validateEngineArgs(command);
    return runProcess(this.binary, args, command.cwd, 120_000);
  }

  async versionInfo(): Promise<{ current: string; latest?: string; hasUpdate?: boolean } | null> {
    try {
      const raw = await this.request<unknown>('/api/version');
      const record = isRecord(raw) ? raw : {};
      return {
        current: str(record.current),
        latest: str(record.latest) || undefined,
        hasUpdate: bool(record.has_update),
      };
    } catch {
      return null;
    }
  }
}

export function legacyPaths(home = os.homedir()): { configDir: string; dataDir: string; cacheDir: string; sitesFile: string } {
  return {
    configDir: path.join(home, '.config', 'lerd'),
    dataDir: path.join(home, '.local', 'share', 'lerd'),
    cacheDir: path.join(home, '.cache', 'lerd'),
    sitesFile: path.join(home, '.local', 'share', 'lerd', 'sites.yaml'),
  };
}
