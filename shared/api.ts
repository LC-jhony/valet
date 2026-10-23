import type {
  AppInfo,
  CommandResult,
  DatabaseOverview,
  EngineCommand,
  EngineStatus,
  MigrationPlan,
  PhpExtensionsReport,
  PhpMyAdminStatus,
  PhpVersion,
  PortEntry,
  Project,
  ProjectInspection,
  Service,
  TerminalSession,
  ValetConfig,
} from './types';

export interface MigrationResult {
  applied: boolean;
  unchanged: boolean;
  backupDir: string | null;
  plan: MigrationPlan;
}

export interface AdoptionStatus {
  adopted: boolean;
  manifest: {
    createdAt: string;
    mode: 'in-place';
    backupDir: string;
    siteCount: number;
    files: number;
    bytes: number;
    warnings: string[];
  } | null;
  plan: MigrationPlan;
}

export interface LogEvent {
  unit: string;
  line: string;
}

/**
 * The only bridge exposed to the renderer. No `exec`, no free-form paths, no
 * Node primitives. Every method is implemented in the main process with an
 * allow-list and validation.
 */
export interface ValetApi {
  app: {
    info(): Promise<AppInfo>;
    quit(): Promise<void>;
    minimize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    isMaximized(): Promise<boolean>;
    onMaximized(callback: (maximized: boolean) => void): () => void;
  };
  engine: {
    status(): Promise<EngineStatus>;
    refresh(): Promise<EngineStatus>;
    sites(): Promise<Project[]>;
    services(): Promise<Service[]>;
    php(): Promise<PhpVersion[]>;
    phpExtensions(version: string): Promise<PhpExtensionsReport>;
    databases(): Promise<DatabaseOverview>;
    siteAction(domain: string, action: string, query?: Record<string, string>): Promise<unknown>;
    setSitePhp(domain: string, version: string): Promise<unknown>;
    serviceAction(name: string, action: 'start' | 'stop' | 'restart'): Promise<unknown>;
    setServicePort(name: string, port: number): Promise<unknown>;
    setServiceSecondaryPort(name: string, containerPort: number, port: number): Promise<unknown>;
    command(command: EngineCommand): Promise<CommandResult>;
    version(): Promise<{ current: string; latest?: string; hasUpdate?: boolean } | null>;
    phpMyAdmin(): Promise<PhpMyAdminStatus>;
    installPhp(version: string): Promise<{ ok: boolean; error?: string }>;
    onPhpInstall(callback: (event: { version: string; line: string }) => void): () => void;
  };
  ports: {
    scan(): Promise<PortEntry[]>;
    check(port: number, address?: string): Promise<{ available: boolean; error?: string }>;
  };
  project: {
    inspect(path: string): Promise<ProjectInspection>;
  };
  config: {
    get(): Promise<ValetConfig>;
    set(patch: Partial<ValetConfig>): Promise<ValetConfig>;
  };
  migration: {
    detect(): Promise<MigrationPlan>;
    apply(): Promise<MigrationResult>;
    status(): Promise<AdoptionStatus>;
  };
  terminal: {
    create(options: { cwd: string; project?: string; title?: string }): Promise<TerminalSession>;
    input(id: string, data: string): void;
    kill(id: string): Promise<void>;
    list(): Promise<TerminalSession[]>;
    buffer(id: string): Promise<string>;
    onData(callback: (event: { id: string; data: string }) => void): () => void;
    onExit(callback: (event: { id: string; code: number | null }) => void): () => void;
  };
  logs: {
    start(unit: string): Promise<void>;
    stop(): Promise<void>;
    onData(callback: (event: LogEvent) => void): () => void;
    onError(callback: (event: { message: string }) => void): () => void;
  };
  dialog: {
    pickProject(): Promise<string | null>;
    pickEngine(): Promise<string | null>;
  };
  shell: {
    openPath(target: string): Promise<string>;
    openExternal(url: string): Promise<void>;
  };
}
