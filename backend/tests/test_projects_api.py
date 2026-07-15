import csv
import io
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import engine
from app.models import Snapshot
from app.services.scan_coordinator import scan_coordinator


def create_project(client: TestClient, root: Path, name: str = "Test Project") -> int:
    response = client.post(
        "/projects/",
        json={"name": name, "root_path": str(root)},
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def test_sqlite_foreign_keys_are_enabled() -> None:
    with engine.connect() as connection:
        enabled = connection.execute(text("PRAGMA foreign_keys")).scalar_one()

    assert enabled == 1


def test_duplicate_scan_returns_conflict(client: TestClient, tmp_path: Path) -> None:
    project_id = create_project(client, tmp_path)
    assert scan_coordinator.try_queue(project_id) is True
    try:
        response = client.post(
            f"/projects/{project_id}/scan",
            json={"trigger": "manual"},
        )
    finally:
        scan_coordinator.cancel(project_id)

    assert response.status_code == 409
    assert response.json()["detail"] == "Project scan is already in progress"


def test_delete_during_scan_returns_conflict(client: TestClient, tmp_path: Path) -> None:
    project_id = create_project(client, tmp_path)
    assert scan_coordinator.try_queue(project_id) is True
    try:
        response = client.delete(f"/projects/{project_id}")
    finally:
        scan_coordinator.cancel(project_id)

    assert response.status_code == 409
    assert response.json()["detail"] == "Project scan is in progress"
    assert client.get(f"/projects/{project_id}").status_code == 200


def test_csv_export_escapes_warning_text(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    project_id = create_project(client, tmp_path)
    warning = 'Skipped C:\\source,archive\\"file.py": denied\nretry'
    db_session.add(
        Snapshot(
            project_id=project_id,
            total_size_bytes=42,
            file_count=1,
            language_distribution={},
            warnings=[warning],
            size_delta_bytes=None,
            trigger="manual",
        )
    )
    db_session.commit()

    response = client.get(f"/projects/{project_id}/export?format=csv")
    rows = list(csv.reader(io.StringIO(response.text)))

    assert response.status_code == 200
    assert response.headers["content-disposition"] == (
        f'attachment; filename="pysizer-project-{project_id}.csv"'
    )
    assert len(rows) == 2
    assert len(rows[1]) == 7
    assert rows[1][6] == warning
