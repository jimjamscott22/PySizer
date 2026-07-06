# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PySizer is a local-first web app that recursively scans project directories on disk, computes storage size / file count / per-language breakdown, and tracks how that changes over time via timestamped snapshots. See `docs/SPEC.md` for the full spec and `docs/IMPLEMENTATION_PLAN.md` for phased build notes and corrections made vs. the original draft prompt (important context if something looks like it deviates from a "naive" implementation — e.g. why `shutil.disk_usage()` is intentionally avoided).

Stack: FastAPI + SQLAlchemy + Alembic + SQLite (backend), Vite + React + TypeScript + Tailwind + Recharts (frontend).

## Commands

Backend (run from repo root; `pyproject.toml` sets `pythonpath = ["backend"]`):

```bash
uv sync                                                              # install deps
uv run alembic -c backend/alembic.ini upgrade head                  # apply migrations
uv run alembic -c backend/alembic.ini revision --autogenerate -m "msg"  # new migration after model changes
uv run uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000  # run API
uv run pytest                                                        # run all tests
uv run pytest backend/tests/test_scanner.py -k test_name             # run a single test
```

Frontend (run from `frontend/`):

```bash
npm install
npm run dev        # Vite dev server; proxies /projects and /health to 127.0.0.1:8000
npm run build       # tsc -b && vite build
```

## Architecture

**Request flow:** `frontend/src/lib/api.ts` calls same-origin paths (`/projects/...`) which Vite proxies to the FastAPI backend in dev. `backend/app/main.py` builds the app via `create_app()` and mounts `app/api/projects.py`'s router at `/projects`. Settings come from `app/config.py` (`pydantic-settings`, backed by `.env`), cached with `@lru_cache` — construct env vars before code that reads `get_settings()` runs (tests override `DATABASE_URL` via `os.environ` *before* importing `app.database`, since the engine is built at import time).

**Scan pipeline:** `api/projects.py`'s `queue_scan` endpoint schedules `run_scan` as a FastAPI `BackgroundTask` (no task queue) and immediately returns 202. `run_scan` opens its own `SessionLocal()` (background tasks run outside the request's DB session) and calls `services/snapshots.create_snapshot`, which invokes `services/scanner.scan_directory` and persists a `Snapshot` row. In-memory `scan_statuses: dict[int, ScanStatus]` (protected by a `Lock`) tracks per-project scan progress for polling via `GET /projects/{id}/scan-status` — this state is process-local and resets on restart, by design (v1 has no task queue/worker).

**Scanner internals** (`services/scanner.py`): `scan_directory` recurses manually with `os.scandir` (faster than repeated `stat()` calls) rather than `pathlib.glob`, tracks `(st_dev, st_ino)` pairs in `seen_dirs` to detect symlink loops, and treats per-file/per-directory `OSError`/`PermissionError` as non-fatal — they're appended to `result.warnings` and traversal continues rather than aborting. Directory names in `excluded_dirs` (from `Settings.excluded_dir_names`) are skipped entirely, not just size-limited. Language classification (`classify_language`) is a pure extension→name lookup separate from the size accounting, so unknown extensions still count toward totals under `"Other"`.

**Snapshot diffing** (`services/snapshots.py`): each `create_snapshot` call looks up the most recent prior `Snapshot` for the project (ordered by `taken_at desc, id desc` to break timestamp ties) and computes `size_delta_bytes` against it; the first snapshot for a project has `size_delta_bytes = None`.

**Data model** (`models.py`): `Project 1:N Snapshot` with `cascade="all, delete-orphan"` — deleting a project deletes its full snapshot history. `Snapshot.language_distribution` and `.warnings` are stored as JSON columns rather than normalized tables (write-once, read-mostly, no cross-language queries needed — see SPEC.md §4 for the rationale). Migrations live in `backend/alembic/versions/`; `alembic/env.py` imports `app.models` for autogenerate metadata and reads the DB URL from `get_settings()`, not `alembic.ini`.

**Path validation** (`api/projects.py::validate_root_path`): registered root paths are resolved and must exist, be a directory, and be readable (probed via `next(resolved.iterdir(), None)`) at registration time — scans never take arbitrary paths from free-form request parameters after that.

**Frontend structure**: `App.tsx` owns all top-level state (projects, selected project, snapshots, per-project scan statuses) and polls `GET /scan-status` on a 1.2s interval only for projects currently `queued`/`running`. `Charts.tsx` is lazy-loaded (`React.lazy`) since Recharts is heavy. Types in `lib/types.ts` mirror `app/schemas.py`'s Pydantic models — keep them in sync when changing API shapes.

## Testing notes

- `test_scanner.py` uses real `tmp_path` fixtures, not mocked `pathlib` internals — the implementation plan explicitly calls out that mocking `Path.glob` is brittle and doesn't exercise real traversal behavior. Follow this pattern for new scanner tests.
- `test_persistence.py` points `DATABASE_URL` at a temp sqlite file *before* importing `app.database`/`app.models`, and resets schema in `setup_function` via `Base.metadata.drop_all`/`create_all`. Import order matters here because the engine is created at module import time.
