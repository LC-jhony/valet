import { describe, expect, it } from 'vitest';
import carbonDark from '../src/themes/carbon-dark.json';
import carbonLight from '../src/themes/carbon-light.json';
import minDark from '../src/themes/min-dark.json';
import minLight from '../src/themes/min-light.json';
import { THEME_DEFINITIONS } from '../shared/themes';
import { THEMES, getTheme } from '../src/themes';
import { buildTheme, contrastRatio, ensureContrast, themeCssVars, xtermTheme, type ThemeJson } from '../shared/theme';

const dark = minDark as unknown as ThemeJson;
const light = minLight as unknown as ThemeJson;
const bundled = [dark, light, carbonDark as unknown as ThemeJson, carbonLight as unknown as ThemeJson];

describe('Theme adapter', () => {
  it('reads the identity from every bundled JSON file', () => {
    expect(buildTheme(dark).id).toBe('min-dark');
    expect(buildTheme(dark).type).toBe('dark');
    expect(buildTheme(light).id).toBe('min-light');
    expect(buildTheme(light).type).toBe('light');
    expect(buildTheme(bundled[2]!).id).toBe('carbon-dark');
    expect(buildTheme(bundled[2]!).type).toBe('dark');
    expect(buildTheme(bundled[3]!).id).toBe('carbon-light');
    expect(buildTheme(bundled[3]!).type).toBe('light');
  });

  it('matches the shared theme catalogue', () => {
    const themes = new Map(bundled.map((theme) => {
      const tokens = buildTheme(theme);
      return [tokens.id, tokens] as const;
    }));

    expect(themes.size).toBe(THEME_DEFINITIONS.length);
    expect(new Set(THEME_DEFINITIONS.map((theme) => theme.id)).size).toBe(THEME_DEFINITIONS.length);
    for (const definition of THEME_DEFINITIONS) {
      const tokens = themes.get(definition.id);
      expect(tokens?.name).toBe(definition.name);
      expect(tokens?.type).toBe(definition.type);
      expect(definition.file).toBe(`${definition.id}.json`);
    }
  });

  it('loads every theme document from the themes folder', () => {
    expect(Object.keys(THEMES).sort()).toEqual(THEME_DEFINITIONS.map((theme) => theme.id).sort());
    expect(buildTheme(getTheme('carbon-dark')).id).toBe('carbon-dark');
    expect(buildTheme(getTheme('carbon-light')).type).toBe('light');
    expect(buildTheme(getTheme('not-a-theme')).id).toBe('min-dark');
  });

  it('keeps semantic text readable on every bundled background', () => {
    for (const theme of bundled) {
      const tokens = buildTheme(theme);
      for (const tone of [tokens.success, tokens.warning, tokens.error, tokens.info]) {
        expect(contrastRatio(tone, tokens.bg)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(tokens.fg, tokens.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('derives Min Dark success from blue, because the theme has no green', () => {
    const tokens = buildTheme(dark);
    expect(tokens.success).toBe(ensureContrast(tokens.blue, tokens.bg));
  });

  it('exposes every consumed colour as a CSS variable', () => {
    const vars = themeCssVars(buildTheme(dark));
    for (const key of [
      '--v-bg',
      '--v-bg-chrome',
      '--v-bg-sidebar',
      '--v-fg',
      '--v-accent',
      '--v-success',
      '--v-error',
      '--v-terminal-bg',
    ]) {
      expect(vars[key as keyof typeof vars]).toMatch(/^#|^rgb/);
    }
  });

  it('builds an xterm palette from terminal theme keys', () => {
    const tokens = buildTheme(light);
    const terminal = xtermTheme(tokens);
    expect(terminal.background).toBe(tokens.terminalBg);
    expect(terminal.foreground).toBe(tokens.terminalFg);
    expect(terminal.red).toMatch(/^#/);
  });

  it('darkens an unreadable accent until it reaches AA contrast', () => {
    const adjusted = ensureContrast('#77cc00', '#ffffff');
    expect(contrastRatio(adjusted, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(adjusted).not.toBe('#77cc00');
  });
});
