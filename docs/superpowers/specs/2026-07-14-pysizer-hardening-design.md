# PySizer Reliability Hardening Design

## Goal

Resolve the five findings from the July 2026 application review without changing PySizer's local-first, single-process v1 architecture.

## Scope

- Reject overlapping scans and prevent project deletion from racing a queued or running scan.
- Enable SQLite foreign-key enforcement for every connection.
- Return explicitly UTC API timestamps.
- Fetch only the latest snapshot for project summary endpoints.
- Generate escaped, downloadable CSV exports.
- Show create, scan, and delete failures in the existing frontend error banner.
- Add focused automated backend and frontend coverage.

Database-backed job state, multi-worker coordination, schema migrations, and broad frontend end-to-end testing are out of scope.

## Architecture

`backend/app/services/scan_coordinator.py` will own the process-local scan state and deletion reservations currently embedded in the API router. Its lock-protected operations will make queueing and deletion mutually exclusive for each project. The FastAPI `BackgroundTasks` execution model remains unchanged.

`backend/app/services/project_queries.py` will expose a query that returns each project with only its latest snapshot, using `(taken_at DESC, id DESC)` as the deterministic ordering. Full snapshot relationships remain available only to endpoints that need history or export data.

`backend/app/services/exports.py` will generate CSV with Python's standard `csv.writer`. Timestamp normalization will happen in the Pydantic response schemas so both SQLite-backed and future database values share the same UTC API contract.

The frontend will retain top-level state in `App.tsx`. Its mutation handlers will catch request failures and set the existing `error` state. Vitest and React Testing Library will cover these focused user-visible behaviors.

## Behavior and Error Handling

- A second scan for a queued or running project returns HTTP 409.
- Deleting a queued or running project returns HTTP 409.
- A scan cannot be queued while deletion of that project is in progress.
- Missing projects continue to return HTTP 404.
- Scan failures remain queryable through the scan-status endpoint.
- API datetimes include a UTC offset rather than exposing naive SQLite values.
- CSV responses use seven stable columns, proper escaping, and a `Content-Disposition` filename.
- Frontend mutation failures remain visible until the next mutation attempt clears or replaces the message.

## Testing

Backend tests will cover coordinator transitions, scan/delete conflicts, SQLite foreign keys, deterministic latest-snapshot selection, UTC serialization, and CSV round-tripping through `csv.reader`. Existing scanner and persistence tests remain regression gates.

Frontend tests will use Vitest, jsdom, and React Testing Library. They will mock the API module and verify that failed create, scan, and delete operations populate the alert without requiring a full browser suite.

## Success Criteria

`uv run pytest`, `npm test -- --run`, `npm run build`, and the FastAPI `/health` smoke check all pass. No database migration is required, and no unrelated application behavior changes.
