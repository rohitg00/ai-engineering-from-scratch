import stat
import unittest
from report_agent.search import engine_binary


class PrivateBinary(unittest.TestCase):
    def test_binary_is_inside_private_build_directory(self):
        binary = engine_binary()
        self.assertEqual(binary.name, "search")
        self.assertTrue(binary.parent.name.startswith("rra-private-build-"))
        self.assertEqual(stat.S_IMODE(binary.parent.stat().st_mode), 0o700)
        self.assertTrue(binary.is_file())
