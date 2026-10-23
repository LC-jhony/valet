#!/usr/bin/env node
/**
 * VALET CLI.
 *
 * The CLI shares the desktop adapter (`shared/engine.ts`) and the same
 * allow-list. It never builds shell command strings: engine subprocesses use
 * execFile with validated arguments, and API calls are limited to `/api/`.
 */

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';
import { EngineClient, EngineError, detectEngine, isRemovedService, validateEngineBinary } from '../shared/engine';
import { adoptionSummary, applyMigration, detectMigration } from '../shared/migration';
import {
  configFile,
  loadConfig,
  updateConfig,
  valetCacheDir,
  valetConfigDir,
  valetDataDir,
  valetLogsDir,
  valetStateDir,
} from '../shared/config';
import { collectPorts } from '../shared/ports';
import { scanHostListeners, isPortAvailable } from '../shared/host';
import { deriveLogSources } from '../shared/log-sources';
import { formatBytes, formatRelative, projectStatus, serviceStatus } from '../shared/format';
import { THEME_IDS, isThemeId } from '../shared/themes';
import type { EngineCommand, EngineStatus, PortEntry, Project, Service, ValetConfig } from '../shared/types';

const VERSION = process.env.VALET_VERSION ?? '1.0.0';
const execFileAsync = promisify(execFile);

const colorEnabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
const paint = (code: number, text: string): string => (colorEnabled ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = (text: string): string => paint(1, text);
const dim = (text: string): string => paint(2, text);
const green = (text: string): string => paint(32, text);
const yellow = (text: string): string => paint(33, text);
const red = (text: string): string => paint(31, text);

function out(text = ''): void {
  process.stdout.write(`${text}\n`);
}

function err(text = ''): void {
  process.stderr.write(`${text}\n`);
}

class CliError extends Error {
  readonly code: number;
  constructor(message: string, code = 1) {
    super(message);
    this.name = 'CliError';
    this.code = code;
  }
}

interface Options {
  json: boolean;
  yes: boolean;
  engine: boolean;
  address?: string;
  container?: string;
}

function usageError(message: string): never {
  throw new CliError(message, 2);
}

function parseArgs(argv: string[]): { positionals: string[]; options: Options } {
  const options: Options = { json: false, yes: false, engine: false };
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--json' || arg === '-j') options.json = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--engine') options.engine = true;
    else if (arg === '--address') {
      const value = argv[index + 1];
      if (!value) usageError('--address requires a value');
      options.address = value;
      index += 1;
    } else if (arg.startsWith('--address=')) {
      options.address = arg.slice('--address='.length);
    } else if (arg === '--container') {
      const value = argv[index + 1];
      if (!value) usageError('--container requires a value');
      options.container = value;
      index += 1;
    } else if (arg.startsWith('--container=')) {
      options.container = arg.slice('--container='.length);
    } else if (arg.startsWith('-') && arg !== '-') {
      usageError(`unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

function table(headers: string[], rows: Array<Array<string | number>>, right: number[] = []): string {
  const normalized = rows.map((row) => row.map((cell) => String(cell)));
  const widths = headers.map((header, index) =>
    Math.max(stripAnsi(header).length, ...normalized.map((row) => stripAnsi(row[index] ?? '').length), 0),
  );
  const line = (cells: string[], boldHeader = false): string =>
    cells
      .map((cell, index) => {
        const visible = stripAnsi(cell).length;
        const width = widths[index] ?? 0;
        const filled = right.includes(index) ? ' '.repeat(Math.max(0, width - visible)) + cell : cell + ' '.repeat(Math.max(0, width - visible));
        return boldHeader ? bold(filled) : filled;
      })
      .join('  ')
      .trimEnd();
  const header = line(headers, true);
  const underline = dim(widths.map((width) => '─'.repeat(width)).join('  '));
  return [header, underline, ...normalized.map((row) => line(row))].join('\n');
}

function statusLabel(tone: 'ok' | 'warn' | 'error' | 'muted', label: string): string {
  if (tone === 'ok') return green(label);
  if (tone === 'warn') return yellow(label);
  if (tone === 'error') return red(label);
  return dim(label);
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function validServiceName(name: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(name) && name.length <= 64 && !isRemovedService(name);
}

function validDomain(domain: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(domain) && domain.length <= 253;
}

function validPhpVersion(version: string): boolean {
  return /^\d+\.\d+$/.test(version);
}

function requireValue(value: string | undefined, label: string): string {
  if (!value) usageError(`${label} is required`);
  return value;
}

async function confirm(question: string, options: Options): Promise<boolean> {
  if (options.yes) return true;
  if (!process.stdin.isTTY) {
    throw new CliError('Confirmation required. Re-run with --yes in a non-interactive shell.', 2);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

interface EngineContext {
  client: EngineClient;
  status: EngineStatus;
  config: ValetConfig;
}

async function loadEngine(requireHttp = false): Promise<EngineContext> {
  const config = loadConfig();
  const status = await detectEngine(config.enginePath);
  const client = new EngineClient({ apiBase: status.apiBase, binary: status.binary });
  if (requireHttp && status.mode !== 'http') {
    throw new CliError(
      `The engine API is not running (${status.apiBase}). Start it with \`valet start\` or inspect \`valet doctor\`.`,
    );
  }
  return { client, status, config };
}

async function requireHttp(): Promise<EngineContext> {
  return loadEngine(true);
}

function engineMode(status: EngineStatus): string {
  if (status.mode === 'http') return green('online');
  if (status.mode === 'cli') return yellow('installed, API offline');
  return red('offline');
}

function printEngine(status: EngineStatus): void {
  out(`${bold('Engine')}   ${engineMode(status)} ${dim(status.version ? `v${status.version}` : '')}`.trimEnd());
  if (status.binary) out(`${bold('Binary')}   ${status.binary}`);
  out(`${bold('API')}      ${status.apiBase}`);
  if (status.error && status.mode !== 'http') out(`${bold('Detail')}   ${dim(status.error)}`);
}

async function phpMyAdminStatus(client: EngineClient): Promise<{ present: boolean; status?: string }> {
  const raw = await client.request<unknown>('/api/services');
  const list = Array.isArray(raw) ? raw : [];
  const entry = list.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const name = (item as Record<string, unknown>).name;
    return typeof name === 'string' && isRemovedService(name);
  }) as Record<string, unknown> | undefined;
  return entry ? { present: true, status: typeof entry.status === 'string' ? entry.status : 'unknown' } : { present: false };
}

