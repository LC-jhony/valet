import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const electron = require('electron');
const outDir = process.env.VALET_SMOKE_OUT ?? '/tmp/opencode/valet-smoke';
const home = process.env.VALET_SMOKE_HOME ?? fs.mkdtempSync(path.join(os.tmpdir(), 'valet-smoke-home-'));

if (!fs.existsSync(path.join(root, 'dist', 'electron', 'electron', 'main.js')) || !fs.existsSync(path.join(root, 'dist', 'renderer', 'index.html'))) {
  console.error('[valet] smoke requires a build. Run: npm run build:renderer && npm run build:electron');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const args = ['.', '--no-sandbox'];
const env = {
  ...process.env,
  HOME: home,
  SHELL: '/bin/bash',
  VALET_SMOKE: '1',
  VALET_SMOKE_OUT: outDir,
};

let command = electron;
let commandArgs = args;
if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
  const probe = spawnSync('which', ['xvfb-run'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    console.error('[valet] No DISPLAY and xvfb-run is not installed. Run with a desktop session.');
    process.exit(1);
  }
  command = 'xvfb-run';
  commandArgs = ['-a', electron, ...args];
}

console.log(`[valet] smoke run (HOME=${home})`);
const child = spawn(command, commandArgs, { cwd: root, env, stdio: 'inherit' });
const timeout = setTimeout(() => {
  console.error('[valet] smoke timed out after 60s');
  child.kill('SIGKILL');
  process.exitCode = 1;
}, 60_000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  if (code === 0) {
    console.log(`[valet] smoke screenshots: ${outDir}`);
    console.log('[valet] expected files: valet-min-dark.png, valet-min-light.png, valet-carbon-dark.png, valet-carbon-light.png, valet-settings-themes.png, valet-project-detail.png, valet-logs-diagnostics.png, valet-engine-output.png, valet-terminal.png');
  } else {
    console.error(`[valet] smoke failed with code ${code ?? 'unknown'}`);
    process.exitCode = code ?? 1;
  }
});
