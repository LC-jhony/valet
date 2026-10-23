/**
 * Bundled theme catalogue shared by the desktop app, CLI and configuration.
 *
 * The JSON files in `src/themes` remain the visual source of truth. This
 * catalogue only describes the selectable identifiers and their metadata; the
 * renderer loads the actual colour documents from the folder at build time.
 */

export const THEME_DEFINITIONS = [
  { id: 'min-dark', name: 'Min Dark', type: 'dark', file: 'min-dark.json' },
  { id: 'min-light', name: 'Min Light', type: 'light', file: 'min-light.json' },
  { id: 'carbon-dark', name: 'Carbon Dark', type: 'dark', file: 'carbon-dark.json' },
  { id: 'carbon-light', name: 'Carbon Light', type: 'light', file: 'carbon-light.json' },
] as const;

export type ThemeId = (typeof THEME_DEFINITIONS)[number]['id'];
export type ThemeType = (typeof THEME_DEFINITIONS)[number]['type'];
export type ThemeDefinition = (typeof THEME_DEFINITIONS)[number];

export const DEFAULT_THEME_ID: ThemeId = 'min-dark';

export const THEME_IDS: readonly ThemeId[] = THEME_DEFINITIONS.map((theme) => theme.id);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function themeDefinition(id: string | null | undefined): ThemeDefinition | undefined {
  return THEME_DEFINITIONS.find((theme) => theme.id === id);
}
