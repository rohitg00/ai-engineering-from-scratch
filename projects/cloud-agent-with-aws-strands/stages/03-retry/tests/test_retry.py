import unittest
import tempfile
from pathlib import Path
from retry import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertNotEqual(request_key("a", "bc"), request_key("ab", "c"))

    def test_02(self):
        cache = {}
        cached_read("a", "b", lambda a, b: 7, cache)
        self.assertTrue(cached_read("a", "b", lambda a, b: 8, cache)["cached"])

    def test_03(self):
        with self.assertRaises(PermissionError):
            cached_read(
                "a", "b", lambda a, b: (_ for _ in ()).throw(PermissionError()), {}
            )

    def test_04(self):
        calls = []

        def provider(a, b):
            calls.append(1)
            if len(calls) < 2:
                raise TimeoutError()
            return 7

        self.assertEqual(cached_read("a", "b", provider, {})["attempts"], 2)

    def test_05(self):
        with self.assertRaises(ValueError):
            cached_read("a", "b", lambda a, b: 7, {}, -1)
