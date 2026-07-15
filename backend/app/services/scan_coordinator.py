from collections.abc import Iterator
from contextlib import contextmanager
from threading import Lock

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
            self._statuses[project_id] = ScanStatus(
                project_id=project_id,
                status="queued",
            )
            return True

    def start(self, project_id: int) -> None:
        self._set(ScanStatus(project_id=project_id, status="running"))

    def complete(self, project_id: int, snapshot_id: int) -> None:
        self._set(
            ScanStatus(
                project_id=project_id,
                status="completed",
                snapshot_id=snapshot_id,
            )
        )

    def fail(self, project_id: int, message: str) -> None:
        self._set(
            ScanStatus(
                project_id=project_id,
                status="failed",
                message=message,
            )
        )

    def cancel(self, project_id: int) -> None:
        with self._lock:
            self._statuses.pop(project_id, None)

    def get(self, project_id: int) -> ScanStatus:
        with self._lock:
            return self._statuses.get(
                project_id,
                ScanStatus(project_id=project_id, status="idle"),
            )

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
