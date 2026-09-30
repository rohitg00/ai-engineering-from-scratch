import unittest
from main import normalize


class CanonicalUnicode(unittest.TestCase):
    def test_canonical_equivalence(self):
        self.assertEqual(normalize("caf\u00e9"), normalize("cafe\u0301"))

    def test_alias_keys_and_values_are_normalized(self):
        self.assertEqual(normalize("CAFE\u0301", {"CAFÉ": "DÉPLOY"}), ["déploy"])
