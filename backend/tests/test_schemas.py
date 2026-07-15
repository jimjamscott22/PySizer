from datetime import datetime

from app.schemas import ProjectRead, SnapshotRead


def test_snapshot_timestamp_serializes_as_utc() -> None:
    snapshot = SnapshotRead(
        id=1,
        project_id=1,
        taken_at=datetime(2026, 7, 14, 12, 0),
        total_size_bytes=10,
        file_count=1,
        language_distribution={},
        warnings=[],
        size_delta_bytes=None,
        trigger="manual",
    )

    assert snapshot.model_dump(mode="json")["taken_at"] == "2026-07-14T12:00:00Z"


def test_project_timestamp_serializes_as_utc() -> None:
    project = ProjectRead(
        id=1,
        name="UTC Project",
        root_path="C:/source/project",
        created_at=datetime(2026, 7, 14, 12, 0),
    )

    assert project.model_dump(mode="json")["created_at"] == "2026-07-14T12:00:00Z"
