import tempfile, unittest
from pathlib import Path
from cli import experiment, promote


class Pipeline(unittest.TestCase):
    def fixture(self):
        return {
            "development": [
                {"id": "d1", "text": "invoice wrong", "label": "billing"},
                {"id": "d2", "text": "invoice late", "label": "billing"},
            ],
            "holdout": [{"id": "h1", "text": "invoice missing", "label": "billing"}],
        }

    def test_feedback_and_exact_approval(self):
        result = experiment(self.fixture())
        self.assertTrue(result["gate"]["promote"])
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "rules.json"
            with self.assertRaises(ValueError):
                promote(result, path, "other-candidate")
            self.assertFalse(path.exists())
            promote(result, path, result["gate"]["candidate_sha256"])
            self.assertTrue(path.exists())

    def test_duplicate_holdout_is_rejected(self):
        data = self.fixture()
        data["holdout"][0]["text"] = "INVOICE wrong"
        with self.assertRaises(ValueError):
            experiment(data)
