from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    root_path: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    snapshots: Mapped[list["Snapshot"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Snapshot.taken_at"
    )


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    taken_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    total_size_bytes: Mapped[int] = mapped_column(nullable=False)
    file_count: Mapped[int] = mapped_column(nullable=False)
    language_distribution: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    warnings: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    size_delta_bytes: Mapped[int | None] = mapped_column(nullable=True)
    trigger: Mapped[str] = mapped_column(String(24), nullable=False, default="manual")

    project: Mapped[Project] = relationship(back_populates="snapshots")
