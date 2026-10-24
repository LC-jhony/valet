import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_THEME_ID, isThemeId } from './themes';
import type { AppInfo, ValetConfig } from './types';

const CONFIG_VERSION = 1;

function envPath(name: string): string | null {
  const value = process.env[name];
  return value && path.isAbsolute(value) ? value : null;
}

export function xdgConfigHome(): string {
  return envPath('XDG_CONFIG_HOME') ?? path.join(os.homedir(), '.config');
}

export function xdgDataHome(): string {
  return envPath('XDG_DATA_HOME') ?? path.join(os.homedir(), '.local', 'share');
}

export function xdgStateHome(): string {
  return envPath('XDG_STATE_HOME') ?? path.join(os.homedir(), '.local', 'state');
}

export function valetConfigDir(): string {
  return envPath('VALET_CONFIG_HOME') ?? path.join(xdgConfigHome(), 'valet');
}

export function valetDataDir(): string {
  return envPath('VALET_DATA_HOME') ?? path.join(xdgDataHome(), 'valet');
}

export function valetStateDir(): string {
  return envPath('VALET_STATE_HOME') ?? path.join(xdgStateHome(), 'valet');
}

export function valetCacheDir(): string {
  return envPath('VALET_CACHE_HOME') ?? path.join(xdgCacheHome(), 'valet');
}

export function xdgCacheHome(): string {
  return envPath('XDG_CACHE_HOME') ?? path.join(os.homedir(), '.cache');
}

export function valetLogsDir(): string {
  return path.join(valetStateDir(), 'logs');
}

export function configFile(): string {
  return path.join(valetConfigDir(), 'desktop.json');
}

export function adoptionFile(): string {
  return path.join(valetConfigDir(), 'adoption.json');
}

export function defaultConfig(): ValetConfig {
  return {
    version: CONFIG_VERSION,
    theme: DEFAULT_THEME_ID,
    enginePath: null,
    lastProject: null,
    recentProjects: [],
    sidebarWidth: 272,
    telemetry: false,
  };
}

export function normalizeConfig(raw: unknown): ValetConfig {
  const base = defaultConfig();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const record = raw as Record<string, unknown>;
  return {
    version: CONFIG_VERSION,
    theme: isThemeId(record.theme) ? record.theme : base.theme,
    enginePath: typeof record.enginePath === 'string' && record.enginePath ? record.enginePath : null,
    lastProject: typeof record.lastProject === 'string' && record.lastProject ? record.lastProject : null,
    recentProjects: Array.isArray(record.recentProjects)
      ? record.recentProjects.filter((item): item is string => typeof item === 'string').slice(0, 20)
      : [],
    sidebarWidth: typeof record.sidebarWidth === 'number' && record.sidebarWidth >= 180 && record.sidebarWidth <= 480
      ? record.sidebarWidth
      : base.sidebarWidth,
    telemetry: false,
  };
}

export function loadConfig(): ValetConfig {
  try {
    const text = fs.readFileSync(configFile(), 'utf8');
    return normalizeConfig(JSON.parse(text));
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: ValetConfig): ValetConfig {
  const normalized = normalizeConfig({ ...config, version: CONFIG_VERSION, telemetry: false });
  const dir = valetConfigDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = path.join(dir, `.desktop.json.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temp, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, configFile());
  return normalized;
}

export function updateConfig(patch: Partial<ValetConfig>): ValetConfig {
  const current = loadConfig();
  return saveConfig({ ...current, ...patch, version: CONFIG_VERSION, telemetry: false });
}

export function appInfo(versions: { electron: string; chrome: string; node: string }): AppInfo {
  return {
    name: 'VALET',
    version: process.env.VALET_VERSION ?? '1.0.0',
    electron: versions.electron,
    chrome: versions.chrome,
    node: versions.node,
    platform: process.platform,
    arch: process.arch,
    home: os.homedir(),
    configDir: valetConfigDir(),
    dataDir: valetDataDir(),
    logsDir: valetLogsDir(),
    legacyDirs: [
      path.join(os.homedir(), '.config', 'lerd'),
      path.join(os.homedir(), '.local', 'share', 'lerd'),
      path.join(os.homedir(), '.cache', 'lerd'),
    ],
  };
}

export function sha256File(file: string): string | null {
  try {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(file));
    return hash.digest('hex');
  } catch {
    return null;
  }
}

export function dirSize(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (current: string, depth: number): void => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(full);
          files += 1;
          bytes += stat.size;
        } catch {
          // ignore unreadable files
        }
      }
    }
  };
  walk(dir, 0);
  return { files, bytes };
}
