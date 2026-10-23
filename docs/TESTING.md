# Testing evidence

## Automated tests

Commands:

```bash
npm run typecheck
npm test
```

Result at the time of this release (2026-10-22):

```text
Test Files  7 passed (7)
Tests       46 passed (46)
```

Coverage by area:

| File | What it verifies |
| --- | --- |
| `tests/theme.test.ts` | Min and Carbon parsing, folder/catalogue sync, AA contrast for semantic tones, dark success mapping, CSS variable coverage, xterm palette, WCAG correction |
| `tests/ports.test.ts` | `ss` and `lsof` parsing, managed service/project merge, secondary and extra ports, host listeners on multiple addresses, managed/foreign conflicts, identical-address non-conflicts, port suggestions |
| `tests/engine.test.ts` | Site/service JSON mapping including suggestions and port conflicts, PHP extensions, PHP runtime/default/patch mapping from `/api/status`, bare-array database response, phpMyAdmin filtering, CSRF and request shape, service-port payload preservation, PHP rollback, argument allow-list, traversal rejection, engine binary validation |
| `tests/migration.test.ts` | Detection only from legacy config/sites, checksummed backup, idempotency, new backup on config change |
| `tests/terminal.test.ts` | Real `script(1)` shell, command execution, engine shim `PATH`, absolute-cwd rejection, session limits |
| `tests/php.test.ts` | Dependency-free Composer PHP-constraint parser, including unsupported syntax returning “unknown” instead of a false warning |
| `tests/config.test.ts` | Bundled Carbon themes are accepted, unknown ids fall back, and old `panelOpen`/`panelHeight` keys are ignored |

The tests use temporary directories and do not modify the working tree, engine
data or user configuration.

## Builds

```bash
npm run build
```

Observed:

- `vite build`: 1,966 modules transformed.
- Renderer: `index-4OGrkama.css` 45.32 KB (8.55 KB gzip) and
  `index-TEjUFKbt.js` 745.76 KB (196.63 KB gzip).
- `tsc -p tsconfig.electron.json`: main and preload emitted under
  `dist/electron`.
- `esbuild` CLI: `dist/cli/valet.js` 97.9 KB, version 1.0.0.
- Type check passes for renderer, shared, CLI, tests and Electron main.

Vite reports one large renderer chunk and an ESM-config warning. Both are
non-fatal; code-splitting remains a pending optimization.

## Desktop smoke

```bash
DISPLAY=:0 npm run smoke
```

The script captures nine images after a real Electron launch and asserts the new
layout. Electron's `capturePage` records the web contents only, so the native OS
frame and its buttons are not in these images:

- the removed bottom panel is absent, and the Terminal view is the only xterm
  host;
- `valet-min-dark.png` — workbench in Min Dark;
- `valet-min-light.png` — the same state in Min Light;
- `valet-carbon-dark.png` and `valet-carbon-light.png` — the two Carbon themes
  render through the same semantic token adapter;
- `valet-settings-themes.png` — Appearance lists exactly four bundled themes
  with their JSON-backed previews;
- `valet-project-detail.png` — the fixture project selected, including its
  suggested service (`mysql`, from `DB_CONNECTION`) and PHP runtime selector;
- `valet-logs-diagnostics.png` — Logs & diagnostics with API online,
  engine version, zero problems and the real engine log line;
- `valet-engine-output.png` — the **Engine output** tab after clicking
  **Run doctor**, with non-empty real `valet doctor` output;
- `valet-terminal.png` — a real PTY session after running
  `echo VALET_SMOKE_$((6*7))`, leaving the view and returning. The smoke fails
  unless the output `VALET_SMOKE_42` is present both times, which verifies live
  terminal input and native-buffer replay.

The run used the isolated Lerd v1.37.1 API with one fixture project,
`acme.test`, zero installed services and zero installed PHP runtimes. The
terminal used `/bin/bash` and an isolated `HOME` so the shell did not prompt for
first-run configuration. The screenshots were visually inspected for hierarchy,
overflow, contrast and theme switching. They are copied into
`docs/screenshots/`.

