import type { ThemeJson } from '../../shared/theme';
import { DEFAULT_THEME_ID } from '../../shared/themes';

/**
 * Load every theme document in this folder. Vite resolves the glob at build
 * time, so adding a JSON file here makes it available to the renderer without
 * touching component code. The shared catalogue still controls which ids the
 * configuration and CLI accept.
 */
const modules = import.meta.glob<{ default: ThemeJson }>('./*.json', { eager: true });

function idFromFile(file: string): string {
  return file.replace(/^\.\//, '').replace(/\.json$/, '');
}

export const THEMES: Record<string, ThemeJson> = Object.fromEntries(
  Object.entries(modules).map(([file, module]) => [idFromFile(file), module.default]),
);

const fallbackTheme = THEMES[DEFAULT_THEME_ID];
if (!fallbackTheme) throw new Error(`The VALET theme ${DEFAULT_THEME_ID} is missing.`);
const defaultTheme: ThemeJson = fallbackTheme;

export function getTheme(id: string | null | undefined): ThemeJson {
  return THEMES[id ?? ''] ?? defaultTheme;
}
