import json, math, tempfile, unittest
import stat
from pathlib import Path
from main import *


class Patches(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.p = Path(self.t.name)
        (self.p / "x").write_text("one two one")
        self.addCleanup(self.t.cleanup)

    def test_unique(self):
        apply_patch(self.p, "x", "two", "three")
        self.assertEqual((self.p / "x").read_text(), "one three one")

    def test_ambiguous(self):
        with self.assertRaises(ValueError):
            apply_patch(self.p, "x", "one", "three")

    def test_missing(self):
        with self.assertRaises(ValueError):
            apply_patch(self.p, "x", "none", "three")

    def test_empty(self):
        with self.assertRaises(ValueError):
            apply_patch(self.p, "x", "", "three")

    def test_unchanged(self):
        try:
            apply_patch(self.p, "x", "missing", "")
        except ValueError:
            pass
        self.assertEqual((self.p / "x").read_text(), "one two one")

    def test_preserves_permissions(self):
        target = self.p / "x"
        for mode in (0o751, 0o640):
            with self.subTest(mode=oct(mode)):
                target.write_text("one two one")
                target.chmod(mode)
                apply_patch(self.p, "x", "two", "three")
                self.assertEqual(stat.S_IMODE(target.stat().st_mode), mode)
