import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adoptionSummary, applyMigration, detectMigration } from '../shared/migration';

const originalConfigHome = process.env.VALET_CONFIG_HOME;
const homes: string[] = [];

afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
  if (originalConfigHome === undefined) delete process.env.VALET_CONFIG_HOME;
  else process.env.VALET_CONFIG_HOME = originalConfigHome;
});

function fixture(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'valet-migration-'));
  homes.push(home);
  fs.mkdirSync(path.join(home, '.config', 'lerd'), { recursive: true });
  fs.mkdirSync(path.join(home, '.local', 'share', 'lerd'), { recursive: true });
  fs.writeFileSync(path.join(home, '.config', 'lerd', 'config.yaml'), 'theme: dark\n');
  fs.writeFileSync(
    path.join(home, '.local', 'share', 'lerd', 'sites.yaml'),
    'sites:\n    - name: acme\n      domains:\n        - acme.test\n      path: /srv/acme\n',
  );
  process.env.VALET_CONFIG_HOME = path.join(home, '.config', 'valet');
  return home;
}

describe('in-place adoption', () => {
  it('does not mark an empty browser-only engine installation as adoptable', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'valet-migration-empty-'));
    homes.push(home);
    process.env.VALET_CONFIG_HOME = path.join(home, '.config', 'valet');
    const plan = detectMigration(home);
    expect(plan.detected).toBe(false);
    expect(plan.entries.every((entry) => !entry.exists)).toBe(true);
    const result = applyMigration(home);
    expect(result.applied).toBe(false);
    expect(fs.existsSync(path.join(home, '.config', 'valet', 'adoption.json'))).toBe(false);
  });

  it('detects legacy config and site data without moving it', () => {
    const home = fixture();
    const plan = detectMigration(home);
    expect(plan.detected).toBe(true);
    expect(plan.legacyEngine.siteCount).toBe(1);
    expect(plan.entries.some((entry) => entry.exists)).toBe(true);
  });

  it('counts real engine site entries without counting nested worker names', () => {
    const home = fixture();
    const sites = path.join(home, '.local', 'share', 'lerd', 'sites.yaml');
    fs.writeFileSync(sites, [
      'sites:',
      '    - name: acme',
      '      path: /srv/acme',
      '      workers:',
      '        - name: queue',
      '    - name: beta',
      '      path: /srv/beta',
      '',
    ].join('\n'));
    expect(detectMigration(home).legacyEngine.siteCount).toBe(2);
  });

  it('writes a checksummed copy and an adoption manifest', () => {
    const home = fixture();
    const result = applyMigration(home);
    expect(result.applied).toBe(true);
    expect(result.backupDir).toBeTruthy();
    const backup = result.backupDir as string;
    expect(fs.readFileSync(path.join(backup, 'config.yaml'), 'utf8')).toBe('theme: dark\n');
    expect(fs.readFileSync(path.join(home, '.local', 'share', 'lerd', 'sites.yaml'), 'utf8')).toContain('acme.test');
    expect(adoptionSummary(home).adopted).toBe(true);
  });

  it('is idempotent and does not duplicate the backup', () => {
    const home = fixture();
    const first = applyMigration(home);
    const second = applyMigration(home);
    expect(second.unchanged).toBe(true);
    expect(second.backupDir).toBe(first.backupDir);
    expect(fs.readdirSync(path.join(home, '.config', 'valet', 'backups'))).toHaveLength(1);
  });

  it('creates a new backup when the engine config changes', async () => {
    const home = fixture();
    const first = applyMigration(home);
    fs.writeFileSync(path.join(home, '.config', 'lerd', 'config.yaml'), 'theme: light\n');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = applyMigration(home);
    expect(second.applied).toBe(true);
    expect(second.backupDir).not.toBe(first.backupDir);
    expect(fs.readFileSync(path.join(second.backupDir as string, 'config.yaml'), 'utf8')).toBe('theme: light\n');
  });
});