## Packaged smoke

`npm run dist` produced both Linux artifacts:

| Artifact | Size | Contents checked |
| --- | --- | --- |
| `release/valet-desktop-1.0.0-linux-x86_64.AppImage` | 125 MB | `valet.desktop`, `resources/app.asar`, current renderer and CLI assets |
| `release/valet-desktop-1.0.0-linux-amd64.deb` | 100 MB | `/opt/VALET/valet-desktop`, `/usr/share/applications/valet.desktop`, `app.asar`, AppArmor profile, `postinst` sandbox setup |

The unpacked binary, the AppImage and the application extracted from the deb
were each launched with `VALET_SMOKE=1`, an isolated `HOME` and the live fixture
engine. All three exited 0 and produced the same nine captures. Example:

```bash
HOME=/tmp/opencode/valet-packaged-home-final4 \
VALET_ENGINE_BIN=/tmp/opencode/lerd-release/lerd \
VALET_SMOKE=1 VALET_SMOKE_OUT=/tmp/opencode/valet-packaged-smoke-final4 \
release/linux-unpacked/valet-desktop --no-sandbox
```

The packaged assertions cover more than image capture: no `.bottom-panel` is
mounted, Logs contains zero xterm instances, Engine output contains a real
`Lerd Doctor` result, and a real PTY command produces `VALET_SMOKE_42` both
before and after leaving and re-entering Terminal. The deb payload was also
run from its extracted tree:

```bash
HOME=/tmp/opencode/valet-deb-home2 \
VALET_ENGINE_BIN=/tmp/opencode/lerd-release/lerd \
VALET_SMOKE=1 VALET_SMOKE_OUT=/tmp/opencode/valet-deb-smoke2 \
/tmp/opencode/valet-deb-check2/root/opt/VALET/valet-desktop --no-sandbox
```

FUSE is not installed on this host, so the AppImage was launched through
`APPIMAGE_EXTRACT_AND_RUN=1` **without** an explicit `--no-sandbox` argument.
Its `AppRun` helper detected that unprivileged user namespaces are unavailable
and added the switch at runtime; the smoke exited 0. The embedded
`valet.desktop` uses `AppRun %U` and remains valid.

Deb validation on the final artifact:

- `desktop-file-validate` exits 0 for `/usr/share/applications/valet.desktop`;
- `bash -n` exits 0 for `postinst` and `postrm`;
- the AppArmor profile compiles with
  `apparmor_parser -Q -K -S` (cache disabled, no root load);
- `/opt/VALET/valet-desktop`, `resources/app.asar`, the AppArmor profile, the
  desktop entry and the application icon are present.

**Sandbox caveat:** the application requests Chromium's sandbox in packaged
builds. In this checkout the unpacked `chrome-sandbox` helper is not
root-owned/setuid, and unprivileged user namespaces are restricted, so the
unpacked binary and the deb-extracted binary were invoked with `--no-sandbox`.
Installing the deb as root was not executed in this environment; its metadata,
file list and maintainer scripts were inspected instead. The AppImage fallback
path was exercised successfully.

The smoke requires the live fixture engine and a selected project; it is not a
standalone offline check.

Final artifact digests:

```text
21aa6a2fe6f46c6be502f01141f0df2966e0a02d348e9c614de46ce7b8e4bec8  valet-desktop-1.0.0-linux-x86_64.AppImage
77a5bc3b073fa22e941fcc173e563a6e997120ae78e77ed242eef3d33dddcc45  valet-desktop-1.0.0-linux-amd64.deb
```

## Live engine checks

Lerd v1.37.1 was started with an isolated `HOME` using its `serve-ui` command.
The API was exercised without creating containers:

