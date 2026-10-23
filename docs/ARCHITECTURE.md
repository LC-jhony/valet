# Architecture

## 1. Technology decision

VALET uses **Electron + React + Vite + TypeScript**. The engine remains the
existing Go binary and is not reimplemented.

| Criterion | Electron (chosen) | Tauri (not chosen) |
| --- | --- | --- |
| Local process integration | Mature Node APIs for PTYs, sockets, SSE, child-process allow-lists and window lifecycle. | Requires Rust command handlers for the same work; more split logic. |
| Reuse of the existing logic | The engine is already a Go daemon with an HTTP API and CLI. Node can call both directly. | Same HTTP/CLI integration, but no practical reuse gain for this UI. |
| Cross-platform delivery | Linux and macOS targets are supported by the engine; Electron packaging is well understood. | Smaller binaries, but platform WebView differences add test surface. |
| Resource use | Higher baseline, acceptable for a developer control plane. | Lower baseline, not a decisive benefit here. |
| Security | `contextIsolation`, sandbox, typed preload and no Node in the renderer are explicit and auditable. | Comparable isolation model, but the team would own more bridge code. |
| Installation/updates | electron-builder targets AppImage/deb, dmg/zip, nsis/zip. | Smaller installers, but no meaningful advantage for this scope. |

Electron was chosen because the difficult parts of this product are local
process management and a rich workbench, not download size. The security
boundary is explicit rather than implicit.

## 2. Processes and boundaries

```text
renderer (Chromium sandbox)
  React views, state, themes, xterm rendering
  window.valet: typed, context-bridged API only
        │
        ▼
preload (isolated world)
  ipcRenderer.invoke / validated event subscriptions
        │
        ▼
main (Node + Electron)
  shared/engine.ts       HTTP + CLI allow-list adapter
  shared/ports.ts        pure port model
  shared/host.ts         ss/lsof + socket bind checks
  electron/terminal.ts   PTY sessions through script(1)
  electron/logs.ts       SSE log streamer
  shared/config.ts       XDG paths + atomic writes
  shared/migration.ts    in-place adoption and checksum backup
        │
        ▼
existing Lerd engine
  loopback HTTP API, CLI, containers, volumes, sites, certificates
```

The renderer cannot import `shared/engine.ts`, `shared/config.ts`,
`shared/migration.ts`, `shared/host.ts` or Node built-ins. This is enforced by
the Vite build (browser target) and by the renderer's import graph; the Electron
tsconfig compiles the main-process code separately.

## 3. Workbench

- `electron/main.ts` uses the operating system's native window frame and
  minimise/maximise/close controls on Windows and Linux, and macOS inset native
  traffic lights. The in-window toolbar remains for app navigation. It enables
  the Chromium sandbox in packaged builds and installs a single-instance lock.
- `src/App.tsx` owns layout, routing, the welcome screen, shortcuts and the
  command palette.
- `src/state/store.tsx` is the single state/action layer. It applies themes,
  refreshes engine data, validates actions and turns errors into toasts and
  problems.
- Eight views: Projects, PHP, Services, Ports, Databases, Terminal,
  Logs & diagnostics, Settings. Tabs can hold any view; the activity bar opens or focuses one.
- Terminals live only in the Terminal view. Logs & diagnostics owns live
  container logs plus the engine command output and problem list, so no second
  xterm instance is mounted for the same PTY.
- The status bar reflects the selected project, engine state, port conflicts,
  service count and current theme.

Every visible control has a real action. There are no simulated command
buttons and no placeholder palettes.

## 4. Engine adapter

`shared/engine.ts` provides two paths:

1. **HTTP API** for normal management. Calls are limited to known `/api/...`
   routes. The API is probed on `GET /api/version`; offline mode is a first-class
   state.
2. **CLI allow-list** for actions that only the binary exposes. `EngineCommand`
   is a discriminated union; `validateEngineArgs` maps it to a fixed argument
   vector. `execFile` is used with no shell. Working directories must be
   absolute directories accessed through a validated IPC call.

