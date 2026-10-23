# Compatibility

VALET is an interface and orchestration layer around the existing Lerd engine.
It is not a fork of the engine's data model, and it does not rename persisted
resources.

## Preserved as-is

| Area | Preserved identifier or resource |
| --- | --- |
| Engine | `lerd` binary, version, HTTP API, CLI flags and output |
| Engine configuration | `~/.config/lerd/config.yaml` |
| Engine sites | `~/.local/share/lerd/sites.yaml` |
| Engine data/cache | `~/.local/share/lerd`, `~/.cache/lerd` |
| Project marker | `.lerd.yaml` |
| Containers | `lerd-*` names, labels, images, networks |
| Services | Existing service names (mysql, postgres, redis, ...) |
| Volumes | Named volumes and database contents |
| Domains | Existing `.test` (or configured TLD) hostnames |
| TLS | Existing locally trusted CA and project certificates |
| phpMyAdmin | Its container and data are not removed by adoption or upgrade |
| Project files | Never moved or copied by migration |
| Databases | Never dumped, recreated or migrated by VALET |
| Upstream authorship | MIT copyright and notices retained |

## Renamed only at the product/interface layer

| Before (concept) | VALET surface | Persisted identifier changed? |
| --- | --- | --- |
| Lerd dashboard / web UI | VALET desktop window | No |
| Lerd "sites" | Projects | No; engine API still returns sites |
| Lerd "link" | Projects → Add project | No; engine command is still `link` |
| Lerd "unlink" | Projects → Remove | No; engine action is still `unlink` |
| Lerd "use" (global PHP) | Global PHP default | No; engine command is still `use` |
| Lerd service list | Services view | No; names unchanged |
| Lerd port mappings | Ports view | No; container mappings unchanged |
| Lerd UI exec/dashboard | Native desktop views | No engine endpoint renamed |

The complete command mapping is in `shared/mapping.ts` and rendered in
Settings → About. See [RENAMING.md](RENAMING.md) for the detailed table.

## phpMyAdmin retirement

phpMyAdmin is removed from active VALET features:

- filtered out of desktop service lists and CLI service tables;
- `services start|stop|restart|port|remove phpmyadmin` is rejected;
- the database engines, volumes, databases and data remain available;
- the only removal path is an explicit confirmation:
  `valet phpmyadmin remove --yes` or Settings → Legacy phpMyAdmin;
- removal maps strictly to `lerd service remove phpmyadmin` with
  `removeData=false` semantics; it does not drop databases.

`valet phpmyadmin status` still reports presence so an operator can see legacy
state.

## PHP

- Each project can pin a PHP version through the engine's
  `POST /api/sites/{domain}/php` endpoint.
- Host PHP is never installed, replaced, linked or edited.
- Global PHP changes only affect the engine and require confirmation.
- Project compatibility ranges are shown; out-of-range choices are disabled
  where the engine exposes `php_min`/`php_max`. Composer's `require.php`
  constraint is shown separately and unsupported constraint syntax is left
  unevaluated rather than presented as a false warning.
- PHP-FPM serves web requests, while PHP CLI and Composer use the engine's
  per-project shims. VALET prepends the engine shim directory to terminal
  `PATH` when it exists, so the host runtime is still untouched.
- Installed runtimes show the engine default, FPM running/stopped state, patch
  build, xdebug mode, configured FPM ports and update availability when
  `/api/status` reports them. A missing status entry is shown as unknown, never
  as “ready”.
- If a pin switch fails, VALET asks the engine to restore the previous pin and
  surfaces both the original error and any rollback error.
- PHP builds stream real engine output into Logs & diagnostics → Engine output.

## Project services

- Attached services are read from the engine's `services` and
  `declared_services` fields; framework suggestions come from
  `suggested_services`.
- `service:add` installs or starts through the engine and may edit the project's
  `.lerd.yaml` and env file. It is confirmed first.
- `service:remove` detaches the service from the marker and env but leaves the
  container and its volumes in place.
- `service:declare` records an env-wired service without installing anything;
  `service:dismiss` only suppresses the suggestion.
- The upstream service names, env wiring and `.lerd.yaml` schema are unchanged.

## Ports and network

- The engine's service port mappings are not rewritten during migration.
- VALET shows the host port for every mapping and the container-internal port
  for secondary mappings. The engine API does not expose the primary
  container-internal port, so VALET does not invent one.
- Primary and secondary mappings can be moved without clearing `extra_ports`
  or the other published ports.
- VALET defaults new checks to `127.0.0.1`.
- A port change is refused if a real bind check fails. VALET does not stop the
  process that owns the port. If the engine rejects a multi-port save, its
  snapshot restores the previous mappings.
- The upstream engine binds its UI/API to `0.0.0.0:7073`; its own LAN gate is
  the security boundary. VALET connects over loopback.
- Existing LAN/public ports exposed by projects are shown but not modified.

## Known differences and limits

1. **Terminal implementation.** VALET uses the host `script(1)` utility rather
   than a native PTY binding. It supports interactive shells and ANSI output,
   and prepends the engine shim directory when present, but terminal resizes
   are not propagated to the process; xterm reflows locally.
2. **Desktop platform.** The engine supports Linux and macOS. The Electron code
   also has Windows window/CLI branches, but this release is validated on
   Linux only.
3. **Engine API offline.** The desktop starts in read-only offline mode. It
   cannot list projects, services or PHP until the API is reachable.
4. **Engine binary vs API.** Some actions (link, global PHP, opening the
   dashboard) require the engine binary as well as the API. `doctor` reports
   which part is missing.
5. **phpMyAdmin removal.** Data removal is intentionally not offered. Use the
   engine manually if you need to delete its volumes.
6. **No engine rename.** URL schemes, API paths, environment identifiers and
   container labels remain Lerd identifiers. They are technical contracts, not
   product branding.

## Upgrade and rollback

- Replacing the desktop app does not touch engine files or containers.
- Adoption backups are additive; the app never restores them automatically.
- Removing VALET's config directory does not remove the engine's data.
- To stop using VALET, simply stop launching it. The engine can be managed with
  the original `lerd` CLI as before.
