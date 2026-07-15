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


def list_project_summaries(
    db: Session,
) -> list[tuple[Project, Snapshot | None]]:
    statement = (
        select(Project, Snapshot)
        .outerjoin(Snapshot, Snapshot.id == _latest_snapshot_id())
        .order_by(Project.created_at.desc(), Project.id.desc())
    )
    return [(project, snapshot) for project, snapshot in db.execute(statement).all()]


def get_project_summary(
    db: Session,
    project_id: int,
) -> tuple[Project, Snapshot | None] | None:
    statement = (
        select(Project, Snapshot)
        .outerjoin(Snapshot, Snapshot.id == _latest_snapshot_id())
        .where(Project.id == project_id)
    )
    row = db.execute(statement).one_or_none()
    return None if row is None else (row[0], row[1])