| Command | Result |
| --- | --- |
| `GET /api/version` | `{"current":"1.37.1"}` |
| `GET /api/status` | `php_default` 8.5, `php_fpms` null (no installed runtime), DNS down, nginx stopped |
| `valet status --json` | engine HTTP online, 1 project, 0 services, 0 installed PHP, 8 available |
| `valet doctor --json` | 12 checks, all pass, exit 0 |
| `valet projects` | `acme.test`, PHP 8.2, Laravel 11, stopped |
| `valet projects services acme.test --json` | no attached services; `mysql` suggested from the env file |
| `valet ports` | 22 host listeners merged, no managed conflicts; multiple addresses preserved |
| `valet php` | 8 available runtimes, 0 installed, with State/Runtime/Projects columns |
| `valet php extensions 8.3 --json` | real endpoint response: not built, empty module/extension lists |
| `valet databases --json` | `{"engines":[]}` |
| `valet services` | clean empty state; phpMyAdmin absent |
| `valet logs lerd-ui` | SSE accepted; real line `container lerd-ui is not running` |
| `valet migrate detect` | no false adoption with only a binary present |

The engine's PHP endpoint exposed 7.4–8.6 as installable and no installed
runtime. The fixture's `sites.yaml` and Composer constraint both report PHP 8.2.
The UI dependency-warning path is covered by unit tests. No PHP build, service
container or database was started.

`/api/status` returned `php_fpms: null` and `php_default: "8.5"`. VALET maps
those fields to `running`, `default`, `patch`, `xdebugMode`, `ports` and
`updateAvailable`; the mapping is covered by an automated test. A live
`FPM running` / `FPM stopped` label requires installing a runtime and is listed
below as pending.

## Migration check

A temporary legacy layout was created with `config.yaml` and `sites.yaml`.
`valet migrate detect` found one site; `valet migrate apply --yes` created a
verified backup under the isolated VALET config directory and left the legacy
files untouched. `migrate status` reported the manifest, site count and file
size. The automated migration tests repeat detection, backup and idempotency.

Detection is intentionally based on legacy config/sites content. Merely having
a `lerd` binary on `PATH` does not trigger migration; this was verified against
the isolated engine and is covered by a unit test.

## CLI checks

Verified with isolated `HOME`/`VALET_CONFIG_HOME`:

- `help`, `version`, `status`, `doctor`, `doctor --json`;
- `config get/path/set`, `theme min-light`, `theme min-dark`, `theme carbon-dark`;
- `projects`, `projects services`, `services`, `php`, `php extensions`,
  `databases`, `ports`, `ports check`, `logs`;
- JSON output for `doctor`, `status`, `projects services`, `php extensions`,
  `databases` and `ports`;
- `migrate detect/apply/status`;
- engine detection with `VALET_ENGINE_BIN=/tmp/opencode/lerd-release/lerd`;
- exit codes 0 and 2 for success and usage errors;
- non-interactive confirmation refusal and the documented `--yes` path.

Shell test note: in `zsh`, unquoted variables are not word-split. The first
multi-word command loop was invalid; commands were re-run with explicit word
splitting and all listed results are from the corrected run.

## Not exercised end-to-end

These require a full, permitted local engine installation with Podman services
and are intentionally not claimed as full end-to-end coverage:

- creating, starting or stopping MySQL/PostgreSQL/Redis containers;
- a successful project service add/detach against a real container
  (`service:add`, `service:remove`; the route, validation and UI wiring are
  covered by unit tests and the suggestion is visible in the live fixture);
- moving a live service primary/secondary port and verifying persistence;
- building a PHP runtime and a successful or failed live PHP pin with rollback;
- observing a live `FPM running`/`FPM stopped` state, engine default and patch
  for an installed runtime (the `/api/status` mapping is unit-tested);
- issuing TLS certificates and resolving `.test` DNS;
- removing phpMyAdmin (guarded, but no real container was present);
- macOS and Windows runtime behaviour;
- the deb/AppImage installers as root, including the setuid helper install;
- multi-monitor/window-manager edge cases.

These are listed in the final report as pending verification, not as completed
work.
