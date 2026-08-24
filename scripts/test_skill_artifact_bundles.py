#!/usr/bin/env python3
"""Regression tests for flat and directory-bundled lesson artifacts."""

from __future__ import annotations

import contextlib
import importlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parent))
install_skills = importlib.import_module("install_skills")
build_catalog = importlib.import_module("build_catalog")


def write_markdown(path: Path, *, name: str, description: str, version: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(
            [
                "---",
                f"name: {name}",
                f"description: {description}",
                f"version: {version}",
                "license: MIT",
                "tags: [skills, testing]",
                "---",
                "",
                f"# {name}",
                "",
            ]
        ),
        encoding="utf-8",
    )


class SkillArtifactBundleTest(unittest.TestCase):
    def make_outputs(self, root: Path) -> Path:
        outputs = root / "phases/14-agent-engineering/22-skill-runtime/outputs"
        outputs.mkdir(parents=True)
        return outputs

    def test_phase_and_lesson_are_derived_after_the_phases_segment(self) -> None:
        path = Path(
            "/workspace/2026-08-21/run/phases/13-tools-and-protocols/"
            "24-skill-discovery/outputs/skill-catalog-builder/SKILL.md"
        )
        self.assertEqual(install_skills.derive_phase_lesson(path), (13, 24))

    def test_installer_discovers_one_bundle_from_its_skill_entrypoint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            write_markdown(
                bundle / "references/not-an-artifact.md",
                name="nested-reference",
                description="Supporting material.",
                version="1.0.0",
            )

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())

            self.assertEqual(len(artifacts), 1)
            artifact = artifacts[0]
            self.assertEqual(artifact.type, "skill")
            self.assertEqual(artifact.name, "release-gate")
            self.assertEqual(artifact.description, "Gate a release.")
            self.assertEqual(artifact.version, "2.1.0")
            self.assertEqual(artifact.tags, ["skills", "testing"])
            self.assertEqual((artifact.phase, artifact.lesson), (14, 22))
            self.assertEqual(artifact.source, bundle / "SKILL.md")
            self.assertEqual(artifact.bundle_root, bundle)
            self.assertEqual(
                artifact.bundle_files,
                ["SKILL.md", "references/not-an-artifact.md"],
            )

    def test_bundle_file_lists_share_sorted_posix_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            (bundle / "sub").mkdir()
            (bundle / "sub/file.txt").write_text("nested\n", encoding="utf-8")
            (bundle / "sub.md").write_text("sibling\n", encoding="utf-8")

            with patch.object(build_catalog, "ROOT", root), patch.object(
                install_skills, "ROOT", root
            ):
                catalog_files = build_catalog.list_bundle_files(bundle)
                installer_files = install_skills.validate_bundle(bundle)

            expected = ["SKILL.md", "sub.md", "sub/file.txt"]
            self.assertEqual(catalog_files, expected)
            self.assertEqual(installer_files, expected)

    def test_installer_copies_the_complete_bundle_to_one_skill_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            (bundle / "references").mkdir()
            (bundle / "references/policy.md").write_text("policy\n", encoding="utf-8")
            (bundle / "scripts").mkdir()
            (bundle / "scripts/check.py").write_text("print('ok')\n", encoding="utf-8")
            (bundle / "assets").mkdir()
            (bundle / "assets/fixture.bin").write_bytes(b"\x00\x01\x02")
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                plan = install_skills.build_plan(artifacts, target, "skills", False)
                install_skills.apply_plan(plan)

            installed = target / "release-gate"
            self.assertEqual(
                (installed / "SKILL.md").read_text(encoding="utf-8"),
                (bundle / "SKILL.md").read_text(encoding="utf-8"),
            )
            self.assertEqual(
                (installed / "references/policy.md").read_text(encoding="utf-8"),
                "policy\n",
            )
            self.assertEqual(
                (installed / "scripts/check.py").read_text(encoding="utf-8"),
                "print('ok')\n",
            )
            self.assertEqual((installed / "assets/fixture.bin").read_bytes(), b"\x00\x01\x02")

    def test_failed_forced_bundle_swap_restores_the_previous_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="New release gate.",
                version="2.1.0",
            )
            (bundle / "references").mkdir()
            (bundle / "references/new.md").write_text("new\n", encoding="utf-8")
            target = root / "installed"
            installed = target / "release-gate"
            installed.mkdir(parents=True)
            (installed / "SKILL.md").write_text("old skill\n", encoding="utf-8")
            (installed / "keep.txt").write_text("old state\n", encoding="utf-8")

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                plan = install_skills.build_plan(artifacts, target, "skills", True)
                real_replace = install_skills.os.replace

                def fail_staged_swap(source: str | Path, dest: str | Path) -> None:
                    if Path(source).name == "bundle" and Path(dest) == installed:
                        raise OSError("intentional staged swap failure")
                    real_replace(source, dest)

                with patch.object(
                    install_skills.os, "replace", side_effect=fail_staged_swap
                ):
                    with self.assertRaisesRegex(OSError, "staged swap failure"):
                        install_skills.apply_plan(plan, force=True)

            self.assertEqual((installed / "SKILL.md").read_text(), "old skill\n")
            self.assertEqual((installed / "keep.txt").read_text(), "old state\n")
            self.assertFalse((installed / "references/new.md").exists())
            self.assertEqual(
                [p.name for p in target.iterdir() if p.name.startswith(".release-gate.")],
                [],
            )

    def test_flat_skill_keeps_all_existing_layouts_and_skill_conversion(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            source = outputs / "skill-flat-reviewer.md"
            write_markdown(
                source,
                name="flat-reviewer",
                description="Review a flat artifact.",
                version="1.0.0",
            )
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                self.assertEqual(len(artifacts), 1)
                artifact = artifacts[0]
                self.assertIsNone(artifact.bundle_root)
                self.assertEqual(
                    install_skills.target_path(artifact, target, "flat"),
                    target / "flat-reviewer.md",
                )
                self.assertEqual(
                    install_skills.target_path(artifact, target, "by-phase"),
                    target / "phase-14/flat-reviewer.md",
                )
                self.assertEqual(
                    install_skills.target_path(artifact, target, "skills"),
                    target / "flat-reviewer/SKILL.md",
                )
                plan = install_skills.build_plan(artifacts, target, "skills", False)
                install_skills.apply_plan(plan)

            self.assertEqual(
                (target / "flat-reviewer/SKILL.md").read_bytes(), source.read_bytes()
            )

    def test_bundle_targets_resolve_for_every_layout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifact = list(install_skills.discover_artifacts())[0]
                self.assertEqual(
                    install_skills.target_path(artifact, target, "flat"),
                    target / "release-gate",
                )
                self.assertEqual(
                    install_skills.target_path(artifact, target, "by-phase"),
                    target / "phase-14/release-gate",
                )
                self.assertEqual(
                    install_skills.target_path(artifact, target, "skills"),
                    target / "release-gate",
                )

    def test_duplicate_flat_and_bundle_names_choose_the_flat_artifact_once(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            flat = outputs / "skill-release-gate.md"
            write_markdown(
                flat,
                name="release-gate",
                description="Original flat gate.",
                version="1.0.0",
            )
            earlier_outputs = (
                root
                / "phases/14-agent-engineering/21-earlier-skill/outputs"
            )
            bundle = earlier_outputs / "release-gate-bundle"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Duplicate bundled gate.",
                version="2.0.0",
            )
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                warnings = io.StringIO()
                with contextlib.redirect_stderr(warnings):
                    plan = install_skills.build_plan(
                        artifacts, target, "skills", False
                    )
                install_skills.apply_plan(plan)

            self.assertEqual(len(artifacts), 2)
            self.assertEqual(len(plan.actions), 1)
            self.assertEqual(plan.actions[0][0].source, flat)
            self.assertIn("target collision", warnings.getvalue())
            self.assertEqual(
                (target / "release-gate/SKILL.md").read_bytes(), flat.read_bytes()
            )

    def test_installer_rejects_bundle_symlinks_before_writing_any_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            outside = root / "private.txt"
            outside.write_text("do not copy\n", encoding="utf-8")
            (bundle / "references").mkdir()
            (bundle / "references/private.txt").symlink_to(outside)
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                with self.assertRaisesRegex(
                    install_skills.UnsafeBundleError, "unsafe file entry"
                ):
                    list(install_skills.discover_artifacts())

            self.assertFalse(target.exists())

    def test_installer_rejects_bundle_file_symlink_swap_at_open_boundary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            references = bundle / "references"
            references.mkdir()
            policy = references / "policy.md"
            policy.write_text("approved policy\n", encoding="utf-8")
            outside = root / "private.txt"
            outside.write_text("must not be installed\n", encoding="utf-8")
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                plan = install_skills.build_plan(artifacts, target, "skills", False)
                real_open = install_skills._open_bundle_file
                swapped = False

                def swap_then_open(directory_fd, name, expected, display_path):
                    nonlocal swapped
                    if not swapped and display_path == policy:
                        swapped = True
                        policy.unlink()
                        policy.symlink_to(outside)
                    return real_open(directory_fd, name, expected, display_path)

                with patch.object(
                    install_skills,
                    "_open_bundle_file",
                    side_effect=swap_then_open,
                ):
                    with self.assertRaisesRegex(
                        install_skills.UnsafeBundleError,
                        "unsafe file entry",
                    ):
                        install_skills.apply_plan(plan)

            self.assertFalse((target / "release-gate").exists())
            self.assertEqual(list(target.iterdir()), [])
            self.assertNotEqual(policy.read_bytes(), b"approved policy\n")

    def test_installer_rejects_flat_file_symlink_swap_at_open_boundary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            source = outputs / "skill-flat-reviewer.md"
            write_markdown(
                source,
                name="flat-reviewer",
                description="Review a flat artifact.",
                version="1.0.0",
            )
            outside = root / "private.md"
            outside.write_text("must not be installed\n", encoding="utf-8")
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                plan = install_skills.build_plan(artifacts, target, "skills", False)
                real_open = install_skills._open_flat_artifact

                def swap_then_open(source_path, expected):
                    source_path.unlink()
                    source_path.symlink_to(outside)
                    return real_open(source_path, expected)

                with patch.object(
                    install_skills,
                    "_open_flat_artifact",
                    side_effect=swap_then_open,
                ):
                    with self.assertRaisesRegex(
                        install_skills.UnsafeArtifactError,
                        "regular file",
                    ):
                        install_skills.apply_plan(plan)

            self.assertFalse((target / "flat-reviewer/SKILL.md").exists())
            self.assertEqual([path for path in target.rglob("*") if path.is_file()], [])

    def test_forced_flat_install_replaces_destination_symlink_not_its_target(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            source = outputs / "skill-flat-reviewer.md"
            write_markdown(
                source,
                name="flat-reviewer",
                description="Review a flat artifact.",
                version="1.0.0",
            )
            target = root / "installed"
            target.mkdir()
            victim = root / "outside.md"
            victim.write_text("outside stays unchanged\n", encoding="utf-8")
            destination = target / "flat-reviewer.md"
            destination.symlink_to(victim)

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                plan = install_skills.build_plan(artifacts, target, "flat", True)
                install_skills.apply_plan(plan, force=True)

            self.assertEqual(victim.read_text(), "outside stays unchanged\n")
            self.assertFalse(destination.is_symlink())
            self.assertEqual(destination.read_bytes(), source.read_bytes())

    def test_installer_rejects_symlinked_layout_parent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            source = outputs / "skill-flat-reviewer.md"
            write_markdown(
                source,
                name="flat-reviewer",
                description="Review a flat artifact.",
                version="1.0.0",
            )
            target = root / "installed"
            target.mkdir()
            outside = root / "outside"
            outside.mkdir()
            victim = outside / "SKILL.md"
            victim.write_text("outside stays unchanged\n", encoding="utf-8")
            (target / "flat-reviewer").symlink_to(
                outside, target_is_directory=True
            )

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                plan = install_skills.build_plan(artifacts, target, "skills", True)
                with self.assertRaisesRegex(
                    install_skills.UnsafeArtifactError,
                    "destination parent",
                ):
                    install_skills.apply_plan(plan, force=True)

            self.assertEqual(victim.read_text(), "outside stays unchanged\n")

    def test_installer_rejects_a_bundle_reached_through_an_escaping_parent_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            root = temp_root / "workspace"
            lesson = root / "phases/14-agent-engineering/22-skill-runtime"
            lesson.mkdir(parents=True)
            outside_outputs = temp_root / "outside-outputs"
            bundle = outside_outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            (lesson / "outputs").symlink_to(outside_outputs, target_is_directory=True)
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                with self.assertRaisesRegex(
                    install_skills.UnsafeBundleError, "escapes the repository"
                ):
                    list(install_skills.discover_artifacts())

            self.assertFalse(target.exists())

    def test_installer_rejects_a_flat_only_escaping_outputs_parent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            root = temp_root / "workspace"
            lesson = root / "phases/14-agent-engineering/22-skill-runtime"
            lesson.mkdir(parents=True)
            outside_outputs = temp_root / "outside-outputs"
            write_markdown(
                outside_outputs / "skill-leaked-reviewer.md",
                name="leaked-reviewer",
                description="This artifact is outside the repository.",
                version="1.0.0",
            )
            (lesson / "outputs").symlink_to(
                outside_outputs, target_is_directory=True
            )

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), patch.object(
                install_skills, "artifact_from_markdown"
            ) as parse_artifact:
                with self.assertRaisesRegex(ValueError, "lesson outputs escapes"):
                    list(install_skills.discover_artifacts())

            parse_artifact.assert_not_called()

    def test_installer_rejects_an_in_repository_outputs_directory_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lesson = root / "phases/14-agent-engineering/22-skill-runtime"
            lesson.mkdir(parents=True)
            shared_outputs = root / "shared-outputs"
            write_markdown(
                shared_outputs / "skill-shared-reviewer.md",
                name="shared-reviewer",
                description="This artifact is in the repository but behind a symlink.",
                version="1.0.0",
            )
            (lesson / "outputs").symlink_to(
                shared_outputs, target_is_directory=True
            )

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), patch.object(
                install_skills, "artifact_from_markdown"
            ) as parse_artifact:
                with self.assertRaisesRegex(
                    ValueError, "lesson outputs must be a regular directory"
                ):
                    list(install_skills.discover_artifacts())

            parse_artifact.assert_not_called()

    def test_installer_rejects_a_direct_flat_artifact_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            root = temp_root / "workspace"
            outputs = self.make_outputs(root)
            outside = temp_root / "skill-outside.md"
            write_markdown(
                outside,
                name="outside",
                description="This artifact is outside the repository.",
                version="1.0.0",
            )
            (outputs / "skill-leaked-reviewer.md").symlink_to(outside)

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), patch.object(
                install_skills, "artifact_from_markdown"
            ) as parse_artifact:
                with self.assertRaisesRegex(ValueError, "flat artifact must be a regular file"):
                    list(install_skills.discover_artifacts())

            parse_artifact.assert_not_called()

    def test_dry_run_rejects_unsafe_bundle_before_previewing_it(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            outside = root / "private.txt"
            outside.write_text("do not read\n", encoding="utf-8")
            (bundle / "references").mkdir()
            (bundle / "references/private.txt").symlink_to(outside)
            target = root / "installed"
            output = io.StringIO()
            errors = io.StringIO()

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                result = install_skills.main([str(target), "--dry-run"])

            self.assertEqual(result, 1)
            self.assertEqual(output.getvalue(), "")
            self.assertIn("unsafe file entry", errors.getvalue())
            self.assertFalse(target.exists())

    def test_discovery_rejects_symlinked_bundle_before_reading_skill_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            external = root / "external-release-gate"
            write_markdown(
                external / "SKILL.md",
                name="release-gate",
                description="External release gate.",
                version="2.1.0",
            )
            (outputs / "release-gate").symlink_to(external, target_is_directory=True)

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), patch.object(
                install_skills, "artifact_from_markdown"
            ) as parse_artifact:
                with self.assertRaisesRegex(
                    install_skills.UnsafeBundleError, "regular directory"
                ):
                    list(install_skills.discover_artifacts())

            parse_artifact.assert_not_called()

    def test_discovery_ignores_unrecognized_symlinked_file_entries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            outside = root / "notes.md"
            outside.write_text("not an artifact\n", encoding="utf-8")
            (outputs / "notes.md").symlink_to(outside)

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())

            self.assertEqual([artifact.name for artifact in artifacts], ["release-gate"])

    def test_cli_reports_an_unsafe_bundle_without_a_traceback(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            outside = root / "private.txt"
            outside.write_text("do not copy\n", encoding="utf-8")
            (bundle / "references").mkdir()
            (bundle / "references/private.txt").symlink_to(outside)
            target = root / "installed"
            errors = io.StringIO()

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), contextlib.redirect_stderr(errors):
                result = install_skills.main([str(target)])

            self.assertEqual(result, 1)
            self.assertIn("error: skill bundle contains an unsafe file entry", errors.getvalue())
            self.assertNotIn("Traceback", errors.getvalue())
            self.assertFalse(target.exists())

    def test_cli_rejects_an_artifact_name_that_escapes_the_target(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            write_markdown(
                outputs / "skill-escape.md",
                name="../../escape",
                description="Unsafe name.",
                version="1.0.0",
            )
            target = root / "installed"
            errors = io.StringIO()

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), contextlib.redirect_stderr(errors):
                result = install_skills.main([str(target)])

            self.assertEqual(result, 1)
            self.assertIn("error: unsafe artifact name", errors.getvalue())
            self.assertFalse((root / "escape.md").exists())

    def test_catalog_surfaces_bundle_metadata_files_and_skill_entrypoint_once(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            flat = outputs / "skill-flat-reviewer.md"
            write_markdown(
                flat,
                name="flat-reviewer",
                description="Review a flat artifact.",
                version="1.0.0",
            )
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            write_markdown(
                bundle / "references/guide.md",
                name="nested-guide",
                description="Not a second artifact.",
                version="1.0.0",
            )
            (bundle / "scripts").mkdir()
            (bundle / "scripts/check.py").write_text("print('ok')\n", encoding="utf-8")

            with patch.object(build_catalog, "ROOT", root), patch.object(
                build_catalog, "PHASES_DIR", root / "phases"
            ):
                catalog = build_catalog.build_catalog()

            self.assertEqual(catalog["totals"]["skills"], 2)
            lesson = catalog["phases"][0]["lessons"][0]
            self.assertEqual(len(lesson["outputs"]), 2)
            flat_record, bundle_record = lesson["outputs"]
            self.assertEqual(
                flat_record,
                {
                    "type": "skill",
                    "name": "flat-reviewer",
                    "path": "phases/14-agent-engineering/22-skill-runtime/outputs/skill-flat-reviewer.md",
                    "version": "1.0.0",
                    "description": "Review a flat artifact.",
                    "tags": ["skills", "testing"],
                },
            )
            self.assertEqual(bundle_record["type"], "skill")
            self.assertEqual(bundle_record["name"], "release-gate")
            self.assertEqual(bundle_record["version"], "2.1.0")
            self.assertEqual(bundle_record["description"], "Gate a release.")
            self.assertEqual(bundle_record["license"], "MIT")
            self.assertEqual(bundle_record["tags"], ["skills", "testing"])
            self.assertTrue(bundle_record["bundle"])
            self.assertEqual(
                bundle_record["path"],
                "phases/14-agent-engineering/22-skill-runtime/outputs/release-gate/SKILL.md",
            )
            self.assertEqual(
                bundle_record["bundle_path"],
                "phases/14-agent-engineering/22-skill-runtime/outputs/release-gate",
            )
            self.assertEqual(
                bundle_record["files"],
                ["SKILL.md", "references/guide.md", "scripts/check.py"],
            )

    def test_catalog_rejects_a_bundle_that_resolves_outside_the_repository(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            root = temp_root / "workspace"
            lesson = root / "phases/14-agent-engineering/22-skill-runtime"
            lesson.mkdir(parents=True)
            outside_outputs = temp_root / "outside-outputs"
            write_markdown(
                outside_outputs / "release-gate/SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            (lesson / "outputs").symlink_to(outside_outputs, target_is_directory=True)

            with patch.object(build_catalog, "ROOT", root), patch.object(
                build_catalog, "PHASES_DIR", root / "phases"
            ):
                with self.assertRaisesRegex(ValueError, "escapes the repository"):
                    build_catalog.build_catalog()

    def test_catalog_rejects_a_flat_only_escaping_outputs_parent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            root = temp_root / "workspace"
            lesson = root / "phases/14-agent-engineering/22-skill-runtime"
            lesson.mkdir(parents=True)
            outside_outputs = temp_root / "outside-outputs"
            write_markdown(
                outside_outputs / "skill-leaked-reviewer.md",
                name="leaked-reviewer",
                description="This artifact is outside the repository.",
                version="1.0.0",
            )
            (lesson / "outputs").symlink_to(
                outside_outputs, target_is_directory=True
            )

            with patch.object(build_catalog, "ROOT", root), patch.object(
                build_catalog, "PHASES_DIR", root / "phases"
            ), patch.object(build_catalog, "parse_artifact") as parse_artifact:
                with self.assertRaisesRegex(ValueError, "lesson outputs escapes"):
                    build_catalog.build_catalog()

            parse_artifact.assert_not_called()

    def test_catalog_rejects_an_in_repository_outputs_directory_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lesson = root / "phases/14-agent-engineering/22-skill-runtime"
            lesson.mkdir(parents=True)
            shared_outputs = root / "shared-outputs"
            write_markdown(
                shared_outputs / "skill-shared-reviewer.md",
                name="shared-reviewer",
                description="This artifact is in the repository but behind a symlink.",
                version="1.0.0",
            )
            (lesson / "outputs").symlink_to(
                shared_outputs, target_is_directory=True
            )

            with patch.object(build_catalog, "ROOT", root), patch.object(
                build_catalog, "PHASES_DIR", root / "phases"
            ), patch.object(build_catalog, "parse_artifact") as parse_artifact:
                with self.assertRaisesRegex(
                    ValueError, "lesson outputs must be a regular directory"
                ):
                    build_catalog.build_catalog()

            parse_artifact.assert_not_called()

    def test_catalog_rejects_a_direct_flat_artifact_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            root = temp_root / "workspace"
            outputs = self.make_outputs(root)
            outside = temp_root / "skill-outside.md"
            write_markdown(
                outside,
                name="outside",
                description="This artifact is outside the repository.",
                version="1.0.0",
            )
            (outputs / "skill-leaked-reviewer.md").symlink_to(outside)

            with patch.object(build_catalog, "ROOT", root), patch.object(
                build_catalog, "PHASES_DIR", root / "phases"
            ), patch.object(build_catalog, "parse_artifact") as parse_artifact:
                with self.assertRaisesRegex(ValueError, "flat artifact must be a regular file"):
                    build_catalog.build_catalog()

            parse_artifact.assert_not_called()

    def test_manifest_describes_the_single_artifact_that_was_installed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            flat = outputs / "skill-release-gate.md"
            write_markdown(
                flat,
                name="release-gate",
                description="Original flat gate.",
                version="1.0.0",
            )
            bundle = outputs / "release-gate-bundle"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Duplicate bundled gate.",
                version="2.0.0",
            )
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(
                io.StringIO()
            ):
                result = install_skills.main([str(target)])

            self.assertEqual(result, 0)
            manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["totals"]["artifacts"], 1)
            self.assertEqual(len(manifest["artifacts"]), 1)
            self.assertEqual(
                manifest["artifacts"][0]["source"],
                "phases/14-agent-engineering/22-skill-runtime/outputs/skill-release-gate.md",
            )

    def test_manifest_includes_bundle_entrypoint_root_and_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            (bundle / "evals").mkdir()
            (bundle / "evals/cases.json").write_text("[]\n", encoding="utf-8")
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ), contextlib.redirect_stdout(io.StringIO()):
                result = install_skills.main([str(target)])

            self.assertEqual(result, 0)
            manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(
                manifest["artifacts"][0],
                {
                    "type": "skill",
                    "name": "release-gate",
                    "phase": 14,
                    "lesson": 22,
                    "version": "2.1.0",
                    "description": "Gate a release.",
                    "tags": ["skills", "testing"],
                    "source": "phases/14-agent-engineering/22-skill-runtime/outputs/release-gate/SKILL.md",
                    "target": "release-gate",
                    "bundle": True,
                    "bundle_path": "phases/14-agent-engineering/22-skill-runtime/outputs/release-gate",
                    "files": ["SKILL.md", "evals/cases.json"],
                },
            )

    def test_manifest_uses_cached_bundle_files_after_install(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outputs = self.make_outputs(root)
            bundle = outputs / "release-gate"
            write_markdown(
                bundle / "SKILL.md",
                name="release-gate",
                description="Gate a release.",
                version="2.1.0",
            )
            (bundle / "evals").mkdir()
            (bundle / "evals/cases.json").write_text("[]\n", encoding="utf-8")
            target = root / "installed"

            with patch.object(install_skills, "ROOT", root), patch.object(
                install_skills, "PHASES_DIR", root / "phases"
            ):
                artifacts = list(install_skills.discover_artifacts())
                plan = install_skills.build_plan(artifacts, target, "skills", False)
                install_skills.apply_plan(plan)
                (bundle / "added-after-install.txt").write_text(
                    "late mutation\n", encoding="utf-8"
                )
                with patch.object(
                    install_skills,
                    "validate_bundle",
                    side_effect=AssertionError("manifest re-walked source bundle"),
                ):
                    manifest_path = install_skills.write_manifest(
                        target, artifacts, "skills"
                    )

            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(
                manifest["artifacts"][0]["files"],
                ["SKILL.md", "evals/cases.json"],
            )

    def test_manifest_atomically_replaces_symlink_without_touching_target(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "installed"
            target.mkdir()
            victim = root / "outside.json"
            victim.write_text('{"protected": true}\n', encoding="utf-8")
            manifest_path = target / "manifest.json"
            manifest_path.symlink_to(victim)

            written = install_skills.write_manifest(target, [], "skills")

            self.assertEqual(victim.read_text(), '{"protected": true}\n')
            self.assertFalse(written.is_symlink())
            self.assertEqual(json.loads(written.read_text())["schema_version"], 1)

    def test_manifest_rejects_symlinked_target_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outside = root / "outside"
            outside.mkdir()
            victim = outside / "manifest.json"
            victim.write_text('{"protected": true}\n', encoding="utf-8")
            target = root / "installed"
            target.symlink_to(outside, target_is_directory=True)

            with self.assertRaisesRegex(
                install_skills.UnsafeArtifactError,
                "installation target",
            ):
                install_skills.write_manifest(target, [], "skills")

            self.assertEqual(victim.read_text(), '{"protected": true}\n')


class TutorSkillCompatibilityTest(unittest.TestCase):
    def test_mcp_tutor_migrates_legacy_state_and_skill_mirrors_match(self) -> None:
        root = Path(__file__).resolve().parents[1]
        focused = (root / "skills/learn-mcp/SKILL.md").read_text(encoding="utf-8")
        focused_mirror = (root / ".claude/skills/learn-mcp/SKILL.md").read_text(
            encoding="utf-8"
        )
        generic = (root / "skills/learn/SKILL.md").read_text(encoding="utf-8")
        generic_mirror = (root / ".claude/skills/learn/SKILL.md").read_text(
            encoding="utf-8"
        )

        self.assertEqual(focused, focused_mirror)
        self.assertEqual(generic, generic_mirror)
        self.assertIn("MCP-ENGINEERING-LEARNING.md", focused)
        self.assertIn("rename the legacy file to `MCP-LEARNING.md`", focused)
        self.assertIn("Preserve every learner note and evidence row byte for byte", focused)
        self.assertIn("`MCP-ENGINEERING-LEARNING.md` exists", generic)
        self.assertIn("without discarding learner evidence", generic)


if __name__ == "__main__":
    unittest.main()
