import csv
import io

from app.schemas import SnapshotRead

CSV_COLUMNS = [
    "id",
    "taken_at",
    "total_size_bytes",
    "file_count",
    "size_delta_bytes",
    "trigger",
    "warnings",
]


def snapshots_to_csv(snapshots: list[SnapshotRead]) -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    for snapshot in snapshots:
        writer.writerow(
            [
                snapshot.id,
                snapshot.taken_at.isoformat(),
                snapshot.total_size_bytes,
                snapshot.file_count,
                (
                    ""
                    if snapshot.size_delta_bytes is None
                    else snapshot.size_delta_bytes
                ),
                snapshot.trigger,
                "|".join(snapshot.warnings),
            ]
        )
    return output.getvalue()