function siteUrl(project: Project): string {
  return `${project.tls ? 'https' : 'http'}://${project.domains[0] ?? project.domain}`;
}

async function openUrl(url: string): Promise<void> {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    await execFileAsync(command, args, { timeout: 8_000 });
  } catch (error) {
    throw new CliError(`Could not open the browser: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runEngineCommand(id: EngineCommand['id'], args?: string[], cwd?: string): Promise<number | null> {
  const { client } = await loadEngine();
  if (!client.binary) throw new CliError('Engine binary not found. Run `valet config set engine-path <path>` or install the engine.');
  const result = await client.runCommand({ id, args, cwd });
  if (result.stdout.trim()) out(result.stdout.trimEnd());
  if (result.stderr.trim()) err(result.stderr.trimEnd());
  return result.code;
}

function pathHealth(target: string): string {
  try {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) return red('not a directory');
    const mode = stat.mode & 0o777;
    if (mode & 0o077) return yellow(`mode ${mode.toString(8)} (consider 700)`);
    return green(`mode ${mode.toString(8)}`);
  } catch {
    return dim('missing');
  }
}

async function commandDoctor(options: Options): Promise<void> {
  const config = loadConfig();
  const status = await detectEngine(config.enginePath);
  const adoption = adoptionSummary();
  const plan = adoption.plan;
  const checks: Array<{ name: string; ok: boolean | null; detail: string }> = [];

  checks.push({
    name: 'Engine binary',
    ok: status.binary ? true : status.mode === 'http' ? null : false,
    detail: status.binary ?? (status.mode === 'http' ? 'not found; API is already running' : 'not found on PATH, VALET_ENGINE_BIN or saved path'),
  });
  const api = (() => {
    try {
      return new URL(status.apiBase);
    } catch {
      return null;
    }
  })();
  const loopback = api
    ? api.hostname === '127.0.0.1' || api.hostname === '::1' || api.hostname === 'localhost'
    : false;
  checks.push({
    name: 'Engine API',
    ok: status.mode === 'http' ? true : false,
    detail: status.mode === 'http' ? `${status.apiBase} (v${status.version ?? '?'})` : `offline at ${status.apiBase}`,
  });
  checks.push({
    name: 'API binding',
    ok: api ? loopback : false,
    detail: api ? (loopback ? 'loopback' : 'non-loopback URL configured') : 'invalid VALET_ENGINE_URL',
  });
  checks.push({ name: 'Config directory', ok: null, detail: `${valetConfigDir()} · ${pathHealth(valetConfigDir())}` });
  checks.push({ name: 'State directory', ok: null, detail: `${valetStateDir()} · ${pathHealth(valetStateDir())}` });
  checks.push({ name: 'Desktop config', ok: fs.existsSync(configFile()) ? true : null, detail: configFile() });

  if (status.mode === 'http') {
    const { client } = await loadEngine(true);
    const [sites, services, php, listeners, admin] = await Promise.allSettled([
      client.sites(),
      client.services(),
      client.phpVersions(),
      scanHostListeners(),
      phpMyAdminStatus(client),
    ]);
    if (sites.status === 'fulfilled') {
      const running = sites.value.filter((project) => project.fpmRunning && !project.paused).length;
      checks.push({ name: 'Projects', ok: true, detail: `${sites.value.length} registered · ${running} running` });
    } else checks.push({ name: 'Projects', ok: false, detail: sites.reason instanceof Error ? sites.reason.message : String(sites.reason) });
    if (services.status === 'fulfilled') {
      const running = services.value.filter((service) => serviceStatus(service).tone === 'ok').length;
      checks.push({ name: 'Services', ok: true, detail: `${services.value.length} installed · ${running} running` });
    } else checks.push({ name: 'Services', ok: false, detail: services.reason instanceof Error ? services.reason.message : String(services.reason) });
    if (php.status === 'fulfilled') {
      checks.push({ name: 'PHP', ok: true, detail: `${php.value.filter((version) => version.installed).length} installed · ${php.value.filter((version) => !version.installed).length} available` });
    } else checks.push({ name: 'PHP', ok: false, detail: php.reason instanceof Error ? php.reason.message : String(php.reason) });
    if (listeners.status === 'fulfilled' && services.status === 'fulfilled' && sites.status === 'fulfilled') {
      const ports = collectPorts(services.value, sites.value, listeners.value);
      const conflicts = ports.filter((port) => port.state === 'conflict').length;
      checks.push({ name: 'Ports', ok: conflicts === 0, detail: conflicts === 0 ? `${ports.length} observed ports · no conflicts` : `${conflicts} conflict(s)` });
    }
    if (admin.status === 'fulfilled') {
      checks.push({
        name: 'phpMyAdmin',
        ok: admin.value.present ? false : true,
        detail: admin.value.present ? `legacy container present (${admin.value.status ?? 'unknown'}) — run \`valet phpmyadmin remove\`` : 'not installed',
      });
    }
  }

  checks.push({
    name: 'Adoption',
    ok: null,
    detail: adoption.adopted && adoption.manifest
      ? `backed up ${formatRelative(Date.parse(adoption.manifest.createdAt))} · ${adoption.manifest.files} files · ${formatBytes(adoption.manifest.bytes)}`
      : plan.detected
        ? plan.entries.some((entry) => entry.exists)
          ? 'legacy engine data detected; run `valet migrate apply` to create a verified backup'
          : 'engine binary found; no legacy config or sites to back up'
        : 'no previous installation detected',
  });

  if (options.json) {
    const safeChecks = checks.map((check) => ({ ...check, detail: stripAnsi(check.detail) }));
    out(JSON.stringify({ valet: VERSION, engine: status, adoption: { adopted: adoption.adopted, plan }, checks: safeChecks }, null, 2));
  } else {
    out(bold(`VALET doctor ${VERSION}`));
    out('');
    for (const check of checks) {
      const marker = check.ok === true ? green('✓') : check.ok === false ? red('✗') : dim('·');
      out(`${marker} ${check.name.padEnd(18)} ${check.detail}`);
    }
    if (plan.warnings.length > 0) {
      out('');
      out(bold('Adoption notes'));
      for (const warning of plan.warnings) out(`  ${yellow('·')} ${warning}`);
    }
    if (status.mode === 'http') {
      const admin = adoption.adopted || !plan.entries.some((entry) => entry.exists)
        ? ''
        : ' Create a verified backup with `valet migrate apply`.';
      out('');
      out(dim(`Engine checks are read-only.${admin}`));
    } else {
      out('');
      out(yellow('The engine API is offline. Project, service, PHP and port data cannot be verified.'));
    }
  }

  if (options.engine && status.binary) {
    out('');
    out(bold('Engine doctor'));
    const code = await runEngineCommand('doctor');
    if (code !== 0) process.exitCode = 1;
  }

  if (status.mode !== 'http' || checks.some((check) => check.ok === false)) process.exitCode = 1;
}

