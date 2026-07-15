# PySizer Reliability Hardening — Implementation Summary

## Overview

Implemented the July 2026 reliability-hardening plan covering scan concurrency, SQLite integrity, deterministic project summaries, UTC timestamps, CSV correctness, and visible frontend mutation errors. The existing single-process FastAPI background-task architecture and database schema remain unchanged.

## Backend Changes

- Added `services/scan_coordinator.py` with lock-protected scan state and deletion reservations.
  - Duplicate scan requests return HTTP 409.
  - Deletion of a queued or running project returns HTTP 409.
  - Queueing and deletion cannot race within the supported single process.
- Enabled `PRAGMA foreign_keys=ON` for every SQLite connection.
- Added `services/project_queries.py` to fetch projects with only their deterministic latest snapshot, ordered by `taken_at DESC, id DESC`.
- Normalized naive database timestamps to explicit UTC values in Pydantic response schemas.
- Added `services/exports.py` using Python's `csv.writer` and added a download filename through `Content-Disposition`.
- Centralized backend database and API client fixtures in `backend/tests/conftest.py`.

## Frontend Changes

- Added focused Vitest, jsdom, React Testing Library, and jest-dom test support.
- Added a `test` npm script and Vite test configuration.
- Create, scan, and delete failures now populate the existing error banner.
- The error banner now has `role="alert"` for accessible announcements and reliable testing.
- Failed project creation retains the submitted name and path for correction.

## Automated Coverage

Backend coverage now includes:

- scan coordinator lifecycle and conflict behavior;
- API scan/delete conflict responses;
- SQLite foreign-key enforcement;
- deterministic latest-snapshot selection without eager-loading history;
- explicit UTC schema serialization;
- CSV round-tripping with commas, quotes, and newlines.

Frontend coverage now verifies visible errors for failed create, scan, and delete actions, including retained form input after a failed create.

## Verification

Completed on July 14, 2026:

- `uv run pytest -q`: 16 passed.
- `npm.cmd test -- --run`: 3 passed.
- `npm.cmd run build`: TypeScript and Vite production build succeeded.
- FastAPI `GET /health` smoke check: HTTP 200 with `{"status": "ok"}`.
- `git diff --check`: passed.
- `npm install`: reported 0 vulnerabilities.

The backend suite and health smoke check emit one dependency-level `StarletteDeprecationWarning` from FastAPI's current `TestClient` import. It does not originate in PySizer code and does not affect test or health-check results.

## Operational Constraint

Scan/delete coordination remains process-local by design. If PySizer is later deployed with multiple API workers, scan state should move to a database-backed job model or another shared coordinator before enabling that deployment mode.
