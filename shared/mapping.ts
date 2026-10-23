/**
 * Command correspondence between the upstream engine and VALET.
 *
 * The engine is invoked as-is. VALET owns the user-facing vocabulary, so the
 * mapping is explicit instead of a blind string replacement.
 */

export interface CommandMapping {
  valet: string;
  engine: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

export const COMMAND_MAP: CommandMapping[] = [
  { valet: 'valet projects', engine: 'GET /api/sites', description: 'List registered projects', risk: 'low' },
  { valet: 'valet projects add <path>', engine: 'lerd link (cwd)', description: 'Register an existing folder in place', risk: 'medium' },
  { valet: 'valet projects remove <domain>', engine: 'POST /api/sites/{domain}/unlink', description: 'Unregister a site; files and data stay', risk: 'medium' },
  { valet: 'valet projects php <domain> <version>', engine: 'POST /api/sites/{domain}/php', description: 'Pin PHP to one project', risk: 'medium' },
  { valet: 'valet start', engine: 'lerd start', description: 'Start DNS, Nginx, PHP-FPM and services', risk: 'low' },
  { valet: 'valet stop', engine: 'lerd stop', description: 'Stop engine containers', risk: 'low' },
  { valet: 'valet restart', engine: 'lerd restart', description: 'Restart the engine', risk: 'low' },
  { valet: 'valet status', engine: 'GET /api/version + API lists', description: 'Show engine and VALET status', risk: 'low' },
  { valet: 'valet doctor', engine: 'VALET checks (+ optional lerd doctor)', description: 'Read-only environment diagnostics', risk: 'low' },
  { valet: 'valet services', engine: 'GET /api/services', description: 'List services; phpMyAdmin filtered', risk: 'low' },
  { valet: 'valet services start|stop|restart <name>', engine: 'POST /api/services/{name}/{action}', description: 'Control one service', risk: 'medium' },
  { valet: 'valet services port <name> <port>', engine: 'POST /api/services/{name}/ports', description: 'Change a host port mapping', risk: 'medium' },
  { valet: 'valet services remove <name>', engine: 'POST /api/services/{name}/remove', description: 'Remove a service container (confirmed)', risk: 'high' },
  { valet: 'valet php', engine: 'GET /api/php-versions', description: 'List installed and available PHP runtimes', risk: 'low' },
  { valet: 'valet php install <version>', engine: 'POST /api/php-versions/install', description: 'Build a PHP runtime and stream output', risk: 'medium' },
  { valet: 'valet php pin <domain> <version>', engine: 'POST /api/sites/{domain}/php', description: 'Pin PHP to one project', risk: 'medium' },
  { valet: 'valet php use <version>', engine: 'lerd use <version>', description: 'Set the engine global PHP (confirmed)', risk: 'medium' },
  { valet: 'valet ports', engine: 'HTTP API + host socket scan', description: 'Show host listeners, mappings and conflicts', risk: 'low' },
  { valet: 'valet ports check <port>', engine: 'Host socket bind', description: 'Check availability without stopping anything', risk: 'low' },
  { valet: 'valet logs [unit]', engine: 'SSE /api/logs/{unit}', description: 'Stream engine, Nginx, PHP or service logs', risk: 'low' },
  { valet: 'valet open [domain]', engine: 'lerd dashboard / GET /api/sites', description: 'Open the dashboard or a project URL', risk: 'low' },
  { valet: 'valet config', engine: '~/.config/valet/desktop.json', description: 'Read or update desktop settings', risk: 'low' },
  { valet: 'valet theme <id>', engine: '~/.config/valet/desktop.json', description: 'Switch the desktop theme', risk: 'low' },
  { valet: 'valet migrate', engine: 'VALET migration', description: 'Adopt an existing engine install without moving data', risk: 'medium' },
  { valet: 'valet phpmyadmin remove', engine: 'lerd service remove phpmyadmin', description: 'Remove only the retired container (confirmed)', risk: 'high' },
];

export const ENGINE_IDENTIFIERS = [
  'lerd binary and its module path',
  '~/.config/lerd, ~/.local/share/lerd, ~/.cache/lerd',
  'Podman containers and quadlets named lerd-*',
  'sites.yaml, config.yaml and persisted engine keys',
  '.lerd.yaml project file',
  'the local CA and certificates issued by mkcert',
];

export function engineCommandFor(valetCommand: string): string | null {
  const normalized = valetCommand.trim().replace(/\s+/g, ' ');
  return COMMAND_MAP.find((entry) => entry.valet === normalized)?.engine ?? null;
}
