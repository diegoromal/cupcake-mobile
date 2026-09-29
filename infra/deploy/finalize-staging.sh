#!/usr/bin/env bash
# Caller holds deploy.lock through recovery and finalization.
FINALIZE_SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
recover_staging_release() {
  node "$FINALIZE_SCRIPT_DIR/transaction-staging.mjs" recover "$1" "$2"
}
finalize_staging_release() {
  node "$FINALIZE_SCRIPT_DIR/transaction-staging.mjs" finalize "$@"
}
