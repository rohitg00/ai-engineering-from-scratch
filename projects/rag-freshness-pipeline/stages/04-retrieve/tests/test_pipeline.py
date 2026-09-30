import tempfile, unittest
from pathlib import Path
from cli import ingest, query


class Lifecycle(unittest.TestCase):
    def test_update_delete_expire(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "index.json"
            ingest(
                path, [{"id": "old", "text": "tokens last 60 minutes", "updated": 100}]
            )
            change = ingest(
                path, [{"id": "new", "text": "tokens last 15 minutes", "updated": 200}]
            )
            self.assertEqual(change["changes"]["delete"], ["old"])
            self.assertEqual(query(path, "tokens", 210)["matches"][0]["id"], "new")
            self.assertEqual(query(path, "tokens", 500, max_age=10)["matches"], [])

    def test_stale_writer_preserves_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "index.json"
            ingest(path, [{"id": "a", "text": "kept", "updated": 1}])
            with self.assertRaises(ValueError):
                ingest(path, [], expected_version=0)
            self.assertEqual(query(path, "kept", 2)["matches"][0]["id"], "a")
