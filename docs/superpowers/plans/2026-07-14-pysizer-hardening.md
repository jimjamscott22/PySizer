# PySizer Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix scan/delete races, timestamp and CSV correctness, project-list scaling, and frontend mutation feedback with focused automated coverage.

**Architecture:** Preserve the single-process FastAPI background-task design while extracting scan coordination, project summary queries, and CSV formatting into focused backend services. Normalize UTC at the response-schema boundary and test frontend error behavior with Vitest and React Testing Library.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, SQLite, Pydantic, pytest, React 19, TypeScript, Vite, Vitest, jsdom, React Testing Library.

## Global Constraints

- Keep scan coordination process-local; multi-worker and restart persistence are out of scope.
- Do not add a database migration or change the existing tables.
- Add no new backend runtime dependency.
- Add only focused frontend unit/component testing dependencies; do not introduce Playwright or a broad E2E suite.
- Preserve existing API response shapes except that serialized datetimes become explicitly UTC.
- Use `uv` for every Python command.

---

## Planned File Structure

- `backend/app/services/scan_coordinator.py`: lock-protected scan state and deletion reservations.
- `backend/app/services/project_queries.py`: latest-snapshot project summary query.
- `backend/app/services/exports.py`: standards-compliant CSV serialization.
- `backend/app/api/projects.py`: route orchestration and HTTP conflict mapping.
- `backend/app/database.py`: SQLite foreign-key connection hook.
- `backend/app/schemas.py`: UTC datetime normalization.
- `backend/tests/conftest.py`: isolated database and API-client fixtures.
- `backend/tests/test_scan_coordinator.py`: coordinator unit tests.
- `backend/tests/test_projects_api.py`: API conflict, summary, timestamp, and export tests.
- `frontend/src/test/setup.ts`: DOM matcher setup.
- `frontend/src/App.test.tsx`: focused mutation error tests.
- `frontend/src/App.tsx`: visible mutation error handling.
- `frontend/vite.config.ts`, `frontend/package.json`, `frontend/package-lock.json`: test runner configuration and locked dev dependencies.
- `docs/implementation-summary-pysizer-hardening.md`: final implementation and verification summary.

### Task 1: Establish isolated backend API test fixtures

**Files:**
- Create: `backend/tests/conftest.py`
- Modify: `backend/tests/test_persistence.py:1-17`

**Interfaces:**
- Produces: pytest fixtures `db_session() -> Session` and `client() -> TestClient` backed by one isolated temporary SQLite database.
- Consumes: existing `app.database.Base`, `SessionLocal`, `engine`, and `app.main.app`.

- [ ] **Step 1: Move test database configuration into `conftest.py` before importing application database modules**

```python
import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest

test_db_path = Path(tempfile.gettempdir()) / "pysizer_test.db"
test_db_path.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    del session, exitstatus
    engine.dispose()
    test_db_path.unlink(missing_ok=True)
```

- [ ] **Step 2: Remove the environment setup and module-level schema lifecycle functions from `test_persistence.py`**

Keep `test_project_scan_snapshot_and_delta_flow` unchanged apart from relying on the autouse fixture.

- [ ] **Step 3: Run the existing backend tests**

Run: `uv run pytest -q`

Expected: `4 passed`.

- [ ] **Step 4: Commit the fixture foundation**

```bash
git add backend/tests/conftest.py backend/tests/test_persistence.py
git commit -m "test: centralize backend database fixtures"
```

### Task 2: Make scan and deletion coordination atomic

**Files:**
- Create: `backend/app/services/scan_coordinator.py`
- Create: `backend/tests/test_scan_coordinator.py`
- Modify: `backend/app/api/projects.py:1-85,122-139,197-203`
- Modify: `backend/app/database.py:1-18`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_projects_api.py`

**Interfaces:**
- Produces: `ScanCoordinator.try_queue(project_id) -> bool`, `start(project_id)`, `complete(project_id, snapshot_id)`, `fail(project_id, message)`, `cancel(project_id)`, `get(project_id) -> ScanStatus`, `reset()`, and `delete_reservation(project_id)`.
- Consumes: `app.schemas.ScanStatus` and the existing FastAPI project routes.

- [ ] **Step 1: Write failing coordinator state-transition tests**

```python
from app.services.scan_coordinator import ProjectBusyError, ScanCoordinator


def test_coordinator_rejects_duplicate_scan() -> None:
    coordinator = ScanCoordinator()
    assert coordinator.try_queue(7) is True
    assert coordinator.try_queue(7) is False


def test_delete_reservation_rejects_active_scan() -> None:
    coordinator = ScanCoordinator()
    coordinator.try_queue(7)
    try:
        with coordinator.delete_reservation(7):
            raise AssertionError("reservation should not be entered")
    except ProjectBusyError:
        pass


