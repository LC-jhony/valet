import { build } from 'esbuild';
import { chmod, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

await mkdir(path.join(root, 'dist', 'cli'), { recursive: true });
await build({
  entryPoints: [path.join(root, 'cli', 'valet.ts')],
  outfile: path.join(root, 'dist', 'cli', 'valet.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  define: {
    'process.env.VALET_VERSION': JSON.stringify(pkg.version),
  },
  logLevel: 'info',
});
await chmod(path.join(root, 'dist', 'cli', 'valet.js'), 0o755);
console.log(`[valet] CLI built: dist/cli/valet.js (${pkg.version})`);
