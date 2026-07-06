from pathlib import Path

from app.services.scanner import scan_directory


def test_scan_directory_counts_files_and_languages(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text("print('hello')\n")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.ts").write_text("const size = 1\n")
    (tmp_path / "README.md").write_text("# Demo\n")

    result = scan_directory(tmp_path, max_depth=4, excluded_dirs=set())

    assert result.file_count == 3
    assert result.total_size_bytes > 0
    distribution = result.as_json_distribution()
    assert distribution["Python"]["files"] == 1
    assert distribution["TypeScript"]["files"] == 1
    assert distribution["Markdown"]["files"] == 1


def test_scan_directory_respects_depth_limit(tmp_path: Path) -> None:
    nested = tmp_path / "one" / "two"
    nested.mkdir(parents=True)
    (nested / "deep.py").write_text("print('too deep')\n")
    (tmp_path / "root.py").write_text("print('root')\n")

    result = scan_directory(tmp_path, max_depth=1, excluded_dirs=set())

    assert result.file_count == 1
    assert result.as_json_distribution()["Python"]["files"] == 1


def test_scan_directory_excludes_default_like_directories(tmp_path: Path) -> None:
    ignored = tmp_path / "node_modules"
    ignored.mkdir()
    (ignored / "package.js").write_text("console.log('ignored')\n")
    (tmp_path / "app.js").write_text("console.log('counted')\n")

    result = scan_directory(tmp_path, max_depth=4, excluded_dirs={"node_modules"})

    assert result.file_count == 1
    assert result.as_json_distribution()["JavaScript"]["files"] == 1
