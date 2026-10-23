/**
 * Port model shared by the desktop UI and the `valet ports` command.
 * Pure functions only: no sockets, no child processes.
 */

import type { PortEntry, Project, Service } from './types';

export interface Listener {
  port: number;
  address: string;
  protocol: 'tcp' | 'udp';
  pid?: number;
  process?: string;
}

export function parseSsOutput(output: string): Listener[] {
  const listeners: Listener[] = [];
  for (const line of output.split('\n')) {
    // `ss -H -ltnup` prefixes the netid. Older callers passed `ss -ltnp`,
    // which starts at State; accept both so the scanner stays compatible.
    const match = line.match(/^(?:(tcp|udp)\s+)?(?:LISTEN|UNCONN)\s+\d+\s+\d+\s+(\S+):(\d+)\s+/);
    if (!match) continue;
    const protocol = match[1] ?? 'tcp';
    const address = match[2];
    const port = Number(match[3]);
    if (!address || !Number.isInteger(port) || port < 1) continue;
    const pidMatch = line.match(/pid=(\d+)/);
    const processMatch = line.match(/users:\(\("([^"]+)"/);
    listeners.push({
      protocol: protocol as 'tcp' | 'udp',
      address,
      port,
      pid: pidMatch ? Number(pidMatch[1]) : undefined,
      process: processMatch?.[1],
    });
  }
  return listeners;
}

export function parseLsofOutput(output: string): Listener[] {
  const listeners: Listener[] = [];
  for (const line of output.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const process = parts[0];
    const pid = Number(parts[1]);
    const address = parts[8];
    if (!address) continue;
    const match = address.match(/^(.*):(\d+)$/);
    if (!match) continue;
    const portText = match[2];
    if (!portText) continue;
    const port = Number(portText);
    if (!Number.isInteger(port) || port < 1) continue;
    listeners.push({
      port,
      address: (match[1] ?? '').replace(/^\[|\]$/g, '') || '127.0.0.1',
      protocol: 'tcp',
      pid: Number.isInteger(pid) ? pid : undefined,
      process,
    });
  }
  return listeners;
}

export function collectPorts(services: Service[], projects: Project[], listeners: Listener[]): PortEntry[] {
  const entries: PortEntry[] = [];
  const managedOwners = new Map<string, number>();
  const keyFor = (protocol: 'tcp' | 'udp', port: number): string => `${protocol}:${port}`;
  const listenersByKey = new Map<string, Listener[]>();
  for (const listener of listeners) {
    const key = keyFor(listener.protocol, listener.port);
    const list = listenersByKey.get(key) ?? [];
    list.push(listener);
    listenersByKey.set(key, list);
  }
  const isWildcard = (address: string): boolean => ['0.0.0.0', '::', '[::]', '*'].includes(address);
  const loopbackListener = (port: number): Listener | undefined => {
    const list = listenersByKey.get(keyFor('tcp', port)) ?? [];
    return list.find((listener) => listener.address === '127.0.0.1' || listener.address === '::1' || listener.address === '[::1]')
      ?? list.find((listener) => isWildcard(listener.address));
  };
  const anyListener = (port: number): Listener | undefined => listenersByKey.get(keyFor('tcp', port))?.[0];
  const managedAddresses = new Set<string>();
  const add = (entry: PortEntry, managed: boolean): void => {
    entries.push(entry);
    if (!managed) return;
    const key = keyFor(entry.protocol, entry.hostPort);
    managedOwners.set(key, (managedOwners.get(key) ?? 0) + 1);
    managedAddresses.add(`${key}:${entry.address}`);
  };

  const managedProcess = (processName: string | undefined, names: string[]): boolean => {
    if (!processName) return true;
    const value = processName.toLowerCase();
    if (names.some((name) => name && value.includes(name.toLowerCase()))) return true;
    return ['rootlessport', 'podman', 'conmon', 'slirp4netns', 'gvproxy', 'pasta', 'nginx'].some((name) => value.includes(name));
  };

  for (const service of services) {
    const addServicePort = (hostPort: number, containerPort?: number): void => {
      const listener = loopbackListener(hostPort);
      const expected = !listener?.process || managedProcess(listener.process, [service.name]);
      add({
        hostPort,
        containerPort,
        address: '127.0.0.1',
        protocol: 'tcp',
        service: service.name,
        state: listener ? (expected ? 'listening' : 'conflict') : 'configured',
        process: listener?.process,
        pid: listener?.pid,
        detail: service.version,
      }, true);
    };
    if (service.port) addServicePort(service.port);
    for (const mapping of service.secondaryPorts ?? []) {
      const hostPort = mapping.published || mapping.default;
      if (hostPort > 0) addServicePort(hostPort, mapping.container);
    }
  }

  for (const project of projects) {
    if (project.lanPort) {
      const listener = anyListener(project.lanPort);
      const expected = !listener?.process || managedProcess(listener.process, []);
      add({
        hostPort: project.lanPort,
        address: '0.0.0.0',
        protocol: 'tcp',
        service: 'site-lan',
        project: project.domain,
        state: listener ? (expected ? 'listening' : 'conflict') : 'configured',
        process: listener?.process,
        pid: listener?.pid,
      }, true);
    }
    if (project.publicPort) {
      const listener = anyListener(project.publicPort);
      const expected = !listener?.process || managedProcess(listener.process, []);
      add({
        hostPort: project.publicPort,
        address: '0.0.0.0',
        protocol: 'tcp',
        service: 'site-public',
        project: project.domain,
        state: listener ? (expected ? 'listening' : 'conflict') : 'configured',
        process: listener?.process,
        pid: listener?.pid,
      }, true);
    }
    if (project.devServerPort) {
      const listener = loopbackListener(project.devServerPort);
      add({
        hostPort: project.devServerPort,
        address: '127.0.0.1',
        protocol: 'tcp',
        service: 'dev-server',
        project: project.domain,
        state: listener ? 'listening' : 'configured',
        process: listener?.process,
        pid: listener?.pid,
      }, true);
    }
  }

  // Host listeners that no managed mapping owns are still real host ports.
  // Match the address too: a listener on 127.0.0.2 is a different row from a
  // managed mapping on 127.0.0.1 even when both use the same port.
  const seenHost = new Set<string>();
  for (const listener of listeners) {
    const key = `${keyFor(listener.protocol, listener.port)}:${listener.address}`;
    if (managedAddresses.has(key) || seenHost.has(key)) continue;
    seenHost.add(key);
    add({
      hostPort: listener.port,
      address: listener.address,
      protocol: listener.protocol,
      service: listener.process || 'host',
      state: 'listening',
      process: listener.process,
      pid: listener.pid,
    }, false);
  }

  for (const entry of entries) {
    if ((managedOwners.get(keyFor(entry.protocol, entry.hostPort)) ?? 0) > 1) entry.state = 'conflict';
  }

  return entries.sort((a, b) => a.hostPort - b.hostPort || a.protocol.localeCompare(b.protocol) || a.service.localeCompare(b.service));
}

export function conflictingPorts(entries: PortEntry[]): PortEntry[] {
  return entries.filter((entry) => entry.state === 'conflict');
}

export function suggestPort(used: Iterable<number>, preferred = 3000): number {
  const taken = new Set(used);
  let candidate = preferred;
  while (candidate < 65535 && taken.has(candidate)) candidate += 1;
  return candidate;
}

export function isPortInRange(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
