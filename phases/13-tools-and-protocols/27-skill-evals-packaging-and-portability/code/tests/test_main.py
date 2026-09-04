"""Deterministic tests for Lesson 27's skill release gate."""

from __future__ import annotations

import json
import sys
import shutil
import subprocess
import tempfile
import unittest
import importlib.util
from pathlib import Path


sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    ArtifactContract,
    EvidenceCheck,
    EvaluationProvenance,
    HostCapabilities,
    KeywordRouter,
    PackageRequirements,
    ReleaseThresholds,
    TriggerCase,
    artifact_digest,
    build_manifest,
    build_external_attestation,
    bytes_digest,
    classification_metrics,
    compare_artifacts,
    evaluate_artifact,
    evaluate_evidence_checks,
    evaluate_triggers,
    evidence_digest,
    host_matrix_digest,
    lint_package,
    portability_matrix,
    rates_from_observations,
    repeated_run_observations,
    repeated_run_rates,
    run_release_gate,
    trigger_results_digest,
    verify_manifest,
)


def make_bundle(root: Path, name: str = "release-check") -> Path:
    bundle = root / name
    (bundle / "references").mkdir(parents=True)
    (bundle / "scripts").mkdir()
    (bundle / "SKILL.md").write_text(
        f"""---
name: {name}
description: Evaluate a skill package before release.
---

# Release check

Read `references/contract.md` and run `python3 scripts/check.py`.

## Output contract

Return a JSON release report with every check and its evidence.

## Failure behavior

Stop with a failed check and do not publish or modify the bundle.
""",
        encoding="utf-8",
    )
    (bundle / "references" / "contract.md").write_text("# Contract\n", encoding="utf-8")
    (bundle / "scripts" / "check.py").write_text("print('safe')\n", encoding="utf-8")
    return bundle


