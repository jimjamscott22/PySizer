import os
import tempfile
from pathlib import Path

test_db_path = Path(tempfile.gettempdir()) / "pysizer_test.db"
test_db_path.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"

from app.database import Base, SessionLocal, engine
from app.models import Project, Snapshot
from app.services.snapshots import create_snapshot


def setup_function() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_module() -> None:
    engine.dispose()
    test_db_path.unlink(missing_ok=True)


def test_project_scan_snapshot_and_delta_flow(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text("print('hello')\n")

    with SessionLocal() as db:
        project = Project(name="PySizer Test", root_path=str(tmp_path))
        db.add(project)
        db.commit()
        db.refresh(project)

        first = create_snapshot(db, project, max_depth=4)
        assert first.file_count == 1
        assert first.size_delta_bytes is None
        assert first.language_distribution["Python"]["files"] == 1

        (tmp_path / "extra.ts").write_text("const extra = true\n")
        second = create_snapshot(db, project, max_depth=4)
        assert second.file_count == 2
        assert second.size_delta_bytes is not None
        assert second.size_delta_bytes > 0
        assert second.language_distribution["TypeScript"]["files"] == 1

        snapshots = db.query(Snapshot).filter(Snapshot.project_id == project.id).all()
        assert len(snapshots) == 2