def test_scan_cannot_queue_during_delete() -> None:
    coordinator = ScanCoordinator()
    with coordinator.delete_reservation(7):
        assert coordinator.try_queue(7) is False
```

- [ ] **Step 2: Run the coordinator tests and verify they fail**

Run: `uv run pytest backend/tests/test_scan_coordinator.py -q`

Expected: FAIL because `app.services.scan_coordinator` does not exist.

- [ ] **Step 3: Implement the coordinator**

```python
from contextlib import contextmanager
from threading import Lock
from collections.abc import Iterator

from app.schemas import ScanStatus


class ProjectBusyError(RuntimeError):
    pass


class ScanCoordinator:
    def __init__(self) -> None:
        self._lock = Lock()
        self._statuses: dict[int, ScanStatus] = {}
        self._deleting: set[int] = set()

    def try_queue(self, project_id: int) -> bool:
        with self._lock:
            status = self._statuses.get(project_id)
            if project_id in self._deleting or (
                status is not None and status.status in {"queued", "running"}
            ):
                return False
            self._statuses[project_id] = ScanStatus(project_id=project_id, status="queued")
            return True

    def start(self, project_id: int) -> None:
        self._set(ScanStatus(project_id=project_id, status="running"))

    def complete(self, project_id: int, snapshot_id: int) -> None:
        self._set(ScanStatus(project_id=project_id, status="completed", snapshot_id=snapshot_id))

    def fail(self, project_id: int, message: str) -> None:
        self._set(ScanStatus(project_id=project_id, status="failed", message=message))

    def cancel(self, project_id: int) -> None:
        with self._lock:
            self._statuses.pop(project_id, None)

    def get(self, project_id: int) -> ScanStatus:
        with self._lock:
            return self._statuses.get(project_id, ScanStatus(project_id=project_id, status="idle"))

    def reset(self) -> None:
        with self._lock:
            self._statuses.clear()
            self._deleting.clear()

    def _set(self, status: ScanStatus) -> None:
        with self._lock:
            self._statuses[status.project_id] = status

    @contextmanager
    def delete_reservation(self, project_id: int) -> Iterator[None]:
        with self._lock:
            status = self._statuses.get(project_id)
            if project_id in self._deleting or (
                status is not None and status.status in {"queued", "running"}
            ):
                raise ProjectBusyError(f"Project {project_id} is busy")
            self._deleting.add(project_id)
        try:
            yield
        finally:
            with self._lock:
                self._deleting.discard(project_id)
                self._statuses.pop(project_id, None)


scan_coordinator = ScanCoordinator()
```

- [ ] **Step 4: Replace router-global status state with the coordinator**

Reserve a queue slot before the project lookup, call `cancel()` before returning 404, return HTTP 409 when `try_queue()` is false, and wrap the complete delete transaction in `delete_reservation()`. Map `ProjectBusyError` to `HTTPException(status_code=409, detail="Project scan is in progress")`.

- [ ] **Step 5: Enable SQLite foreign keys and test the connection setting**

Add an SQLAlchemy `connect` listener in `database.py`:

```python
from sqlalchemy import create_engine, event


