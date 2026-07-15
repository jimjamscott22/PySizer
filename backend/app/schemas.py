from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    root_path: str = Field(min_length=1)


class SnapshotRead(BaseModel):
    id: int
    project_id: int
    taken_at: datetime
    total_size_bytes: int
    file_count: int
    language_distribution: dict[str, Any]
    warnings: list[str]
    size_delta_bytes: int | None
    trigger: str

    model_config = ConfigDict(from_attributes=True)

    @field_validator("taken_at", mode="before")
    @classmethod
    def ensure_taken_at_is_utc(cls, value: datetime) -> datetime:
        return normalize_utc(value)


class ProjectRead(BaseModel):
    id: int
    name: str
    root_path: str
    created_at: datetime
    latest_snapshot: SnapshotRead | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def ensure_created_at_is_utc(cls, value: datetime) -> datetime:
        return normalize_utc(value)


class ProjectListItem(ProjectRead):
    pass


class ScanRequest(BaseModel):
    max_depth: int | None = Field(default=None, ge=0, le=64)
    trigger: Literal["manual", "scheduled", "git_commit"] = "manual"


class ScanQueued(BaseModel):
    project_id: int
    status: str


class ScanStatus(BaseModel):
    project_id: int
    status: Literal["idle", "queued", "running", "completed", "failed"]
    message: str | None = None
    snapshot_id: int | None = None


class ExportResponse(BaseModel):
    project: ProjectRead
    snapshots: list[SnapshotRead]
