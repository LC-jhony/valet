import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { TerminalSession } from '../shared/types';

const MAX_SESSIONS = 8;
const MAX_BUFFER = 64 * 1024;
const MAX_INPUT = 64 * 1024;

interface Session {
  info: TerminalSession;
  child: ChildProcessWithoutNullStreams;
  buffer: string;
}

export interface TerminalEvents {
  data: { id: string; data: string };
  exit: { id: string; code: number | null };
}

function isAllowedShell(candidate: string): boolean {
  const base = path.basename(candidate);
  return ['bash', 'zsh', 'sh', 'fish', 'dash'].includes(base);
}

function resolveShell(): string {
  const fromEnv = process.env.SHELL;
  if (fromEnv && path.isAbsolute(fromEnv) && isAllowedShell(fromEnv) && fs.existsSync(fromEnv)) return fromEnv;
  for (const candidate of ['/bin/bash', '/bin/zsh', '/usr/bin/fish', '/bin/sh']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return '/bin/sh';
}

/**
 * The engine keeps its PHP/Composer command shims in `<home>/.local/share/lerd/bin`.
 * Putting that directory first lets an interactive shell resolve `php` and
 * `composer` through the project's engine pin instead of the host runtime.
 * The host PATH is untouched when the engine has not installed shims.
 */
export function terminalShellPath(basePath: string, home = os.homedir()): string {
  const shimDir = path.join(home, '.local', 'share', 'lerd', 'bin');
  if (!fs.existsSync(shimDir)) return basePath;
  return basePath ? `${shimDir}${path.delimiter}${basePath}` : shimDir;
}

function validateCwd(cwd: string): string {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd) || cwd.includes('\0')) {
    throw new Error('terminal: cwd must be an absolute path');
  }
  const resolved = path.resolve(cwd);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error('terminal: cwd is not a directory');
  return resolved;
}

/**
 * Terminal sessions are real shells attached to a PTY. On Linux/macOS the
 * `script` utility allocates the PTY, so VALET needs no native dependency.
 * Commands are not accepted over IPC: the renderer can only open a shell in a
 * validated project directory and write to its stdin.
 */
export class TerminalManager extends EventEmitter {
  private readonly sessions = new Map<string, Session>();

  create(options: { cwd: string; project?: string; title?: string }): TerminalSession {
    if (this.sessions.size >= MAX_SESSIONS) throw new Error(`terminal: limit of ${MAX_SESSIONS} sessions reached`);
    const cwd = validateCwd(options.cwd);
    const shell = resolveShell();
    const id = `term_${crypto.randomUUID()}`;
    const title = (options.title || options.project || path.basename(cwd) || 'shell').slice(0, 80);
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      CLICOLOR_FORCE: '0',
      VALET: '1',
      VALET_PROJECT: options.project ?? '',
      PWD: cwd,
      PATH: terminalShellPath(process.env.PATH ?? ''),
    };

    let child: ChildProcessWithoutNullStreams;
    if (process.platform === 'win32') {
      child = spawn('powershell.exe', ['-NoLogo'], { cwd, env, stdio: 'pipe' });
    } else if (process.platform === 'darwin') {
      child = spawn('/usr/bin/script', ['-q', '/dev/null', shell], { cwd, env, stdio: 'pipe' });
    } else {
      child = spawn('script', ['-qf', '-c', shell, '/dev/null'], { cwd, env, stdio: 'pipe' });
    }

    const info: TerminalSession = {
      id,
      title,
      cwd,
      project: options.project ?? null,
      createdAt: Date.now(),
      alive: true,
    };
    const session: Session = { info, child, buffer: '' };
    this.sessions.set(id, session);

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      session.buffer = (session.buffer + text).slice(-MAX_BUFFER);
      this.emit('data', { id, data: text } satisfies TerminalEvents['data']);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      session.buffer = (session.buffer + text).slice(-MAX_BUFFER);
      this.emit('data', { id, data: text } satisfies TerminalEvents['data']);
    });
    child.on('error', (err) => {
      const text = `\r\n[valet] terminal error: ${err.message}\r\n`;
      session.buffer = (session.buffer + text).slice(-MAX_BUFFER);
      this.emit('data', { id, data: text } satisfies TerminalEvents['data']);
    });
    child.on('close', (code) => {
      info.alive = false;
      this.emit('exit', { id, code } satisfies TerminalEvents['exit']);
      this.sessions.delete(id);
    });

    return info;
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) throw new Error('terminal: unknown session');
    if (typeof data !== 'string' || data.length > MAX_INPUT) throw new Error('terminal: input too large');
    if (!session.info.alive) throw new Error('terminal: session is closed');
    session.child.stdin.write(data);
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.child.kill('SIGTERM');
    const timer = setTimeout(() => {
      if (session.info.alive) session.child.kill('SIGKILL');
    }, 1_000);
    timer.unref();
  }

  list(): TerminalSession[] {
    return [...this.sessions.values()].map((session) => ({ ...session.info }));
  }

  buffer(id: string): string {
    return this.sessions.get(id)?.buffer ?? '';
  }

  killAll(): void {
    for (const session of this.sessions.values()) {
      session.child.kill('SIGTERM');
    }
  }
}
