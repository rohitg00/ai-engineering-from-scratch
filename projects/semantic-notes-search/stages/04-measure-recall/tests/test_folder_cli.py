import tempfile, unittest
from pathlib import Path
from cli import run


class Folder(unittest.TestCase):
    def test_file_search_preserves_path_and_unicode(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "café.md").write_text("Café guest wifi")
            hit = run(root, "cafe\u0301")["matches"][0]
            self.assertEqual(hit["id"], "café.md")
            self.assertIn("Café", hit["preview"])

    def test_symlink_file_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "link.md").symlink_to("/etc/hosts")
            with self.assertRaises(ValueError):
                run(root, "hosts")
