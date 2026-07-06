"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("root_path", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_name"), "projects", ["name"], unique=True)
    op.create_table(
        "snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("total_size_bytes", sa.Integer(), nullable=False),
        sa.Column("file_count", sa.Integer(), nullable=False),
        sa.Column("language_distribution", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("size_delta_bytes", sa.Integer(), nullable=True),
        sa.Column("trigger", sa.String(length=24), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_snapshots_project_id"), "snapshots", ["project_id"], unique=False)
    op.create_index(op.f("ix_snapshots_taken_at"), "snapshots", ["taken_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_snapshots_taken_at"), table_name="snapshots")
    op.drop_index(op.f("ix_snapshots_project_id"), table_name="snapshots")
    op.drop_table("snapshots")
    op.drop_index(op.f("ix_projects_name"), table_name="projects")
    op.drop_table("projects")
