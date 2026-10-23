# Renaming table

The product name is **VALET** in the window, CLI, documentation, package
identity and user-facing vocabulary. Technical identifiers owned by the engine
are deliberately not renamed: they are contracts for existing projects,
containers, certificates and data.

| Layer | Old / engine identifier | VALET name or handling | Renamed on disk? | Reason |
| --- | --- | --- | --- | --- |
| Product | Lerd dashboard | VALET Desktop | No | Product identity only |
| Window title | Lerd | VALET | No | Window metadata |
| App ID | — | `sh.valet.desktop` | N/A | New application identity |
| Config root | `~/.config/lerd` | `~/.config/valet` for desktop settings | No; new directory alongside | Preserve engine state |
| Data root | `~/.local/share/lerd` | `~/.local/share/valet` for VALET data | No | Preserve containers/volumes |
| State/logs | Lerd state | `~/.local/state/valet` | No | New desktop state |
| Cache | `~/.cache/lerd` | `~/.cache/valet` | No | New desktop cache |
| CLI | `lerd` | `valet` wrapper, separate binary | No; both can coexist | Compatibility and Laravel Valet conflict guard |
| Site list | `sites.yaml` | Same file, read via API | No | Engine persistence |
| Global config | `config.yaml` | Same file, read via API | No | Engine persistence |
| Project marker | `.lerd.yaml` | Same file | No | Existing projects |
| Container prefix | `lerd-*` | Same names | No | Podman identity and DNS |
| Service names | `mysql`, `postgres`, `redis`, ... | Same names | No | Engine API |
| Volume names | Existing names | Same names | No | Database data |
| TLD / domains | `.test` and existing vhosts | Same | No | URLs and certificates |
| PHP | Host PHP | Untouched; project and global engine pinning only | No | Avoid host changes |
| phpMyAdmin | Service/admin UI | Filtered out; explicit legacy removal only | No | Retire feature, preserve data |
| Engine API | `/api/...` | Used as-is | No | Engine contract |
| Engine env vars | `LERD_*` (if used by engine) | Not renamed | No | Engine contract |
| Themes | Bundled Min and Carbon JSON | Same files, semantic adapter | No | Design source |
| Upstream links | lerd.sh, lerd-env/lerd | Kept as provenance/help links | No | Attribution and useful docs |

## Not renamed by design

The following are **never** subject to a blind product rename:

- the `lerd` executable and its version;
- `/api/` route names and response fields;
- `sites.yaml`, `config.yaml`, `.lerd.yaml` keys;
- container, volume, network and image names;
- certificates and domain names;
- persisted container labels;
- environment variables consumed by the engine.

## Visible brand replacement

| Surface | Result |
| --- | --- |
| App title bar | VALET wordmark |
| CLI banner/help | `VALET` |
| Package name/product name | `valet-desktop` / `VALET` |
| Window/app ID | `sh.valet.desktop` |
| Settings → About | VALET identity plus upstream provenance |
| Documentation | VALET product name, Lerd only when naming the engine |

The mapping in `shared/mapping.ts` is the executable record used to explain
which user-facing command maps to which engine command. It contains no invented
commands; unsupported operations are marked as pending or rejected rather than
silently renamed.
