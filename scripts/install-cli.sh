#!/usr/bin/env bash
# Install the VALET CLI without overwriting an unrelated `valet` executable.
# Laravel Valet also uses the name `valet`; this installer is intentionally
# conservative about conflicts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${VALET_CLI_DIR:-$HOME/.local/bin}"
TARGET="$TARGET_DIR/valet"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help)
      echo "Usage: $0 [--force]"
      echo "Installs a symlink at ${TARGET} pointing to ${ROOT}/bin/valet"
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$ROOT/dist/cli/valet.js" ]]; then
  echo "CLI build not found. Run: npm run build:cli" >&2
  exit 1
fi
chmod +x "$ROOT/bin/valet" "$ROOT/dist/cli/valet.js"
mkdir -p "$TARGET_DIR"

if [[ -e "$TARGET" || -L "$TARGET" ]]; then
  RESOLVED="$(readlink -f "$TARGET" 2>/dev/null || true)"
  if [[ "$RESOLVED" != "$ROOT/bin/valet" && "$FORCE" -ne 1 ]]; then
    echo "Refusing to overwrite existing ${TARGET}." >&2
    echo "It may be Laravel Valet or another tool. Inspect it with:" >&2
    echo "  command -v valet; readlink -f \"$TARGET\"" >&2
    echo "Re-run with --force only if you intend to replace it." >&2
    exit 1
  fi
fi

ln -sfn "$ROOT/bin/valet" "$TARGET"
echo "Installed: $TARGET -> $ROOT/bin/valet"
case ":$PATH:" in
  *":$TARGET_DIR:"*) echo "Run: valet --help" ;;
  *) echo "Add $TARGET_DIR to PATH, then run: valet --help" ;;
esac
