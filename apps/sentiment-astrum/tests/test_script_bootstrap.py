from pathlib import Path

from scripts.bootstrap import project_root


def test_project_root_points_to_service_root() -> None:
    root = project_root()
    assert root == Path(__file__).resolve().parent.parent
    assert (root / "src").is_dir()
    assert (root / "scripts").is_dir()
