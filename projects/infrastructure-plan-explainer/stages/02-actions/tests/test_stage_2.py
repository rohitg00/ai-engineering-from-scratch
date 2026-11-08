import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_create(self):
        self.assertEqual(classify(["create"]), "create")

    def test_update(self):
        self.assertEqual(classify(["update"]), "update")

    def test_replace(self):
        self.assertEqual(classify(["delete", "create"]), "replace")
        self.assertEqual(classify(["create", "delete"]), "replace")

    def test_delete(self):
        self.assertEqual(classify(["delete"]), "delete")

    def test_invalid(self):
        with self.assertRaises(ValueError):
            classify(["delete", "update"])