if get_settings().database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
```

Add a test that executes `PRAGMA foreign_keys` through `engine.connect()` and asserts `scalar_one() == 1`.

- [ ] **Step 6: Add API tests for duplicate scans and deletion conflicts**

Patch `background_tasks.add_task` or coordinator state directly so the assertions do not depend on thread timing. Assert both endpoints return 409 and the original project remains present. Update the autouse fixture in `conftest.py` to call `scan_coordinator.reset()` after each test so process-local state cannot leak between tests.

- [ ] **Step 7: Run focused and complete backend tests**

Run: `uv run pytest backend/tests/test_scan_coordinator.py backend/tests/test_projects_api.py -q`

Expected: PASS.

Run: `uv run pytest -q`

Expected: all backend tests pass.

- [ ] **Step 8: Commit scan coordination**

```bash
git add backend/app/services/scan_coordinator.py backend/app/api/projects.py backend/app/database.py backend/tests
git commit -m "fix: coordinate project scans and deletion"
```

### Task 3: Query deterministic latest snapshots and serialize UTC

**Files:**
- Create: `backend/app/services/project_queries.py`
- Modify: `backend/app/api/projects.py:31-40,102-119`
- Modify: `backend/app/schemas.py:1-34`
- Test: `backend/tests/test_projects_api.py`

**Interfaces:**
- Produces: `list_project_summaries(db: Session) -> list[tuple[Project, Snapshot | None]]` and `get_project_summary(db: Session, project_id: int) -> tuple[Project, Snapshot | None] | None`.
- Produces: `normalize_utc(value: datetime) -> datetime` used by Pydantic field validators.
- Consumes: `Project`, `Snapshot`, and `project_to_read(project, latest_snapshot)`.

- [ ] **Step 1: Write failing tests for equal-timestamp ordering and unloaded history**

Create one project with two snapshots sharing the same `taken_at` and different IDs. Assert the higher ID is returned as latest. Use `sqlalchemy.inspect(project).attrs.snapshots.loaded_value is NO_VALUE` to prove the history relationship was not loaded.

- [ ] **Step 2: Implement the project summary query**

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, Snapshot


def _latest_snapshot_id():
    return (
        select(Snapshot.id)
        .where(Snapshot.project_id == Project.id)
        .order_by(Snapshot.taken_at.desc(), Snapshot.id.desc())
        .limit(1)
        .correlate(Project)
        .scalar_subquery()
    )


def list_project_summaries(db: Session) -> list[tuple[Project, Snapshot | None]]:
    statement = (
        select(Project, Snapshot)
        .outerjoin(Snapshot, Snapshot.id == _latest_snapshot_id())
        .order_by(Project.created_at.desc(), Project.id.desc())
    )
    return [(project, snapshot) for project, snapshot in db.execute(statement).all()]


def get_project_summary(
    db: Session, project_id: int
) -> tuple[Project, Snapshot | None] | None:
    statement = (
        select(Project, Snapshot)
        .outerjoin(Snapshot, Snapshot.id == _latest_snapshot_id())
        .where(Project.id == project_id)
    )
    row = db.execute(statement).one_or_none()
    return None if row is None else (row[0], row[1])
```

- [ ] **Step 3: Update API conversion and summary endpoints**

Change the converter to `project_to_read(project: Project, latest_snapshot: Snapshot | None) -> ProjectRead`. Use the new query service in list/get endpoints; pass an explicitly selected latest snapshot in export code.

- [ ] **Step 4: Write a failing UTC serialization test**

Build `SnapshotRead` from a snapshot with a naive `datetime(2026, 7, 14, 12, 0)` and assert `model_dump(mode="json")["taken_at"] == "2026-07-14T12:00:00Z"`. Add the equivalent assertion for `ProjectRead.created_at`.

- [ ] **Step 5: Add schema-level UTC normalization**

```python
from datetime import UTC, datetime
from pydantic import field_validator


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
```

Apply `@field_validator("taken_at", mode="before")` to `SnapshotRead` and `@field_validator("created_at", mode="before")` to `ProjectRead`, each returning `normalize_utc(value)`.

```python
@field_validator("taken_at", mode="before")
@classmethod
def ensure_taken_at_is_utc(cls, value: datetime) -> datetime:
    return normalize_utc(value)


@field_validator("created_at", mode="before")
@classmethod
def ensure_created_at_is_utc(cls, value: datetime) -> datetime:
    return normalize_utc(value)
```

- [ ] **Step 6: Run tests and commit**

Run: `uv run pytest backend/tests/test_projects_api.py -q`

Expected: PASS.

```bash
git add backend/app/services/project_queries.py backend/app/api/projects.py backend/app/schemas.py backend/tests/test_projects_api.py
git commit -m "perf: query latest project snapshots directly"
```

### Task 4: Produce standards-compliant CSV exports

**Files:**
- Create: `backend/app/services/exports.py`
- Modify: `backend/app/api/projects.py:162-193`
- Test: `backend/tests/test_projects_api.py`

**Interfaces:**
- Produces: `snapshots_to_csv(snapshots: list[SnapshotRead]) -> str`.
- Consumes: ordered `SnapshotRead` values from the export endpoint.

- [ ] **Step 1: Write a failing CSV round-trip test**

Insert a snapshot whose warning is `Skipped C:\\source,archive\\\"file.py\": denied\nretry`. Request `?format=csv`, parse the body with `csv.reader(io.StringIO(response.text))`, and assert the data row has exactly seven columns and the warning field round-trips unchanged.

- [ ] **Step 2: Implement the CSV service**

```python
import csv
import io

from app.schemas import SnapshotRead

CSV_COLUMNS = [
    "id", "taken_at", "total_size_bytes", "file_count",
    "size_delta_bytes", "trigger", "warnings",
]


def snapshots_to_csv(snapshots: list[SnapshotRead]) -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    for snapshot in snapshots:
        writer.writerow([
            snapshot.id,
            snapshot.taken_at.isoformat(),
            snapshot.total_size_bytes,
            snapshot.file_count,
            "" if snapshot.size_delta_bytes is None else snapshot.size_delta_bytes,
            snapshot.trigger,
            "|".join(snapshot.warnings),
        ])
    return output.getvalue()
```

- [ ] **Step 3: Use the service and download headers in the route**