async function commandStatus(options: Options): Promise<void> {
  const { client, status } = await loadEngine(false);
  let projects: Project[] = [];
  let services: Service[] = [];
  let phpInstalled = 0;
  let phpAvailable = 0;
  const failures: string[] = [];
  if (status.mode === 'http') {
    const [sitesResult, servicesResult, phpResult] = await Promise.allSettled([
      client.sites(),
      client.services(),
      client.phpVersions(),
    ]);
    if (sitesResult.status === 'fulfilled') projects = sitesResult.value;
    else failures.push(`projects: ${sitesResult.reason instanceof Error ? sitesResult.reason.message : String(sitesResult.reason)}`);
    if (servicesResult.status === 'fulfilled') services = servicesResult.value;
    else failures.push(`services: ${servicesResult.reason instanceof Error ? servicesResult.reason.message : String(servicesResult.reason)}`);
    if (phpResult.status === 'fulfilled') {
      phpInstalled = phpResult.value.filter((version) => version.installed).length;
      phpAvailable = phpResult.value.filter((version) => !version.installed).length;
    } else failures.push(`php: ${phpResult.reason instanceof Error ? phpResult.reason.message : String(phpResult.reason)}`);
  }
  const adoption = adoptionSummary();
  if (options.json) {
    out(JSON.stringify({
      valet: VERSION,
      engine: status,
      projects,
      services,
      php: { installed: phpInstalled, available: phpAvailable },
      adoption: { adopted: adoption.adopted, backupDir: adoption.manifest?.backupDir ?? null },
      failures,
    }, null, 2));
  } else {
    out(`${bold('VALET')} ${VERSION}`);
    printEngine(status);
    if (status.mode === 'http') {
      const running = projects.filter((project) => project.fpmRunning && !project.paused).length;
      const servicesRunning = services.filter((service) => serviceStatus(service).tone === 'ok').length;
      out(`${bold('Projects')} ${projects.length} registered · ${running} running`);
      out(`${bold('Services')} ${services.length} installed · ${servicesRunning} running`);
      out(`${bold('PHP')}      ${phpInstalled} installed · ${phpAvailable} available`);
    }
    out(`${bold('Backup')}   ${adoption.adopted ? `adopted (${adoption.manifest?.backupDir ?? ''})` : 'not created'}`);
    for (const failure of failures) err(yellow(`warning: ${failure}`));
  }
}

