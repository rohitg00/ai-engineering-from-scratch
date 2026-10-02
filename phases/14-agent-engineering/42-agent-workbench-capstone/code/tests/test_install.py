# Installer behavior follows the capstone lesson contract and pack layout.
# Source: phases/14-agent-engineering/42-agent-workbench-capstone/docs/en.md.
# These integration tests use only Python's standard library and Bash.
# They protect safe installs, collision handling, and nested file copying.
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


LESSON = Path(__file__).resolve().parents[2]
PACK = LESSON / "outputs" / "agent-workbench-pack"
INSTALLER = PACK / "bin" / "install.sh"


def _bash_executable() -> str:
    candidates: list[Path] = []
    if os.name == "nt":
        candidates.extend(
            [
                Path(r"C:\Program Files\Git\bin\bash.exe"),
                Path(r"C:\Program Files\Git\usr\bin\bash.exe"),
            ]
        )
    located = shutil.which("bash")
    if located:
        candidates.append(Path(located))
    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate).casefold()
        if key in seen or not candidate.is_file():
            continue
        seen.add(key)
        try:
            probe = subprocess.run(
                [str(candidate), "-c", "exit 0"],
                capture_output=True,
                text=True,
                check=False,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        if probe.returncode == 0:
            return str(candidate)
    raise unittest.SkipTest("A working Bash executable is required for installer integration tests")


def _bash_path(path: Path) -> str:
    resolved = path.resolve()
    if os.name != "nt":
        return resolved.as_posix()
    drive = resolved.drive.rstrip(":").lower()
    tail = resolved.as_posix()[len(resolved.drive):]
    return f"/{drive}{tail}"


class InstallScriptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bash = _bash_executable()

    def run_installer(
        self, target: Path, *args: str, installer: Path = INSTALLER
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [self.bash, _bash_path(installer), *args],
            cwd=target,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_fresh_install_populates_pack(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            result = self.run_installer(target)
            self.assertEqual(result.returncode, 0, result.stderr)
            for relative in ("AGENTS.md", ".workbench-version", "docs/reviewer-rubric.md", "schemas/agent_state.schema.json", "scripts/init_agent.py"):
                self.assertTrue((target / relative).is_file(), relative)

    def test_fresh_install_creates_parents_for_nested_pack_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "target"
            target.mkdir()
            pack = root / "pack"
            shutil.copytree(PACK, pack)
            relative = Path("docs") / "examples" / "nested" / "guide.md"
            contents = "nested pack file\n"
            nested_source = pack / relative
            nested_source.parent.mkdir(parents=True)
            nested_source.write_text(contents, encoding="utf-8")

            result = self.run_installer(
                target, installer=pack / "bin" / "install.sh"
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((target / relative).read_text(encoding="utf-8"), contents)

    def test_collision_refuses_before_any_write(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            existing = target / "docs" / "reviewer-rubric.md"
            existing.parent.mkdir()
            existing.write_text("keep this local file\n", encoding="utf-8")

            result = self.run_installer(target)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("docs/reviewer-rubric.md", result.stderr)
            self.assertEqual(existing.read_text(encoding="utf-8"), "keep this local file\n")
            self.assertFalse((target / "AGENTS.md").exists())
            self.assertFalse((target / ".workbench-version").exists())
            self.assertFalse((target / "scripts").exists())

    def test_reports_all_collisions_without_partial_install(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            collisions = {
                "docs/reviewer-rubric.md": "local docs\n",
                "scripts/init_agent.py": "local script\n",
            }
            for relative, content in collisions.items():
                path = target / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")

            result = self.run_installer(target)

            self.assertNotEqual(result.returncode, 0)
            for relative in collisions:
                self.assertIn(relative, result.stderr)
                self.assertEqual((target / relative).read_text(encoding="utf-8"), collisions[relative])
            self.assertFalse((target / "AGENTS.md").exists())
            self.assertFalse((target / ".workbench-version").exists())
            self.assertFalse((target / "schemas").exists())

    def test_force_replaces_regular_file_collision(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            existing = target / "docs" / "reviewer-rubric.md"
            existing.parent.mkdir()
            existing.write_text("local copy\n", encoding="utf-8")

            result = self.run_installer(target, "--force")

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(existing.read_bytes(), (PACK / "docs" / "reviewer-rubric.md").read_bytes())
            self.assertTrue((target / "AGENTS.md").is_file())

    def test_identical_reinstall_is_safe_and_preserves_extra_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)
            self.assertEqual(self.run_installer(target).returncode, 0)
            extra = target / "docs" / "local-notes.md"
            extra.write_text("keep me\n", encoding="utf-8")

            result = self.run_installer(target)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(extra.read_text(encoding="utf-8"), "keep me\n")

    def test_symlink_destination_is_rejected_even_with_force(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "target"
            outside = root / "outside.md"
            target.mkdir()
            outside.write_text("preserve outside\n", encoding="utf-8")
            destination = target / "docs" / "reviewer-rubric.md"
            destination.parent.mkdir()
            try:
                destination.symlink_to(outside)
            except (OSError, NotImplementedError) as exc:
                self.skipTest(f"symlink creation unavailable: {exc}")

            result = self.run_installer(target, "--force")

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("symlinked path", result.stderr)
            self.assertEqual(outside.read_text(encoding="utf-8"), "preserve outside\n")
            self.assertFalse((target / "AGENTS.md").exists())

    def test_unknown_argument_fails_before_writing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary)

            result = self.run_installer(target, "--overwrite")

            self.assertEqual(result.returncode, 2)
            self.assertFalse((target / "AGENTS.md").exists())


if __name__ == "__main__":
    unittest.main()
