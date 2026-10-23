/**
 * Small, dependency-free evaluator for the PHP constraints commonly found in
 * composer.json. It returns `null` when a constraint uses syntax outside this
 * deliberately limited grammar, so callers can stay silent instead of showing
 * a false warning.
 */

type Version = [number, number, number];

function parseVersion(input: string): Version | null {
  const clean = input.trim().replace(/^v/i, '').replace(/@[a-z-]+$/i, '');
  const match = /^(\d+)(?:\.(\d+|\*|x))?(?:\.(\d+|\*|x))?$/i.exec(clean);
  if (!match) return null;
  const major = Number(match[1]);
  const minorRaw = match[2];
  const patchRaw = match[3];
  if (!Number.isInteger(major)) return null;
  const minor = minorRaw === undefined || minorRaw === '*' || minorRaw.toLowerCase() === 'x' ? null : Number(minorRaw);
  const patch = patchRaw === undefined || patchRaw === '*' || patchRaw.toLowerCase() === 'x' ? null : Number(patchRaw);
  if (minor !== null && !Number.isInteger(minor)) return null;
  if (patch !== null && !Number.isInteger(patch)) return null;
  return [major, minor ?? 0, patch ?? 0];
}

function compare(a: Version, b: Version): number {
  for (let index = 0; index < 3; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

function upperForCaret(version: Version): Version {
  const [major, minor] = version;
  return major > 0 ? [major + 1, 0, 0] : [0, minor + 1, 0];
}

function upperForTilde(version: Version, explicitPatch: boolean): Version {
  const [major, minor] = version;
  return explicitPatch ? [major, minor + 1, 0] : [major + 1, 0, 0];
}

function checkAtom(version: Version, rawAtom: string): boolean | null {
  const atom = rawAtom.trim().toLowerCase();
  if (!atom || atom === '*' || atom === 'x') return true;

  const wildcard = /^(\d+)(?:\.(\d+))?\.(?:\*|x)$/.exec(atom);
  if (wildcard) {
    const major = Number(wildcard[1]);
    const minorRaw = wildcard[2];
    if (minorRaw === undefined) return version[0] === major;
    return version[0] === major && version[1] === Number(minorRaw);
  }

  const caret = /^\^(.*)$/.exec(atom);
  if (caret) {
    const base = parseVersion(caret[1] ?? '');
    if (!base) return null;
    return compare(version, base) >= 0 && compare(version, upperForCaret(base)) < 0;
  }

  const tilde = /^~(.*)$/.exec(atom);
  if (tilde) {
    const raw = tilde[1] ?? '';
    const base = parseVersion(raw);
    if (!base) return null;
    return compare(version, base) >= 0 && compare(version, upperForTilde(base, raw.split('.').length >= 3)) < 0;
  }

  const operator = /^(>=|<=|>|<|==|=|!=)\s*(.+)$/.exec(atom);
  if (operator) {
    const base = parseVersion(operator[2] ?? '');
    if (!base) return null;
    const relation = compare(version, base);
    switch (operator[1]) {
      case '>=': return relation >= 0;
      case '<=': return relation <= 0;
      case '>': return relation > 0;
      case '<': return relation < 0;
      case '!=': return relation !== 0;
      default: return relation === 0;
    }
  }

  const exact = parseVersion(atom);
  if (exact) return compare(version, exact) === 0;
  return null;
}

export function satisfiesPhpConstraint(phpVersion: string, constraint: string): boolean | null {
  const version = parseVersion(phpVersion);
  if (!version) return null;
  const expression = constraint.trim().replace(/@[a-z-]+/gi, '');
  if (!expression || expression === '*' || expression.toLowerCase() === 'x') return true;

  const groups = expression.split(/\s*\|\|?\s*/).filter(Boolean);
  if (groups.length === 0) return null;

  let unknown = false;
  for (const group of groups) {
    const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(group.trim());
    if (hyphen) {
      const low = parseVersion(hyphen[1] ?? '');
      const high = parseVersion(hyphen[2] ?? '');
      if (!low || !high) {
        unknown = true;
        continue;
      }
      if (compare(version, low) >= 0 && compare(version, high) <= 0) return true;
      continue;
    }

    const atoms = group.split(/[\s,]+/).filter(Boolean);
    let matches = true;
    for (const atom of atoms) {
      const result = checkAtom(version, atom);
      if (result === null) {
        unknown = true;
        matches = false;
        break;
      }
      if (!result) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return unknown ? null : false;
}
