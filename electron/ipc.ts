import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { EngineClient, EngineError, detectEngine, isRemovedService, validateEngineBinary } from '../shared/engine';
import { appInfo, updateConfig, loadConfig } from '../shared/config';
import { adoptionSummary, applyMigration, detectMigration } from '../shared/migration';
import { collectPorts } from '../shared/ports';
import type { CommandResult, EngineCommand, EngineStatus, PortEntry, ValetConfig } from '../shared/types';
import { isPortAvailable, scanHostListeners } from '../shared/host';
import type { LogStreamer } from './logs';
import type { TerminalManager } from './terminal';

interface IpcContext {
  window: BrowserWindow;
  terminal: TerminalManager;
  logs: LogStreamer;
}

let engine: EngineClient | null = null;
let status: EngineStatus | null = null;
let config = loadConfig();

function trusted(event: IpcMainInvokeEvent, window: BrowserWindow): boolean {
  return event.sender === window.webContents;
}

function assertTrusted(event: IpcMainInvokeEvent, window: BrowserWindow): void {
  if (!trusted(event, window)) throw new Error('ipc: untrusted sender');
}

async function ensureEngine(force = false): Promise<EngineClient> {
  if (force || !engine || !status) {
    config = loadConfig();
    status = await detectEngine(config.enginePath);
    engine = new EngineClient({ apiBase: status.apiBase, binary: status.binary });
  }
  return engine;
}

async function requireHttp(): Promise<EngineClient> {
  const client = await ensureEngine();
  status = await detectEngine(config.enginePath);
  if (status.mode !== 'http') {
    throw new Error('The engine API is not running. Start it from the status bar or run `valet start`.');
  }
  engine = new EngineClient({ apiBase: status.apiBase, binary: status.binary });
  return engine;
}

function validateCwd(cwd: unknown): string | undefined {
  if (cwd === undefined || cwd === null || cwd === '') return undefined;
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd) || cwd.includes('\0')) throw new Error('invalid working directory');
  const resolved = path.resolve(cwd);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error('working directory is not a directory');
  return resolved;
}

function validateDomain(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(value) || value.length > 253) {
    throw new Error('invalid project domain');
  }
  return value;
}

function inspectProject(projectPath: string): import('../shared/types').ProjectInspection {
  const readJson = (file: string): Record<string, unknown> | null => {
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > 1_000_000) return null;
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const composer = readJson(path.join(projectPath, 'composer.json'));
  const pkg = readJson(path.join(projectPath, 'package.json'));
  const require = composer && typeof composer.require === 'object' && composer.require ? (composer.require as Record<string, unknown>) : {};
  const packages = Object.keys(require);
  const framework =
    packages.includes('laravel/framework') ? 'Laravel'
      : packages.includes('symfony/framework-bundle') ? 'Symfony'
        : packages.includes('drupal/core') ? 'Drupal'
          : packages.includes('magento/product-community-edition') ? 'Magento'
            : packages.includes('cakephp/cakephp') ? 'CakePHP'
              : packages.includes('statamic/cms') ? 'Statamic'
                : packages.includes('yiisoft/yii2') ? 'Yii2'
                  : packages.some((name) => name.includes('wordpress')) ? 'WordPress'
                    : undefined;
  const php = require.php;
  return {
    path: projectPath,
    composerPhp: typeof php === 'string' ? php : undefined,
    framework,
    hasComposer: Boolean(composer),
    hasNode: Boolean(pkg),
    hasGit: fs.existsSync(path.join(projectPath, '.git')),
    packageManager: fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml')) ? 'pnpm'
      : fs.existsSync(path.join(projectPath, 'yarn.lock')) ? 'yarn'
        : fs.existsSync(path.join(projectPath, 'bun.lockb')) ? 'bun'
          : fs.existsSync(path.join(projectPath, 'package-lock.json')) ? 'npm'
            : undefined,
  };
}