Site actions are limited to `php`, `unlink`, `pause`, `unpause`, `secure`,
`unsecure`, `restart`, `rebuild`, and the project-service actions `service:add`,
`service:remove`, `service:declare` and `service:dismiss`. Service actions accept
only a validated `name`; phpMyAdmin is rejected. A failed PHP switch triggers a
compensating request for the previous pin; the adapter reports a failed
compensation instead of hiding it.

PHP installation uses the engine's SSE endpoint
`POST /api/php-versions/install?version=<x.y>`. Build lines are forwarded to
Logs & diagnostics → Engine output through a dedicated event channel; the
request has a 30-minute abort limit. `phpVersions()` merges `/api/php-versions`,
`/api/php-installable` and `/api/status`, so installed runtimes carry the engine
default, FPM running state, patch, xdebug mode, ports and update flag instead of
a synthetic “ready” label. State-changing HTTP requests carry `X-Lerd-CSRF: 1`,
as required by the engine's loopback API.

## 5. Ports

`scanHostListeners` runs `ss -H -ltnup` on Linux and `lsof` on macOS, without
privileges. `collectPorts` merges host listeners with engine services and
project mappings:

- managed service and project ports are marked `configured`, `listening` or
  `conflict`;
- service secondary mappings keep their container-internal port; the engine API
  does not expose the primary container port, so only secondary internal ports
  are shown;
- host listeners that no managed mapping owns are still shown, including every
  listening address, so the UI never gives a false "port free" impression;
- a conflict is a duplicate **managed** TCP/UDP mapping or a managed mapping
  occupied by a process that is not that service or the engine;
- multiple addresses for the same protocol/port (for example systemd-resolved
  on `127.0.0.53` and `127.0.0.54`) are not treated as a conflict.

`isPortAvailable` performs a real bind check. It defaults to `127.0.0.1` unless
the caller explicitly checks a different address. Service port changes are
pre-checked, and starting an inactive service is blocked when the engine reports
any of its required ports busy or a fresh primary bind fails. VALET never kills
a process to free a port. Primary moves re-send `extra_ports`, and secondary
moves re-send the current primary override, because the engine endpoint replaces
those lists.

## 6. Terminals and logs

`TerminalManager` starts `script(1)` in a new session with the user's
environment, plus normalized terminal variables and the engine shim directory
first on `PATH` when it exists. It limits sessions to 8, buffers 64 KB per
session and accepts at most 64 KB per write. Input is sent through a validated
IPC invoke, not an unhandled `send` channel. Sessions belong to absolute
directories selected in the UI, optionally with a project label. When the
Terminal view remounts, each pane fetches that 64 KB tail and replays it before
live output continues, so leaving the view does not lose visible scrollback.

`LogStreamer` is the only component that opens the engine SSE stream. It accepts
only unit names matching `lerd-[a-z0-9-]+`, parses `data:` frames and forwards
lines to the renderer. The renderer never opens a cross-origin connection to
the engine. Engine command output and the problem list are store state rendered
by the same Logs & diagnostics view; neither opens a second terminal.

## 7. Configuration and data

- Configuration: `$XDG_CONFIG_HOME/valet` (default `~/.config/valet`)
- Data: `$XDG_DATA_HOME/valet` (default `~/.local/share/valet`)
- State and logs: `$XDG_STATE_HOME/valet` (default `~/.local/state/valet`)
- Cache: `$XDG_CACHE_HOME/valet` (default `~/.cache/valet`)

`VALET_CONFIG_HOME`, `VALET_DATA_HOME`, `VALET_STATE_HOME` and
`VALET_CACHE_HOME` allow isolated tests. Writes use a temporary file plus
`rename`; permissions are restricted to the user where relevant.

The engine keeps its own paths (`~/.config/lerd`, `~/.local/share/lerd`,
`~/.cache/lerd`) and its own `sites.yaml`/`config.yaml`.

## 8. Known architectural limits

- The upstream engine listens on `0.0.0.0:7073` and applies its own LAN gate.
  VALET cannot change that bind address without changing the engine. The
  adapter uses loopback and never forwards remote credentials.
- Terminal resize is not propagated to the PTY; xterm reflows locally. See
  `docs/COMPATIBILITY.md` for the exact limitation.
- The renderer bundle is currently one chunk (~712 KB minified). Code-splitting
  is a future optimization, not a correctness issue for a desktop app.
