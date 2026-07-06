from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


DEFAULT_LANGUAGE_BY_EXTENSION: dict[str, str] = {
    ".py": "Python",
    ".ipynb": "Jupyter Notebook",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".c": "C",
    ".h": "C/C++ Header",
    ".cpp": "C++",
    ".hpp": "C++ Header",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".scala": "Scala",
    ".sh": "Shell",
    ".zsh": "Shell",
    ".bash": "Shell",
    ".ps1": "PowerShell",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".md": "Markdown",
    ".sql": "SQL",
}


@dataclass
class LanguageBucket:
    bytes: int = 0
    files: int = 0


@dataclass
class ScanResult:
    total_size_bytes: int = 0
    file_count: int = 0
    language_distribution: dict[str, LanguageBucket] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def as_json_distribution(self) -> dict[str, dict[str, int]]:
        return {
            language: {"bytes": bucket.bytes, "files": bucket.files}
            for language, bucket in sorted(self.language_distribution.items())
        }


def classify_language(path: Path, mapping: dict[str, str] | None = None) -> str:
    language_mapping = mapping or DEFAULT_LANGUAGE_BY_EXTENSION
    return language_mapping.get(path.suffix.lower(), "Other")


def scan_directory(
    path: Path,
    max_depth: int,
    excluded_dirs: set[str] | None = None,
    language_mapping: dict[str, str] | None = None,
) -> ScanResult:
    root = path.expanduser().resolve()
    exclusions = excluded_dirs or set()
    result = ScanResult()
    seen_dirs: set[tuple[int, int]] = set()

    def scan(current: Path, depth: int) -> None:
        if depth > max_depth:
            return

        try:
            current_stat = current.stat()
        except (OSError, PermissionError) as exc:
            result.warnings.append(f"Could not stat directory {current}: {exc}")
            return

        dir_key = (current_stat.st_dev, current_stat.st_ino)
        if dir_key in seen_dirs:
            result.warnings.append(f"Skipped symlink loop or repeated directory: {current}")
            return
        seen_dirs.add(dir_key)

        try:
            with os.scandir(current) as entries:
                for entry in entries:
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            if entry.name in exclusions:
                                continue
                            scan(Path(entry.path), depth + 1)
                        elif entry.is_file(follow_symlinks=False):
                            stat_result = entry.stat(follow_symlinks=False)
                            file_path = Path(entry.path)
                            language = classify_language(file_path, language_mapping)
                            bucket = result.language_distribution.setdefault(
                                language, LanguageBucket()
                            )
                            bucket.bytes += stat_result.st_size
                            bucket.files += 1
                            result.total_size_bytes += stat_result.st_size
                            result.file_count += 1
                    except (OSError, PermissionError) as exc:
                        result.warnings.append(f"Skipped {entry.path}: {exc}")
        except (OSError, PermissionError) as exc:
            result.warnings.append(f"Could not read directory {current}: {exc}")

    scan(root, 0)
    return result
