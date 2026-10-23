/**
 * Safe adoption of an existing engine installation.
 *
 * VALET does not move, rename or delete the engine's data. It verifies the
 * legacy config, copies a checksummed backup into VALET's own config directory,
 * and records an adoption manifest. Containers, volumes and sites stay in
 * place, so no environment is duplicated.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findEngineBinary, legacyPaths } from './engine';
import { adoptionFile, dirSize, sha256File, valetConfigDir } from './config';
import type { MigrationEntry, MigrationPlan } from './types';

interface AdoptionManifest {
  version: 1;
  createdAt: string;
  mode: 'in-place';
  source: {
    configDir: string;
    dataDir: string;
    cacheDir: string;
    sitesFile: string;
    sitesSha256: string | null;
    configSha256: string | null;
  };
  backupDir: string;
  siteCount: number;
  files: number;
  bytes: number;
  engineBinary: string | null;
  warnings: string[];
}

function countSites(sitesFile: string): number {
  try {
    const text = fs.readFileSync(sitesFile, 'utf8');
    // The engine writes each site as a list item starting with `name`, followed
    // by nested keys such as `path` and `domains`. Counting top-level `- name`
    // items avoids double-counting `path` and avoids counting nested worker
    // names. Older/external snapshots may start with `path`; support those as a
    // fallback.
    const countListItems = (key: string): number => {
      const matches = [...text.matchAll(new RegExp(`^(\\s*)-\\s+${key}:`, 'gm'))];
      if (matches.length === 0) return 0;
      const minIndent = Math.min(...matches.map((match) => match[1]?.length ?? 0));
      return matches.filter((match) => (match[1]?.length ?? 0) === minIndent).length;
    };
    return countListItems('name') || countListItems('path');
  } catch {
    return 0;
  }
}

function statEntry(source: string, destination: string): MigrationEntry {
  if (!fs.existsSync(source)) {
    return { source, destination, exists: false, fileCount: 0, bytes: 0 };
  }
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    const size = dirSize(source);
    return { source, destination, exists: true, fileCount: size.files, bytes: size.bytes };
  }
  return { source, destination, exists: true, fileCount: 1, bytes: stat.size };
}

export function detectMigration(home = os.homedir()): MigrationPlan {
  const legacy = legacyPaths(home);
  const configFile = path.join(legacy.configDir, 'config.yaml');
  const sitesFile = legacy.sitesFile;
  const binary = findEngineBinary();
  const hasConfig = fs.existsSync(configFile);
  const hasSites = fs.existsSync(sitesFile);
  const siteCount = hasSites ? countSites(sitesFile) : 0;
  const stamp = new Date().toISOString().slice(0, 10);
  const backupRoot = path.join(valetConfigDir(), 'backups', stamp);
  const entries: MigrationEntry[] = [
    statEntry(configFile, path.join(backupRoot, 'config.yaml')),
    statEntry(sitesFile, path.join(backupRoot, 'sites.yaml')),
  ];
  const themesDir = path.join(legacy.configDir, 'themes');
  if (fs.existsSync(themesDir)) {
    entries.push(statEntry(themesDir, path.join(backupRoot, 'themes')));
  }

  const warnings: string[] = [];
  if (!hasConfig && !hasSites) {
    warnings.push('No previous Lerd configuration was detected. Nothing to adopt.');
  }
  if (hasConfig || hasSites) {
    warnings.push('VALET adopts the existing engine in place: containers, volumes and project files are not copied or moved.');
    warnings.push('The backup is written under VALET config; the engine keeps using its own directories.');
  }
  if (hasSites && siteCount === 0) {
    warnings.push('sites.yaml exists but no project entries were parsed; review the backup before making changes.');
  }

  return {
    detected: hasConfig || hasSites,
    legacyEngine: {
      found: Boolean(binary),
      binary,
      configDir: legacy.configDir,
      dataDir: legacy.dataDir,
      sitesFile,
      siteCount,
    },
    entries,
    warnings,
  };
}

export function applyMigration(home = os.homedir()): { applied: boolean; unchanged: boolean; backupDir: string | null; manifest: AdoptionManifest | null; plan: MigrationPlan } {
  const plan = detectMigration(home);
  if (!plan.detected) return { applied: false, unchanged: false, backupDir: null, manifest: null, plan };

  const sitesSha = sha256File(plan.legacyEngine.sitesFile);
  const configSha = sha256File(path.join(plan.legacyEngine.configDir, 'config.yaml'));
  try {
    const existing = JSON.parse(fs.readFileSync(adoptionFile(), 'utf8')) as AdoptionManifest;
    if (
      existing?.version === 1 &&
      existing.mode === 'in-place' &&
      existing.source?.sitesSha256 === sitesSha &&
      existing.source?.configSha256 === configSha
    ) {
      return { applied: false, unchanged: true, backupDir: existing.backupDir, manifest: existing, plan };
    }
  } catch {
    // no previous manifest
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(valetConfigDir(), 'backups', stamp);
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

  const copied: string[] = [];
  const copyIfFile = (source: string, name: string): void => {
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return;
    const destination = path.join(backupDir, name);
    fs.copyFileSync(source, destination);
    const sourceHash = sha256File(source);
    const destinationHash = sha256File(destination);
    if (!sourceHash || sourceHash !== destinationHash) {
      throw new Error(`backup verification failed for ${source}`);
    }
    copied.push(name);
  };
  copyIfFile(path.join(plan.legacyEngine.configDir, 'config.yaml'), 'config.yaml');
  copyIfFile(plan.legacyEngine.sitesFile, 'sites.yaml');

  const themesSource = path.join(plan.legacyEngine.configDir, 'themes');
  if (fs.existsSync(themesSource)) {
    fs.cpSync(themesSource, path.join(backupDir, 'themes'), { recursive: true, errorOnExist: false });
    copied.push('themes/');
  }

  const manifest: AdoptionManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    mode: 'in-place',
    source: {
      configDir: plan.legacyEngine.configDir,
      dataDir: plan.legacyEngine.dataDir,
      cacheDir: legacyPaths(home).cacheDir,
      sitesFile: plan.legacyEngine.sitesFile,
      sitesSha256: sitesSha,
      configSha256: configSha,
    },
    backupDir,
    siteCount: plan.legacyEngine.siteCount,
    files: plan.entries.reduce((total, entry) => total + entry.fileCount, 0),
    bytes: plan.entries.reduce((total, entry) => total + entry.bytes, 0),
    engineBinary: plan.legacyEngine.binary,
    warnings: plan.warnings,
  };
  fs.mkdirSync(valetConfigDir(), { recursive: true, mode: 0o700 });
  const temp = `${adoptionFile()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, adoptionFile());

  return { applied: true, unchanged: false, backupDir, manifest, plan };
}

export function adoptionSummary(home = os.homedir()): { adopted: boolean; manifest: AdoptionManifest | null; plan: MigrationPlan } {
  let manifest: AdoptionManifest | null = null;
  try {
    manifest = JSON.parse(fs.readFileSync(adoptionFile(), 'utf8')) as AdoptionManifest;
  } catch {
    manifest = null;
  }
  return { adopted: Boolean(manifest), manifest, plan: detectMigration(home) };
}

export function checksum(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}
