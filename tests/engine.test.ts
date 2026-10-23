import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EngineClient, EngineError, isRemovedService, mapDatabaseOverview, mapPhpExtensions, mapProject, mapService, validateEngineArgs, validateEngineBinary } from '../shared/engine';

describe('engine boundary', () => {
  it('treats every phpMyAdmin spelling as removed', () => {
    expect(isRemovedService('phpmyadmin')).toBe(true);
    expect(isRemovedService('phpMyAdmin')).toBe(true);
    expect(isRemovedService('php-my-admin')).toBe(true);
    expect(isRemovedService('mysql')).toBe(false);
  });

  it('maps the real site JSON shape', () => {
    const project = mapProject({
      domain: 'acme.test',
      app_name: 'Acme',
      path: '/srv/acme',
      php_version: '8.3',
      php_min: '8.2',
      php_max: '8.4',
      framework: 'laravel',
      framework_label: 'Laravel',
      tls: true,
      fpm_running: true,
      uses_php: true,
      queue_running: false,
      services: ['mysql', 'redis'],
      declared_services: ['mysql'],
      suggested_services: [{ name: 'mailpit', reason: 'The env file sets MAIL_MAILER', package: 'laravel/framework' }],
      runtime: 'fpm',
      framework_workers: [{ name: 'queue', label: 'Queue', running: true }],
      domains: ['acme.test'],
    });
    expect(project).toMatchObject({
      domain: 'acme.test',
      name: 'Acme',
      phpVersion: '8.3',
      phpMin: '8.2',
      tls: true,
      fpmRunning: true,
      services: ['mysql', 'redis'],
      declaredServices: ['mysql'],
      suggestedServices: [{ name: 'mailpit', reason: 'The env file sets MAIL_MAILER', package: 'laravel/framework' }],
      runtime: 'fpm',
      workers: [{ name: 'queue', label: 'Queue', running: true, failing: false, unreachable: false }],
    });
  });

  it('maps the engine PHP extension report without inventing modules', () => {
    expect(mapPhpExtensions({
      ok: true,
      report: {
        version: '8.3',
        built: true,
        needs_rebuild: false,
        extensions: { declared: ['redis'], has: ['redis'], cannot: [] },
        packages: { declared: [], has: [], cannot: [] },
        modules: ['Core', 'redis'],
      },
    }, '8.3')).toMatchObject({
      version: '8.3',
      built: true,
      modules: ['Core', 'redis'],
      extensions: { declared: ['redis'], has: ['redis'] },
    });
  });

  it('maps the bare /api/databases array returned by the engine', () => {
    expect(mapDatabaseOverview([{
      service: 'postgres',
      family: 'PostgreSQL',
      status: 'active',
      port: 5432,
      databases: [
        { name: 'acme', size_bytes: 2_097_152, site: 'acme.test' },
        { name: 'empty', size_bytes: 0 },
      ],
    }])).toEqual({
      engines: [{
        name: 'postgres',
        status: 'active',
        databases: [
          { name: 'acme', engine: 'PostgreSQL', site: 'acme.test', size: '2.0 MB' },
          { name: 'empty', engine: 'PostgreSQL', site: undefined, size: '0 B' },
        ],
      }],
    });
  });

  it('maps a service and keeps phpMyAdmin out of the list boundary', async () => {
    const mapped = mapService({
      name: 'mailpit',
      status: 'active',
      port: 8025,
      version: '1',
      extra_ports: ['18025:8025'],
      secondary_ports: [{ container: 1025, default: 1025 }],
      port_conflicts: [{ port: '8025', label: 'SMTP' }],
    });
    expect(mapped).toMatchObject({
      name: 'mailpit',
      port: 8025,
      status: 'active',
      extraPorts: ['18025:8025'],
      secondaryPorts: [{ container: 1025, default: 1025, published: undefined }],
      portConflicts: [{ port: '8025', label: 'SMTP' }],
    });
    expect(isRemovedService(mapped.name)).toBe(false);
  });

  it('allows only the documented engine commands', () => {
    expect(validateEngineArgs({ id: 'start' })).toEqual(['start']);
    expect(validateEngineArgs({ id: 'link' })).toEqual(['link']);
    expect(validateEngineArgs({ id: 'use-php', args: ['8.3'] })).toEqual(['use', '8.3']);
    expect(validateEngineArgs({ id: 'service-stop', args: ['redis'] })).toEqual(['service', 'stop', 'redis']);
    expect(validateEngineArgs({ id: 'remove-phpmyadmin' })).toEqual(['service', 'remove', 'phpmyadmin']);
    expect(validateEngineArgs({ id: 'logs', args: ['lerd-mysql'] })).toEqual(['logs', 'lerd-mysql']);
  });

  it('rejects traversal, unknown commands and phpMyAdmin actions', () => {
    expect(() => validateEngineArgs({ id: 'service-start', args: ['../../etc'] })).toThrow(EngineError);
    expect(() => validateEngineArgs({ id: 'service-start', args: ['phpmyadmin'] })).toThrow(/phpMyAdmin/);
    expect(() => validateEngineArgs({ id: 'use-php', args: ['8.3; rm -rf /'] })).toThrow(/PHP version/);
    expect(() => validateEngineArgs({ id: 'logs', args: ['../secrets'] })).toThrow(/log unit/);
    expect(() => validateEngineArgs({ id: 'exec', args: ['anything'] } as never)).toThrow(/unsupported/);
  });

  it('only accepts an executable engine named lerd or valet-engine', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'valet-binary-'));
    const engine = path.join(dir, 'lerd');
    const other = path.join(dir, 'sh');
    fs.writeFileSync(engine, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    fs.writeFileSync(other, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    expect(validateEngineBinary(engine)).toBe(engine);
    expect(validateEngineBinary(other)).toBeNull();
    expect(validateEngineBinary(path.join(dir, 'missing'))).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects unknown site actions and unexpected query parameters', async () => {
    let requested = '';
    const client = new EngineClient({
      apiBase: 'http://127.0.0.1:7073',
      binary: null,
      fetchImpl: (async (input: string | URL | Request) => {
        requested = String(input);
        return new Response('{}', { status: 200 });
      }) as typeof fetch,
    });
    await client.siteAction('acme.test', 'service:add', { name: 'mysql' });
    expect(requested).toBe('http://127.0.0.1:7073/api/sites/acme.test/service:add?name=mysql');
    await expect(client.siteAction('acme.test', 'service:add')).rejects.toThrow(/invalid or unmanaged service/);
    await expect(client.siteAction('acme.test', 'service:add', { name: 'phpmyadmin' })).rejects.toThrow(/invalid or unmanaged service/);
    await expect(client.siteAction('acme.test', 'unlinkEverything')).rejects.toThrow(/unsupported site action/);
    await expect(client.siteAction('acme.test', 'restart', { force: '1' })).rejects.toThrow(/unsupported site action parameter/);
    await expect(client.siteAction('acme.test', 'restart', { name: 'mysql' })).rejects.toThrow(/unsupported site action parameter/);
  });

  it('restores the previous project PHP pin when a switch fails', async () => {
    const switched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if ((init?.method ?? 'GET') === 'GET' && url.pathname === '/api/sites') {
        return new Response(JSON.stringify([{
          domain: 'acme.test',
          path: '/srv/acme',
          php_version: '8.2',
        }]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.pathname === '/api/sites/acme.test/php') {
        const version = url.searchParams.get('version') ?? '';
        switched.push(version);
        if (version === '8.4') {
          return new Response(JSON.stringify({ ok: false, error: 'nginx reload failed' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const client = new EngineClient({ apiBase: 'http://127.0.0.1:7073', binary: null, fetchImpl });
    await expect(client.setSitePhp('acme.test', '8.4')).rejects.toThrow(/nginx reload failed/);
    expect(switched).toEqual(['8.4', '8.2']);
  });

  it('preserves extra ports and sends CSRF metadata on service-port changes', async () => {
    let body: unknown = null;
    let secondaryBody: unknown = null;
    let csrf: string | null = null;
    const service = {
      name: 'mailpit',
      status: 'active',
      port: 8025,
      published_port: 0,
      extra_ports: ['18025:8025'],
      secondary_ports: [{ container: 1025, default: 1025 }],
    };
    const okFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.endsWith('/api/services')) {
        return new Response(JSON.stringify([service]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (method === 'POST' && url.endsWith('/api/services/mailpit/ports')) {
        const parsed = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        if (parsed && 'published_ports' in parsed) secondaryBody = parsed;
        else body = parsed;
        csrf = new Headers(init?.headers).get('x-lerd-csrf');
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const client = new EngineClient({ apiBase: 'http://127.0.0.1:7073', binary: null, fetchImpl: okFetch });
    await client.setServicePort('mailpit', 8026);
    expect(body).toEqual({ published_port: 8026, extra_ports: ['18025:8025'] });
    expect(csrf).toBe('1');
    await client.setServiceSecondaryPort('mailpit', 1025, 11025);
    expect(secondaryBody).toEqual({
      published_port: 0,
      published_ports: { '1025': 11025 },
      extra_ports: ['18025:8025'],
    });

    const failing = (async (_input: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify([service]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(
        JSON.stringify({ ok: false, error: 'port busy' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;
    const failedClient = new EngineClient({ apiBase: 'http://127.0.0.1:7073', binary: null, fetchImpl: failing });
    await expect(failedClient.setServicePort('mailpit', 8026)).rejects.toThrow(/port busy/);
  });

  it('maps PHP runtime state, default and patch from the engine status endpoint', async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const json = (value: unknown): Response => new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
      if (url.pathname === '/api/php-versions') return json(['8.4', '8.2']);
      if (url.pathname === '/api/php-installable') return json(['8.5', '8.4', '8.2']);
      if (url.pathname === '/api/status') {
        return json({
          php_default: '8.4',
          php_fpms: [
            { version: '8.4', running: true, patch: '8.4.12', xdebug_enabled: true, xdebug_mode: 'debug', ports: ['9000:9000'], update_available: true },
            { version: '8.2', running: false, xdebug_enabled: false },
          ],
        });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const client = new EngineClient({ apiBase: 'http://127.0.0.1:7073', binary: null, fetchImpl });
    const versions = await client.phpVersions();
    expect(versions.map((version) => version.version)).toEqual(['8.5', '8.4', '8.2']);
    expect(versions.find((version) => version.version === '8.4')).toMatchObject({
      installed: true,
      running: true,
      default: true,
      patch: '8.4.12',
      xdebugMode: 'debug',
      ports: ['9000:9000'],
      updateAvailable: true,
    });
    expect(versions.find((version) => version.version === '8.2')).toMatchObject({
      installed: true,
      running: false,
      default: false,
    });
    expect(versions.find((version) => version.version === '8.5')).toEqual({ version: '8.5', installed: false });
  });
});