async function commandProjects(positionals: string[], options: Options): Promise<void> {
  const action = positionals[0] ?? 'list';
  const { client } = await requireHttp();

  if (action === 'list' || action === 'ls') {
    const projects = (await client.sites()).sort((a, b) => a.domain.localeCompare(b.domain));
    if (options.json) {
      out(JSON.stringify(projects, null, 2));
      return;
    }
    if (projects.length === 0) {
      out(dim('No projects registered. Add one with `valet projects add <path>`.'));
      return;
    }
    const rows = projects.map((project) => {
      const status = projectStatus(project);
      return [
        project.domain,
        project.phpVersion || '—',
        project.frameworkLabel || '—',
        statusLabel(status.tone, status.label),
        project.path,
      ];
    });
    out(table(['Domain', 'PHP', 'Framework', 'Status', 'Path'], rows));
    const running = projects.filter((project) => project.fpmRunning && !project.paused).length;
    out('');
    out(dim(`${projects.length} registered · ${running} running`));
    return;
  }

  if (action === 'add') {
    const target = requireValue(positionals[1], 'project path');
    const resolved = path.resolve(target);
    if (!path.isAbsolute(target) || !isDirectory(resolved)) throw new CliError(`Not a directory: ${target}`);
    const result = await client.runCommand({ id: 'link', cwd: resolved });
    if (result.stdout.trim()) out(result.stdout.trimEnd());
    if (result.stderr.trim()) err(result.stderr.trimEnd());
    if (result.code !== 0) throw new CliError(`The engine could not register ${resolved}.`);
    out(green(`Registered ${resolved}. Project files were not moved.`));
    return;
  }

  if (action === 'remove' || action === 'unregister') {
    const domain = requireValue(positionals[1], 'project domain');
    if (!validDomain(domain)) throw new CliError(`Invalid domain: ${domain}`);
    const project = (await client.sites()).find((site) => site.domain === domain);
    if (!project) throw new CliError(`Project not found: ${domain}`);
    if (!(await confirm(`Unregister ${domain}? Files and databases are preserved.`, options))) {
      out('Cancelled.');
      return;
    }
    const result = await client.siteAction(domain, 'unlink');
    if (result && typeof result === 'object' && 'error' in result && result.error) throw new CliError(String(result.error));
    out(green(`Unregistered ${domain}. Files, databases and volumes were not touched.`));
    return;
  }

  if (action === 'php') {
    const domain = requireValue(positionals[1], 'project domain');
    const version = requireValue(positionals[2], 'PHP version');
    if (!validDomain(domain)) throw new CliError(`Invalid domain: ${domain}`);
    if (!validPhpVersion(version)) throw new CliError(`Invalid PHP version: ${version}`);
    const result = (await client.setSitePhp(domain, version)) as { ok?: boolean; warning?: string; error?: string } | null;
    if (result?.error) throw new CliError(result.error);
    out(result?.warning ? yellow(result.warning) : green(`${domain} now uses PHP ${version}. Other projects are untouched.`));
    return;
  }

  if (action === 'services') {
    const domain = requireValue(positionals[1], 'project domain');
    if (!validDomain(domain)) throw new CliError(`Invalid domain: ${domain}`);
    const project = (await client.sites()).find((site) => site.domain === domain);
    if (!project) throw new CliError(`Project not found: ${domain}`);
    const attached = (project.services ?? []).map((name) => ({
      name,
      declared: (project.declaredServices ?? []).includes(name),
    }));
    if (options.json) {
      out(JSON.stringify({
        domain,
        attached,
        suggested: project.suggestedServices ?? [],
      }, null, 2));
      return;
    }
    if (attached.length === 0) out(dim(`No services attached to ${domain}.`));
    else {
      out(table(['Service', 'Attachment'], attached.map((service) => [service.name, service.declared ? 'declared' : 'detected in env'])));
    }
    const suggestions = project.suggestedServices ?? [];
    if (suggestions.length > 0) {
      out('');
      out(bold('Suggested'));
      for (const suggestion of suggestions) {
        out(`  ${suggestion.name}${suggestion.reason ? dim(`  ${suggestion.reason}`) : ''}`);
      }
    }
    return;
  }

  if (action === 'service') {
    const operation = positionals[1] ?? '';
    const domain = requireValue(positionals[2], 'project domain');
    const name = requireValue(positionals[3], 'service name');
    if (!['add', 'remove', 'declare', 'dismiss'].includes(operation)) {
      usageError('Use: valet projects service add|remove|declare|dismiss <domain> <service>');
    }
    if (!validDomain(domain)) throw new CliError(`Invalid domain: ${domain}`);
    if (!validServiceName(name)) throw new CliError(`Invalid or unmanaged service: ${name}`);
    const destructive = operation === 'add' || operation === 'remove';
    const message = operation === 'add'
      ? `Add ${name} to ${domain}? The engine may install and start the service and will edit the project env.`
      : operation === 'remove'
        ? `Detach ${name} from ${domain}? The container and its data are preserved.`
        : operation === 'declare'
          ? `Declare ${name} for ${domain} in .lerd.yaml? Nothing is installed.`
          : `Dismiss the ${name} suggestion for ${domain}? No project file is changed.`;
    if (destructive && !(await confirm(message, options))) {
      out('Cancelled.');
      return;
    }
    const result = await client.siteAction(domain, `service:${operation}`, { name });
    if (options.json) {
      out(JSON.stringify({ domain, service: name, operation, result }, null, 2));
      return;
    }
    out(green(`${domain}: service:${operation} completed for ${name}.`));
    return;
  }

  if (['restart', 'pause', 'resume', 'unpause', 'secure', 'unsecure', 'rebuild'].includes(action)) {
    const domain = requireValue(positionals[1], 'project domain');
    if (!validDomain(domain)) throw new CliError(`Invalid domain: ${domain}`);
    const siteAction = action === 'resume' ? 'unpause' : action;
    const result = (await client.siteAction(domain, siteAction)) as { ok?: boolean; warning?: string; error?: string } | null;
    if (result?.error) throw new CliError(result.error);
    out(result?.warning ? yellow(result.warning) : green(`${domain}: ${siteAction} completed.`));
    return;
  }

  if (action === 'open') {
    const domain = requireValue(positionals[1], 'project domain');
    if (!validDomain(domain)) throw new CliError(`Invalid domain: ${domain}`);
    const project = (await client.sites()).find((site) => site.domain === domain);
    if (!project) throw new CliError(`Project not found: ${domain}`);
    await openUrl(siteUrl(project));
    out(green(`Opened ${siteUrl(project)}`));
    return;
  }

  usageError(`Unknown projects action: ${action}`);
}

async function commandServices(positionals: string[], options: Options): Promise<void> {
  const action = positionals[0] ?? 'list';
  const { client } = await requireHttp();

  if (action === 'list' || action === 'ls') {
    const services = (await client.services()).sort((a, b) => a.name.localeCompare(b.name));
    if (options.json) {
      out(JSON.stringify(services, null, 2));
      return;
    }
    if (services.length === 0) {
      out(dim('No services installed.'));
      return;
    }
    const rows = services.map((service) => {
      const status = serviceStatus(service);
      const conflict = service.portConflicts && service.portConflicts.length > 0
        ? dim(` (busy: ${service.portConflicts.map((entry) => entry.port).join(', ')})`)
        : '';
      return [
        service.name,
        `${statusLabel(status.tone, status.label)}${conflict}`,
        service.version ?? '—',
        service.port ? `127.0.0.1:${service.port}` : '—',
        service.siteCount > 0 ? String(service.siteCount) : '—',
      ];
    });
    out(table(['Service', 'Status', 'Version', 'Host port', 'Sites'], rows));
    out('');
    out(dim('phpMyAdmin is not managed by VALET and is intentionally absent.'));
    return;
  }

  const name = requireValue(positionals[1], 'service name');
  if (!validServiceName(name)) throw new CliError(`Invalid or unmanaged service: ${name}`);

  if (action === 'start' || action === 'stop' || action === 'restart') {
    if (action === 'start') {
      const service = (await client.services()).find((entry) => entry.name === name);
      const running = service ? ['active', 'running'].includes(service.status.toLowerCase()) : false;
      if (!running && service?.portConflicts && service.portConflicts.length > 0) {
        const detail = service.portConflicts.map((conflict) => `${conflict.port}${conflict.label ? ` (${conflict.label})` : ''}`).join(', ');
        throw new CliError(`The engine sees busy ports for ${name}: ${detail}. Move the managed port first; VALET will not stop another process.`);
      }
      if (service?.port && !running) {
        const availability = await isPortAvailable(service.port);
        if (!availability.available) {
          throw new CliError(
            `Port ${service.port} is not available: ${availability.error ?? 'in use'}. Move the managed port first; VALET will not stop another process.`,
          );
        }
      }
    }
    const result = (await client.serviceAction(name, action)) as { ok?: boolean; error?: string; warning?: string } | null;
    if (result?.error) throw new CliError(result.error);
    out(green(`${name}: ${action} requested.`));
    return;
  }

  if (action === 'port') {
    const port = Number(requireValue(positionals[2], 'host port'));
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new CliError('Port must be an integer between 1 and 65535.');
    const containerPort = options.container === undefined ? null : Number(options.container);
    if (containerPort !== null && (!Number.isInteger(containerPort) || containerPort < 1 || containerPort > 65535)) {
      throw new CliError('--container must be an integer between 1 and 65535.');
    }
    const availability = await isPortAvailable(port);
    if (!availability.available) throw new CliError(`Port ${port} is not available: ${availability.error ?? 'in use'}`);
    if (containerPort !== null) {
      await client.setServiceSecondaryPort(name, containerPort, port);
      out(green(`${name} now publishes container port ${containerPort} on host port ${port}.`));
    } else {
      await client.setServicePort(name, port);
      out(green(`${name} now publishes host port ${port}. The container port is unchanged.`));
    }
    return;
  }

  if (action === 'logs') {
    await streamLogs(`lerd-${name}`, options);
    return;
  }

  if (action === 'remove') {
    if (isRemovedService(name)) throw new CliError('Use `valet phpmyadmin remove` for phpMyAdmin.');
    if (!(await confirm(`Remove service ${name}? Its container is removed; named volumes are preserved unless the engine says otherwise.`, options))) {
      out('Cancelled.');
      return;
    }
    await client.request(`/api/services/${encodeURIComponent(name)}/remove?removeData=false`, { method: 'POST' }).then((result) => {
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
        const message = (result as { error?: unknown }).error;
        throw new CliError(typeof message === 'string' ? message : `Could not remove ${name}.`);
      }
    });
    out(green(`${name} removed. Database volumes are not removed by this command.`));
    return;
  }

  usageError(`Unknown services action: ${action}`);
}

