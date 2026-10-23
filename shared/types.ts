/**
 * Shared domain types for the VALET desktop app, CLI and tests.
 *
 * The shapes mirror the JSON exposed by the Lerd engine (`/api/...`). The
 * engine keeps its internal identifiers; VALET maps them at this boundary.
 */

import type { ThemeId } from './themes';

export type { ThemeId } from './themes';

export type EngineMode = 'http' | 'cli' | 'offline';

export interface EngineStatus {
  mode: EngineMode;
  version: string | null;
  apiBase: string;
  binary: string | null;
  checkedAt: number;
  platform: NodeJS.Platform | string;
  wsl: boolean;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  domains: string[];
  path: string;
  phpVersion: string;
  phpMin?: string;
  phpMax?: string;
  nodeVersion: string;
  framework: string;
  frameworkLabel: string;
  tls: boolean;
  paused: boolean;
  fpmRunning: boolean;
  usesPhp: boolean;
  lastActive?: number;
  requestCount?: number;
  queueRunning: boolean;
  queueFailing?: boolean;
  scheduleRunning?: boolean;
  hasQueueWorker?: boolean;
  hasScheduleWorker?: boolean;
  workers?: ProjectWorker[];
  runtime?: string;
  services?: string[];
  declaredServices?: string[];
  suggestedServices?: ServiceSuggestion[];
  lanPort?: number;
  publicPort?: number;
  devServerPort?: number;
}

export interface ServicePortMapping {
  container: number;
  default: number;
  published?: number;
}

export interface ServicePortConflict {
  port: string;
  label?: string;
}

export interface Service {
  name: string;
  status: string;
  version?: string;
  port?: number;
  defaultPort?: number;
  publishedPort?: number;
  secondaryPorts?: ServicePortMapping[];
  extraPorts?: string[];
  portConflicts?: ServicePortConflict[];
  dashboard?: string;
  category?: string;
  isDatabase: boolean;
  siteCount: number;
  siteDomains: string[];
  custom: boolean;
  preset: boolean;
}

export interface PhpVersion {
  version: string;
  installed: boolean;
  /** Present for installed runtimes when the engine status endpoint answers. */
  running?: boolean;
  default?: boolean;
  patch?: string;
  xdebugMode?: string;
  ports?: string[];
  updateAvailable?: boolean;
}

export interface PhpSetState {
  declared: string[];
  has: string[];
  cannot: string[];
}

export interface PhpExtensionsReport {
  version: string;
  built: boolean;
  needsRebuild: boolean;
  extensions: PhpSetState;
  packages: PhpSetState;
  modules: string[];
  modulesError?: string;
}

export interface ProjectWorker {
  name: string;
  label: string;
  running: boolean;
  failing: boolean;
  unreachable: boolean;
}

export interface ServiceSuggestion {
  name: string;
  reason?: string;
  package?: string;
}

export type PortState = 'listening' | 'configured' | 'conflict';

export interface PortEntry {
  hostPort: number;
  containerPort?: number;
  address: string;
  protocol: 'tcp' | 'udp';
  service: string;
  project?: string;
  state: PortState;
  process?: string;
  pid?: number;
  detail?: string;
}

export interface DatabaseSummary {
  name: string;
  engine: string;
  site?: string;
  size?: string;
}

export interface DatabaseOverview {
  engines: Array<{
    name: string;
    status: string;
    databases: DatabaseSummary[];
  }>;
}

export interface LogSource {
  id: string;
  label: string;
  kind: 'app' | 'service' | 'php' | 'nginx';
  unit: string;
}

export interface MigrationEntry {
  source: string;
  destination: string;
  exists: boolean;
  fileCount: number;
  bytes: number;
}

export interface MigrationPlan {
  detected: boolean;
  legacyEngine: {
    found: boolean;
    binary: string | null;
    configDir: string;
    dataDir: string;
    sitesFile: string;
    siteCount: number;
  };
  entries: MigrationEntry[];
  warnings: string[];
}

export interface ValetConfig {
  version: 1;
  theme: ThemeId;
  enginePath: string | null;
  lastProject: string | null;
  recentProjects: string[];
  sidebarWidth: number;
  telemetry: false;
}

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  arch: string;
  home: string;
  configDir: string;
  dataDir: string;
  logsDir: string;
  legacyDirs: string[];
}

export interface ProjectInspection {
  path: string;
  composerPhp?: string;
  framework?: string;
  hasComposer: boolean;
  hasNode: boolean;
  hasGit: boolean;
  packageManager?: string;
}

export interface PhpMyAdminStatus {
  present: boolean;
  status?: string;
}


export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  project: string | null;
  createdAt: number;
  alive: boolean;
}

export interface TerminalDataEvent {
  id: string;
  data: string;
}

export interface TerminalExitEvent {
  id: string;
  code: number | null;
}

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface EngineCommand {
  id:
    | 'start'
    | 'stop'
    | 'restart'
    | 'doctor'
    | 'version'
    | 'link'
    | 'unlink'
    | 'use-php'
    | 'isolate-php'
    | 'logs'
    | 'open'
    | 'service-start'
    | 'service-stop'
    | 'service-restart'
    | 'service-remove'
    | 'remove-phpmyadmin';
  args?: string[];
  cwd?: string;
}

export type ViewId =
  | 'projects'
  | 'php'
  | 'services'
  | 'ports'
  | 'databases'
  | 'terminal'
  | 'logs'
  | 'settings';

export type LogsTab = 'container' | 'output' | 'problems';

export interface Tab {
  id: string;
  view: ViewId;
  title: string;
  projectDomain?: string;
}

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
