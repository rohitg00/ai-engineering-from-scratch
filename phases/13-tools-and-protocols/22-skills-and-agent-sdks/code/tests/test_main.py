"""Deterministic tests for the Lesson 22 skill contract lab."""

from __future__ import annotations

import sys
import importlib.util
import tempfile
import unittest
from pathlib import Path


sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import TaskShape, parse_frontmatter, select_primitives, validate_skill_text


def skill_text(name: str = "release-check", description: str = "Check a release.") -> str:
    return f"""---
name: {name}
description: {description}
---

# Release check

Verify the version and produce a report.
"""


class FrontmatterTests(unittest.TestCase):
    def test_parses_folded_description_and_metadata(self) -> None:
        text = """---
name: release-check
description: >
  Check a release when a maintainer
  asks for a readiness report.
metadata:
  owner: platform
---
# Instructions
Run read-only checks.
"""
        fields, body = parse_frontmatter(text)
        self.assertEqual(
            fields["description"],
            "Check a release when a maintainer asks for a readiness report.",
        )
        self.assertEqual(fields["metadata"], {"owner": "platform"})
        self.assertIn("Run read-only checks", body)

    def test_rejects_duplicate_fields(self) -> None:
        text = """---
name: release-check
name: second-name
description: Check a release.
---
Body
"""
        report = validate_skill_text(text, "release-check")
        self.assertEqual(report.issues[0].code, "frontmatter-syntax")

    def test_rejects_malformed_top_level_line(self) -> None:
        text = skill_text().replace(
            "description: Check a release.",
            "this is not yaml\ndescription: Check a release.",
        )
        report = validate_skill_text(text, "release-check")
        self.assertEqual(report.issues[0].code, "frontmatter-syntax")


class ValidationTests(unittest.TestCase):
    def test_accepts_valid_core_skill(self) -> None:
        report = validate_skill_text(skill_text(), "release-check")
        self.assertTrue(report.valid)
        self.assertEqual(report.runtime_extensions, ())

    def test_rejects_non_kebab_name(self) -> None:
        report = validate_skill_text(skill_text("Release_Check"), "Release_Check")
        self.assertIn("name-format", {issue.code for issue in report.issues})

    def test_rejects_directory_mismatch(self) -> None:
        report = validate_skill_text(skill_text(), "different-directory")
        self.assertIn("directory-mismatch", {issue.code for issue in report.issues})

    def test_requires_description(self) -> None:
        report = validate_skill_text(skill_text(description=""), "release-check")
        self.assertIn("description-required", {issue.code for issue in report.issues})

    def test_host_extension_requires_explicit_policy(self) -> None:
        text = skill_text().replace("description:", "user-invocable: false\ndescription:")
        portable = validate_skill_text(text, "release-check")
        adapted = validate_skill_text(
            text, "release-check", allowed_runtime_extensions={"user-invocable"}
        )
        self.assertFalse(portable.valid)
        self.assertTrue(adapted.valid)
        self.assertEqual(adapted.runtime_extensions, ("user-invocable",))

    def test_compatibility_enforces_normative_length(self) -> None:
        valid = skill_text().replace(
            "description:", f"compatibility: {'x' * 500}\ndescription:"
        )
        invalid = skill_text().replace(
            "description:", f"compatibility: {'x' * 501}\ndescription:"
        )
        self.assertTrue(validate_skill_text(valid, "release-check").valid)
        report = validate_skill_text(invalid, "release-check")
        self.assertIn("compatibility-too-long", {issue.code for issue in report.issues})

    def test_metadata_must_be_string_mapping(self) -> None:
        text = skill_text().replace("description:", "metadata: owner\ndescription:")
        report = validate_skill_text(text, "release-check")
        self.assertIn("metadata-shape", {issue.code for issue in report.issues})

    def test_allowed_tools_must_be_non_empty_string(self) -> None:
        text = skill_text().replace("description:", "allowed-tools:\ndescription:")
        report = validate_skill_text(text, "release-check")
        self.assertIn("allowed-tools-shape", {issue.code for issue in report.issues})

    def test_bundled_checker_parses_folded_description(self) -> None:
        script_path = (
            Path(__file__).resolve().parents[2]
            / "outputs"
            / "skill-contract-reviewer"
            / "scripts"
            / "check_skill.py"
        )
        spec = importlib.util.spec_from_file_location("bundled_checker", script_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temp_dir:
            bundle = Path(temp_dir) / "folded-skill"
            bundle.mkdir()
            (bundle / "SKILL.md").write_text(
                """---
name: folded-skill
description: >
  Review a package when release
  evidence is required.
---
Body
""",
                encoding="utf-8",
            )
            result = module.validate(bundle)
        self.assertTrue(result["valid"])
        self.assertEqual(
            result["description"],
            "Review a package when release evidence is required.",
        )

    def test_bundled_checker_validates_optional_core_fields(self) -> None:
        script_path = (
            Path(__file__).resolve().parents[2]
            / "outputs"
            / "skill-contract-reviewer"
            / "scripts"
            / "check_skill.py"
        )
        spec = importlib.util.spec_from_file_location("bundled_optional_checker", script_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temp_dir:
            bundle = Path(temp_dir) / "optional-fields"
            bundle.mkdir()
            (bundle / "SKILL.md").write_text(
                """---
name: optional-fields
description: Validate optional fields when reviewing a package.
compatibility: Requires Python 3.13.
metadata:
  owner: platform
allowed-tools: Read
---
Body
""",
                encoding="utf-8",
            )
            result = module.validate(bundle)
        self.assertTrue(result["valid"])

    def test_bundled_checker_rejects_malformed_top_level_line(self) -> None:
        script_path = (
            Path(__file__).resolve().parents[2]
            / "outputs"
            / "skill-contract-reviewer"
            / "scripts"
            / "check_skill.py"
        )
        spec = importlib.util.spec_from_file_location("bundled_strict_checker", script_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temp_dir:
            bundle = Path(temp_dir) / "strict-skill"
            bundle.mkdir()
            (bundle / "SKILL.md").write_text(
                """---
name: strict-skill
this is not yaml
description: Reject malformed frontmatter.
---
Body
""",
                encoding="utf-8",
            )
            result = module.validate(bundle)
        self.assertFalse(result["valid"])
        self.assertIn(
            "frontmatter-syntax", {error["code"] for error in result["errors"]}
        )


class DecisionModelTests(unittest.TestCase):
    def test_one_off_task_stays_a_prompt(self) -> None:
        self.assertEqual(select_primitives(TaskShape()), ("prompt",))

    def test_repo_method_and_capability_compose(self) -> None:
        shape = TaskShape(
            repeatable_method=True,
            repository_default=True,
            external_capability=True,
        )
        self.assertEqual(
            select_primitives(shape), ("AGENTS.md", "Agent Skill", "MCP tool")
        )

    def test_lifecycle_event_selects_hook(self) -> None:
        self.assertEqual(
            select_primitives(TaskShape(lifecycle_event=True)), ("hook",)
        )

    def test_deterministic_transformation_selects_ordinary_code(self) -> None:
        self.assertEqual(
            select_primitives(TaskShape(deterministic_logic=True)), ("ordinary code",)
        )

    def test_isolated_context_selects_subagent(self) -> None:
        self.assertEqual(
            select_primitives(TaskShape(isolated_delegation=True)), ("subagent",)
        )


if __name__ == "__main__":
    unittest.main()
