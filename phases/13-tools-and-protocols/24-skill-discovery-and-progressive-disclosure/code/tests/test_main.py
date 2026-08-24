"""Deterministic tests for Lesson 24 discovery and disclosure."""

from __future__ import annotations

import sys
import tempfile
import unittest
import importlib.util
import json
from pathlib import Path


sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    CatalogBudget,
    CollisionError,
    DiscoveryError,
    ReferencePathError,
    Scope,
    build_catalog,
    discover_scope,
    load_reference,
    load_skill_body,
    resolve_collisions,
    validate_reference,
)


def write_skill(root: Path, directory: str, description: str = "Use for reports.") -> None:
    skill = root / directory
    (skill / "references").mkdir(parents=True)
    (skill / "SKILL.md").write_text(
        f"---\nname: {directory}\ndescription: {description}\n---\n\n# Body\n\nBODY-MARKER\n",
        encoding="utf-8",
    )
    (skill / "references" / "format.md").write_text("FORMAT-MARKER", encoding="utf-8")


class DiscoveryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_discovers_only_direct_skill_directories(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        (root / "not-a-skill").mkdir()
        candidates = discover_scope(Scope("project", root))
        self.assertEqual([candidate.name for candidate in candidates], ["reporter"])

    def test_discovers_folded_description_content(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        skill_path = root / "reporter" / "SKILL.md"
        skill_path.write_text(
            """---
name: reporter
description: >
  Build an evidence report when an audit
  needs a bounded summary.
metadata:
  owner: platform
---
Body
""",
            encoding="utf-8",
        )
        candidate = discover_scope(Scope("project", root))[0]
        self.assertEqual(
            candidate.description,
            "Build an evidence report when an audit needs a bounded summary.",
        )

    def test_rejects_frontmatter_name_directory_mismatch(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        skill_path = root / "reporter" / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "name: reporter", "name: different-name"
            ),
            encoding="utf-8",
        )
        with self.assertRaises(DiscoveryError):
            discover_scope(Scope("project", root))

    def test_rejects_invalid_or_duplicate_identity_fields(self) -> None:
        root = self.base / "scope"
        write_skill(root, "Bad_Name")
        with self.assertRaises(DiscoveryError):
            discover_scope(Scope("project", root))
        skill_path = root / "Bad_Name" / "SKILL.md"
        skill_path.write_text(
            "---\nname: Bad_Name\nname: Bad_Name\ndescription: Duplicate.\n---\nBody\n",
            encoding="utf-8",
        )
        with self.assertRaises(DiscoveryError):
            discover_scope(Scope("project", root))

    def test_rejects_malformed_top_level_frontmatter(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        skill_path = root / "reporter" / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "description: Use for reports.",
                "this is not yaml\ndescription: Use for reports.",
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(DiscoveryError, "malformed top-level"):
            discover_scope(Scope("project", root))

    def test_rejects_symlinked_skill_file(self) -> None:
        root = self.base / "scope"
        directory = root / "reporter"
        directory.mkdir(parents=True)
        source = self.base / "external-skill.md"
        source.write_text(
            "---\nname: reporter\ndescription: Report findings.\n---\nBody\n",
            encoding="utf-8",
        )
        (directory / "SKILL.md").symlink_to(source)
        with self.assertRaises(DiscoveryError):
            discover_scope(Scope("project", root))

    def test_host_precedence_selects_project_candidate(self) -> None:
        project = self.base / "project"
        user = self.base / "user"
        write_skill(project, "reporter", "Project report.")
        write_skill(user, "reporter", "User report.")
        candidates = (*discover_scope(Scope("project", project)), *discover_scope(Scope("user", user)))
        winners, collisions = resolve_collisions(candidates, ("project", "user"))
        self.assertEqual(winners[0].scope, "project")
        self.assertEqual(collisions[0].shadowed_scopes, ("user",))

    def test_precedence_is_policy_not_fixed_standard(self) -> None:
        project = self.base / "project"
        user = self.base / "user"
        write_skill(project, "reporter")
        write_skill(user, "reporter")
        candidates = (*discover_scope(Scope("project", project)), *discover_scope(Scope("user", user)))
        winners, _ = resolve_collisions(candidates, ("user", "project"))
        self.assertEqual(winners[0].scope, "user")

    def test_equal_precedence_collision_is_not_silently_overwritten(self) -> None:
        first = self.base / "first"
        second = self.base / "second"
        write_skill(first, "reporter")
        write_skill(second, "reporter")
        candidates = (*discover_scope(Scope("project", first)), *discover_scope(Scope("project", second)))
        with self.assertRaises(CollisionError):
            resolve_collisions(candidates, ("project",))

    def test_catalog_honors_entry_budget(self) -> None:
        root = self.base / "scope"
        write_skill(root, "alpha")
        write_skill(root, "beta")
        catalog = build_catalog(
            discover_scope(Scope("project", root)),
            ("project",),
            CatalogBudget(max_entries=1, max_catalog_chars=2_000),
        )
        self.assertEqual([entry.name for entry in catalog.entries], ["alpha"])
        self.assertEqual(catalog.omitted, ("beta",))

    def test_catalog_truncates_description_to_declared_budget(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter", "x" * 30)
        catalog = build_catalog(
            discover_scope(Scope("project", root)),
            ("project",),
            CatalogBudget(max_description_chars=10, max_catalog_chars=2_000),
        )
        self.assertEqual(len(catalog.entries[0].description), 10)
        self.assertTrue(catalog.entries[0].description.endswith("…"))

    def test_catalog_budget_covers_exact_model_facing_entries(self) -> None:
        root = self.base / "scope"
        for name in ("alpha", "beta", "gamma", "delta"):
            write_skill(root, name, "x" * 120)
        catalog = build_catalog(
            discover_scope(Scope("project", root)),
            ("project",),
            CatalogBudget(max_entries=4, max_description_chars=80, max_catalog_chars=700),
        )
        model_serialized = json.dumps(
            catalog.model_dict(), sort_keys=True, separators=(",", ":")
        )
        report_serialized = json.dumps(
            catalog.to_dict(), sort_keys=True, separators=(",", ":")
        )
        self.assertEqual(len(model_serialized), catalog.catalog_chars)
        self.assertLessEqual(len(model_serialized), 700)
        self.assertEqual(len(report_serialized), catalog.report_chars)

    def test_diagnostics_do_not_evict_model_visible_entries(self) -> None:
        project = self.base / "project"
        user = self.base / "user"
        for name in ("alpha", "beta", "gamma"):
            write_skill(project, name, "Project report.")
            write_skill(user, name, "User report.")
        project_candidates = discover_scope(Scope("project", project))
        baseline = build_catalog(
            project_candidates,
            ("project", "user"),
            CatalogBudget(max_entries=3, max_catalog_chars=4_000),
        )
        combined = build_catalog(
            (*project_candidates, *discover_scope(Scope("user", user))),
            ("project", "user"),
            CatalogBudget(max_entries=3, max_catalog_chars=baseline.catalog_chars),
        )
        self.assertEqual(
            [entry.name for entry in combined.entries], ["alpha", "beta", "gamma"]
        )
        self.assertEqual(combined.catalog_chars, baseline.catalog_chars)
        self.assertGreater(combined.report_chars, baseline.report_chars)

    def test_body_load_is_separate_from_catalog_construction(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        candidates = discover_scope(Scope("project", root))
        catalog = build_catalog(candidates, ("project",), CatalogBudget())
        self.assertNotIn("BODY-MARKER", str(catalog.to_dict()))
        self.assertIn("BODY-MARKER", load_skill_body(catalog.entries[0], candidates))

    def test_accepts_one_level_reference(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        path = validate_reference(root / "reporter", "references/format.md")
        self.assertEqual(path.name, "format.md")

    def test_rejects_traversal_reference(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        with self.assertRaises(ReferencePathError):
            validate_reference(root / "reporter", "../secret.md")

    def test_rejects_non_string_reference_with_domain_error(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        for reference in (None, 1, [], {}):
            with self.subTest(reference=reference):
                with self.assertRaisesRegex(ReferencePathError, "must be a string"):
                    validate_reference(root / "reporter", reference)

    def test_rejects_deep_reference_chain(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        with self.assertRaises(ReferencePathError):
            validate_reference(root / "reporter", "references/archive/format.md")

    def test_rejects_internal_symlink_reference(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        link = root / "reporter" / "references" / "linked.md"
        link.symlink_to(link.parent / "format.md")
        with self.assertRaisesRegex(ReferencePathError, "symlinks"):
            validate_reference(root / "reporter", "references/linked.md")

    def test_reference_load_obeys_size_budget(self) -> None:
        root = self.base / "scope"
        write_skill(root, "reporter")
        candidates = discover_scope(Scope("project", root))
        catalog = build_catalog(candidates, ("project",), CatalogBudget())
        with self.assertRaises(ReferencePathError):
            load_reference(catalog.entries[0], "references/format.md", max_chars=3)

    def test_bundled_catalog_reports_equal_precedence_duplicate(self) -> None:
        script_path = (
            Path(__file__).resolve().parents[2]
            / "outputs"
            / "skill-catalog-builder"
            / "scripts"
            / "build_catalog.py"
        )
        spec = importlib.util.spec_from_file_location("bundled_catalog", script_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        first = self.base / "first"
        second = self.base / "second"
        write_skill(first, "reporter")
        write_skill(second, "reporter")
        result = module.build([("project", first), ("project", second)], 40)
        self.assertFalse(result["valid"])
        self.assertIn("equal-precedence duplicate", result["errors"][0])

    def test_bundled_catalog_shorten_handles_boundary_limits(self) -> None:
        script_path = (
            Path(__file__).resolve().parents[2]
            / "outputs"
            / "skill-catalog-builder"
            / "scripts"
            / "build_catalog.py"
        )
        spec = importlib.util.spec_from_file_location("bundled_catalog_shorten", script_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.shorten("catalog", -1), "")
        self.assertEqual(module.shorten("catalog", 0), "")
        self.assertEqual(module.shorten("catalog", 1), "…")

    def test_bundled_catalog_rejects_malformed_top_level_frontmatter(self) -> None:
        script_path = (
            Path(__file__).resolve().parents[2]
            / "outputs"
            / "skill-catalog-builder"
            / "scripts"
            / "build_catalog.py"
        )
        spec = importlib.util.spec_from_file_location("bundled_strict_catalog", script_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        root = self.base / "scope"
        write_skill(root, "reporter")
        skill_path = root / "reporter" / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "description: Use for reports.",
                "this is not yaml\ndescription: Use for reports.",
            ),
            encoding="utf-8",
        )
        result = module.build([("project", root)], 40)
        self.assertFalse(result["valid"])
        self.assertTrue(any("malformed top-level" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()
