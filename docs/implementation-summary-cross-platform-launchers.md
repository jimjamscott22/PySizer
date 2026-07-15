# Cross-Platform Launcher Implementation Summary

## Changes

- Added `start.ps1` for starting the FastAPI backend and Vite frontend together
  on Windows.
- Added `start.sh` with equivalent Linux behavior.
- Both launchers resolve the repository from their own location, validate that
  `uv` and `npm` are available, display both servers' logs, and clean up both
  process trees on shutdown.
- Documented launcher usage in `README.md` without changing the existing manual
  setup commands.

## Setup Assumption

The launchers assume `uv sync`, the Alembic migration, and `npm install` have
already been completed. They only start the two development servers.

## Verification

- `start.ps1` parsed successfully with Windows PowerShell 5.1 and PowerShell 7.
- `start.sh` passed `bash -n` using Git Bash. The machine's WSL shim could not
  be used because no WSL distribution is installed.
- Backend test suite: 16 passed with one upstream Starlette deprecation warning.
- Frontend test suite: 3 passed.
- Frontend production build completed successfully.
- `git diff --check` passed, and the final diff review found no unintended
  launcher changes.
