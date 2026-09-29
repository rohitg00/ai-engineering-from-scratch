import errno
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import main


class PatchCleanupTests(unittest.TestCase):
    def test_failed_write_or_close_removes_temporary_file(self):
        create = tempfile.NamedTemporaryFile
        for failure in ("write", "close"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                target = root / "source.py"
                target.write_text("one two one")

                class FailingFile:
                    def __init__(self, *args, **kwargs):
                        self.file = create(*args, **kwargs)
                        self.name = self.file.name

                    def __enter__(self):
                        return self

                    def write(self, content):
                        self.file.write(content[:5] if failure == "write" else content)
                        self.file.flush()
                        if failure == "write":
                            raise OSError(errno.ENOSPC, "injected disk full")

                    def __exit__(self, *args):
                        self.file.close()
                        if failure == "close":
                            raise OSError(errno.EIO, "injected close failure")

                with patch("tempfile.NamedTemporaryFile", FailingFile):
                    with self.assertRaises(OSError):
                        main.apply_patch(root, "source.py", "two", "three")
                self.assertEqual(target.read_text(), "one two one")
                self.assertEqual(list(root.iterdir()), [target])

    def test_failed_replace_removes_temporary_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "source.py"
            target.write_text("one two one")
            with patch("os.replace", side_effect=OSError("injected replacement failure")):
                with self.assertRaises(OSError):
                    main.apply_patch(root, "source.py", "two", "three")
            self.assertEqual(target.read_text(), "one two one")
            self.assertEqual(list(root.iterdir()), [target])
