import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Paths(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.p = Path(self.t.name)
        (self.p / "x.py").write_text("x")
        self.addCleanup(self.t.cleanup)

    def test_file(self):
        self.assertEqual(safe_path(self.p, "x.py"), (self.p / "x.py").resolve())

    def test_traversal(self):
        with self.assertRaises(ValueError):
            safe_path(self.p, "../x.py")

    def test_absolute(self):
        with self.assertRaises(ValueError):
            safe_path(self.p, str(self.p / "x.py"))

    def test_directory(self):
        with self.assertRaises(ValueError):
            safe_path(self.p, ".")

    def test_symlink(self):
        (self.p / "link").symlink_to("/etc/hosts")
        with self.assertRaises(ValueError):
            safe_path(self.p, "link")
