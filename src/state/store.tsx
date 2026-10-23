import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppInfo,
  DatabaseOverview,
  EngineStatus,
  LogsTab,
  PhpMyAdminStatus,
  PhpVersion,
  PortEntry,
  Project,
  ProjectInspection,
  Service,
  Tab,
  TerminalSession,
  ThemeId,
  Toast,
  ValetConfig,
  ViewId,
} from '../../shared/types';
import type { AdoptionStatus, MigrationResult, ValetApi } from '../../shared/api';
import { applyTheme } from '../../shared/theme';
import { isThemeId } from '../../shared/themes';
import { VIEW_META } from '../../shared/format';
import { getTheme } from '../themes';

export function valet(): ValetApi {
  if (typeof window === 'undefined' || !window.valet) {
    throw new Error('VALET native bridge is unavailable. Run the app through Electron.');
  }
  return window.valet;
}

interface AppContextValue {
  config: ValetConfig | null;
  appInfo: AppInfo | null;
  engine: EngineStatus | null;
  projects: Project[];
  services: Service[];
  php: PhpVersion[];
  databases: DatabaseOverview;
  ports: PortEntry[];
  loading: boolean;
  refreshing: boolean;
  selectedProject: string | null;
  selectedProjectData: Project | null;
  inspection: ProjectInspection | null;
  phpMyAdmin: PhpMyAdminStatus | null;
  activeView: ViewId;
  tabs: Tab[];
  activeTabId: string;
  toasts: Toast[];
  problems: string[];
  output: string[];
  paletteOpen: boolean;
  sidebarVisible: boolean;
  logsTab: LogsTab;
  terminalSessions: TerminalSession[];
  adoption: AdoptionStatus | null;
  logUnit: string | null;
  setLogUnit: (unit: string | null) => void;
  setPaletteOpen: (open: boolean) => void;
  openView: (view: ViewId) => void;
  openLogs: (tab?: LogsTab) => void;
  setLogsTab: (tab: LogsTab) => void;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
  selectProject: (domain: string | null) => void;
  refreshAll: () => Promise<void>;
  refreshPorts: () => Promise<void>;
  refreshEngine: () => Promise<void>;
  setTheme: (theme: ThemeId) => Promise<void>;
  notify: (kind: Toast['kind'], message: string) => void;
  dismissToast: (id: string) => void;
  toggleSidebar: () => void;
  addProject: (path: string) => Promise<string | null>;
  removeProject: (project: Project) => Promise<void>;
  setProjectPhp: (domain: string, version: string) => Promise<void>;
  runSiteAction: (domain: string, action: string, query?: Record<string, string>) => Promise<boolean>;
  runServiceAction: (name: string, action: 'start' | 'stop' | 'restart') => Promise<void>;
  setServicePort: (name: string, port: number, containerPort?: number) => Promise<boolean>;
  runEngineCommand: (id: Parameters<ValetApi['engine']['command']>[0]['id'], args?: string[], cwd?: string) => Promise<boolean>;
  installPhp: (version: string) => Promise<{ ok: boolean; error?: string }>;
  removePhpMyAdmin: () => Promise<void>;
  createTerminal: (cwd?: string, project?: string) => Promise<void>;
  killTerminal: (id: string) => Promise<void>;
  refreshTerminalSessions: () => Promise<void>;
  inspectProject: (path: string) => Promise<void>;
  refreshAdoption: () => Promise<void>;
  applyAdoption: () => Promise<MigrationResult | null>;
  updateConfig: (patch: Partial<ValetConfig>) => Promise<void>;
  clearOutput: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [config, setConfig] = useState<ValetConfig | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [php, setPhp] = useState<PhpVersion[]>([]);
  const [databases, setDatabases] = useState<DatabaseOverview>({ engines: [] });
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [inspection, setInspection] = useState<ProjectInspection | null>(null);
  const [phpMyAdmin, setPhpMyAdmin] = useState<PhpMyAdminStatus | null>(null);
  const [activeView, setActiveView] = useState<ViewId>('projects');
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'projects', view: 'projects', title: 'Projects' }]);
  const [activeTabId, setActiveTabId] = useState('projects');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [logsTab, setLogsTab] = useState<LogsTab>('container');
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [adoption, setAdoption] = useState<AdoptionStatus | null>(null);
  const [logUnit, setLogUnit] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
  }, []);

  const notify = useCallback((kind: Toast['kind'], message: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current.slice(-4), { id, kind, message }]);
    const timer = setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      toastTimers.current.delete(id);
    }, kind === 'error' ? 9_000 : 5_000);
    toastTimers.current.set(id, timer);
  }, []);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const refreshAll = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      const status = await valet().engine.status();
      setEngine(status);
      if (status.mode !== 'http') {
        setProjects([]);
        setServices([]);
        setPhp([]);
        setDatabases({ engines: [] });
        setPorts([]);
        setProblems([]);
        return;
      }
      const [sitesResult, servicesResult, phpResult, databasesResult, portsResult, adminResult] = await Promise.allSettled([
        valet().engine.sites(),
        valet().engine.services(),
        valet().engine.php(),
        valet().engine.databases(),
        valet().ports.scan(),
        valet().engine.phpMyAdmin(),
      ]);
      const failures: string[] = [];
      if (sitesResult.status === 'fulfilled') setProjects(sitesResult.value);
      else failures.push(`Projects: ${errorMessage(sitesResult.reason)}`);
      if (servicesResult.status === 'fulfilled') setServices(servicesResult.value);
      else failures.push(`Services: ${errorMessage(servicesResult.reason)}`);
      if (phpResult.status === 'fulfilled') setPhp(phpResult.value);
      else failures.push(`PHP: ${errorMessage(phpResult.reason)}`);
      if (databasesResult.status === 'fulfilled') setDatabases(databasesResult.value);
      else failures.push(`Databases: ${errorMessage(databasesResult.reason)}`);
      if (portsResult.status === 'fulfilled') setPorts(portsResult.value);
      else failures.push(`Ports: ${errorMessage(portsResult.reason)}`);
      if (adminResult.status === 'fulfilled') setPhpMyAdmin(adminResult.value);
      setProblems(failures);
    } catch (err) {
      setProblems([errorMessage(err)]);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const refreshEngine = useCallback(async () => {
    try {
      const status = await valet().engine.refresh();
      setEngine(status);
      notify(status.mode === 'http' ? 'success' : 'warning', status.mode === 'http' ? `Engine ${status.version ?? ''} online` : 'Engine is not running');
      if (status.mode === 'http') await refreshAll();
    } catch (err) {
      notify('error', errorMessage(err));
    }
  }, [notify, refreshAll]);

  const refreshPorts = useCallback(async () => {
    try {
      setPorts(await valet().ports.scan());
    } catch (err) {
      notify('error', errorMessage(err));
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [cfg, info, status] = await Promise.all([valet().config.get(), valet().app.info(), valet().engine.status()]);
        if (cancelled) return;
        setConfig(cfg);
        setAppInfo(info);
        setEngine(status);
        applyTheme(getTheme(cfg.theme), document.documentElement);
        if (status.mode === 'http') await refreshAll();
        else setLoading(false);
      } catch (err) {
        if (!cancelled) {
          notify('error', errorMessage(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // The bootstrap runs once; refreshAll/notify are stable for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void (async () => {
        try {
          const status = await valet().engine.status();
          setEngine((previous) => {
            if (previous?.mode !== 'http' && status.mode === 'http') void refreshAll();
            return status;
          });
        } catch {
          // keep the last known status
        }
      })();
    }, 12_000);
    return () => clearInterval(timer);
  }, [refreshAll]);

  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<string>).detail;
      if (!isThemeId(detail)) return;
      applyTheme(getTheme(detail), document.documentElement);
      setConfig((current) => (current ? { ...current, theme: detail } : current));
      void valet().config.set({ theme: detail });
    };
    window.addEventListener('valet:set-theme', handler);
    return () => window.removeEventListener('valet:set-theme', handler);
  }, []);

  const setTheme = useCallback(async (theme: ThemeId) => {
    applyTheme(getTheme(theme), document.documentElement);
    const next = await valet().config.set({ theme });
    setConfig(next);
  }, []);

  const updateConfig = useCallback(async (patch: Partial<ValetConfig>) => {
    const next = await valet().config.set(patch);
    setConfig(next);
  }, []);

  const openView = useCallback((view: ViewId) => {
    setActiveView(view);
    setTabs((current) => {
      if (current.some((tab) => tab.view === view)) return current;
      return [...current, { id: view, view, title: VIEW_META[view].label }];
    });
    setActiveTabId(view);
  }, []);

  const openLogs = useCallback((tab: LogsTab = 'container') => {
    setLogsTab(tab);
    openView('logs');
  }, [openView]);

  const closeTab = useCallback((id: string) => {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      if (index === -1) return current;
      const next = current.filter((tab) => tab.id !== id);
      if (next.length === 0) {
        setActiveView('projects');
        setActiveTabId('welcome');
        return [];
      }
      if (id === activeTabId) {
        const fallback = next[Math.max(0, index - 1)] ?? next[0];
        if (fallback) {
          setActiveView(fallback.view);
          setActiveTabId(fallback.id);
        }
      }
      return next;
    });
  }, [activeTabId]);

  const selectTab = useCallback((id: string) => {
    setActiveTabId(id);
    setTabs((current) => {
      const tab = current.find((entry) => entry.id === id);
      if (tab) setActiveView(tab.view);
      return current;
    });
  }, []);

  const selectProject = useCallback((domain: string | null) => {
    setSelectedProject(domain);
    setInspection(null);
    if (domain) {
      void valet().config.set({ lastProject: domain }).then(setConfig).catch(() => undefined);
    }
  }, []);

  const selectedProjectData = useMemo(
    () => projects.find((project) => project.domain === selectedProject) ?? null,
    [projects, selectedProject],
  );

  const inspectProject = useCallback(async (projectPath: string) => {
    try {
      setInspection(await valet().project.inspect(projectPath));
    } catch (err) {
      setInspection(null);
      notify('error', errorMessage(err));
    }
  }, [notify]);

  const addProject = useCallback(async (projectPath: string): Promise<string | null> => {
    try {
      const result = await valet().engine.command({ id: 'link', cwd: projectPath });
      if (result.stdout.trim()) setOutput((current) => [...current.slice(-500), result.stdout.trim()]);
      if (result.code !== 0) {
        notify('error', result.stderr.trim() || 'Could not register the project.');
        return null;
      }
      await refreshAll();
      const sites = await valet().engine.sites();
      const match = sites.find((site) => site.path === projectPath);
      if (match) selectProject(match.domain);
      notify('success', `Registered ${match?.name ?? projectPath}`);
      return match?.domain ?? null;
    } catch (err) {
      notify('error', errorMessage(err));
      return null;
    }
  }, [notify, refreshAll, selectProject]);

  const removeProject = useCallback(async (project: Project) => {
    try {
      const result = await valet().engine.command({ id: 'unlink', cwd: project.path });
      if (result.code !== 0) {
        notify('error', result.stderr.trim() || 'Could not unregister the project.');
        return;
      }
      if (selectedProject === project.domain) selectProject(null);
      notify('success', `${project.name} unregistered. Project files were not touched.`);
      await refreshAll();
    } catch (err) {
      notify('error', errorMessage(err));
    }
  }, [notify, refreshAll, selectedProject, selectProject]);

  const setProjectPhp = useCallback(async (domain: string, version: string) => {
    try {
      const result = (await valet().engine.setSitePhp(domain, version)) as { ok?: boolean; warning?: string; error?: string } | null;
      if (result?.error) {
        notify('error', result.error);
        return;
      }
      if (result?.warning) notify('warning', result.warning);
      else notify('success', `${domain} now uses PHP ${version}`);
      await refreshAll();
    } catch (err) {
      notify('error', errorMessage(err));
      // setSitePhp restores the previous pin when the switch fails. Re-read the
      // authoritative state instead of guessing what the engine left behind.
      await refreshAll();
    }
  }, [notify, refreshAll]);

  const runSiteAction = useCallback(async (domain: string, action: string, query: Record<string, string> = {}): Promise<boolean> => {
    try {
      const result = (await valet().engine.siteAction(domain, action, query)) as { ok?: boolean; warning?: string; error?: string } | null;
      if (result?.error) {
        notify('error', result.error);
        return false;
      }
      const label = action === 'service:add' ? 'service added'
        : action === 'service:remove' ? 'service detached'
          : action === 'service:declare' ? 'service declared'
            : action === 'service:dismiss' ? 'suggestion dismissed'
              : action;
      if (result?.warning) notify('warning', result.warning);
      else notify('success', `${domain}: ${label} completed`);
      await refreshAll();
      return true;
    } catch (err) {
      notify('error', errorMessage(err));
      await refreshAll();
      return false;
    }
  }, [notify, refreshAll]);

  const runServiceAction = useCallback(async (name: string, action: 'start' | 'stop' | 'restart') => {
    try {
      if (action === 'start') {
        const service = services.find((entry) => entry.name === name);
        const running = service ? ['active', 'running'].includes(service.status.toLowerCase()) : false;
        if (service?.portConflicts?.length) {
          const detail = service.portConflicts.map((conflict) => `${conflict.port}${conflict.label ? ` (${conflict.label})` : ''}`).join(', ');
          notify('error', `The engine reports busy ports for ${name}: ${detail}. Move the managed port first; VALET will not stop the other process.`);
          return;
        }
        if (service?.port && !running) {
          const availability = await valet().ports.check(service.port);
          if (!availability.available) {
            notify('error', `Port ${service.port} is not available: ${availability.error ?? 'in use'}. Move the managed port first; VALET will not stop the other process.`);
            return;
          }
        }
      }
      await valet().engine.serviceAction(name, action);
      notify('success', `${name}: ${action} requested`);
      await refreshAll();
    } catch (err) {
      notify('error', errorMessage(err));
      await refreshAll();
    }
  }, [notify, refreshAll, services]);

  const setServicePort = useCallback(async (name: string, port: number, containerPort?: number): Promise<boolean> => {
    try {
      if (containerPort) {
        await valet().engine.setServiceSecondaryPort(name, containerPort, port);
        notify('success', `${name} now publishes container port ${containerPort} on host port ${port}`);
      } else {
        await valet().engine.setServicePort(name, port);
        notify('success', `${name} now publishes host port ${port}`);
      }
      await refreshAll();
      return true;
    } catch (err) {
      notify('error', errorMessage(err));
      await refreshAll();
      return false;
    }
  }, [notify, refreshAll]);

  const runEngineCommand = useCallback(async (id: Parameters<ValetApi['engine']['command']>[0]['id'], args?: string[], cwd?: string): Promise<boolean> => {
    try {
      setOutput((current) => [...current.slice(-500), `$ valet ${id}${args?.length ? ` ${args.join(' ')}` : ''}`]);
      const result = await valet().engine.command({ id, args, cwd });
      if (result.stdout.trim()) setOutput((current) => [...current.slice(-500), result.stdout.trim()]);
      if (result.stderr.trim()) setOutput((current) => [...current.slice(-500), result.stderr.trim()]);
      if (result.code !== 0) {
        notify('error', result.stderr.trim() || `valet ${id} exited with code ${result.code ?? 'unknown'}`);
        return false;
      }
      notify('success', `valet ${id} completed`);
      await refreshAll();
      return true;
    } catch (err) {
      notify('error', errorMessage(err));
      return false;
    }
  }, [notify, refreshAll]);

  useEffect(() => {
    const remove = valet().engine.onPhpInstall(({ version, line }) => {
      if (!line.trim()) return;
      setOutput((current) => [...current.slice(-800), `[php ${version}] ${line.trimEnd()}`]);
    });
    return remove;
  }, []);

  const installPhp = useCallback(async (version: string) => {
    try {
      notify('info', `Building PHP ${version}. Real engine output is streaming to Logs → Engine output.`);
      setOutput((current) => [...current.slice(-800), `$ valet php install ${version}`]);
      const result = await valet().engine.installPhp(version);
      if (!result.ok) {
        notify('error', result.error ?? `PHP ${version} could not be installed.`);
        setProblems((current) => [...current.slice(-20), `PHP ${version}: ${result.error ?? 'install failed'}`]);
        return result;
      }
      notify('success', `PHP ${version} installed.`);
      await refreshAll();
      return result;
    } catch (err) {
      const message = errorMessage(err);
      notify('error', message);
      setProblems((current) => [...current.slice(-20), `PHP ${version}: ${message}`]);
      return { ok: false, error: message };
    }
  }, [notify, refreshAll]);

  const removePhpMyAdmin = useCallback(async () => {
    try {
      const result = await valet().engine.command({ id: 'remove-phpmyadmin' });
      if (result.stdout.trim()) setOutput((current) => [...current.slice(-500), result.stdout.trim()]);
      if (result.code !== 0) {
        notify('error', result.stderr.trim() || 'Could not remove the legacy phpMyAdmin container.');
        return;
      }
      notify('success', 'Legacy phpMyAdmin container removed. Database engines and volumes were not touched.');
      await refreshAll();
    } catch (err) {
      notify('error', errorMessage(err));
    }
  }, [notify, refreshAll]);

  const refreshTerminalSessions = useCallback(async () => {
    try {
      setTerminalSessions(await valet().terminal.list());
    } catch {
      // terminal list is best-effort
    }
  }, []);

  const createTerminal = useCallback(async (cwd?: string, project?: string) => {
    try {
      const target = cwd ?? selectedProjectData?.path ?? appInfo?.home;
      if (!target) throw new Error('No working directory available yet.');
      const session = await valet().terminal.create({ cwd: target, project: project ?? (cwd ? undefined : selectedProjectData?.domain) });
      setTerminalSessions((current) => [...current, session]);
      openView('terminal');
    } catch (err) {
      notify('error', errorMessage(err));
    }
  }, [appInfo?.home, notify, openView, selectedProjectData?.path, selectedProjectData?.domain]);

  const killTerminal = useCallback(async (id: string) => {
    try {
      await valet().terminal.kill(id);
      setTerminalSessions((current) => current.filter((session) => session.id !== id));
    } catch (err) {
      notify('error', errorMessage(err));
    }
  }, [notify]);

  const refreshAdoption = useCallback(async () => {
    try {
      setAdoption(await valet().migration.status());
    } catch (err) {
      notify('error', errorMessage(err));
    }
  }, [notify]);

  const applyAdoption = useCallback(async (): Promise<MigrationResult | null> => {
    try {
      const result = await valet().migration.apply();
      await refreshAdoption();
      notify(result.applied ? 'success' : 'info', result.applied ? `Verified backup created at ${result.backupDir}` : 'Existing installation was already adopted.');
      return result;
    } catch (err) {
      notify('error', errorMessage(err));
      return null;
    }
  }, [notify, refreshAdoption]);

  const toggleSidebar = useCallback(() => setSidebarVisible((visible) => !visible), []);
  const clearOutput = useCallback(() => setOutput([]), []);

  const value: AppContextValue = {
    config,
    appInfo,
    engine,
    projects,
    services,
    php,
    databases,
    ports,
    loading,
    refreshing,
    selectedProject,
    selectedProjectData,
    inspection,
    phpMyAdmin,
    activeView,
    tabs,
    activeTabId,
    toasts,
    problems,
    output,
    paletteOpen,
    sidebarVisible,
    logsTab,
    terminalSessions,
    adoption,
    logUnit,
    setLogUnit,
    setPaletteOpen,
    openView,
    openLogs,
    setLogsTab,
    closeTab,
    selectTab,
    selectProject,
    refreshAll,
    refreshPorts,
    refreshEngine,
    setTheme,
    notify,
    dismissToast,
    toggleSidebar,
    addProject,
    removeProject,
    setProjectPhp,
    runSiteAction,
    runServiceAction,
    setServicePort,
    runEngineCommand,
    installPhp,
    removePhpMyAdmin,
    createTerminal,
    killTerminal,
    refreshTerminalSessions,
    inspectProject,
    refreshAdoption,
    applyAdoption,
    updateConfig,
    clearOutput,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
