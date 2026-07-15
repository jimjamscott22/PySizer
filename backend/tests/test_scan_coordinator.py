import pytest

from app.services.scan_coordinator import ProjectBusyError, ScanCoordinator


def test_coordinator_rejects_duplicate_scan() -> None:
    coordinator = ScanCoordinator()

    assert coordinator.try_queue(7) is True
    assert coordinator.try_queue(7) is False


def test_delete_reservation_rejects_active_scan() -> None:
    coordinator = ScanCoordinator()
    coordinator.try_queue(7)

    with pytest.raises(ProjectBusyError):
        with coordinator.delete_reservation(7):
            pass


def test_scan_cannot_queue_during_delete() -> None:
    coordinator = ScanCoordinator()

    with coordinator.delete_reservation(7):
        assert coordinator.try_queue(7) is False


def test_coordinator_tracks_scan_lifecycle() -> None:
    coordinator = ScanCoordinator()

    assert coordinator.get(7).status == "idle"
    assert coordinator.try_queue(7) is True
    coordinator.start(7)
    assert coordinator.get(7).status == "running"
    coordinator.complete(7, snapshot_id=11)
    assert coordinator.get(7).status == "completed"
    assert coordinator.get(7).snapshot_id == 11
