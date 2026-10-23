import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalManager, terminalShellPath } from '../electron/terminal';

const managers: TerminalManager[] = [];

afterEach(() => {
  for (const manager of managers.splice(0)) manager.killAll();
});

describe('real terminal sessions', () => {
  it('opens a shell in a validated directory and executes stdin', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'valet-terminal-'));
    const manager = new TerminalManager();
    managers.push(manager);
    const chunks: string[] = [];
    manager.on('data', (event: { data: string }) => chunks.push(event.data));
    const session = manager.create({ cwd, project: 'acme.test' });
    expect(session.cwd).toBe(cwd);
    expect(session.project).toBe('acme.test');
    expect(manager.list()).toHaveLength(1);

    manager.write(session.id, 'printf "VALET_TERMINAL_OK\\n"\n');
    const deadline = Date.now() + 5_000;
    while (!chunks.join('').includes('VALET_TERMINAL_OK') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(chunks.join('')).toContain('VALET_TERMINAL_OK');

    manager.kill(session.id);
  });

  it('rejects relative working directories', () => {
    const manager = new TerminalManager();
    managers.push(manager);
    expect(() => manager.create({ cwd: 'relative/path' })).toThrow(/absolute path/);
  });

  it('prepends the engine shim directory only when it exists', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'valet-terminal-home-'));
    expect(terminalShellPath('/usr/bin', home)).toBe('/usr/bin');
    const shimDir = path.join(home, '.local', 'share', 'lerd', 'bin');
    fs.mkdirSync(shimDir, { recursive: true });
    expect(terminalShellPath('/usr/bin', home)).toBe(`${shimDir}${path.delimiter}/usr/bin`);
    expect(terminalShellPath('', home)).toBe(shimDir);
  });

  it('enforces the session limit', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'valet-terminal-limit-'));
    const manager = new TerminalManager();
    managers.push(manager);
    for (let index = 0; index < 8; index += 1) manager.create({ cwd });
    expect(() => manager.create({ cwd })).toThrow(/limit of 8/);
    manager.killAll();
  });
});
