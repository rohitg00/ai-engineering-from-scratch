from __future__ import annotations

import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from main import (
    RELEASE_NOTES_SKILL,
    Skill,
    agent_run,
    discover_skills,
    load_skill,
    parse_frontmatter,
    read_subresource,
    setup_fixtures,
)


class FrontmatterTests(unittest.TestCase):
    def test_parse_frontmatter_returns_metadata_and_body(self) -> None:
        frontmatter, body = parse_frontmatter(RELEASE_NOTES_SKILL)

        self.assertEqual(frontmatter["name"], "release-notes-writer")
        self.assertIn("# Release notes writer", body)

    def test_parse_frontmatter_preserves_plain_markdown(self) -> None:
        text = "# Plain instructions\n"

        self.assertEqual(parse_frontmatter(text), ({}, text))


class DiscoveryTests(unittest.TestCase):
    def test_discover_skills_loads_valid_fixtures(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            setup_fixtures(root)

            skills = discover_skills(root)

        self.assertEqual(set(skills), {"pr-reviewer", "release-notes-writer"})

    def test_discover_skills_returns_empty_for_missing_root(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory) / "missing"

            self.assertEqual(discover_skills(root), {})

    def test_load_skill_rejects_missing_name(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "SKILL.md").write_text(
                "---\ndescription: Missing name\n---\nBody\n", encoding="utf-8"
            )

            self.assertIsNone(load_skill(root))

    def test_load_skill_rejects_missing_description(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory) / "missing-description"
            root.mkdir()
            (root / "SKILL.md").write_text(
                "---\nname: missing-description\n---\nBody\n", encoding="utf-8"
            )

            self.assertIsNone(load_skill(root))

    def test_load_skill_rejects_invalid_name(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory) / "invalid_name"
            root.mkdir()
            (root / "SKILL.md").write_text(
                "---\nname: invalid_name\ndescription: Invalid name\n---\nBody\n",
                encoding="utf-8",
            )

            self.assertIsNone(load_skill(root))

    def test_load_skill_rejects_directory_name_mismatch(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory) / "directory-name"
            root.mkdir()
            (root / "SKILL.md").write_text(
                "---\nname: manifest-name\ndescription: Mismatch\n---\nBody\n",
                encoding="utf-8",
            )

            self.assertIsNone(load_skill(root))

    def test_discovery_skips_invalid_utf8_without_hiding_siblings(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            setup_fixtures(root)
            invalid = root / "invalid-encoding"
            invalid.mkdir()
            (invalid / "SKILL.md").write_bytes(b"\xff\xfe")

            skills = discover_skills(root)

        self.assertEqual(set(skills), {"pr-reviewer", "release-notes-writer"})


class SubresourceTests(unittest.TestCase):
    def test_read_subresource_reads_file_inside_skill_root(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "reference.md"
            reference.write_text("bounded", encoding="utf-8")
            skill = Skill("example", "", "", root)

            self.assertEqual(read_subresource(skill, "reference.md"), "bounded")

    def test_read_subresource_rejects_parent_traversal(self) -> None:
        with TemporaryDirectory() as directory:
            parent = Path(directory)
            root = parent / "skill"
            root.mkdir()
            (parent / "outside.md").write_text("secret", encoding="utf-8")
            skill = Skill("example", "", "", root)

            result = read_subresource(skill, "../outside.md")

        self.assertEqual(result, "(subresource outside skill root: ../outside.md)")

    def test_read_subresource_rejects_symlink_escape(self) -> None:
        with TemporaryDirectory() as directory:
            parent = Path(directory)
            root = parent / "skill"
            root.mkdir()
            outside = parent / "outside.txt"
            outside.write_text("secret", encoding="utf-8")
            link = root / "link.txt"
            try:
                link.symlink_to(outside)
            except OSError as error:
                self.skipTest(f"symlinks unavailable: {error}")
            skill = Skill("example", "", "", root)

            result = read_subresource(skill, "link.txt")

        self.assertEqual(result, "(subresource outside skill root: link.txt)")

    def test_agent_run_loads_referenced_style(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            setup_fixtures(root)
            skill = discover_skills(root)["release-notes-writer"]

            with redirect_stdout(StringIO()):
                prompt = agent_run(skill, "draft notes")

        self.assertIn("Additional style guide", prompt)
        self.assertIn("User task: draft notes", prompt)


if __name__ == "__main__":
    unittest.main()
