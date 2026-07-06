from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Project, Snapshot
from app.services.scanner import scan_directory


def create_snapshot(
    db: Session,
    project: Project,
    max_depth: int | None = None,
    trigger: str = "manual",
) -> Snapshot:
    settings = get_settings()
    result = scan_directory(
        Path(project.root_path),
        max_depth=max_depth if max_depth is not None else settings.default_scan_depth_limit,
        excluded_dirs=settings.excluded_dir_names,
    )
    previous = db.execute(
        select(Snapshot)
        .where(Snapshot.project_id == project.id)
        .order_by(Snapshot.taken_at.desc(), Snapshot.id.desc())
        .limit(1)
    ).scalars().first()
    delta = (
        result.total_size_bytes - previous.total_size_bytes
        if previous is not None
        else None
    )
    snapshot = Snapshot(
        project_id=project.id,
        total_size_bytes=result.total_size_bytes,
        file_count=result.file_count,
        language_distribution=result.as_json_distribution(),
        warnings=result.warnings,
        size_delta_bytes=delta,
        trigger=trigger,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
