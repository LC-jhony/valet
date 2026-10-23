# Migration and recovery

## Principle

VALET adopts an existing Lerd installation **in place**. It does not move,
recreate or duplicate containers, volumes, images, certificates, project
directories or databases. The engine continues to use its own configuration and
data directories after adoption.

The only write performed by `valet migrate apply` is a verified backup under the
VALET configuration directory:

```text
~/.config/valet/
  desktop.json
  adoption.json
  backups/
    2026-10-21T18-52-40-754Z/
      config.yaml
      sites.yaml
      themes/          # only when the engine has themes
```

`adoption.json` is the manifest and points at the backup directory.

## What is detected

`detectMigration` checks the legacy engine paths derived from the current
home directory:

| Item | Default path |
| --- | --- |
| Engine config | `~/.config/lerd/config.yaml` |
| Engine sites | `~/.local/share/lerd/sites.yaml` |
| Engine data | `~/.local/share/lerd` |
| Engine cache | `~/.cache/lerd` |
| Engine binary | `PATH`, `VALET_ENGINE_BIN`, saved `enginePath` |

It also reads the site count when `sites.yaml` is readable. Detection is
read-only and works when the engine API is offline.

## Apply

```bash
valet migrate detect
valet migrate status
valet migrate apply          # interactive confirmation
valet migrate apply --yes    # automation / non-interactive
```

`applyMigration`:

1. Re-reads the plan and refuses paths that are not absolute or that escape the
   expected user directories.
2. Creates a backup directory with mode `0700`.
3. Copies `config.yaml`, `sites.yaml` and the engine `themes/` directory when
   present.
4. Computes SHA-256 for each copied file and verifies the destination hash
   before accepting the backup.
5. Writes `manifest.json` and `adoption.json` atomically.
6. Leaves all source files exactly where they are.

If the manifest already exists with the same source checksums for `config.yaml`
and `sites.yaml`, a second `apply` is idempotent (`unchanged: true`) and does
not create another backup. A changed config or sites file creates a new backup.
A checksum mismatch aborts the operation without deleting source data.

## Recovery

The backup is a copy, not a restore mechanism that mutates the engine. To
recover an engine configuration file manually:

1. Stop the engine using its normal process (`lerd stop` or the desktop app).
2. Compare the backup file with the live file.
3. Copy the backup over the live file only after making your own copy.
4. Start the engine again and verify with `valet doctor`.

Do not delete `adoption.json` unless you intend to forget that this installation
was adopted. Deleting it does not delete any engine data.

## Compatibility during adoption

- The engine binary keeps its name, version and flags.
- `sites.yaml` and `config.yaml` keep their original format and location.
- `.lerd.yaml` in a project is not modified.
- Podman resources named `lerd-*` are not renamed.
- Project URLs, TLS certificates and DNS names remain unchanged.
- phpMyAdmin data is not removed by adoption. Removal is a separate, explicit
  action described in [COMPATIBILITY.md](COMPATIBILITY.md).

## Failure modes

| Failure | Behaviour |
| --- | --- |
| Engine not installed | `detected: false`; no backup is written. |
| Engine API offline | Detection and backup still work; live lists are unavailable. |
| Source file changes during copy | Hash verification fails; apply aborts. |
| Backup path exists | No silent overwrite; the existing backup is reused only when the manifest matches. |
| Permission denied | The command exits non-zero and prints the OS error. |
| Invalid/custom engine path | The saved path is accepted only if it resolves to an existing engine binary; adoption does not follow arbitrary symlinks. |

The implementation lives in `shared/migration.ts`; tests are in
`tests/migration.test.ts`.
