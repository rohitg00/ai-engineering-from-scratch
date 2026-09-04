import json
import pathlib
import subprocess
import sys
import tempfile
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class ConfigurationScopeAuditTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_audit_is_verified(self):
        self.assertEqual(main.validate_artifact()["status"], "configuration_verified")

    def test_path_fixtures_are_required(self):
        self.assertEqual(main.validate_text(self.text.replace("## Path Rule Fixtures", "## Removed"))["status"], "blocked")

    def test_allow_and_deny_cases_are_required(self):
        text = self.text.replace("allow", "pass").replace("deny", "block")
        self.assertTrue(any("fixtures" in finding for finding in main.validate_text(text)["findings"]))

    def test_ci_must_be_fresh_and_read_only(self):
        text = self.text.replace("fresh checkout", "resumed session").replace("read-only", "write-capable")
        self.assertTrue(any("ci" in finding for finding in main.validate_text(text)["findings"]))

    def test_hook_evidence_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("pre-write hook", "prompt rule"))["status"], "blocked")

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTBD\n")["status"], "blocked")

    def test_operational_configuration_evidence_is_required(self):
        for evidence in ("/agents", "maxTurns", "extraKnownMarketplaces", "exit 2"):
            with self.subTest(evidence=evidence):
                result = main.validate_text(self.text.replace(evidence, "removed", 1))
                self.assertEqual(result["status"], "blocked")

    def test_shipped_multifile_skill_is_valid(self):
        self.assertEqual(main.validate_skill()["status"], "valid")

    def test_skill_rejects_broad_bash_grant(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "scripts").mkdir()
            (root / "references").mkdir()
            (root / "scripts" / "check_scope.py").write_text("pass\n", encoding="utf-8")
            (root / "references" / "review-checklist.md").write_text("check\n", encoding="utf-8")
            text = main.SKILL_FILE.read_text(encoding="utf-8").replace(
                "allowed-tools: Read Grep Glob Bash(", "allowed-tools: Bash(*) Read Grep Glob Bash("
            )
            (root / "SKILL.md").write_text(text, encoding="utf-8")
            self.assertEqual(main.validate_skill(root)["status"], "blocked")

    def test_scope_checker_accepts_only_migration_files(self):
        completed = subprocess.run(
            [sys.executable, str(main.SCRIPT_FILE), "migrations/2026_add_index.sql"],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0)
        self.assertEqual(json.loads(completed.stdout)["status"], "valid")

    def test_scope_checker_blocks_traversal_and_other_directories(self):
        completed = subprocess.run(
            [sys.executable, str(main.SCRIPT_FILE), "../secret.sql", "src/schema.py"],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 2)
        result = json.loads(completed.stdout)
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(len(result["rejected"]), 2)


if __name__ == "__main__":
    unittest.main()
