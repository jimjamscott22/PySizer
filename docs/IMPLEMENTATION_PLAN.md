# PySizer — Implementation Plan

Companion to `SPEC.md`. Phased build order, concrete tasks, and the specific pitfalls in the original draft prompt that this plan corrects.

## Phase 0: Project Scaffolding
- [ ] `backend/` — FastAPI app, SQLAlchemy models, Alembic migrations
- [ ] `frontend/` — Vite + React + TypeScript + Tailwind
- [ ] SQLite DB file + initial schema migration (`projects`, `snapshots` tables from spec)
- [ ] `.env` for config (default scan depth limit, excluded dirs list)

## Phase 1: Core Directory Scanning (backend)
- [ ] Implement `scan_directory(path: Path, max_depth: int) -> ScanResult` using `os.scandir` for performance
- [ ] Build extension → language mapping (start with a reasonable default set: py, js/ts, java, go, rs, etc.; make it extensible via config, not hardcoded)
- [ ] Default exclusion list: `.git`, `node_modules`, `.venv`, `__pycache__`, `dist`, `build`
- [ ] Per-file/per-directory error handling: catch `PermissionError`/`OSError`, log as warnings, continue scan (don't abort on first bad file)
- [ ] Unit tests using `tmp_path` fixtures (real temp directories, not mocked `Path` internals — mocking `pathlib.Path.glob` directly gets brittle fast and doesn't test real traversal behavior)

## Phase 2: Persistence + Snapshot Diffing
- [ ] `POST /projects/` — register project, validate path exists/readable
- [ ] `POST /projects/{id}/scan` — run scan, compute delta vs. most recent snapshot, persist
- [ ] `GET /projects/{id}/snapshots` — paginated snapshot history
- [ ] Background task handling for large scans (FastAPI `BackgroundTasks` is enough for v1 — no need for a task queue yet)

## Phase 3: Dashboard UI
- [ ] Project list view (registered projects + latest snapshot summary)
- [ ] Current stats view: pie chart (language distribution) via Recharts
- [ ] Size comparison bar chart across all tracked projects
- [ ] Timeline view: line chart of a single project's size history
- [ ] Dark terminal aesthetic, consistent with your other tools (CodeVerter, ImageVault, etc.)

## Phase 4: Export + Polish
- [ ] `GET /projects/{id}/export` — JSON export; CSV as a secondary format
- [ ] Scan status/progress indicator for long-running scans
- [ ] Empty states, error states (e.g. path no longer exists on re-scan)

## Phase 5 (Stretch): Git-Linked Snapshots
- [ ] Watch registered projects for new commits (via `GitPython` or a lightweight polling check on `.git/HEAD`)
- [ ] Auto-trigger a snapshot on new commit, tagged `trigger: 'git_commit'`
- [ ] Surface commit hash alongside the snapshot in the timeline view

## Phase 6 (Stretch): Desktop Packaging
- [ ] Tauri wrapper around the existing FastAPI + React stack, matching your ImageVault/file-manager pattern

---

## Corrections vs. the Original Draft Prompt

Worth flagging explicitly since these would've caused real bugs if implemented as originally written:

1. **`shutil.disk_usage()` is not directory size.** It reports total/used/free space for the *volume* the path lives on, not the size of that directory's contents. The original fallback logic (`glob('**/*')` sum) is the actually correct approach and should be the primary method, not a fallback.
2. **Zip-upload architecture conflicted with local-first scanning.** The original had a `POST /analyze-directory/` endpoint expecting `UploadFile` (implying zipping a directory client-side and uploading it) alongside code that assumes direct filesystem access via `pathlib`. Since this is a local-first tool scanning your own machine, the backend should just be given a path and read it directly — no zip/upload round-trip needed.
3. **The test example was actually broken.** `mock_path.glob.side_effect` combined with `assert calculate_directory_size('/test') == (0 + 768) * len(mock_path)` doesn't correspond to any real return path in the function it's testing, and `len(mock_path)` on a `MagicMock` isn't meaningful. Use real temp-directory fixtures (`tmp_path` in pytest) instead of mocking `pathlib` internals.
4. **SQLModel class was missing `table=True`.** As written, `Project(SQLModel)` defines a plain schema model, not a database table. Given the spec already defines a SQLAlchemy schema directly, stick with SQLAlchemy models for consistency rather than mixing in SQLModel.
5. **"Track historical snapshots as Git commits occur" was underspecified** and is better treated as a stretch phase (5) once manual/scheduled scanning is solid, rather than a Phase 2 requirement.

## Suggested Build Order Rationale

Scanning correctness (Phase 1) has to be right before anything else matters — a wrong size number undermines every chart built on top of it. Persistence and diffing (Phase 2) come before UI so you have real historical data to visualize instead of building charts against fixtures. Git integration and desktop packaging are pushed to stretch phases since they're additive, not core to the "does this tool tell me accurate project sizes over time" value proposition.