export function registerIpc(context: IpcContext): void {
  const { window, terminal, logs } = context;

  const handle = (channel: string, handler: (...args: unknown[]) => Promise<unknown> | unknown): void => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (event, ...args) => {
      assertTrusted(event, window);
      try {
        return await handler(...args);
      } catch (err) {
        if (err instanceof EngineError) throw new Error(err.message);
        throw err instanceof Error ? err : new Error(String(err));
      }
    });
  };

  handle('app:info', () =>
    appInfo({
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    }),
  );
  handle('app:quit', () => {
    app.quit();
  });
  handle('app:minimize', () => window.minimize());
  handle('app:toggle-maximize', () => {
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  handle('app:is-maximized', () => window.isMaximized());

  handle('engine:status', async () => {
    config = loadConfig();
    status = await detectEngine(config.enginePath);
    engine = new EngineClient({ apiBase: status.apiBase, binary: status.binary });
    return status;
  });
  handle('engine:refresh', async () => {
    config = loadConfig();
    status = await detectEngine(config.enginePath);
    engine = new EngineClient({ apiBase: status.apiBase, binary: status.binary });
    return status;
  });
  handle('engine:sites', async () => (await requireHttp()).sites());
  handle('engine:services', async () => (await requireHttp()).services());
  handle('engine:php', async () => (await requireHttp()).phpVersions());
  handle('engine:php-extensions', async (version) => {
    if (typeof version !== 'string' || !/^\d+\.\d+$/.test(version)) throw new Error('invalid PHP version');
    return (await requireHttp()).phpExtensions(version);
  });
  handle('engine:databases', async () => (await requireHttp()).databases());
  handle('engine:version', async () => (await requireHttp()).versionInfo());
  handle('engine:phpmyadmin', async () => {
    try {
      const raw = await (await requireHttp()).request<unknown>('/api/services');
      const list = Array.isArray(raw) ? raw : [];
      const entry = list.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const name = (item as Record<string, unknown>).name;
        return typeof name === 'string' && isRemovedService(name);
      }) as Record<string, unknown> | undefined;
      return entry
        ? { present: true, status: typeof entry.status === 'string' ? entry.status : 'unknown' }
        : { present: false };
    } catch {
      return { present: false };
    }
  });
  handle('engine:install-php', async (version) => {
    if (typeof version !== 'string' || !/^\d+\.\d+$/.test(version)) throw new Error('invalid PHP version');
    const client = await requireHttp();
    const result = await client.installPhp(version, (line) => {
      if (!window.isDestroyed()) window.webContents.send('php:install', { version, line });
    });
    if (result.ok) {
      status = await detectEngine(config.enginePath);
      engine = new EngineClient({ apiBase: status.apiBase, binary: status.binary });
    }
    return result;
  });

  handle('engine:site-action', async (domain, action, query) => {
    const client = await requireHttp();
    if (typeof action !== 'string' || !/^[a-z][a-z0-9:-]*$/i.test(action)) throw new Error('invalid action');
    const params: Record<string, string> = {};
    if (query && typeof query === 'object' && !Array.isArray(query)) {
      for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
        if (typeof value === 'string' && /^[a-z0-9._:-]{1,64}$/i.test(value)) params[key] = value;
      }
    }
    return client.siteAction(validateDomain(domain), action, params);
  });
  handle('engine:set-site-php', async (domain, version) => {
    if (typeof version !== 'string' || !/^\d+\.\d+$/.test(version)) throw new Error('invalid PHP version');
    return (await requireHttp()).setSitePhp(validateDomain(domain), version);
  });
  handle('engine:service-action', async (name, action) => {
    if (typeof name !== 'string' || isRemovedService(name)) throw new Error('service is not managed by VALET');
    if (action !== 'start' && action !== 'stop' && action !== 'restart') throw new Error('invalid service action');
    return (await requireHttp()).serviceAction(name, action);
  });
  handle('engine:set-service-port', async (name, port) => {
    if (typeof name !== 'string' || isRemovedService(name)) throw new Error('service is not managed by VALET');
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid port');
    const taken = await isPortAvailable(port);
    if (!taken.available) throw new Error(`Port ${port} is not available: ${taken.error ?? 'in use'}`);
    return (await requireHttp()).setServicePort(name, port);
  });
  handle('engine:set-service-secondary-port', async (name, containerPort, port) => {
    if (typeof name !== 'string' || isRemovedService(name)) throw new Error('service is not managed by VALET');
    if (typeof containerPort !== 'number' || !Number.isInteger(containerPort) || containerPort < 1 || containerPort > 65535) {
      throw new Error('invalid container port');
    }
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid port');
    const taken = await isPortAvailable(port);
    if (!taken.available) throw new Error(`Port ${port} is not available: ${taken.error ?? 'in use'}`);
    return (await requireHttp()).setServiceSecondaryPort(name, containerPort, port);
  });
  handle('engine:command', async (raw) => {
    const command = raw as EngineCommand;
    if (!command || typeof command !== 'object' || typeof command.id !== 'string') throw new Error('invalid command');
    const client = await ensureEngine();
    const cwd = validateCwd(command.cwd);
    const result = await client.runCommand({ ...command, cwd });
    if (command.id === 'start' || command.id === 'stop') {
      status = await detectEngine(config.enginePath);
      engine = new EngineClient({ apiBase: status.apiBase, binary: status.binary });
    }
    return result;
  });

  handle('ports:scan', async () => {
    const listeners = await scanHostListeners();
    let entries: PortEntry[] = [];
    try {
      const client = await requireHttp();
      const [services, projects] = await Promise.all([client.services(), client.sites()]);
      entries = collectPorts(services, projects, listeners);
    } catch {
      entries = listeners.map((listener) => ({
        hostPort: listener.port,
        address: listener.address,
        protocol: listener.protocol,
        service: listener.process || 'host',
        state: 'listening' as const,
        pid: listener.pid,
        process: listener.process,
      }));
    }
    return entries;
  });
  handle('ports:check', async (port, address) => {
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid port');
    if (typeof address !== 'string' || net.isIP(address) === 0) throw new Error('invalid IP address');
    return isPortAvailable(port, address);
  });
  handle('project:inspect', (target) => {
    const projectPath = validateCwd(target);
    if (!projectPath) throw new Error('invalid project path');
    return inspectProject(projectPath);
  });

  handle('config:get', () => loadConfig());
  handle('config:set', async (patch) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('invalid config patch');
    const candidate = patch as Partial<ValetConfig>;
    if ('enginePath' in candidate && candidate.enginePath) {
      const binary = validateEngineBinary(candidate.enginePath);
      if (!binary) throw new Error('engine path must be an executable lerd or valet-engine binary');
      candidate.enginePath = binary;
    }
    const next = updateConfig(candidate);
    config = next;
    if ('enginePath' in candidate) {
      status = await detectEngine(next.enginePath);
      engine = new EngineClient({ apiBase: status.apiBase, binary: status.binary });
    }
    return next;
  });

  handle('migration:detect', () => detectMigration());
  handle('migration:apply', () => {
    const result = applyMigration();
    return {
      applied: result.applied,
      unchanged: result.unchanged,
      backupDir: result.backupDir,
      plan: result.plan,
    };
  });
  handle('migration:status', () => {
    const summary = adoptionSummary();
    return {
      adopted: summary.adopted,
      manifest: summary.manifest
        ? {
            createdAt: summary.manifest.createdAt,
            mode: summary.manifest.mode,
            backupDir: summary.manifest.backupDir,
            siteCount: summary.manifest.siteCount,
            files: summary.manifest.files,
            bytes: summary.manifest.bytes,
            warnings: summary.manifest.warnings,
          }
        : null,
      plan: summary.plan,
    };
  });

  handle('terminal:create', (options) => {
    const opts = (options ?? {}) as { cwd?: string; project?: string; title?: string };
    const cwd = validateCwd(opts.cwd) ?? process.env.HOME ?? app.getPath('home');
    return terminal.create({ cwd, project: opts.project, title: opts.title });
  });
  handle('terminal:input', (id, data) => {
    if (typeof id !== 'string' || typeof data !== 'string') throw new Error('invalid terminal input');
    terminal.write(id, data);
  });
  handle('terminal:kill', (id) => {
    if (typeof id !== 'string') throw new Error('invalid terminal id');
    terminal.kill(id);
  });
  handle('terminal:list', () => terminal.list());
  handle('terminal:buffer', (id) => {
    if (typeof id !== 'string') throw new Error('invalid terminal id');
    return terminal.buffer(id);
  });

  handle('logs:start', async (unit) => {
    if (typeof unit !== 'string') throw new Error('invalid log unit');
    const client = await requireHttp();
    await logs.start(unit, client.apiBase);
  });
  handle('logs:stop', () => logs.stop());

  handle('dialog:pick-project', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Add a project to VALET',
      properties: ['openDirectory'],
      buttonLabel: 'Use this folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  handle('dialog:pick-engine', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Select the engine binary',
      properties: ['openFile'],
      buttonLabel: 'Use this binary',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  handle('shell:open-path', async (target) => {
    if (typeof target !== 'string' || !path.isAbsolute(target) || target.includes('\0')) throw new Error('invalid path');
    if (!fs.existsSync(target)) throw new Error('path does not exist');
    return shell.openPath(target);
  });
  handle('shell:open-external', async (url) => {
    if (typeof url !== 'string') throw new Error('invalid url');
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('only http(s) links are allowed');
    await shell.openExternal(parsed.toString());
  });
}
