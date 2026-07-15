# Cross-Platform Development Launchers

## Goal

Add one Windows launcher and one Linux launcher that start PySizer's existing
backend and frontend development servers together after project setup is
complete.

## Files

- `start.ps1`: Windows PowerShell launcher at the repository root.
- `start.sh`: Linux Bash launcher at the repository root.
- `README.md`: Usage instructions for both launchers.

## Behavior

Each launcher will:

1. Resolve paths relative to its own location so it works regardless of the
   caller's current directory.
2. Verify that `uv` and `npm` are available and exit with a clear error if
   either command is missing.
3. Start the FastAPI backend with:

   ```text
   uv run uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
   ```

4. Start the Vite frontend by running `npm run dev` in `frontend/`.
5. Keep both processes attached to the launcher's session so their logs remain
   visible.
6. Stop both child processes when the launcher is interrupted or when either
   server exits, preventing the sibling process from being left behind.
7. Return a nonzero status when a prerequisite is missing or a server fails.

The launchers will not install dependencies, apply database migrations, or
open a browser. Existing setup steps remain unchanged.

## Implementation Approach

The Windows script will use PowerShell process jobs and cleanup in a `finally`
block. The Linux script will use Bash background processes, `wait`, and an
`EXIT`/signal trap. Both scripts will preserve the backend and frontend
commands already documented by the project.

## Verification

Verification will include:

- PowerShell syntax parsing for `start.ps1`.
- Bash syntax checking for `start.sh` when Bash is available.
- Static checks that both launchers contain the expected backend and frontend
  commands and prerequisite checks.
- A review of the resulting diff to ensure unrelated user files are untouched.

