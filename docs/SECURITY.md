# Security model

## Trust boundary

```text
untrusted: web content, theme JSON, engine responses
renderer: Chromium sandbox, no Node, no direct filesystem or process access
preload: contextBridge with a fixed API, no raw ipcRenderer
main: trusted local process, validates every request
engine: separately installed local service
```

The renderer is loaded from the packaged `file://` bundle or the Vite dev
server. It has no `nodeIntegration`, no `webviewTag`, no remote module and
`sandbox: true`. Packaged builds keep the Chromium sandbox enabled; development
builds append `--no-sandbox` only because the setuid helper is not installed in
a source checkout. The smoke script passes `--no-sandbox` explicitly for the
same reason.

The AppImage desktop entry passes no sandbox override. Its `AppRun` helper
probes unprivileged user namespaces and only falls back to `--no-sandbox` when
the kernel or container blocks them. The deb `postinst` marks
`chrome-sandbox` setuid when user namespaces are unavailable, so an installed
deb uses the helper rather than disabling the sandbox.

## IPC

- Every handler is registered by the main process and checks
  `event.sender === window.webContents`.
- The preload exposes only typed methods from `shared/api.ts`. There is no
  generic `invoke(channel, ...)`, no `exec`, no `spawn`, no `eval`, no raw
  filesystem API.
- `terminal:input` uses the validated `invoke` path. The earlier `send`-only
  channel was removed because it had no main-process receiver.
- External URLs are restricted to `http:`/`https:` and opened by the OS.
- Navigation is restricted to the exact app URL; new windows are denied.
- Permissions are denied except clipboard-sanitized write.

## Engine command allow-list

`EngineCommand` is a union of operations such as `start`, `stop`, `link`,
`unlink`, `use-php`, `service-stop`, `remove-phpmyadmin` and `logs`.
`validateEngineArgs` maps each one to a fixed argument vector. There is no
free-form command and no shell string.

The engine binary itself is validated: it must be an absolute executable
regular file named `lerd` or `valet-engine` (including `.exe`). A renderer
cannot set `enginePath` to an arbitrary interpreter and use the allow-list as a
generic launcher. `VALET_ENGINE_BIN` and the saved path go through the same
validation.

Domains, service names, PHP versions, log units, working directories and ports
are validated before use. `execFile` receives an argument array, never a shell
command. Working directories must be existing absolute directories. Site actions
are restricted to `php`, `unlink`, `pause`, `unpause`, `secure`, `unsecure`,
`restart`, `rebuild`, `service:add`, `service:remove`, `service:declare` and
`service:dismiss`. PHP actions accept only `version`/`branch`; service actions
accept only a validated service `name`. phpMyAdmin is rejected by name in every
service handler. Add and detach are confirmed in the UI and require `--yes` in a
non-interactive CLI.

## Ports

Port checks bind a local socket. They never send signals or kill processes.
Changing a service port is refused if the target is bound. Starting an inactive
service is refused when the engine reports any required port busy or a fresh
primary bind fails. Secondary published ports are checked when edited, and the
engine validates every mapping again on save. The UI does not offer a "force
free" action.

## Terminals

A terminal is intentionally a shell for the user. The renderer can request a
shell only in an existing absolute directory and can write stdin; it cannot
choose a binary or pass command-line arguments. The shell is resolved from a
fixed allow-list (`bash`, `zsh`, `sh`, `fish`, `dash`) or falls back to
`/bin/sh`. Sessions are capped at 8, buffer 64 KB and input 64 KB per write.
The terminal inherits the user's environment because an interactive developer
shell without it would be surprising, and prepends the engine's shim directory
when it exists so project PHP/Composer pins apply. Do not open terminals on a
shared, untrusted desktop session.

## Logs

Unit names must match `lerd-[a-z0-9-]+`. The main process opens the SSE
connection; the renderer never opens a cross-origin connection. Log lines are
data, not instructions. VALET does not evaluate them.

## Content Security Policy

`index.html` sets:

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self' ws://localhost:5173 http://localhost:5173
            ws://127.0.0.1:5173 http://127.0.0.1:5173;
object-src 'none'; base-uri 'none'; form-action 'none'
```

The 5173 entries exist only for Vite HMR. Production traffic to the engine goes
through IPC, not renderer `fetch`. `style-src 'unsafe-inline'` is required by
React inline styles and CSS custom properties; no user-authored HTML is
rendered.

## Migration

Migration only reads fixed legacy paths and writes under VALET's config
directory. It does not follow arbitrary user-supplied paths, does not delete
source data and aborts on a checksum mismatch. Backups are created with mode
`0700`; files use user-only permissions.

## Secrets and local data

- The app does not implement telemetry; `telemetry` is forced to `false`.
- No credentials are sent to the renderer. Engine responses are mapped to
  display models.
- The renderer receives the user's home path and project paths for display and
  terminal actions.
- The upstream engine binds its UI/API to `0.0.0.0:7073` and uses its own LAN
  gate. VALET does not add remote access and connects through loopback. If you
  expose the engine, follow the upstream remote-control guidance.
- Terminal sessions and logs can contain secrets from commands you run or from
  services. They stay in this desktop process and are not uploaded.

## Known limitations

- The engine binary is trusted code. An executable named `lerd` that the user
  explicitly selects is still executed with allow-listed arguments.
- A compromised renderer could type into a user terminal, because that is the
  terminal feature. CSP, escaped React output and the absence of remote content
  reduce the attack surface but do not make an interactive shell safe against a
  fully compromised local UI.
- No application-level code signing or automatic update is configured in this
  repository.
- The upstream engine's network gate and container security are outside
  VALET's control. Keep the engine updated.

## Reporting

Report security issues privately to the maintainers of this repository. Do not
include credentials, private project source or unredacted logs in a public
issue.