def load_bundled_evaluator():
    script_path = (
        Path(__file__).resolve().parents[2]
        / "outputs"
        / "skill-release-gate"
        / "scripts"
        / "evaluate_skill.py"
    )
    spec = importlib.util.spec_from_file_location("bundled_evaluator", script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load bundled evaluator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CASES = (
    TriggerCase("positive", "evaluate this skill package", True),
    TriggerCase("near-miss", "evaluate this model response", False),
)
ROUTER = KeywordRouter(("evaluate", "skill", "package"), threshold=2)
CONTRACT = ArtifactContract(("Decision", "Evidence"), ("precision",), ("guaranteed",))
HOSTS = (
    HostCapabilities("native", True, True, True),
    HostCapabilities("adapter", True, False, False),
    HostCapabilities("unsupported", False, False, False),
)
SCRIPT_CHECKS = (
    EvidenceCheck("unit-tests", True, "Deterministic unit fixtures passed."),
    EvidenceCheck("repeat-run", True, "Repeated execution produced the same result."),
)
SAFETY_CHECKS = (
    EvidenceCheck("traversal", True, "Traversal input was rejected."),
    EvidenceCheck("external-write", True, "No external write was attempted."),
)


class ReleaseGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def release_bundle(self) -> tuple[Path, Path, dict[str, str]]:
        bundle = make_bundle(self.root)
        manifest = build_manifest(bundle)
        installed = self.root / "installed-release-check"
        shutil.copytree(bundle, installed)
        return bundle, installed, manifest

    def test_valid_package_passes_structural_lint(self) -> None:
        report = lint_package(make_bundle(self.root))
        self.assertTrue(report.valid)
        self.assertEqual(
            set(report.references), {"references/contract.md", "scripts/check.py"}
        )

    def test_folded_description_is_parsed_during_lint(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "description: Evaluate a skill package before release.",
                "description: >\n  Evaluate a skill package\n  before release.",
            ),
            encoding="utf-8",
        )
        self.assertTrue(lint_package(bundle).valid)
        self.assertTrue(load_bundled_evaluator().lint(bundle)["passed"])

    def test_directory_name_mismatch_fails_lint(self) -> None:
        bundle = make_bundle(self.root)
        text = (bundle / "SKILL.md").read_text(encoding="utf-8")
        (bundle / "SKILL.md").write_text(text.replace("name: release-check", "name: other"), encoding="utf-8")
        report = lint_package(bundle)
        self.assertIn("name-directory", {issue.code for issue in report.issues})

    def test_non_kebab_identity_fails_both_linters(self) -> None:
        bundle = make_bundle(self.root, "Bad_Name")
        report = lint_package(bundle)
        bundled = load_bundled_evaluator().lint(bundle)
        self.assertIn("name-format", {issue.code for issue in report.issues})
        self.assertFalse(bundled["passed"])
        self.assertTrue(any("kebab-case" in issue for issue in bundled["issues"]))

    def test_duplicate_frontmatter_field_fails_both_linters(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "description: Evaluate a skill package before release.",
                "description: First.\ndescription: Second.",
            ),
            encoding="utf-8",
        )
        report = lint_package(bundle)
        bundled = load_bundled_evaluator().lint(bundle)
        self.assertIn("frontmatter", {issue.code for issue in report.issues})
        self.assertFalse(bundled["passed"])
        self.assertTrue(any("duplicate frontmatter" in issue for issue in bundled["issues"]))

    def test_malformed_top_level_frontmatter_fails_both_linters(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "description: Evaluate a skill package before release.",
                "this is not yaml\ndescription: Evaluate a skill package before release.",
            ),
            encoding="utf-8",
        )
        report = lint_package(bundle)
        bundled = load_bundled_evaluator().lint(bundle)
        self.assertIn("frontmatter", {issue.code for issue in report.issues})
        self.assertFalse(bundled["passed"])
        self.assertTrue(any("malformed top-level" in issue for issue in bundled["issues"]))

    def test_missing_direct_reference_fails_lint(self) -> None:
        bundle = make_bundle(self.root)
        (bundle / "references" / "contract.md").unlink()
        report = lint_package(bundle)
        self.assertIn("reference-missing", {issue.code for issue in report.issues})

    def test_orphan_file_fails_lint(self) -> None:
        bundle = make_bundle(self.root)
        (bundle / "references" / "orphan.md").write_text("orphan", encoding="utf-8")
        report = lint_package(bundle)
        self.assertIn("orphan-file", {issue.code for issue in report.issues})

    def test_output_and_failure_sections_are_required_by_both_linters(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "## Output contract", "## Result"
            ),
            encoding="utf-8",
        )
        lesson = lint_package(bundle)
        shipped = load_bundled_evaluator().lint(bundle)
        self.assertIn("output-contract", {issue.code for issue in lesson.issues})
        self.assertFalse(shipped["passed"])
        self.assertTrue(any("Output contract" in issue for issue in shipped["issues"]))

    def test_runtime_extension_requires_explicit_allowlist_in_both_linters(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "description: Evaluate a skill package before release.",
                "description: Evaluate a skill package before release.\ndelegated-context: true",
            ),
            encoding="utf-8",
        )
        lesson = lint_package(bundle)
        shipped = load_bundled_evaluator().lint(bundle)
        self.assertIn("runtime-extension", {issue.code for issue in lesson.issues})
        self.assertFalse(shipped["passed"])
        self.assertTrue(
            any("not explicitly allowed" in issue for issue in shipped["issues"])
        )
        self.assertTrue(
            lint_package(bundle, ("delegated-context",)).valid
        )
        self.assertTrue(
            load_bundled_evaluator().lint(bundle, ["delegated-context"])["passed"]
        )

    def test_referenced_obvious_secret_fails_both_linters(self) -> None:
        bundle = make_bundle(self.root)
        (bundle / "assets").mkdir()
        (bundle / "assets" / "config.txt").write_text(
            "api_key=sk-example-1234567890\n", encoding="utf-8"
        )
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8")
            + "\nInspect `assets/config.txt` before release.\n",
            encoding="utf-8",
        )
        lesson = lint_package(bundle)
        shipped = load_bundled_evaluator().lint(bundle)
        self.assertIn("secret-material", {issue.code for issue in lesson.issues})
        self.assertFalse(shipped["passed"])
        self.assertTrue(
            any("possible secret material" in issue for issue in shipped["issues"])
        )

    def test_companion_type_and_size_policies_match_both_linters(self) -> None:
        typed = make_bundle(self.root, "typed-release")
        (typed / "assets").mkdir()
        (typed / "assets" / "payload.exe").write_bytes(b"executable")
        typed_skill = typed / "SKILL.md"
        typed_skill.write_text(
            typed_skill.read_text(encoding="utf-8")
            + "\nInspect `assets/payload.exe` before release.\n",
            encoding="utf-8",
        )
        typed_lesson = lint_package(typed)
        typed_shipped = load_bundled_evaluator().lint(typed)
        self.assertIn("file-type", {issue.code for issue in typed_lesson.issues})
        self.assertTrue(
            any("unsupported assets file type" in issue for issue in typed_shipped["issues"])
        )

        sized = make_bundle(self.root, "sized-release")
        (sized / "assets").mkdir()
        (sized / "assets" / "payload.txt").write_bytes(b"x" * 1_000_001)
        sized_skill = sized / "SKILL.md"
        sized_skill.write_text(
            sized_skill.read_text(encoding="utf-8")
            + "\nInspect `assets/payload.txt` before release.\n",
            encoding="utf-8",
        )
        sized_lesson = lint_package(sized)
        sized_shipped = load_bundled_evaluator().lint(sized)
        self.assertIn("file-size", {issue.code for issue in sized_lesson.issues})
        self.assertTrue(
            any("exceeds 1000000 bytes" in issue for issue in sized_shipped["issues"])
        )

    def test_body_budget_matches_both_linters(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8") + "\n" + "x" * 10_001,
            encoding="utf-8",
        )
        lesson = lint_package(bundle)
        shipped = load_bundled_evaluator().lint(bundle)
        self.assertIn("body-size", {issue.code for issue in lesson.issues})
        self.assertTrue(
            any("exceeds 10000 characters" in issue for issue in shipped["issues"])
        )

    def test_bundled_lint_rejects_symlinked_bundle_directory(self) -> None:
        bundle = make_bundle(self.root)
        link = self.root / "linked-bundle"
        link.symlink_to(bundle, target_is_directory=True)
        report = load_bundled_evaluator().lint(link)
        self.assertFalse(report["passed"])
        self.assertIn("non-symlink bundle", report["issues"][0])

    def test_bundled_cli_preserves_and_rejects_symlinked_root(self) -> None:
        source = Path(__file__).resolve().parents[2] / "outputs" / "skill-release-gate"
        link = self.root / "skill-release-gate"
        link.symlink_to(source, target_is_directory=True)
        completed = subprocess.run(
            [sys.executable, str(source / "scripts" / "evaluate_skill.py"), str(link)],
            check=False,
            capture_output=True,
            env={"PYTHONDONTWRITEBYTECODE": "1"},
            text=True,
        )
        self.assertEqual(completed.returncode, 2)
        self.assertIn("regular non-symlink bundle", completed.stdout)

    def test_bundled_preflight_rejects_entry_symlink_before_json_read(self) -> None:
        module = load_bundled_evaluator()
        source = Path(__file__).resolve().parents[2] / "outputs" / "skill-release-gate"
        installed = self.root / "skill-release-gate"
        shutil.copytree(source, installed)
        case_path = installed / "evals" / "cases.json"
        case_path.unlink()
        external = self.root / "external-cases.json"
        external.write_text("not valid JSON", encoding="utf-8")
        case_path.symlink_to(external)
        with self.assertRaisesRegex(
            ValueError, "preflight rejects symlink: evals/cases.json"
        ):
            module.evaluate(installed)

    def test_bundled_lint_rejects_traversal_reference(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "references/contract.md", "../references/contract.md"
            ),
            encoding="utf-8",
        )
        report = load_bundled_evaluator().lint(bundle)
        self.assertFalse(report["passed"])
        self.assertTrue(
            any("invalid direct reference" in issue for issue in report["issues"])
        )

    def test_bundled_lint_rejects_malformed_reference_prefix(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "references/contract.md", "xreferences/contract.md"
            ),
            encoding="utf-8",
        )
        lesson = lint_package(bundle)
        shipped = load_bundled_evaluator().lint(bundle)
        self.assertIn("reference-shape", {issue.code for issue in lesson.issues})
        self.assertFalse(shipped["passed"])
        self.assertTrue(
            any("invalid direct reference" in issue for issue in shipped["issues"])
        )

    def test_lesson_lint_rejects_complete_traversal_reference(self) -> None:
        bundle = make_bundle(self.root)
        skill_path = bundle / "SKILL.md"
        skill_path.write_text(
            skill_path.read_text(encoding="utf-8").replace(
                "references/contract.md", "../references/contract.md"
            ),
            encoding="utf-8",
        )
        report = lint_package(bundle)
        self.assertFalse(report.valid)
        self.assertIn("reference-shape", {issue.code for issue in report.issues})

    def test_bundled_lint_flags_symlinked_companion(self) -> None:
        bundle = make_bundle(self.root)
        companion = bundle / "references" / "contract.md"
        companion.unlink()
        external = self.root / "external.md"
        external.write_text("external", encoding="utf-8")
        companion.symlink_to(external)
        report = load_bundled_evaluator().lint(bundle)
        self.assertFalse(report["passed"])
        self.assertTrue(any("symlink is not portable" in issue for issue in report["issues"]))

    def test_precision_and_recall_use_confusion_counts(self) -> None:
        metrics = classification_metrics(
            [True, True, False, False], [True, False, True, False]
        )
        self.assertEqual(metrics["precision"], 0.5)
        self.assertEqual(metrics["recall"], 0.5)
        self.assertEqual(metrics["true_negative"], 1)

    def test_trigger_eval_includes_positive_and_near_miss(self) -> None:
        result = evaluate_triggers(CASES, ROUTER)
        self.assertEqual(result["metrics"]["precision"], 1.0)
        self.assertEqual(result["metrics"]["recall"], 1.0)
        self.assertTrue(all(case["passed"] for case in result["cases"]))

    def test_repeated_run_rate_is_measured_per_case(self) -> None:
        rates = repeated_run_rates(CASES, ROUTER, runs=7)
        self.assertEqual(rates, {"positive": 1.0, "near-miss": 1.0})

    def test_trigger_digest_binds_every_raw_prediction(self) -> None:
        first = {
            "positive": (True, False, True, False),
            "near-miss": (False, True, False, True),
        }
        reordered = {
            "positive": (True, True, False, False),
            "near-miss": (False, False, True, True),
        }
        self.assertEqual(
            [values[0] for values in first.values()],
            [values[0] for values in reordered.values()],
        )
        self.assertEqual(
            rates_from_observations(CASES, first),
            rates_from_observations(CASES, reordered),
        )
        self.assertNotEqual(
            trigger_results_digest(CASES, first),
            trigger_results_digest(CASES, reordered),
        )

    def test_trigger_case_ids_are_unique_and_non_empty_at_gate_boundary(self) -> None:
        with self.assertRaisesRegex(ValueError, "unique and non-empty"):
            repeated_run_rates(
                (
                    TriggerCase("", "evaluate this skill package", True),
                    TriggerCase("near-miss", "evaluate this model response", False),
                ),
                ROUTER,
                runs=2,
            )

        bundle, installed, manifest = self.release_bundle()
        duplicate_cases = (
            TriggerCase("duplicate", "evaluate this skill package", True),
            TriggerCase("duplicate ", "evaluate this model response", False),
        )
        with self.assertRaisesRegex(ValueError, "unique and non-empty"):
            run_release_gate(
                bundle,
                duplicate_cases,
                ROUTER,
                runs=2,
                baseline_artifact="Looks fine.",
                with_skill_artifact="# Decision\nPass\n# Evidence\nPrecision is 1.0.",
                artifact_contract=CONTRACT,
                requirements=PackageRequirements(),
                hosts=HOSTS,
                script_checks=SCRIPT_CHECKS,
                safety_checks=SAFETY_CHECKS,
                installed_root=installed,
                manifest=manifest,
            )

    def test_trigger_prompts_reject_blank_and_surrounding_whitespace(self) -> None:
        for prompt in ("", "   ", " evaluate this skill package"):
            with self.subTest(prompt=prompt), self.assertRaisesRegex(
                ValueError, "trigger prompts"
            ):
                repeated_run_rates(
                    (
                        TriggerCase("positive", prompt, True),
                        TriggerCase("near-miss", "evaluate this model", False),
                    ),
                    ROUTER,
                    runs=2,
                )

    def test_evidence_ids_reject_blank_and_whitespace_variants(self) -> None:
        with self.assertRaisesRegex(ValueError, "without surrounding whitespace"):
            evaluate_evidence_checks(
                (
                    EvidenceCheck("same", True, "first"),
                    EvidenceCheck("same ", True, "second"),
                ),
                "safety",
            )
        module = load_bundled_evaluator()
        with self.assertRaisesRegex(ValueError, "without surrounding whitespace"):
            module.evidence_checks(
                {
                    "scriptChecks": [
                        {"id": "same", "passed": True, "evidence": "first"},
                        {"id": "same ", "passed": True, "evidence": "second"},
                    ]
                },
                "scriptChecks",
            )

    def test_with_skill_artifact_can_improve_contract_pass(self) -> None:
        result = compare_artifacts(
            "Looks fine.",
            "# Decision\nPass\n# Evidence\nPrecision is 1.0.",
            CONTRACT,
        )
        self.assertFalse(result["baseline"]["passed"])
        self.assertTrue(result["with_skill"]["passed"])
        self.assertTrue(result["skill_improves_pass_state"])

    def test_artifact_assertions_use_exact_boundaries(self) -> None:
        misleading = "# Decision-making\n# Evidence-free\nRecalling prior work."
        result = evaluate_artifact(misleading, ArtifactContract(("Decision", "Evidence"), ("recall",)))
        bundled = load_bundled_evaluator().artifact(
            misleading,
            {"requiredHeadings": ["Decision", "Evidence"], "requiredTerms": ["recall"], "forbiddenTerms": []},
        )
        self.assertFalse(result["passed"])
        self.assertFalse(bundled["passed"])

    def test_portability_matrix_distinguishes_native_adapter_and_unsupported(self) -> None:
        rows = portability_matrix(
            PackageRequirements(companion_files=True, script_execution=True), HOSTS
        )
        self.assertEqual([row["status"] for row in rows], ["native", "adapter-required", "unsupported"])

    def test_duplicate_host_identity_cannot_satisfy_native_host_threshold(self) -> None:
        duplicates = (
            HostCapabilities("same-host", True, True, True),
            HostCapabilities("same-host ", True, True, True),
        )
        with self.assertRaisesRegex(ValueError, "unique and non-empty"):
            portability_matrix(PackageRequirements(), duplicates)

        bundle, installed, manifest = self.release_bundle()
        with self.assertRaisesRegex(ValueError, "unique and non-empty"):
            run_release_gate(
                bundle,
                CASES,
                ROUTER,
                runs=2,
                baseline_artifact="Looks fine.",
                with_skill_artifact="# Decision\nPass\n# Evidence\nPrecision is 1.0.",
                artifact_contract=CONTRACT,
                requirements=PackageRequirements(),
                hosts=duplicates,
                script_checks=SCRIPT_CHECKS,
                safety_checks=SAFETY_CHECKS,
                installed_root=installed,
                manifest=manifest,
                thresholds=ReleaseThresholds(min_native_hosts=2),
            )

    def test_fixture_gate_passes_checks_without_claiming_production_readiness(self) -> None:
        bundle, installed, manifest = self.release_bundle()
        report = run_release_gate(
            bundle,
            CASES,
            ROUTER,
            runs=5,
            baseline_artifact="Looks fine.",
            with_skill_artifact="# Decision\nPass\n# Evidence\nPrecision is 1.0.",
            artifact_contract=CONTRACT,
            requirements=PackageRequirements(companion_files=True, script_execution=True),
            hosts=HOSTS,
            script_checks=SCRIPT_CHECKS,
            safety_checks=SAFETY_CHECKS,
            installed_root=installed,
            manifest=manifest,
        )
        self.assertTrue(report["checks_passed"])
        self.assertTrue(report["fixture_passed"])
        self.assertFalse(report["local_evidence_ready"])
        self.assertFalse(report["trust_anchor_valid"])
        self.assertFalse(report["production_ready"])
        self.assertFalse(report["passed"])
        self.assertTrue(all(report["checks"].values()))

    def test_local_provenance_needs_a_trusted_attestation(self) -> None:
        bundle, installed, manifest = self.release_bundle()
        baseline = "Looks fine."
        with_skill = "# Decision\nPass\n# Evidence\nPrecision is 1.0."
        requirements = PackageRequirements(
            companion_files=True, script_execution=True
        )
        observations = repeated_run_observations(CASES, ROUTER, runs=5)
        arguments = {
            "package_root": bundle,
            "cases": CASES,
            "router": ROUTER,
            "runs": 5,
            "baseline_artifact": baseline,
            "with_skill_artifact": with_skill,
            "artifact_contract": CONTRACT,
            "requirements": requirements,
            "hosts": HOSTS,
            "script_checks": SCRIPT_CHECKS,
            "safety_checks": SAFETY_CHECKS,
            "installed_root": installed,
            "manifest": manifest,
            "provenance": EvaluationProvenance(
                trigger_mode="captured-observations",
                artifact_mode="captured-artifacts",
                evidence_mode="captured-results",
                host_mode="captured-capabilities",
                artifact_source="runtime-run-42",
                evidence_source="ci-run-42",
                host_source="host-probe-run-42",
                trigger_source="router-run-42",
                baseline_digest=artifact_digest(baseline),
                with_skill_digest=artifact_digest(with_skill),
                checks_digest=evidence_digest(SCRIPT_CHECKS, SAFETY_CHECKS),
                host_digest=host_matrix_digest(requirements, HOSTS),
                trigger_digest=trigger_results_digest(CASES, observations),
            ),
        }
        local = run_release_gate(**arguments)
        self.assertTrue(local["local_evidence_ready"])
        self.assertFalse(local["trust_anchor_valid"])
        self.assertFalse(local["production_ready"])
        self.assertFalse(local["passed"])

        attestation = build_external_attestation(local["evidence_root"])
        production = run_release_gate(
            **arguments,
            attestation_payload=attestation,
            trusted_attestation_digest=bytes_digest(attestation),
        )
        self.assertTrue(production["local_evidence_ready"])
        self.assertTrue(production["trust_anchor_valid"])
        self.assertTrue(production["production_ready"])
        self.assertTrue(production["passed"])

    def test_release_gate_fails_weak_trigger_precision(self) -> None:
        always = lambda prompt, run: True
        bundle, installed, manifest = self.release_bundle()
        report = run_release_gate(
            bundle,
            CASES,
            always,
            runs=3,
            baseline_artifact="Looks fine.",
            with_skill_artifact="# Decision\nPass\n# Evidence\nPrecision is 1.0.",
            artifact_contract=CONTRACT,
            requirements=PackageRequirements(),
            hosts=HOSTS,
            script_checks=SCRIPT_CHECKS,
            safety_checks=SAFETY_CHECKS,
            installed_root=installed,
            manifest=manifest,
            thresholds=ReleaseThresholds(min_precision=0.8),
        )
        self.assertFalse(report["checks"]["precision"])
        self.assertFalse(report["passed"])

    def test_release_gate_blocks_failed_script_and_safety_layers(self) -> None:
        bundle, installed, manifest = self.release_bundle()
        report = run_release_gate(
            bundle,
            CASES,
            ROUTER,
            runs=3,
            baseline_artifact="Looks fine.",
            with_skill_artifact="# Decision\nPass\n# Evidence\nPrecision is 1.0.",
            artifact_contract=CONTRACT,
            requirements=PackageRequirements(),
            hosts=HOSTS,
            script_checks=(EvidenceCheck("unit-tests", False, "One fixture failed."),),
            safety_checks=(EvidenceCheck("traversal", False, "Traversal escaped."),),
            installed_root=installed,
            manifest=manifest,
        )
        self.assertFalse(report["checks"]["script_correctness"])
        self.assertFalse(report["checks"]["safety"])
        self.assertFalse(report["passed"])

    def test_release_gate_blocks_installed_tree_drift(self) -> None:
        bundle, installed, manifest = self.release_bundle()
        (installed / "scripts" / "check.py").write_text("print('changed')\n", encoding="utf-8")
        report = run_release_gate(
            bundle,
            CASES,
            ROUTER,
            runs=3,
            baseline_artifact="Looks fine.",
            with_skill_artifact="# Decision\nPass\n# Evidence\nPrecision is 1.0.",
            artifact_contract=CONTRACT,
            requirements=PackageRequirements(),
            hosts=HOSTS,
            script_checks=SCRIPT_CHECKS,
            safety_checks=SAFETY_CHECKS,
            installed_root=installed,
            manifest=manifest,
        )
        self.assertFalse(report["checks"]["installed_tree"])
        self.assertEqual(report["packaging"]["installed_tree"]["mismatched"], ["scripts/check.py"])
        self.assertFalse(report["passed"])

    def test_manifest_rejects_parent_paths(self) -> None:
        bundle = make_bundle(self.root)
        report = verify_manifest(bundle, {"../SKILL.md": "sha256:" + "0" * 64})
        self.assertFalse(report["passed"])
        self.assertTrue(any("invalid manifest path" in issue for issue in report["issues"]))

    def test_manifest_rejects_noncanonical_posix_keys(self) -> None:
        bundle = make_bundle(self.root)
        digest = "sha256:" + "0" * 64
        lesson = verify_manifest(bundle, {"./SKILL.md": digest})
        shipped = load_bundled_evaluator().verify_manifest(
            bundle,
            {
                "manifestVersion": 1,
                "algorithm": "sha256",
                "files": {"./SKILL.md": digest},
            },
        )
        self.assertFalse(lesson["passed"])
        self.assertFalse(shipped["passed"])
        self.assertTrue(
            any("invalid manifest path" in issue for issue in lesson["issues"])
        )
        self.assertTrue(
            any("invalid manifest path" in issue for issue in shipped["issues"])
        )

    def test_reserved_manifest_is_excluded_from_its_own_domain(self) -> None:
        bundle = make_bundle(self.root)
        (bundle / "assets").mkdir()
        (bundle / "assets" / "manifest.json").write_text(
            '{"files": {}}\n', encoding="utf-8"
        )
        manifest = build_manifest(bundle)
        self.assertNotIn("assets/manifest.json", manifest)
        self.assertTrue(verify_manifest(bundle, manifest)["passed"])

        digest = "sha256:" + "0" * 64
        lesson = verify_manifest(
            bundle, {**manifest, "assets/manifest.json": digest}
        )
        shipped = load_bundled_evaluator().verify_manifest(
            bundle,
            {
                "manifestVersion": 1,
                "algorithm": "sha256",
                "files": {**manifest, "assets/manifest.json": digest},
            },
        )
        self.assertFalse(lesson["passed"])
        self.assertFalse(shipped["passed"])
        self.assertTrue(
            any("reserved manifest path" in issue for issue in lesson["issues"])
        )
        self.assertTrue(
            any("reserved manifest path" in issue for issue in shipped["issues"])
        )

    def test_bundled_manifest_rejects_unknown_version_and_algorithm(self) -> None:
        module = load_bundled_evaluator()
        bundle = Path(__file__).resolve().parents[2] / "outputs" / "skill-release-gate"
        valid = {
            "manifestVersion": 1,
            "algorithm": "sha256",
            "files": build_manifest(bundle),
        }
        self.assertTrue(module.verify_manifest(bundle, valid)["passed"])
        with self.assertRaisesRegex(ValueError, "manifestVersion"):
            module.verify_manifest(bundle, {**valid, "manifestVersion": 999})
        with self.assertRaisesRegex(ValueError, "algorithm"):
            module.verify_manifest(bundle, {**valid, "algorithm": "md5"})

    def test_bundled_artifact_and_evidence_modes_fail_closed(self) -> None:
        module = load_bundled_evaluator()
        fixture_modes = module.validate_result_modes(
            {"artifactMode": "fixture"},
            {"evidenceMode": "deterministic-fixture"},
        )
        fixture_hosts = module.validate_host_provenance(
            {"hostMode": "deterministic-fixture"}
        )
        fixture_triggers = module.validate_trigger_provenance(
            {"evaluationMode": "deterministic-fixture"}
        )
        fixture = module.release_readiness(
            True, fixture_triggers, fixture_modes, fixture_hosts
        )
        self.assertTrue(fixture["fixturePassed"])
        self.assertFalse(fixture["localEvidenceReady"])
        self.assertFalse(fixture["productionReady"])
        self.assertFalse(fixture["passed"])

        label_only = module.validate_result_modes(
            {
                "artifactMode": "captured-artifacts",
                "baseline": "baseline",
                "withSkill": "treatment",
            },
            {
                "evidenceMode": "captured-results",
                "scriptChecks": [],
                "safetyChecks": [],
            },
        )
        relabeled_hosts = module.validate_host_provenance(
            {"hostMode": "captured-capabilities"}
        )
        self.assertFalse(relabeled_hosts["hostIntegrity"])
        captured_trigger_values = {
            "evaluationMode": "captured-observations",
            "triggerTerms": ["skill"],
            "threshold": 1,
            "runs": 1,
            "cases": [
                {
                    "id": "positive",
                    "prompt": "skill",
                    "expected": True,
                    "observedPredictions": [True],
                }
            ],
        }
        relabeled_triggers = module.validate_trigger_provenance(
            captured_trigger_values
        )
        self.assertFalse(relabeled_triggers["triggerIntegrity"])
        relabeled = module.release_readiness(
            True,
            relabeled_triggers,
            label_only,
            relabeled_hosts,
        )
        self.assertFalse(relabeled["localEvidenceReady"])
        self.assertFalse(relabeled["passed"])

        artifacts = {
            "artifactMode": "captured-artifacts",
            "baseline": "baseline",
            "withSkill": "treatment",
            "provenance": {
                "source": "runtime-run-42",
                "baselineDigest": module.digest_text("baseline"),
                "withSkillDigest": module.digest_text("treatment"),
            },
        }
        evidence = {
            "evidenceMode": "captured-results",
            "scriptChecks": [
                {"id": "unit", "passed": True, "evidence": "CI run 42"}
            ],
            "safetyChecks": [
                {"id": "scope", "passed": True, "evidence": "sandbox run 42"}
            ],
        }
        evidence["provenance"] = {
            "source": "ci-run-42",
            "checksDigest": module.digest_evidence(evidence),
        }
        captured_modes = module.validate_result_modes(artifacts, evidence)
        hosts = {
            "hostMode": "captured-capabilities",
            "requirements": {
                "companionFiles": True,
                "scriptExecution": True,
                "runtimeExtensions": [],
            },
            "minimumNativeHosts": 1,
            "hosts": [
                {
                    "name": "runtime-host",
                    "loadsCoreSkill": True,
                    "preservesCompanionFiles": True,
                    "runsBundledScripts": True,
                    "supportedExtensions": [],
                }
            ],
        }
        hosts["provenance"] = {
            "source": "host-probe-run-42",
            "matrixDigest": module.digest_hosts(hosts),
        }
        captured_hosts = module.validate_host_provenance(hosts)
        captured_trigger_values["provenance"] = {
            "source": "router-run-42",
            "observationsDigest": module.digest_trigger_observations(
                captured_trigger_values
            ),
        }
        captured_triggers = module.validate_trigger_provenance(
            captured_trigger_values
        )
        captured = module.release_readiness(
            True, captured_triggers, captured_modes, captured_hosts
        )
        self.assertTrue(captured["localEvidenceReady"])
        self.assertFalse(captured["trustAnchorValid"])
        self.assertFalse(captured["productionReady"])
        self.assertFalse(captured["passed"])

        with self.assertRaisesRegex(ValueError, "artifactMode"):
            module.validate_result_modes(
                {"artifactMode": "unchecked"},
                {"evidenceMode": "captured-results"},
            )
        with self.assertRaisesRegex(ValueError, "evidenceMode"):
            module.validate_result_modes(
                {"artifactMode": "fixture"},
                {"evidenceMode": "unchecked"},
            )

    def test_release_gate_rejects_invalid_thresholds_and_case_shape(self) -> None:
        with self.assertRaises(ValueError):
            ReleaseThresholds(min_precision=float("nan"))
        bundle, installed, manifest = self.release_bundle()
        with self.assertRaises(ValueError):
            run_release_gate(
                bundle,
                (TriggerCase("only-positive", "evaluate skill", True),),
                ROUTER,
                runs=2,
                baseline_artifact="baseline",
                with_skill_artifact="# Decision\n# Evidence\nprecision",
                artifact_contract=CONTRACT,
                requirements=PackageRequirements(),
                hosts=HOSTS,
                script_checks=SCRIPT_CHECKS,
                safety_checks=SAFETY_CHECKS,
                installed_root=installed,
                manifest=manifest,
            )

    def test_shipped_bundle_evaluator_gates_every_taught_layer(self) -> None:
        module = load_bundled_evaluator()
        bundle = Path(__file__).resolve().parents[2] / "outputs" / "skill-release-gate"
        report = module.evaluate(bundle)
        self.assertTrue(report["checksPassed"])
        self.assertTrue(report["fixturePassed"])
        self.assertFalse(report["localEvidenceReady"])
        self.assertFalse(report["trustAnchorValid"])
        self.assertFalse(report["productionReady"])
        self.assertFalse(report["passed"])
        self.assertTrue(
            {
                "structure",
                "precision",
                "recall",
                "repeatedRuns",
                "artifactImprovement",
                "scriptCorrectness",
                "safety",
                "installedTree",
                "nativeHosts",
            }.issubset(report["checks"])
        )

    def test_bundled_manifest_detects_installed_tree_drift(self) -> None:
        module = load_bundled_evaluator()
        source = Path(__file__).resolve().parents[2] / "outputs" / "skill-release-gate"
        installed = self.root / "skill-release-gate"
        shutil.copytree(source, installed)
        (installed / "references" / "eval-contract.md").write_text(
            "changed after install\n", encoding="utf-8"
        )
        report = module.evaluate(installed)
        self.assertFalse(report["checks"]["installedTree"])
        self.assertEqual(
            report["installedTree"]["mismatched"], ["references/eval-contract.md"]
        )
        self.assertFalse(report["passed"])

    def test_bundled_evaluator_rejects_zero_runs(self) -> None:
        module = load_bundled_evaluator()
        cases = {
            "triggerTerms": ["skill"],
            "threshold": 1,
            "runs": 0,
            "minimumPrecision": 0.8,
            "minimumRecall": 0.8,
            "minimumRepeatRate": 0.8,
            "cases": [
                {"id": "yes", "prompt": "skill", "expected": True},
                {"id": "no", "prompt": "other", "expected": False},
            ],
        }
        hosts = {"minimumNativeHosts": 0, "hosts": []}
        with self.assertRaises(ValueError):
            module.validate_configuration(cases, hosts)

    def test_bundled_configuration_rejects_blank_prompts(self) -> None:
        module = load_bundled_evaluator()
        cases = {
            "triggerTerms": ["skill"],
            "threshold": 1,
            "runs": 1,
            "minimumPrecision": 0.8,
            "minimumRecall": 0.8,
            "minimumRepeatRate": 0.8,
            "cases": [
                {"id": "yes", "prompt": "   ", "expected": True},
                {"id": "no", "prompt": "other", "expected": False},
            ],
        }
        hosts = {
            "requirements": {
                "companionFiles": False,
                "scriptExecution": False,
                "runtimeExtensions": [],
            },
            "minimumNativeHosts": 1,
            "hosts": [
                {
                    "name": "host",
                    "loadsCoreSkill": True,
                    "preservesCompanionFiles": True,
                    "runsBundledScripts": True,
                    "supportedExtensions": [],
                }
            ],
        }
        with self.assertRaisesRegex(ValueError, "case prompts"):
            module.validate_configuration(cases, hosts)

    def test_host_gate_cannot_pass_vacuously(self) -> None:
        with self.assertRaisesRegex(ValueError, "positive integer"):
            ReleaseThresholds(min_native_hosts=0)
        module = load_bundled_evaluator()
        cases = {
            "triggerTerms": ["skill"],
            "threshold": 1,
            "runs": 1,
            "minimumPrecision": 0.8,
            "minimumRecall": 0.8,
            "minimumRepeatRate": 0.8,
            "cases": [
                {"id": "yes", "prompt": "skill", "expected": True},
                {"id": "no", "prompt": "other", "expected": False},
            ],
        }
        hosts = {
            "requirements": {
                "companionFiles": False,
                "scriptExecution": False,
                "runtimeExtensions": [],
            },
            "minimumNativeHosts": 0,
            "hosts": [],
        }
        with self.assertRaisesRegex(ValueError, "minimumNativeHosts"):
            module.validate_configuration(cases, hosts)

    def test_bundled_captured_observations_reject_duplicate_case_ids(self) -> None:
        module = load_bundled_evaluator()
        cases = {
            "triggerTerms": ["skill"],
            "evaluationMode": "captured-observations",
            "threshold": 1,
            "runs": 2,
            "minimumPrecision": 0.8,
            "minimumRecall": 0.8,
            "minimumRepeatRate": 0.8,
            "cases": [
                {
                    "id": "duplicate ",
                    "prompt": "skill",
                    "expected": True,
                    "observedPredictions": [True, True],
                },
                {
                    "id": "duplicate",
                    "prompt": "other",
                    "expected": False,
                    "observedPredictions": [True, True],
                },
            ],
        }
        hosts = {
            "requirements": {
                "companionFiles": False,
                "scriptExecution": False,
                "runtimeExtensions": [],
            },
            "minimumNativeHosts": 0,
            "hosts": [],
        }
        with self.assertRaisesRegex(ValueError, "unique non-empty"):
            module.validate_configuration(cases, hosts)

    def test_bundled_duplicate_hosts_cannot_meet_native_host_threshold(self) -> None:
        module = load_bundled_evaluator()
        cases = {
            "triggerTerms": ["skill"],
            "threshold": 1,
            "runs": 1,
            "minimumPrecision": 0.8,
            "minimumRecall": 0.8,
            "minimumRepeatRate": 0.8,
            "cases": [
                {"id": "yes", "prompt": "skill", "expected": True},
                {"id": "no", "prompt": "other", "expected": False},
            ],
        }
        native = {
            "name": "same-host",
            "loadsCoreSkill": True,
            "preservesCompanionFiles": True,
            "runsBundledScripts": True,
            "supportedExtensions": [],
        }
        whitespace_variant = dict(native)
        whitespace_variant["name"] = "same-host "
        hosts = {
            "requirements": {
                "companionFiles": False,
                "scriptExecution": False,
                "runtimeExtensions": [],
            },
            "minimumNativeHosts": 2,
            "hosts": [native, whitespace_variant],
        }
        with self.assertRaisesRegex(ValueError, "unique non-empty"):
            module.validate_configuration(cases, hosts)

    def test_relabelled_local_fixtures_need_external_trust_anchor(self) -> None:
        module = load_bundled_evaluator()
        source = Path(__file__).resolve().parents[2] / "outputs" / "skill-release-gate"
        installed = self.root / "skill-release-gate"
        shutil.copytree(source, installed)

        case_path = installed / "evals" / "cases.json"
        cases = json.loads(case_path.read_text(encoding="utf-8"))
        cases["evaluationMode"] = "captured-observations"
        for case in cases["cases"]:
            case["observedPredictions"] = [case["expected"]] * cases["runs"]
        cases["provenance"] = {
            "source": "arbitrary-local-router-label",
            "observationsDigest": module.digest_trigger_observations(cases),
        }
        case_path.write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8")

        artifact_path = installed / "evals" / "artifacts.json"
        artifacts = json.loads(artifact_path.read_text(encoding="utf-8"))
        artifacts["artifactMode"] = "captured-artifacts"
        artifacts["provenance"] = {
            "source": "arbitrary-local-artifact-label",
            "baselineDigest": module.digest_text(artifacts["baseline"]),
            "withSkillDigest": module.digest_text(artifacts["withSkill"]),
        }
        artifact_path.write_text(
            json.dumps(artifacts, indent=2) + "\n", encoding="utf-8"
        )

        evidence_path = installed / "evals" / "evidence.json"
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
        evidence["evidenceMode"] = "captured-results"
        evidence["provenance"] = {
            "source": "arbitrary-local-evidence-label",
            "checksDigest": module.digest_evidence(evidence),
        }
        evidence_path.write_text(
            json.dumps(evidence, indent=2) + "\n", encoding="utf-8"
        )

        host_path = installed / "assets" / "hosts.json"
        hosts = json.loads(host_path.read_text(encoding="utf-8"))
        hosts["hostMode"] = "captured-capabilities"
        hosts["provenance"] = {
            "source": "arbitrary-local-host-label",
            "matrixDigest": module.digest_hosts(hosts),
        }
        host_path.write_text(json.dumps(hosts, indent=2) + "\n", encoding="utf-8")

        manifest_path = installed / "assets" / "manifest.json"
        manifest_path.write_text(
            json.dumps(
                {
                    "manifestVersion": 1,
                    "algorithm": "sha256",
                    "files": build_manifest(installed),
                },
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

        local = module.evaluate(installed)
        self.assertTrue(local["checksPassed"])
        self.assertTrue(local["localEvidenceReady"])
        self.assertFalse(local["trustAnchorValid"])
        self.assertFalse(local["productionReady"])
        self.assertFalse(local["passed"])

        attestation_payload = json.dumps(
            {
                "attestationVersion": 1,
                "evidenceRoot": local["evidenceRoot"],
            },
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        attestation_path = self.root / "trusted-attestation.json"
        attestation_path.write_bytes(attestation_payload)
        trusted_digest = module.digest_bytes(attestation_payload)
        inside_attestation = installed / "assets" / "local-attestation.json"
        inside_attestation.write_bytes(attestation_payload)
        inside_report = module.verify_external_attestation(
            installed,
            local["evidenceRoot"],
            inside_attestation,
            trusted_digest,
        )
        self.assertFalse(inside_report["trustAnchorValid"])
        self.assertTrue(
            any("outside the bundle" in issue for issue in inside_report["issues"])
        )
        inside_attestation.unlink()

        production = module.evaluate(installed, attestation_path, trusted_digest)
        self.assertTrue(production["trustAnchorValid"])
        self.assertTrue(production["productionReady"])
        self.assertTrue(production["passed"])

        completed = subprocess.run(
            [
                sys.executable,
                str(installed / "scripts" / "evaluate_skill.py"),
                "--attestation",
                str(attestation_path),
                "--trusted-attestation-sha256",
                trusted_digest,
                str(installed),
            ],
            check=False,
            capture_output=True,
            env={"PYTHONDONTWRITEBYTECODE": "1"},
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        self.assertTrue(json.loads(completed.stdout)["passed"])

    def test_malformed_config_root_is_structured_cli_failure(self) -> None:
        source = Path(__file__).resolve().parents[2] / "outputs" / "skill-release-gate"
        installed = self.root / "skill-release-gate"
        shutil.copytree(source, installed)
        (installed / "evals" / "cases.json").write_text("[]\n", encoding="utf-8")
        completed = subprocess.run(
            [
                sys.executable,
                str(installed / "scripts" / "evaluate_skill.py"),
                str(installed),
            ],
            check=False,
            capture_output=True,
            env={"PYTHONDONTWRITEBYTECODE": "1"},
            text=True,
        )
        self.assertEqual(completed.returncode, 2)
        report = json.loads(completed.stdout)
        self.assertEqual(report["error"], "invalid-evaluation-config")
        self.assertIn("cases.json root must be an object", report["reason"])
        self.assertNotIn("Traceback", completed.stderr)


if __name__ == "__main__":
    unittest.main()
