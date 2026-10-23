# `valet` CLI

The CLI is the same TypeScript engine adapter used by the desktop app. It uses
`execFile` with a fixed argument allow-list and the engine's loopback HTTP API;
it never builds shell command strings.

## Install

```bash
npm run build:cli
./scripts/install-cli.sh
```

The installer symlinks `~/.local/bin/valet` (or `VALET_CLI_DIR`) to this
repository's `bin/valet`. It refuses to overwrite an existing command that is
not this wrapper, because Laravel Valet uses the same name. Use `--force` only
after verifying the existing command.

## Commands

```text
valet doctor [--json] [--engine]
valet status [--json]
valet start
valet stop
valet restart
valet version [--json]

valet projects [list|--json]
valet projects add <path>
valet projects remove <domain> [--yes]
valet projects php <domain> <version>
valet projects services <domain>
valet projects service add|remove|declare|dismiss <domain> <service> [--yes]
valet projects restart|pause|resume|secure|unsecure|rebuild <domain>
valet projects open <domain>

valet php [list]
valet php install <version>
valet php extensions <version> [--json]
valet php pin <domain> <version>
valet php use <version> [--yes]

# `valet php` lists PHP, State, Runtime and project count. Runtime shows
# FPM running/stopped or unknown; State marks the engine default.

valet services [list|--json]
valet services start|stop|restart <name>
valet services port <name> <port> [--container <port>]
valet services logs <name>
valet services remove <name> [--yes]

valet ports [list|--json]
valet ports check <port> [--address <ip>] [--json]

valet databases [--json]

valet logs [--json]
valet logs <unit>

valet config [get|set|path] [key] [value]
valet theme [min-dark|min-light|carbon-dark|carbon-light]
valet migrate [status|detect]
valet migrate apply [--yes]
valet phpmyadmin [status|remove] [--yes]
valet open [domain|dashboard]
```

`help`, `--help`, `-h`, `--version` and `-v` are also supported.

## Examples

```bash
valet doctor                       # read-only diagnostics; exit 1 on failed checks
valet status                       # engine version, projects, services, PHP, backup
valet projects add ~/Code/acme     # register in place; files never moved
valet projects php acme.test 8.3   # pin one project; host PHP is not changed
valet projects services acme.test  # attached and suggested services
valet projects service add acme.test mailpit --yes
                                    # engine installs/wires; data is preserved
valet php install 8.4              # stream real engine build output
valet php extensions 8.3 --json    # image modules and declared extensions
valet services port mysql 3307     # only if 3307 is free
valet services port mailpit 11025 --container 1025
                                    # move a secondary container mapping
valet services start mysql         # pre-checks the primary configured port first
valet ports check 3000 --json
valet databases --json             # engines, projects and sizes
valet logs lerd-nginx              # Ctrl+C to stop
valet migrate detect
valet migrate apply --yes
valet theme carbon-dark
```

## Behaviour and exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success, or a read-only command that completed |
| `1` | Runtime failure (engine error, offline API where required, failed check, unavailable port) |
| `2` | Usage error, unknown option/command, missing confirmation in non-interactive mode |

- `--json` is machine-readable where supported. Streaming logs reject `--json`.
- Destructive or high-impact actions require `--yes` when stdin is not a TTY:
  project removal, service removal, global PHP change, phpMyAdmin removal,
  migration apply.
- `phpMyAdmin` is filtered out of service listings and cannot be started,
  stopped, moved or removed through `services`. Use the explicit
  `valet phpmyadmin` namespace.
- `services remove` sends `removeData=false`. Named database volumes are not
  deleted by VALET.
- `projects services` is read-only. `projects service add` may install and start
  the container and edits the project env, so it requires confirmation in a TTY
  or `--yes`. `remove` edits the engine marker and env but keeps the container
  and data. `declare` records an env-wired service; `dismiss` only suppresses a
  suggestion.
- `services port` preserves `extra_ports` and moves only the requested mapping.
  Use `--container` for a secondary mapping of a multi-port service; the primary
  override and extras are sent back untouched. If the engine rejects a save, its
  own snapshot restores the previous mappings.
- `projects php` and `php pin` ask the adapter to restore the previous project
  pin when the engine reports a failed switch. A rollback failure is reported
  explicitly instead of claiming success.
- `ports check` defaults to `127.0.0.1` and performs a real bind check. It never
  stops another process.
- `start` and `restart` wait for the engine API briefly before reporting. If the
  API is already online, `start` still asks the engine to start its containers.
- `doctor` exits `1` if any check fails. `--engine` additionally runs the
  upstream `lerd doctor` when a binary is available.

## Environment

| Variable | Effect |
| --- | --- |
| `VALET_ENGINE_BIN` | Explicit engine binary path |
| `VALET_ENGINE_URL` | API base, default `http://127.0.0.1:7073` |
| `VALET_CONFIG_HOME` | Config directory override |
| `VALET_DATA_HOME` | Data directory override |
| `VALET_STATE_HOME` | State directory override |
| `VALET_CACHE_HOME` | Cache directory override |
| `NO_COLOR` | Disable ANSI colour |
| `TERM=dumb` | Disable ANSI colour |

## Not exposed

There is no `exec`, `shell`, `run`, `eval`, plugin loader or arbitrary file
operation. The CLI cannot run a command that is not in `EngineCommand`.
