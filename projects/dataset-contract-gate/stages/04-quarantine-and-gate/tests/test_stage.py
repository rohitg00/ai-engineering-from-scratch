import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def setUp(self):
        self.spec = {
            "version": 1,
            "fields": {"id": {"type": "string", "required": True}},
            "unique": ["id"],
            "min_rows": 1,
        }

    def test_both_duplicates_quarantined(self):
        result = evaluate([{"id": "a"}, {"id": "a"}, {"id": "b"}], self.spec)
        self.assertEqual(result["accepted"], [{"id": "b"}])
        self.assertEqual(result["counts"]["quarantined"], 2)

    def test_empty_dataset_gate(self):
        self.assertEqual(evaluate([], self.spec)["dataset_issues"], ["min_rows"])

    def test_clean(self):
        self.assertTrue(evaluate([{"id": "a"}], self.spec)["passed"])

    def test_dataset_failure_keeps_clean_rows(self):
        self.spec["max_rows"] = 1
        result = evaluate([{"id": "a"}, {"id": "b"}], self.spec)
        self.assertFalse(result["passed"])
        self.assertEqual(result["counts"]["accepted"], 2)

    def test_cli_gate_and_consumable_exports(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / "rows.jsonl"
            source.write_text('{"id":"a"}\n{"id":"a"}\n{"id":"heldout"}\n')
            spec = folder / "contract.json"
            spec.write_text(json.dumps(self.spec))
            out = folder / "out"
            result = subprocess.run(
                [
                    sys.executable,
                    str(Path(os.environ["PROJECT_WORKSPACE"]) / "cli.py"),
                    str(source),
                    "--contract",
                    str(spec),
                    "--output",
                    str(out),
                    "--check",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 1, result.stderr)
            accepted = [
                json.loads(line)
                for line in (out / "accepted.jsonl").read_text().splitlines()
            ]
            self.assertTrue(evaluate(accepted, self.spec)["passed"])
            self.assertEqual(
                json.loads((out / "receipt.json").read_text())["counts"]["quarantined"],
                2,
            )

    def test_cli_bad_contract_is_error(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / "rows.jsonl"
            source.write_text("{}\n")
            spec = folder / "contract.json"
            spec.write_text("{}")
            result = subprocess.run(
                [
                    sys.executable,
                    str(Path(os.environ["PROJECT_WORKSPACE"]) / "cli.py"),
                    str(source),
                    "--contract",
                    str(spec),
                    "--output",
                    str(folder / "out"),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 2)
            self.assertFalse((folder / "out").exists())
