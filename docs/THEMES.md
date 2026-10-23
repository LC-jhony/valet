# Themes

## Source of truth

VALET bundles four theme files:

- `src/themes/min-dark.json`
- `src/themes/min-light.json`
- `src/themes/carbon-dark.json`
- `src/themes/carbon-light.json`

They are VS Code theme documents. No component defines its own palette. The
only literal palette values in CSS are the initial `:root` fallbacks, which
mirror Min Dark so the first paint is styled; `shared/theme.ts` overwrites every
token at runtime from the active JSON file. Neutral `rgba()` shadows, overlays
and scrims are effects, not theme colours.

The renderer loads every `src/themes/*.json` document through a Vite glob in
`src/themes/index.ts`. `shared/themes.ts` is the selectable catalogue and the
validation boundary used by `desktop.json`, the CLI and the native window
background. Adding a JSON file makes it available to the renderer; adding a
matching catalogue entry makes it selectable from Settings, menus, the command
palette and `valet theme`.

The Min themes are based on **Min Theme** by Miguel Solorio and are
MIT-licensed. See [NOTICE](../NOTICE). Carbon Dark and Carbon Light are bundled
from the repository's existing theme assets.

## Semantic mapping

`buildTheme()` maps VS Code colour keys to `ThemeTokens` and then to the
`--v-*` CSS custom properties. Important mappings:

| VALET token | Source keys |
| --- | --- |
| `bg` | `editor.background` |
| `bgChrome` | `titleBar.activeBackground`, `activityBar.background` |
| `bgSidebar` | `sideBar.background` |
| `bgInput` | `input.background`, `editor.background` |
| `fg` | `editor.foreground`, `foreground` |
| `fgMuted` | `foreground` |
| `fgActive` | `list.activeSelectionForeground`, `tab.activeForeground`, `editor.foreground` |
| `accent` | theme focus/accent colour, then symbol/accent fallbacks |
| `blue` | `symbolIcon.fieldForeground`, `debugIcon.startForeground`, `textLink.foreground` |
| `red` | `terminal.ansiRed`, debug disconnect/breakpoint keys |
| `orange` | `symbolIcon.enumeratorForeground`, `variable.parameter.function` |
| `border` | `focusBorder`, `peekView.border` |
| `terminal*` | `terminal.background`, `editor.foreground`, selection and ANSI keys |

The xterm palette is derived from the same tokens by `xtermTheme()`. Terminal
colours therefore change with the workbench theme without a second palette.

## Semantic corrections

Min Dark has no dedicated green. The adapter maps `success`/green to the theme's
blue in dark mode. Min Light does define green values, but some are too light for
text on a white editor background. Carbon themes have the same kind of
upstream-token gaps, so the adapter applies the same rules to every bundled
document.

`ensureContrast(color, background, 4.5)` performs a deterministic WCAG AA
correction **inside the theme's hue**: it darkens the colour in small steps only
until the contrast target is met. It does not introduce a new hue or replace the
theme. Success/error/warning/info accents pass through this function.

`fgDisabled` remains intentionally low-contrast: it is reserved for disabled
chrome. Informational copy and informational icons use `fgMuted` with component
overrides, so dark-theme helper text does not inherit the disabled tone.

## Applying a theme

1. The renderer reads `desktop.json` through the native bridge.
2. `applyTheme(theme, document.documentElement)` writes every `--v-*` property,
   `data-theme` (`dark`/`light`) and `data-theme-id`.
3. The window background is selected from the saved theme's type at creation to
   avoid a bright first paint. The operating system draws the native frame and
   window buttons; VALET does not paint its own minimise, maximise or close
   controls. Screenshots made with `capturePage` show only the web contents, so
   the OS frame is not visible in them.
4. Changing the theme through Settings, the command palette, the View menu or
   `valet theme` persists the choice to `desktop.json`.
5. The Terminal view rebuilds the xterm theme tokens when the theme changes.

## Changing a bundled theme

Do not edit component CSS. A visual change belongs in one of the JSON files;
`shared/theme.ts` maps the changed keys. Then:

1. Verify every token resolves (no `undefined` CSS variables).
2. Run `npm test` for contrast, token coverage and xterm palette checks.
3. Run `npm run smoke` and inspect the workbench in both dark and light themes.
4. Document any semantic correction, as is done for dark `success`.

`npm test` also checks that every catalogue entry matches the identity, display
name and type in its JSON document. The Windows and Linux builds use the native
window frame; macOS uses `hiddenInset` with the native traffic lights over the
app toolbar.
