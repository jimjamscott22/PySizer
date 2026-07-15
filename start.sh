#!/usr/bin/env bash

set -Eeuo pipefail
set -m

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

require_command() {
    local command_name="$1"
    local setup_hint="$2"

    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf "Error: '%s' was not found. %s\n" "$command_name" "$setup_hint" >&2
        exit 1
    fi
}

stop_process_group() {
    local pid="$1"
    local name="$2"

    if [[ -n "$pid" ]] && kill -0 -- "-$pid" 2>/dev/null; then
        printf "Stopping %s...\n" "$name"
        kill -TERM -- "-$pid" 2>/dev/null || true
    fi
}

cleanup() {
    local status=$?

    trap - EXIT INT TERM
    stop_process_group "$FRONTEND_PID" "frontend"
    stop_process_group "$BACKEND_PID" "backend"

    [[ -z "$FRONTEND_PID" ]] || wait "$FRONTEND_PID" 2>/dev/null || true
    [[ -z "$BACKEND_PID" ]] || wait "$BACKEND_PID" 2>/dev/null || true

    return "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

require_command uv "Install uv and complete project setup first."
require_command npm "Install Node.js and complete project setup first."

printf "Starting PySizer backend at http://127.0.0.1:8000...\n"
(
    cd "$ROOT_DIR"
    exec uv run uvicorn app.main:app \
        --app-dir backend \
        --reload \
        --host 127.0.0.1 \
        --port 8000
) &
BACKEND_PID=$!

printf "Starting PySizer frontend...\n"
(
    cd "$ROOT_DIR/frontend"
    exec npm run dev
) &
FRONTEND_PID=$!

printf "Both servers are running. Press Ctrl+C to stop them.\n"

set +e
wait -n "$BACKEND_PID" "$FRONTEND_PID"
exit_code=$?
set -e

exit "$exit_code"
