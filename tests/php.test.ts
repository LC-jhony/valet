import { describe, expect, it } from 'vitest';
import { satisfiesPhpConstraint } from '../shared/php';

describe('composer PHP constraints', () => {
  it('understands common caret, tilde and comparison ranges', () => {
    expect(satisfiesPhpConstraint('8.2', '^8.1')).toBe(true);
    expect(satisfiesPhpConstraint('8.4', '^8.1')).toBe(true);
    expect(satisfiesPhpConstraint('9.0', '^8.1')).toBe(false);
    expect(satisfiesPhpConstraint('8.1', '~8.1.0')).toBe(true);
    expect(satisfiesPhpConstraint('8.2', '~8.1.0')).toBe(false);
    expect(satisfiesPhpConstraint('8.3', '>=8.1 <8.4')).toBe(true);
    expect(satisfiesPhpConstraint('8.4', '>=8.1 <8.4')).toBe(false);
  });

  it('understands wildcards, alternatives and hyphen ranges', () => {
    expect(satisfiesPhpConstraint('8.2', '8.2.*')).toBe(true);
    expect(satisfiesPhpConstraint('8.3', '8.2.*')).toBe(false);
    expect(satisfiesPhpConstraint('7.4', '^8.1 || ^7.4')).toBe(true);
    expect(satisfiesPhpConstraint('8.2', '8.1 - 8.3')).toBe(true);
    expect(satisfiesPhpConstraint('8.4', '8.1 - 8.3')).toBe(false);
  });

  it('returns null instead of guessing on unsupported syntax', () => {
    expect(satisfiesPhpConstraint('8.2', 'dev-main as 8.2')).toBeNull();
    expect(satisfiesPhpConstraint('not-a-version', '^8.1')).toBeNull();
    expect(satisfiesPhpConstraint('8.2', '*')).toBe(true);
  });
});
