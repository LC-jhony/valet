import { contextBridge, ipcRenderer } from 'electron';
import type { ValetApi } from '../shared/api';
import type { EngineCommand, ValetConfig } from '../shared/types';

const api: ValetApi = {
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    quit: () => ipcRenderer.invoke('app:quit'),
    minimize: () => ipcRenderer.invoke('app:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('app:toggle-maximize'),
    isMaximized: () => ipcRenderer.invoke('app:is-maximized'),
    onMaximized: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, maximized: boolean): void => callback(maximized);
      ipcRenderer.on('window:maximized', listener);
      return () => ipcRenderer.removeListener('window:maximized', listener);
    },
  },
  engine: {
    status: () => ipcRenderer.invoke('engine:status'),
    refresh: () => ipcRenderer.invoke('engine:refresh'),
    sites: () => ipcRenderer.invoke('engine:sites'),
    services: () => ipcRenderer.invoke('engine:services'),
    php: () => ipcRenderer.invoke('engine:php'),
    phpExtensions: (version) => ipcRenderer.invoke('engine:php-extensions', version),
    databases: () => ipcRenderer.invoke('engine:databases'),
    siteAction: (domain, action, query) => ipcRenderer.invoke('engine:site-action', domain, action, query),
    setSitePhp: (domain, version) => ipcRenderer.invoke('engine:set-site-php', domain, version),
    serviceAction: (name, action) => ipcRenderer.invoke('engine:service-action', name, action),
    setServicePort: (name, port) => ipcRenderer.invoke('engine:set-service-port', name, port),
    setServiceSecondaryPort: (name, containerPort, port) =>
      ipcRenderer.invoke('engine:set-service-secondary-port', name, containerPort, port),
    command: (command: EngineCommand) => ipcRenderer.invoke('engine:command', command),
    version: () => ipcRenderer.invoke('engine:version'),
    phpMyAdmin: () => ipcRenderer.invoke('engine:phpmyadmin'),
    installPhp: (version) => ipcRenderer.invoke('engine:install-php', version),
    onPhpInstall: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { version: string; line: string }): void => callback(payload);
      ipcRenderer.on('php:install', listener);
      return () => ipcRenderer.removeListener('php:install', listener);
    },
  },
  ports: {
    scan: () => ipcRenderer.invoke('ports:scan'),
    check: (port, address) => ipcRenderer.invoke('ports:check', port, address),
  },
  project: {
    inspect: (target) => ipcRenderer.invoke('project:inspect', target),
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (patch: Partial<ValetConfig>) => ipcRenderer.invoke('config:set', patch),
  },
  migration: {
    detect: () => ipcRenderer.invoke('migration:detect'),
    apply: () => ipcRenderer.invoke('migration:apply'),
    status: () => ipcRenderer.invoke('migration:status'),
  },
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    input: (id, data) => {
      // Fire-and-forget to keep keystroke latency low, but still route through
      // the validated invoke handler instead of the unhandled send channel.
      void ipcRenderer.invoke('terminal:input', id, data).catch(() => undefined);
    },
    kill: (id) => ipcRenderer.invoke('terminal:kill', id),
    list: () => ipcRenderer.invoke('terminal:list'),
    buffer: (id) => ipcRenderer.invoke('terminal:buffer', id),
    onData: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }): void => callback(payload);
      ipcRenderer.on('terminal:data', listener);
      return () => ipcRenderer.removeListener('terminal:data', listener);
    },
    onExit: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; code: number | null }): void => callback(payload);
      ipcRenderer.on('terminal:exit', listener);
      return () => ipcRenderer.removeListener('terminal:exit', listener);
    },
  },
  logs: {
    start: (unit) => ipcRenderer.invoke('logs:start', unit),
    stop: () => ipcRenderer.invoke('logs:stop'),
    onData: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { unit: string; line: string }): void => callback(payload);
      ipcRenderer.on('logs:data', listener);
      return () => ipcRenderer.removeListener('logs:data', listener);
    },
    onError: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { message: string }): void => callback(payload);
      ipcRenderer.on('logs:error', listener);
      return () => ipcRenderer.removeListener('logs:error', listener);
    },
  },
  dialog: {
    pickProject: () => ipcRenderer.invoke('dialog:pick-project'),
    pickEngine: () => ipcRenderer.invoke('dialog:pick-engine'),
  },
  shell: {
    openPath: (target) => ipcRenderer.invoke('shell:open-path', target),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },
};

contextBridge.exposeInMainWorld('valet', api);
