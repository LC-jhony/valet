import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const electron = require('electron');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

if (!fs.existsSync(path.join(root, 'dist', 'electron', 'electron', 'main.js'))) {
  console.log('[valet] compiling Electron main process…');
  const compile = spawnSync(process.execPath, [tscBin, '-p', 'tsconfig.electron.json'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (compile.status !== 0) process.exit(compile.status ?? 1);
}

const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5173'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' },
});

let child = null;
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child?.kill('SIGTERM');
  vite.kill('SIGTERM');
  setTimeout(() => process.exit(code), 250).unref();
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(600) });
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not answer at ${url}`);
}

try {
  await waitForServer('http://127.0.0.1:5173/');
  console.log('[valet] starting Electron with the Vite dev server…');
  child = spawn(electron, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
  });
  child.on('exit', (code) => stop(code ?? 0));
} catch (error) {
  console.error(`[valet] dev failed: ${error instanceof Error ? error.message : String(error)}`);
  stop(1);
}

vite.on('exit', (code) => {
  if (!stopping) {
    console.error(`[valet] Vite exited with code ${code ?? 'unknown'}`);
    stop(code ?? 1);
  }
});

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
