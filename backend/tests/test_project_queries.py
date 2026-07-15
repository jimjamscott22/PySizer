from datetime import datetime

from sqlalchemy import inspect
from sqlalchemy.orm import Session
from sqlalchemy.orm.state import NO_VALUE

from app.models import Project, Snapshot
from app.services.project_queries import get_project_summary, list_project_summaries


def add_snapshot(project_id: int, taken_at: datetime, size: int) -> Snapshot:
    return Snapshot(
        project_id=project_id,
        taken_at=taken_at,
        total_size_bytes=size,
        file_count=1,
        language_distribution={},
        warnings=[],
        size_delta_bytes=None,
        trigger="manual",
    )


def test_list_project_summaries_selects_highest_id_for_timestamp_tie(
    db_session: Session,
) -> None:
    project = Project(name="Summary Project", root_path="C:/source/project")
    db_session.add(project)
    db_session.commit()
    taken_at = datetime(2026, 7, 14, 12, 0)
    first = add_snapshot(project.id, taken_at, 10)
    second = add_snapshot(project.id, taken_at, 20)
    db_session.add_all([first, second])
    db_session.commit()
    db_session.expire_all()

    [(result_project, latest)] = list_project_summaries(db_session)

    assert latest is not None
    assert latest.id == second.id
    assert inspect(result_project).attrs.snapshots.loaded_value is NO_VALUE


def test_get_project_summary_returns_project_without_snapshot(
    db_session: Session,
) -> None:
    project = Project(name="Empty Project", root_path="C:/source/empty")
    db_session.add(project)
    db_session.commit()

    result = get_project_summary(db_session, project.id)

    assert result is not None
    result_project, latest = result
    assert result_project.id == project.id
    assert latest is None