async function commandPhp(positionals: string[], options: Options): Promise<void> {
  const action = positionals[0] ?? 'list';
  const { client, status } = await loadEngine(false);

  if (action === 'list' || action === 'ls') {
    if (status.mode !== 'http') throw new CliError('The engine API is required to list PHP runtimes. Start it with `valet start`.');
    const [versions, projects] = await Promise.all([client.phpVersions(), client.sites().catch(() => [] as Project[])]);
    const rows = versions.map((version) => {
      const runtime = !version.installed
        ? dim('not installed')
        : version.running
          ? green('FPM running')
          : version.running === false
            ? yellow('FPM stopped')
            : dim('FPM state unknown');
      const state = version.default ? green('default') : version.installed ? 'installed' : 'available';
      return [
        version.version,
        state,
        runtime,
        String(projects.filter((project) => project.phpVersion === version.version).length),
      ];
    });
    out(table(['PHP', 'State', 'Runtime', 'Projects'], rows, [2]));
    out('');
    out(dim('Pin a project with `valet php pin <domain> <version>`. The host PHP is never replaced.'));
    return;
  }

  if (action === 'install') {
    if (status.mode !== 'http') throw new CliError('The engine API is required to build PHP. Start it with `valet start`.');
    const version = requireValue(positionals[1], 'PHP version');
    if (!validPhpVersion(version)) throw new CliError(`Invalid PHP version: ${version}`);
    out(dim(`Building PHP ${version}. Engine output follows.`));
    const result = await client.installPhp(version, (line) => {
      if (line.trim()) out(line);
    });
    if (!result.ok) throw new CliError(result.error ?? `PHP ${version} could not be installed.`);
    out(green(`PHP ${version} installed.`));
    return;
  }

  if (action === 'extensions' || action === 'ext') {
    if (status.mode !== 'http') throw new CliError('The engine API is required to inspect PHP extensions. Start it with `valet start`.');
    const version = requireValue(positionals[1], 'PHP version');
    if (!validPhpVersion(version)) throw new CliError(`Invalid PHP version: ${version}`);
    const report = await client.phpExtensions(version);
    if (options.json) {
      out(JSON.stringify(report, null, 2));
      return;
    }
    out(`${bold(`PHP ${report.version}`)}  ${report.built ? green('image built') : dim('image not built')}${report.needsRebuild ? yellow(' · rebuild recommended') : ''}`);
    if (report.modulesError) out(yellow(report.modulesError));
    out('');
    out(bold('Loaded modules'));
    out(report.modules.length ? report.modules.join(', ') : dim('none reported'));
    out('');
    out(bold('Extensions'));
    out(`declared  ${report.extensions.declared.join(', ') || '—'}`);
    out(`present   ${report.extensions.has.join(', ') || '—'}`);
    if (report.extensions.cannot.length > 0) out(`cannot    ${report.extensions.cannot.join(', ')}`);
    if (report.packages.declared.length > 0 || report.packages.has.length > 0) {
      out('');
      out(bold('Packages'));
      out(`declared  ${report.packages.declared.join(', ') || '—'}`);
      out(`present   ${report.packages.has.join(', ') || '—'}`);
    }
    return;
  }

  if (action === 'pin') {
    if (status.mode !== 'http') throw new CliError('The engine API is required to pin PHP. Start it with `valet start`.');
    const domain = requireValue(positionals[1], 'project domain');
    const version = requireValue(positionals[2], 'PHP version');
    if (!validDomain(domain)) throw new CliError(`Invalid domain: ${domain}`);
    if (!validPhpVersion(version)) throw new CliError(`Invalid PHP version: ${version}`);
    const result = (await client.setSitePhp(domain, version)) as { ok?: boolean; warning?: string; error?: string } | null;
    if (result?.error) throw new CliError(result.error);
    out(result?.warning ? yellow(result.warning) : green(`${domain} pinned to PHP ${version}. Other projects and host PHP are untouched.`));
    return;
  }

  if (action === 'use' || action === 'global') {
    const version = requireValue(positionals[1], 'PHP version');
    if (!validPhpVersion(version)) throw new CliError(`Invalid PHP version: ${version}`);
    if (!(await confirm(`Set the engine global PHP to ${version}? This does not replace the host system PHP.`, options))) {
      out('Cancelled.');
      return;
    }
    const code = await runEngineCommand('use-php', [version]);
    if (code !== 0) throw new CliError(`The engine could not set the global PHP to ${version}.`);
    out(green(`Engine global PHP set to ${version}.`));
    return;
  }

  usageError(`Unknown php action: ${action}`);
}

async function getPorts(): Promise<{ entries: PortEntry[]; engineOnline: boolean }> {
  const listeners = await scanHostListeners();
  const { client, status } = await loadEngine(false);
  if (status.mode === 'http') {
    const [services, projects] = await Promise.all([client.services(), client.sites()]);
    return { entries: collectPorts(services, projects, listeners), engineOnline: true };
  }
  return {
    entries: listeners.map((listener) => ({
      hostPort: listener.port,
      address: listener.address,
      protocol: listener.protocol,
      service: listener.process || 'host',
      state: 'listening' as const,
      pid: listener.pid,
      process: listener.process,
    })),
    engineOnline: false,
  };
}

