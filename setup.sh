#!/usr/bin/env bash
# WordScript — First-time setup (Linux / macOS)
# Run this once after cloning: bash setup.sh

set -euo pipefail

git config core.hooksPath hooks
chmod +x hooks/pre-commit

exec "$(dirname "$0")/setup-tauri.sh"
