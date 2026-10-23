import { describe, expect, it } from 'vitest';
import { collectPorts, conflictingPorts, parseLsofOutput, parseSsOutput, suggestPort } from '../shared/ports';
import type { Project, Service } from '../shared/types';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'acme.test',
  name: 'Acme',
  domain: 'acme.test',
  domains: ['acme.test'],
  path: '/srv/acme',
  phpVersion: '8.3',
  nodeVersion: '22',
  framework: 'laravel',
  frameworkLabel: 'Laravel',
  tls: true,
  paused: false,
  fpmRunning: true,
  usesPhp: true,
  queueRunning: false,
  ...overrides,
});

const service = (overrides: Partial<Service> = {}): Service => ({
  name: 'mysql',
  status: 'active',
  version: '8.4',
  port: 3306,
  isDatabase: true,
  siteCount: 0,
  siteDomains: [],
  custom: false,
  preset: true,
  ...overrides,
});

describe('host listener parsers', () => {
  it('parses ss output including pid and process', () => {
    const listeners = parseSsOutput(
      'tcp   LISTEN 0      4096   127.0.0.1:7073      0.0.0.0:*    users:(("lerd",pid=4242,fd=7))\n' +
        'tcp   LISTEN 0      511    [::1]:80            [::]:*       users:(("nginx",pid=9,fd=6))\n' +
        'LISTEN 0      4096   0.0.0.0:8080       0.0.0.0:*    users:(("node",pid=11,fd=3))\n' +
        'udp   UNCONN 0      0     127.0.0.54:53      0.0.0.0:*\n' +
        'garbage\n',
    );
    expect(listeners).toHaveLength(4);
    expect(listeners[0]).toMatchObject({ port: 7073, address: '127.0.0.1', protocol: 'tcp', pid: 4242, process: 'lerd' });
    expect(listeners[1]).toMatchObject({ port: 80, address: '[::1]' });
    expect(listeners[2]).toMatchObject({ port: 8080, protocol: 'tcp', process: 'node' });
    expect(listeners[3]).toMatchObject({ port: 53, protocol: 'udp' });
  });

  it('parses lsof output and ignores the header', () => {
    const listeners = parseLsofOutput(
      'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\n' +
        'nginx 123 root 6u IPv4 999 0t0 TCP 127.0.0.1:8080 (LISTEN)\n' +
        'node 77 jhony 19u IPv6 1000 0t0 TCP [::1]:5173 (LISTEN)\n',
    );
    expect(listeners).toHaveLength(2);
    expect(listeners[0]).toMatchObject({ port: 8080, address: '127.0.0.1', process: 'nginx', pid: 123 });
    expect(listeners[1]).toMatchObject({ port: 5173, address: '::1' });
  });
});

describe('collectPorts', () => {
  it('marks an active managed service as listening', () => {
    const ports = collectPorts([service()], [], [{ port: 3306, address: '127.0.0.1', protocol: 'tcp', process: 'mysqld', pid: 8 }]);
    expect(ports).toHaveLength(1);
    expect(ports[0]).toMatchObject({ hostPort: 3306, service: 'mysql', state: 'listening', process: 'mysqld' });
  });

  it('marks an inactive service port taken by an unrelated process as a conflict', () => {
    const ports = collectPorts(
      [service({ status: 'inactive' })],
      [],
      [{ port: 3306, address: '127.0.0.1', protocol: 'tcp', process: 'node', pid: 99 }],
    );
    expect(ports[0]?.state).toBe('conflict');
    expect(conflictingPorts(ports)).toHaveLength(1);
  });

  it('includes host listeners that are not managed by the engine', () => {
    const ports = collectPorts([], [], [
      { port: 5173, address: '127.0.0.1', protocol: 'tcp', process: 'node', pid: 17 },
      { port: 22, address: '0.0.0.0', protocol: 'tcp', process: 'sshd' },
    ]);
    expect(ports.map((port) => port.hostPort)).toEqual([22, 5173]);
    expect(ports.every((port) => port.state === 'listening')).toBe(true);
  });

  it('shows a host listener on a different address at the same port', () => {
    const ports = collectPorts(
      [service({ port: 3306 })],
      [],
      [
        { port: 3306, address: '127.0.0.1', protocol: 'tcp', process: 'rootlessport', pid: 8 },
        { port: 3306, address: '127.0.0.2', protocol: 'tcp', process: 'node', pid: 19 },
      ],
    );
    expect(ports).toHaveLength(2);
    expect(ports.find((port) => port.address === '127.0.0.1')).toMatchObject({ service: 'mysql', state: 'listening' });
    expect(ports.find((port) => port.address === '127.0.0.2')).toMatchObject({ service: 'node', state: 'listening' });
  });

  it('does not call two addresses of the same external listener a conflict', () => {
    const ports = collectPorts([], [], [
      { port: 53, address: '127.0.0.53', protocol: 'tcp', process: 'systemd-resolve' },
      { port: 53, address: '127.0.0.54', protocol: 'tcp', process: 'systemd-resolve' },
      { port: 53, address: '127.0.0.54', protocol: 'udp', process: 'systemd-resolve' },
    ]);
    expect(conflictingPorts(ports)).toHaveLength(0);
  });

  it('includes secondary published ports with their internal port', () => {
    const ports = collectPorts(
      [service({ name: 'mailpit', port: 8025, secondaryPorts: [{ container: 1025, default: 1025 }] })],
      [],
      [{ port: 1025, address: '127.0.0.1', protocol: 'tcp', process: 'mailpit' }],
    );
    expect(ports).toHaveLength(2);
    expect(ports.find((port) => port.hostPort === 1025)).toMatchObject({
      containerPort: 1025,
      service: 'mailpit',
      state: 'listening',
    });
  });

  it('detects two managed owners on the same port', () => {
    const ports = collectPorts([service({ port: 3000 })], [project({ devServerPort: 3000 })], []);
    expect(ports).toHaveLength(2);
    expect(ports.every((port) => port.state === 'conflict')).toBe(true);
  });

  it('suggests the next free port', () => {
    expect(suggestPort([3000, 3001, 3003], 3000)).toBe(3002);
    expect(suggestPort([], 3000)).toBe(3000);
  });
});
