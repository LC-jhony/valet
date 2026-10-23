# Diagnostics

## `valet doctor`

`valet doctor` is read-only. It never starts, stops or changes the engine.

Checks:

| Check | Meaning |
| --- | --- |
| Engine binary | `lerd`/`valet-engine` found on PATH, `VALET_ENGINE_BIN`, or saved path |
| Engine API | `/api/version` answered at `VALET_ENGINE_URL` or `http://127.0.0.1:7073` |
| API binding | Configured API URL is loopback |
| Config/state directories | Path and permissions (warns if group/world accessible) |
| Desktop config | `desktop.json` exists |
| Projects / Services / PHP | Live engine lists, when the API is online |
| Ports | Host listeners merged with managed mappings |
| phpMyAdmin | Presence of the retired container |
| Adoption | Whether a manifest and backup exist |

Exit code is `1` if the API is offline or any check reports `✗`. A missing
binary with an already-running API is a warning (`·`), not a failure.

`valet doctor --json` is suitable for support bundles. It strips ANSI codes.
`valet doctor --engine` also runs the upstream `lerd doctor` when the binary is
available; that output is not parsed.

## Offline mode

If the API is offline:

- the desktop still opens, themes and settings work;
- the engine banner explains how to start it;
- projects/services/PHP/databases lists are empty rather than fabricated;
- ports shows host listeners only;
- terminal sessions can still open as host shells; VALET prepends the engine
  shim directory only when it exists, and shims themselves need the engine to
  resolve a project pin;
- logs cannot stream;
- start/stop actions use the engine binary when available.

Run `valet start` or start the engine as you normally would. If the binary is
missing, set it in Settings → Engine or:

```bash
valet config set engine-path /path/to/lerd
```

## Port troubleshooting

```bash
valet ports
valet ports check 3306
valet ports check 3306 --address 0.0.0.0
```

- `configured` means a managed mapping exists but nothing is listening.
- `listening` means the expected process or an engine-managed listener owns it.
- `conflict` means a managed mapping is occupied by an unexpected process, or
  two managed mappings claim the same protocol/port.
- Host-only rows are listeners not owned by a managed mapping; every listening
  address is shown so a port is never reported free incorrectly.
- Starting a service is refused when the engine reports any required port busy
  or the configured primary port fails a fresh bind check.
- External processes are never killed. Change the managed port with
  `valet services port <service> <port>`. For a secondary container mapping use
  `--container <container-port>`; the other mapped ports are preserved.

## Logs

List units with `valet logs`. Sources are derived from the fixed engine units
plus installed services and PHP runtimes:

- `lerd-nginx`, `lerd-watcher`, `lerd-ui` are always listed as engine units;
- `lerd-<service>` for each installed service;
- `lerd-php<xy>-fpm` for each installed PHP runtime.

A listed unit can be stopped; the engine then sends a status line such as
"container is not running". Stream with `valet logs <unit>` or use the Logs &
diagnostics view. The stream is SSE from the engine; stopping the view aborts
the connection. Lines are displayed as data and never executed. The desktop
view also shows engine mode/version, the API base and a read-only `doctor`
action. Its tabs are **Container logs**, **Engine output** and **Problems**;
the last two replace the former bottom panel and remain available even when no
container unit exists.

## Terminal diagnostics

- The host shell must be one of `bash`, `zsh`, `sh`, `fish`, `dash`.
- Terminals run through `script(1)` on Linux/macOS; `script` must exist.
- The engine shim directory (`~/.local/share/lerd/bin`) is prepended to `PATH`
  only when it exists. Inside a project, that is what makes `php` and
  `composer` follow the project pin instead of the host runtime.
- Working directory must exist and be absolute.
- Maximum 8 sessions; close one if the limit is reached.
- Resize is local only; run `stty size` if a program depends on the PTY size.

## Migration diagnostics

```bash
valet migrate status
```

Shows the manifest, backup path, site count and checksums. If a backup exists
but the manifest is missing, `status` reports the plan without claiming
adoption. `apply` is idempotent only when `config.yaml` and `sites.yaml`
checksums match the manifest.

## Reporting a bug

Include:

```bash
valet version
valet doctor --json
node --version
uname -a
```

and the relevant app/engine log excerpt. Redact project paths, tokens, database
credentials and private URLs before publishing.