async function commandPorts(positionals: string[], options: Options): Promise<void> {
  const action = positionals[0] ?? 'list';
  if (action === 'check') {
    const port = Number(requireValue(positionals[1], 'port'));
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new CliError('Port must be an integer between 1 and 65535.');
    const address = options.address ?? '127.0.0.1';
    if (net.isIP(address) === 0) throw new CliError('--address must be an IP address.');
    const result = await isPortAvailable(port, address);
    if (options.json) out(JSON.stringify({ port, address, ...result }, null, 2));
    else out(result.available ? green(`${address}:${port} is available.`) : red(`${address}:${port} is not available: ${result.error ?? 'in use'}`));
    if (!result.available) process.exitCode = 1;
    return;
  }

  if (action !== 'list' && action !== 'ls') usageError(`Unknown ports action: ${action}`);
  const { entries, engineOnline } = await getPorts();
  entries.sort((a, b) => a.hostPort - b.hostPort || a.service.localeCompare(b.service));
  if (options.json) {
    out(JSON.stringify(entries, null, 2));
    return;
  }
  if (entries.length === 0) {
    out(dim('No host listeners or managed ports found.'));
    return;
  }
  const rows = entries.map((port) => [
    String(port.hostPort),
    port.address,
    port.protocol,
    port.service,
    port.project ?? '—',
    statusLabel(port.state === 'conflict' ? 'error' : port.state === 'listening' ? 'ok' : 'warn', port.state),
  ]);
  out(table(['Port', 'Address', 'Proto', 'Owner', 'Project', 'State'], rows, [0]));
  const conflicts = entries.filter((port) => port.state === 'conflict').length;
  out('');
  out(dim(`${entries.length} entries · ${conflicts} conflict(s)${engineOnline ? '' : ' · engine offline, host listeners only'}`));
  out(dim('VALET never terminates external processes. Move a managed port with `valet services port <name> <port>`.'));
}

async function commandDatabases(options: Options): Promise<void> {
  const { client } = await requireHttp();
  const overview = await client.databases();
  if (options.json) {
    out(JSON.stringify(overview, null, 2));
    return;
  }
  if (overview.engines.length === 0) {
    out(dim('No database engines installed. Projects and volumes are untouched.'));
    return;
  }
  const rows: Array<Array<string | number>> = [];
  for (const engine of overview.engines) {
    if (engine.databases.length === 0) {
      rows.push([engine.name, engine.status, '—', '—', '—']);
      continue;
    }
    for (const database of engine.databases) {
      rows.push([engine.name, engine.status, database.name, database.site ?? '—', database.size ?? '—']);
    }
  }
  out(table(['Engine', 'Status', 'Database', 'Project', 'Size'], rows));
  out('');
  out(dim(`${overview.engines.length} engine(s). phpMyAdmin is not managed by VALET; engine data and volumes stay in place.`));
}

