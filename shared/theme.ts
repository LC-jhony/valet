/**
 * Theme adapter: VS Code theme JSON -> semantic VALET tokens.
 *
 * The two JSON files in `src/themes` are the source of truth. No component may
 * hardcode a colour; everything resolves through the tokens produced here.
 */

export interface ThemeJson {
  name: string;
  type: 'dark' | 'light';
  colors: Record<string, string>;
  tokenColors?: Array<{ scope?: string | string[]; settings?: Record<string, string> }>;
  semanticHighlighting?: boolean;
}

export interface ThemeTokens {
  id: string;
  name: string;
  type: 'dark' | 'light';
  bg: string;
  bgChrome: string;
  bgSidebar: string;
  bgPanel: string;
  bgInput: string;
  bgHover: string;
  bgSelected: string;
  bgActive: string;
  fg: string;
  fgMuted: string;
  fgActive: string;
  fgDisabled: string;
  border: string;
  borderSubtle: string;
  accent: string;
  accentMuted: string;
  blue: string;
  green: string;
  red: string;
  orange: string;
  violet: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  focusRing: string;
  statusBg: string;
  statusFg: string;
  tabActiveBg: string;
  tabInactiveBg: string;
  tabActiveFg: string;
  tabInactiveFg: string;
  tabBorder: string;
  terminalBg: string;
  terminalFg: string;
  terminalCursor: string;
  terminalSelection: string;
  ansi: [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
}

function pick(colors: Record<string, string>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = colors[key];
    if (value) return value;
  }
  return fallback;
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})/i.exec(hex.trim());
  if (!match?.[1]) return 0;
  const value = match[1];
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(hex: string, target: number, amount: number): string {
  const match = /^#([0-9a-f]{6})/i.exec(hex.trim());
  if (!match?.[1]) return hex;
  const value = match[1];
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const mixed = channels.map((component) => Math.round(component + (target - component) * amount));
  return `#${mixed.map((component) => component.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Keep a semantic colour inside the theme's hue while meeting WCAG AA on the
 * theme background. Min Light defines a few accent colours that are too light
 * for text (for example its green); darkening them is a contrast correction,
 * not a new palette.
 */
export function ensureContrast(color: string, background: string, minimum = 4.5): string {
  const normalized = normalizeColor(color).slice(0, 7);
  if (contrastRatio(normalized, background) >= minimum) return normalized;
  const target = luminance(background) > 0.5 ? 0 : 255;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(normalized, target, step * 0.05);
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return target === 0 ? '#000000' : '#ffffff';
}

/**
 * Normalise an 8-digit hex colour to `#rrggbbaa` for CSS. The source themes
 * already use that form, but some upstream themes use shorthand.
 */
export function normalizeColor(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{4}$/i.test(trimmed)) {
    const [, r, g, b, a] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}${a}${a}`;
  }
  return trimmed;
}

export function buildTheme(theme: ThemeJson): ThemeTokens {
  const c = theme.colors;
  const fallbackFg = theme.type === 'dark' ? '#cccccc' : '#212121';
  const fg = pick(c, ['editor.foreground', 'foreground'], fallbackFg);
  const blue = pick(c, ['symbolIcon.fieldForeground', 'debugIcon.startForeground', 'textLink.foreground'], '#79b8ff');
  const red = pick(c, ['terminal.ansiRed', 'debugIcon.disconnectForeground', 'debugIcon.breakpointForeground'], '#FF7A84');
  const orange = pick(c, ['symbolIcon.enumeratorForeground', 'variable.parameter.function'], '#ffab70');
  const violet = pick(c, ['symbolIcon.methodForeground', 'symbolIcon.functionForeground', 'entity.name.function'], '#b392f0');
  const green = pick(c, ['terminal.ansiGreen', 'terminal.ansiBrightGreen'], theme.type === 'dark' ? blue : '#22863a');
  const bg = pick(c, ['editor.background'], theme.type === 'dark' ? '#1f1f1f' : '#ffffff');
  const muted = pick(c, ['foreground'], theme.type === 'dark' ? '#888888' : '#757575');
  const accent = normalizeColor(violet);
  const semantic = {
    success: ensureContrast(green, bg),
    warning: ensureContrast(orange, bg),
    error: ensureContrast(red, bg),
    info: ensureContrast(blue, bg),
  };

  return {
    id: theme.name.toLowerCase().replace(/\s+/g, '-'),
    name: theme.name,
    type: theme.type,
    bg: normalizeColor(bg),
    bgChrome: normalizeColor(pick(c, ['titleBar.activeBackground', 'activityBar.background'], bg)),
    bgSidebar: normalizeColor(pick(c, ['sideBar.background'], bg)),
    bgPanel: normalizeColor(pick(c, ['panel.background', 'editor.background'], bg)),
    bgInput: normalizeColor(pick(c, ['input.background', 'editor.background'], bg)),
    bgHover: normalizeColor(pick(c, ['list.hoverBackground', 'list.focusBackground'], theme.type === 'dark' ? '#262626' : '#eeeeee')),
    bgSelected: normalizeColor(pick(c, ['list.activeSelectionBackground', 'list.inactiveSelectionBackground'], theme.type === 'dark' ? '#212121' : '#eeeeee')),
    bgActive: normalizeColor(pick(c, ['list.focusBackground', 'list.activeSelectionBackground'], theme.type === 'dark' ? '#292929' : '#dddddd')),
    fg: normalizeColor(fg),
    fgMuted: normalizeColor(muted),
    fgActive: normalizeColor(pick(c, ['list.activeSelectionForeground', 'tab.activeForeground', 'editor.foreground'], fg)),
    fgDisabled: normalizeColor(pick(c, ['gitDecoration.ignoredResourceForeground', 'tab.inactiveForeground'], muted)),
    border: normalizeColor(pick(c, ['focusBorder', 'peekView.border'], theme.type === 'dark' ? '#444444' : '#d0d0d0')),
    borderSubtle: normalizeColor(pick(c, ['tab.border', 'sideBar.border', 'panel.border'], theme.type === 'dark' ? '#2a2a2a' : '#e9e9e9')),
    accent,
    accentMuted: normalizeColor(pick(c, ['list.inactiveSelectionBackground'], theme.type === 'dark' ? '#212121' : '#e0e0e0')),
    blue: normalizeColor(blue),
    green: normalizeColor(green),
    red: normalizeColor(red),
    orange: normalizeColor(orange),
    violet: normalizeColor(violet),
    success: semantic.success,
    warning: semantic.warning,
    error: semantic.error,
    info: semantic.info,
    focusRing: normalizeColor(pick(c, ['focusBorder'], theme.type === 'dark' ? '#444444' : '#d0d0d0')),
    statusBg: normalizeColor(pick(c, ['statusBar.background'], bg)),
    statusFg: normalizeColor(pick(c, ['statusBar.foreground'], muted)),
    tabActiveBg: normalizeColor(pick(c, ['tab.activeBackground', 'editor.background'], bg)),
    tabInactiveBg: normalizeColor(pick(c, ['tab.inactiveBackground', 'editorGroupHeader.tabsBackground'], bg)),
    tabActiveFg: normalizeColor(pick(c, ['tab.activeForeground', 'editor.foreground'], fg)),
    tabInactiveFg: normalizeColor(pick(c, ['tab.inactiveForeground'], muted)),
    tabBorder: normalizeColor(pick(c, ['tab.border', 'editorGroupHeader.tabsBorder'], bg)),
    terminalBg: normalizeColor(pick(c, ['terminal.background', 'editor.background'], bg)),
    terminalFg: normalizeColor(pick(c, ['editor.foreground', 'foreground'], fg)),
    terminalCursor: normalizeColor(pick(c, ['textLink.activeForeground', 'list.activeSelectionForeground'], fg)),
    terminalSelection: normalizeColor(pick(c, ['list.activeSelectionBackground', 'editor.selectionBackground'], theme.type === 'dark' ? '#333333' : '#d7e7ff')),
    ansi: [
      pick(c, ['terminal.ansiBlack'], theme.type === 'dark' ? '#1a1a1a' : '#333333'),
      pick(c, ['terminal.ansiRed'], red),
      pick(c, ['terminal.ansiGreen'], green),
      pick(c, ['terminal.ansiYellow', 'terminal.ansiBrightYellow'], orange),
      pick(c, ['terminal.ansiBlue'], blue),
      pick(c, ['terminal.ansiMagenta', 'terminal.ansiBrightMagenta'], violet),
      pick(c, ['terminal.ansiCyan', 'terminal.ansiBrightCyan'], blue),
      pick(c, ['terminal.ansiWhite'], fg),
      pick(c, ['terminal.ansiBrightBlack'], '#5c5c5c'),
      pick(c, ['terminal.ansiBrightRed'], red),
      pick(c, ['terminal.ansiBrightGreen'], green),
      pick(c, ['terminal.ansiBrightYellow'], orange),
      pick(c, ['terminal.ansiBrightBlue'], blue),
      pick(c, ['terminal.ansiBrightMagenta'], violet),
      pick(c, ['terminal.ansiBrightCyan'], blue),
      pick(c, ['terminal.ansiBrightWhite'], fg),
    ].map(normalizeColor) as ThemeTokens['ansi'],
  };
}

export function themeCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--v-bg': tokens.bg,
    '--v-bg-chrome': tokens.bgChrome,
    '--v-bg-sidebar': tokens.bgSidebar,
    '--v-bg-panel': tokens.bgPanel,
    '--v-bg-input': tokens.bgInput,
    '--v-bg-hover': tokens.bgHover,
    '--v-bg-selected': tokens.bgSelected,
    '--v-bg-active': tokens.bgActive,
    '--v-fg': tokens.fg,
    '--v-fg-muted': tokens.fgMuted,
    '--v-fg-active': tokens.fgActive,
    '--v-fg-disabled': tokens.fgDisabled,
    '--v-border': tokens.border,
    '--v-border-subtle': tokens.borderSubtle,
    '--v-accent': tokens.accent,
    '--v-accent-muted': tokens.accentMuted,
    '--v-blue': tokens.blue,
    '--v-green': tokens.green,
    '--v-red': tokens.red,
    '--v-orange': tokens.orange,
    '--v-violet': tokens.violet,
    '--v-success': tokens.success,
    '--v-warning': tokens.warning,
    '--v-error': tokens.error,
    '--v-info': tokens.info,
    '--v-focus': tokens.focusRing,
    '--v-status-bg': tokens.statusBg,
    '--v-status-fg': tokens.statusFg,
    '--v-tab-active-bg': tokens.tabActiveBg,
    '--v-tab-inactive-bg': tokens.tabInactiveBg,
    '--v-tab-active-fg': tokens.tabActiveFg,
    '--v-tab-inactive-fg': tokens.tabInactiveFg,
    '--v-tab-border': tokens.tabBorder,
    '--v-terminal-bg': tokens.terminalBg,
    '--v-terminal-fg': tokens.terminalFg,
    '--v-terminal-cursor': tokens.terminalCursor,
    '--v-terminal-selection': tokens.terminalSelection,
  };
}

export interface ThemeRoot {
  style: { setProperty(property: string, value: string): void };
  dataset: Record<string, string | undefined>;
}

export function applyTheme(theme: ThemeJson, root: ThemeRoot): ThemeTokens {
  const tokens = buildTheme(theme);
  for (const [key, value] of Object.entries(themeCssVars(tokens))) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = tokens.type;
  root.dataset.themeId = tokens.id;
  return tokens;
}

export function xtermTheme(tokens: ThemeTokens) {
  return {
    background: tokens.terminalBg,
    foreground: tokens.terminalFg,
    cursor: tokens.terminalCursor,
    cursorAccent: tokens.terminalBg,
    selectionBackground: tokens.terminalSelection,
    black: tokens.ansi[0],
    red: tokens.ansi[1],
    green: tokens.ansi[2],
    yellow: tokens.ansi[3],
    blue: tokens.ansi[4],
    magenta: tokens.ansi[5],
    cyan: tokens.ansi[6],
    white: tokens.ansi[7],
    brightBlack: tokens.ansi[8],
    brightRed: tokens.ansi[9],
    brightGreen: tokens.ansi[10],
    brightYellow: tokens.ansi[11],
    brightBlue: tokens.ansi[12],
    brightMagenta: tokens.ansi[13],
    brightCyan: tokens.ansi[14],
    brightWhite: tokens.ansi[15],
  };
}
