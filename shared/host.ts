import { execFile } from 'node:child_process';
import net from 'node:net';
import { promisify } from 'node:util';
import { parseLsofOutput, parseSsOutput, type Listener } from '../shared/ports';

const execFileAsync = promisify(execFile);

/** Read host listeners without privileges. Failures are non-fatal. */
export async function scanHostListeners(): Promise<Listener[]> {
  try {
    if (process.platform === 'linux') {
      const { stdout } = await execFileAsync('ss', ['-H', '-ltnup'], { timeout: 5_000, maxBuffer: 2_000_000 });
      return parseSsOutput(stdout);
    }
    if (process.platform === 'darwin') {
      const { stdout } = await execFileAsync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { timeout: 5_000, maxBuffer: 2_000_000 });
      return parseLsofOutput(stdout);
    }
  } catch {
    return [];
  }
  return [];
}

export async function isPortAvailable(port: number, address = '127.0.0.1'): Promise<{ available: boolean; error?: string }> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve({ available: false, error: err.code === 'EADDRINUSE' ? 'port is already in use' : err.message });
    });
    server.listen({ port, host: address, exclusive: true }, () => {
      server.close(() => resolve({ available: true }));
    });
  });
}