async function streamLogs(unit: string, options: Options): Promise<void> {
  const { status, client } = await requireHttp();
  if (!/^lerd-[a-z0-9-]+$/.test(unit)) throw new CliError(`Invalid log unit: ${unit}`);
  if (options.json) throw new CliError('--json is not supported for streaming logs.');
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
    process.exitCode = 130;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  out(dim(`streaming ${unit} from ${status.apiBase} · Ctrl+C to stop`));
  try {
    const response = await fetch(new URL(`/api/logs/${unit}`, client.apiBase), {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new CliError(`The engine returned ${response.status} for ${unit}.`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const blocks = pending.split('\n\n');
      pending = blocks.pop() ?? '';
      for (const block of blocks) {
        for (const line of block.split('\n')) {
          if (line.startsWith('data:')) out(line.slice(5).trimStart());
        }
      }
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    throw error instanceof Error ? new CliError(error.message) : new CliError(String(error));
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

async function listLogs(options: Options): Promise<void> {
  const { client, status } = await requireHttp();
  const [services, php] = await Promise.all([client.services(), client.phpVersions()]);
  const sources = deriveLogSources(services, php);
  if (options.json) {
    out(JSON.stringify(sources, null, 2));
    return;
  }
  out(table(['Unit', 'Kind', 'Label'], sources.map((source) => [source.unit, source.kind, source.label])));
  out('');
  out(dim(`Stream with \`valet logs <unit>\` against ${status.apiBase}.`));
}

async function commandLogs(positionals: string[], options: Options): Promise<void> {
  const requested = positionals[0];
  if (!requested) {
    await listLogs(options);
    return;
  }
  const { client } = await requireHttp();
  const [services, php] = await Promise.all([client.services(), client.phpVersions()]);
  const sources = deriveLogSources(services, php);
  const match = sources.find((source) => source.unit === requested || source.id === requested || source.label.toLowerCase() === requested.toLowerCase());
  if (!match) {
    throw new CliError(`Unknown log source: ${requested}\nAvailable: ${sources.map((source) => source.unit).join(', ')}`);
  }
  await streamLogs(match.unit, options);
}

async function commandStart(): Promise<void> {
  const code = await runEngineCommand('start');
  if (code !== 0) throw new CliError('The engine did not start.');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const status = await detectEngine(loadConfig().enginePath);
    if (status.mode === 'http') {
      out(green(`Engine online at ${status.apiBase}${status.version ? ` (v${status.version})` : ''}.`));
      return;
    }
  }
  throw new CliError('The engine start command returned, but the API did not answer. Run `valet doctor`.');
}

async function commandStop(): Promise<void> {
  const code = await runEngineCommand('stop');
  if (code !== 0) throw new CliError('The engine did not stop cleanly.');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const status = await detectEngine(loadConfig().enginePath);
    if (status.mode !== 'http') {
      out(green('Engine stopped. Containers and data were not removed.'));
      return;
    }
  }
  out(yellow('Stop was requested, but the API still answers. Check `valet doctor`.'));
}

async function commandRestart(): Promise<void> {
  const code = await runEngineCommand('restart');
  if (code !== 0) throw new CliError('The engine did not restart cleanly.');
  out(green('Engine restarted.'));
}

async function commandMigrate(positionals: string[], options: Options): Promise<void> {
  const action = positionals[0] ?? 'status';
  if (action === 'detect') {
    const plan = detectMigration();
    if (options.json) out(JSON.stringify(plan, null, 2));
    else {
      out(plan.detected ? green('A previous engine installation was detected.') : dim('No previous engine installation detected.'));
      out(`${bold('Config')} ${plan.legacyEngine.configDir} ${plan.legacyEngine.siteCount ? `· ${plan.legacyEngine.siteCount} site(s)` : ''}`);
      out(`${bold('Data')}   ${plan.legacyEngine.dataDir}`);
      if (plan.legacyEngine.binary) out(`${bold('Binary')} ${plan.legacyEngine.binary}`);
      for (const warning of plan.warnings) out(yellow(`· ${warning}`));
    }
    return;
  }

  if (action === 'status') {
    const summary = adoptionSummary();
    if (options.json) out(JSON.stringify(summary, null, 2));
    else {
      out(summary.adopted ? green('Adoption manifest present.') : dim('No adoption manifest yet.'));
      if (summary.manifest) {
        out(`${bold('Backup')}   ${summary.manifest.backupDir}`);
        out(`${bold('Created')}  ${summary.manifest.createdAt} (${formatRelative(Date.parse(summary.manifest.createdAt))})`);
        out(`${bold('Mode')}     ${summary.manifest.mode}`);
        out(`${bold('Sites')}    ${summary.manifest.siteCount}`);
        out(`${bold('Files')}    ${summary.manifest.files} · ${formatBytes(summary.manifest.bytes)}`);
      }
      out('');
      out(`${bold('Detected')} ${summary.plan.detected ? 'yes' : 'no'}`);
    }
    return;
  }

  if (action === 'apply') {
    const plan = detectMigration();
    if (!plan.detected) {
      out(dim('Nothing to adopt. The engine is already the source of truth.'));
      return;
    }
    out(`${bold('VALET will create a verified backup, not move data.')}`);
    out(`  ${plan.legacyEngine.configDir}`);
    out(`  ${plan.legacyEngine.dataDir}`);
    if (!(await confirm('Create the checksummed backup and record adoption?', options))) {
      out('Cancelled.');
      return;
    }
    const result = applyMigration();
    if (result.unchanged) {
      out(dim(`Already adopted. Existing backup: ${result.backupDir ?? 'unknown'}`));
      return;
    }
    if (!result.applied) {
      out(yellow('Nothing was copied. Review `valet migrate detect`.'));
      return;
    }
    out(green(`Verified backup created at ${result.backupDir}`));
    out(dim('The engine keeps its directories. Containers, volumes, projects and databases were not moved.'));
    return;
  }

  usageError(`Unknown migrate action: ${action}`);
}

async function commandConfig(positionals: string[], options: Options): Promise<void> {
  const action = positionals[0] ?? 'get';
  if (action === 'path' || action === 'paths') {
    const paths = {
      config: valetConfigDir(),
      configFile: configFile(),
      data: valetDataDir(),
      state: valetStateDir(),
      logs: valetLogsDir(),
      cache: valetCacheDir(),
    };
    if (options.json) out(JSON.stringify(paths, null, 2));
    else for (const [key, value] of Object.entries(paths)) out(`${bold(key.padEnd(10))} ${value}`);
    return;
  }

  const config = loadConfig();
  if (action === 'get') {
    const key = positionals[1];
    if (key) {
      if (!(key in config)) throw new CliError(`Unknown config key: ${key}`);
      const value = (config as unknown as Record<string, unknown>)[key];
      out(options.json ? JSON.stringify(value, null, 2) : String(value));
    } else {
      out(JSON.stringify(config, null, 2));
    }
    return;
  }

  if (action === 'set') {
    const key = requireValue(positionals[1], 'config key');
    const raw = requireValue(positionals[2], 'config value');
    const patch: Partial<ValetConfig> = {};
    if (key === 'theme') {
      if (!isThemeId(raw)) throw new CliError(`Theme must be one of: ${THEME_IDS.join(', ')}.`);
      patch.theme = raw;
    } else if (key === 'engine-path' || key === 'enginePath') {
      if (raw === 'auto' || raw === 'none') patch.enginePath = null;
      else {
        const resolved = validateEngineBinary(path.resolve(raw));
        if (!resolved) throw new CliError('Engine path must be an executable lerd or valet-engine binary.');
        patch.enginePath = resolved;
      }
    } else if (key === 'sidebar-width' || key === 'sidebarWidth') {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 180 || value > 480) throw new CliError('sidebar-width must be between 180 and 480.');
      patch.sidebarWidth = value;
    } else if (key === 'telemetry') {
      throw new CliError('Telemetry is fixed to false and cannot be enabled.');
    } else {
      throw new CliError(`Unknown or read-only config key: ${key}`);
    }
    const next = updateConfig(patch);
    out(green('Configuration saved.'));
    if (options.json) out(JSON.stringify(next, null, 2));
    return;
  }

  usageError(`Unknown config action: ${action}`);
}

async function commandTheme(positionals: string[], options: Options): Promise<void> {
  const config = loadConfig();
  const requested = positionals[0];
  if (!requested) {
    out(options.json ? JSON.stringify({ theme: config.theme }) : config.theme);
    return;
  }
  if (!isThemeId(requested)) throw new CliError(`Theme must be one of: ${THEME_IDS.join(', ')}.`);
  const next = updateConfig({ theme: requested });
  out(options.json ? JSON.stringify({ theme: next.theme }) : green(`Theme set to ${next.theme}.`));
}

async function commandPhpMyAdmin(positionals: string[], options: Options): Promise<void> {
  const action = positionals[0] ?? 'status';
  const { client, status } = await loadEngine(false);
  if (status.mode !== 'http') throw new CliError('The engine API is required. Start it with `valet start`.');
  const admin = await phpMyAdminStatus(client);
  if (action === 'status') {
    out(admin.present ? yellow(`phpMyAdmin container present (${admin.status ?? 'unknown'}).`) : green('phpMyAdmin is not present.'));
    out(dim('VALET filters phpMyAdmin from services, ports and every action. Database engines and volumes are separate.'));
    return;
  }
  if (action !== 'remove') usageError(`Unknown phpmyadmin action: ${action}`);
  if (!admin.present) {
    out(green('phpMyAdmin is not present. Nothing to remove.'));
    return;
  }
  if (!(await confirm('Stop and remove the legacy phpMyAdmin container? Databases, volumes and projects are preserved.', options))) {
    out('Cancelled.');
    return;
  }
  const code = await runEngineCommand('remove-phpmyadmin');
  if (code !== 0) throw new CliError('The engine could not remove phpMyAdmin.');
  out(green('phpMyAdmin container removed. Database engines and volumes were not touched.'));
}

function commandVersion(options: Options): void {
  if (options.json) out(JSON.stringify({ name: 'VALET', version: VERSION, engine: null }, null, 2));
  else out(`VALET ${VERSION}`);
}

function help(): void {
  out(`${bold(`VALET ${VERSION}`)} — local PHP development, without the noise.`);
  out('');
  out(`${bold('Usage')}  valet <command> [args] [--json] [--yes]`);
  out('');
  out(bold('Core'));
  out('  status                     Engine, project, service and backup summary');
  out('  doctor [--engine]          Read-only diagnostics; --engine also runs the engine doctor');
  out('  start | stop | restart     Control the engine service');
  out('  version                    Print the VALET version');
  out('');
  out(bold('Projects'));
  out('  projects                   List registered projects');
  out('  projects add <path>        Register an existing folder in place');
  out('  projects remove <domain>   Unregister a site (files and data preserved)');
  out('  projects php <domain> <v>  Pin a PHP runtime to one project');
  out('  projects services <domain>  Attached and suggested services');
  out('  projects service add|remove|declare|dismiss <domain> <service>');
  out('  projects restart|pause|resume|secure|unsecure <domain>');
  out('  projects open <domain>     Open the site in the browser');
  out('');
  out(bold('PHP and services'));
  out('  php                        List installed and available runtimes');
  out('  php install <version>      Build and install a runtime');
  out('  php extensions <version>   Show modules and declared extensions');
  out('  php pin <domain> <version> Pin a project (same as projects php)');
  out('  php use <version>          Change the engine global default (confirmed)');
  out('  services                   List services; phpMyAdmin is never shown');
  out('  services start|stop|restart|logs <name>');
  out('  services port <name> <p>   Move the host mapping to another port');
  out('  services port <name> <p> --container <cp>');
  out('                             Move a secondary container mapping instead');
  out('  services remove <name>     Remove a service container (confirmed, data preserved)');
  out('');
  out(bold('Ports, logs and configuration'));
  out('  ports [--json]             Host listeners plus managed mappings');
  out('  ports check <port> [--address <ip>]');
  out('  databases [--json]         Database engines, projects and sizes');
  out('  logs [unit]                List or stream live engine logs (Ctrl+C to stop)');
  out('  config [get|set|path]      Read or update VALET desktop configuration');
  out(`  theme [${THEME_IDS.join('|')}] Get or set the desktop theme`);
  out('');
  out(bold('Migration'));
  out('  migrate [status|detect]    Inspect adoption of an existing engine installation');
  out('  migrate apply --yes        Create a checksummed backup; never moves data');
  out('  phpmyadmin [status|remove] Legacy container only; VALET exposes no admin UI');
  out('');
  out(bold('Environment'));
  out('  VALET_ENGINE_BIN           Explicit engine binary');
  out('  VALET_ENGINE_URL           Engine API base (default http://127.0.0.1:7073)');
  out('  VALET_CONFIG_HOME          Config directory override');
  out('  NO_COLOR                   Disable ANSI colour');
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  if (raw.includes('--help') || raw.includes('-h') || raw[0] === 'help') {
    help();
    return;
  }
  if (raw.includes('--version') || raw[0] === '-v') {
    commandVersion({ json: false, yes: false, engine: false });
    return;
  }
  const { positionals, options } = parseArgs(raw);
  const [command] = positionals;
  const rest = positionals.slice(1);

  if (!command) {
    help();
    return;
  }

  switch (command) {
    case 'doctor':
      await commandDoctor(options);
      return;
    case 'status':
      await commandStatus(options);
      return;
    case 'start':
      await commandStart();
      return;
    case 'stop':
      await commandStop();
      return;
    case 'restart':
      await commandRestart();
      return;
    case 'version':
      commandVersion(options);
      return;
    case 'projects':
    case 'sites':
      await commandProjects(rest, options);
      return;
    case 'services':
      await commandServices(rest, options);
      return;
    case 'php':
      await commandPhp(rest, options);
      return;
    case 'ports':
      await commandPorts(rest, options);
      return;
    case 'databases':
      await commandDatabases(options);
      return;
    case 'logs':
      if (rest.length === 0 && options.json) {
        await listLogs(options);
        return;
      }
      await commandLogs(rest, options);
      return;
    case 'config':
      await commandConfig(rest, options);
      return;
    case 'theme':
      await commandTheme(rest, options);
      return;
    case 'migrate':
      await commandMigrate(rest, options);
      return;
    case 'phpmyadmin':
      await commandPhpMyAdmin(rest, options);
      return;
    case 'open': {
      const target = rest[0];
      if (!target || target === 'dashboard') {
        const code = await runEngineCommand('open');
        if (code !== 0) throw new CliError('The engine could not open its dashboard.');
        return;
      }
      const { client } = await requireHttp();
      if (!validDomain(target)) throw new CliError(`Invalid domain: ${target}`);
      const project = (await client.sites()).find((site) => site.domain === target);
      if (!project) throw new CliError(`Project not found: ${target}`);
      await openUrl(siteUrl(project));
      out(green(`Opened ${siteUrl(project)}`));
      return;
    }
    case 'help':
      help();
      return;
    default:
      err(red(`Unknown command: ${command}`));
      err(dim('Run `valet help` for the command list.'));
      process.exitCode = 2;
  }
}

void main().catch((error: unknown) => {
  if (error instanceof CliError) {
    err(red(`error: ${error.message}`));
    process.exitCode = error.code;
    return;
  }
  if (error instanceof EngineError) {
    err(red(`engine: ${error.message}`));
    process.exitCode = 1;
    return;
  }
  err(red(`error: ${error instanceof Error ? error.message : String(error)}`));
  process.exitCode = 1;
});