Return `Response(content=snapshots_to_csv(snapshots), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="pysizer-project-{project_id}.csv"'})`.

- [ ] **Step 4: Run tests and commit**

Run: `uv run pytest backend/tests/test_projects_api.py -q`

Expected: PASS, including special-character CSV round-trip and header assertions.

```bash
git add backend/app/services/exports.py backend/app/api/projects.py backend/tests/test_projects_api.py
git commit -m "fix: escape project CSV exports"
```

### Task 5: Add focused frontend automation and visible mutation errors

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx:91-116`
- Modify: `frontend/src/components/ProjectForm.tsx:4-23`

**Interfaces:**
- Produces: `npm test -- --run` as the focused frontend test command.
- Consumes: existing API functions and the existing `error` banner in `App`.

- [ ] **Step 1: Add focused test dependencies**

Run from `frontend/`:

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom
```

Add `"test": "vitest"` to `package.json` scripts.

- [ ] **Step 2: Configure Vitest**

Import `defineConfig` from `vitest/config` in `vite.config.ts` and add:

```typescript
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  clearMocks: true,
},
```

Create `frontend/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Write failing mutation error tests**

Mock `./lib/api` so `listProjects` initially resolves projects while each mutation rejects in its own test. Use `render`, `fireEvent`, `screen`, and `waitFor` to verify errors such as `Path is not readable`, `Scan already in progress`, and `Project scan is in progress` appear in the banner. Mock `./components/Charts` to keep the tests focused.

- [ ] **Step 4: Run the tests and verify failure**

Run: `npm test -- --run`

Expected: FAIL because mutation rejections are not written to `error`.

- [ ] **Step 5: Catch mutation errors consistently**

Add a shared helper inside `App`:

```typescript
function messageFrom(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback
}
```

Wrap each of `handleCreateProject`, `handleScan`, and `handleDelete` in `try/catch`; preserve the existing success path and use `Failed to create project`, `Failed to start scan`, and `Failed to remove project` as their respective fallback messages. Rethrow only from `handleCreateProject` so its form knows not to clear the submitted values. In `ProjectForm.handleSubmit`, catch that already-reported error before `finally` resets `isSaving`:

```typescript
try {
  await onSubmit(name, rootPath)
  setName('')
  setRootPath('')
} catch {
  // App owns the visible error message; retain the user's inputs for correction.
} finally {
  setIsSaving(false)
}
```

- [ ] **Step 6: Run frontend tests and build**

Run: `npm test -- --run`

Expected: all focused tests pass.

Run: `npm run build`

Expected: TypeScript and Vite production build succeed.

- [ ] **Step 7: Commit frontend feedback and tests**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/test/setup.ts frontend/src/components/ProjectForm.tsx
git commit -m "fix: surface frontend mutation failures"
```

### Task 6: Full verification and implementation summary

**Files:**
- Create: `docs/implementation-summary-pysizer-hardening.md`

**Interfaces:**
- Consumes: all deliverables from Tasks 1-5.
- Produces: repository-level verification evidence and handoff notes.

- [ ] **Step 1: Run the complete backend suite**

Run: `uv run pytest -q`

Expected: all backend tests pass with no new warnings from project code.

- [ ] **Step 2: Run frontend tests and production build**

Run from `frontend/`: `npm test -- --run`

Expected: all frontend tests pass.

Run from `frontend/`: `npm run build`

Expected: production build succeeds.

- [ ] **Step 3: Run the health smoke check**

Run:

```bash
uv run python -c "import sys; sys.path.insert(0, 'backend'); from fastapi.testclient import TestClient; from app.main import app; r=TestClient(app).get('/health'); assert r.status_code == 200; print(r.json())"
```

Expected: `{'status': 'ok'}`.

- [ ] **Step 4: Write the implementation summary**

Document the files changed, user-visible behavior, concurrency limitation to one process, added tests, and exact verification results in `docs/implementation-summary-pysizer-hardening.md`.

- [ ] **Step 5: Commit the summary**

```bash
git add docs/implementation-summary-pysizer-hardening.md
git commit -m "docs: summarize PySizer reliability hardening"
```

## Final Acceptance Checklist

- [ ] Concurrent scan requests cannot create competing snapshots.
- [ ] Active scans and deletion cannot race within the supported single process.
- [ ] SQLite reports `PRAGMA foreign_keys = 1`.
- [ ] Project summary endpoints load only the deterministic latest snapshot.
- [ ] API datetimes serialize with explicit UTC information.
- [ ] CSV values containing commas, quotes, and newlines round-trip correctly.
- [ ] Failed create, scan, and delete actions appear in the frontend error banner.
- [ ] Backend tests, frontend tests, frontend build, and health smoke check pass.
