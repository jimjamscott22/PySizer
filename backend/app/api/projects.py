from __future__ import annotations

from pathlib import Path
from threading import Lock

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import SessionLocal, get_db
from app.models import Project, Snapshot
from app.schemas import (
    ExportResponse,
    ProjectCreate,
    ProjectListItem,
    ProjectRead,
    ScanQueued,
    ScanRequest,
    ScanStatus,
    SnapshotRead,
)
from app.services.snapshots import create_snapshot

router = APIRouter(prefix="/projects", tags=["projects"])

scan_statuses: dict[int, ScanStatus] = {}
scan_status_lock = Lock()


def project_to_read(project: Project) -> ProjectRead:
    latest = project.snapshots[-1] if project.snapshots else None
    return ProjectRead(
        id=project.id,
        name=project.name,
        root_path=project.root_path,
        created_at=project.created_at,
        latest_snapshot=SnapshotRead.model_validate(latest) if latest else None,
    )


def validate_root_path(raw_path: str) -> str:
    path = Path(raw_path).expanduser()
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Path is not accessible: {exc}") from exc
    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail="Project root must be a directory")
    try:
        next(resolved.iterdir(), None)
    except PermissionError as exc:
        raise HTTPException(status_code=400, detail=f"Path is not readable: {exc}") from exc
    return str(resolved)


def set_scan_status(project_id: int, status: ScanStatus) -> None:
    with scan_status_lock:
        scan_statuses[project_id] = status


def run_scan(project_id: int, max_depth: int | None, trigger: str) -> None:
    set_scan_status(project_id, ScanStatus(project_id=project_id, status="running"))
    db = SessionLocal()
    try:
        project = db.get(Project, project_id)
        if project is None:
            set_scan_status(
                project_id,
                ScanStatus(project_id=project_id, status="failed", message="Project not found"),
            )
            return
        snapshot = create_snapshot(db, project, max_depth=max_depth, trigger=trigger)
        set_scan_status(
            project_id,
            ScanStatus(project_id=project_id, status="completed", snapshot_id=snapshot.id),
        )
    except Exception as exc:  # pragma: no cover - defensive status boundary
        set_scan_status(
            project_id,
            ScanStatus(project_id=project_id, status="failed", message=str(exc)),
        )
    finally:
        db.close()


@router.post("/", response_model=ProjectRead, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> ProjectRead:
    root_path = validate_root_path(payload.root_path)
    project = Project(name=payload.name.strip(), root_path=root_path)
    db.add(project)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Project name already exists") from exc
    db.refresh(project)
    return project_to_read(project)


@router.get("/", response_model=list[ProjectListItem])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectRead]:
    projects = db.execute(
        select(Project).options(selectinload(Project.snapshots)).order_by(Project.created_at.desc())
    ).scalars().all()
    return [project_to_read(project) for project in projects]


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)) -> ProjectRead:
    project = db.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.snapshots))
    ).scalars().first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_to_read(project)


@router.post("/{project_id}/scan", response_model=ScanQueued, status_code=202)
def queue_scan(
    project_id: int,
    payload: ScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ScanQueued:
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    set_scan_status(project_id, ScanStatus(project_id=project_id, status="queued"))
    background_tasks.add_task(run_scan, project_id, payload.max_depth, payload.trigger)
    return ScanQueued(project_id=project_id, status="queued")


@router.get("/{project_id}/scan-status", response_model=ScanStatus)
def get_scan_status(project_id: int) -> ScanStatus:
    with scan_status_lock:
        return scan_statuses.get(project_id, ScanStatus(project_id=project_id, status="idle"))


@router.get("/{project_id}/snapshots", response_model=list[SnapshotRead])
def list_snapshots(
    project_id: int,
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[Snapshot]:
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.execute(
        select(Snapshot)
        .where(Snapshot.project_id == project_id)
        .order_by(Snapshot.taken_at.desc(), Snapshot.id.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()


@router.get("/{project_id}/export", response_model=None)
def export_project(
    project_id: int,
    format: str = Query(default="json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
) -> ExportResponse | Response:
    project = db.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.snapshots))
    ).scalars().first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    project_read = project_to_read(project)
    snapshots = [SnapshotRead.model_validate(snapshot) for snapshot in project.snapshots]
    if format == "csv":
        lines = ["id,taken_at,total_size_bytes,file_count,size_delta_bytes,trigger,warnings"]
        for snapshot in snapshots:
            lines.append(
                ",".join(
                    [
                        str(snapshot.id),
                        snapshot.taken_at.isoformat(),
                        str(snapshot.total_size_bytes),
                        str(snapshot.file_count),
                        "" if snapshot.size_delta_bytes is None else str(snapshot.size_delta_bytes),
                        snapshot.trigger,
                        "|".join(snapshot.warnings),
                    ]
                )
            )
        return Response(content="\n".join(lines), media_type="text/csv")

    return ExportResponse(project=project_read, snapshots=snapshots)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)) -> None:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
