"""Observable task-label contracts for the draft authoring example."""

import unittest

from your_package.first import first_function


class LabelTests(unittest.TestCase):
    def test_normalizes_case_and_surrounding_space(self):
        self.assertEqual(first_function("  Ship-Report2  "), "ship-report2")

    def test_accepts_one_letter_and_maximum_length(self):
        self.assertEqual(first_function("a"), "a")
        self.assertEqual(first_function("a" * 32), "a" * 32)

    def test_rejects_unbounded_label(self):
        with self.assertRaises(ValueError):
            first_function("a" * 33)

    def test_rejects_ambiguous_or_unsafe_separators(self):
        for value in ("", "a--b", "-a", "a-", "a b", "../a", "7-task"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                first_function(value)

    def test_wrong_type_is_not_silently_stringified(self):
        for value in (None, 7, ["task"]):
            with self.subTest(value=value), self.assertRaises(TypeError):
                first_function(value)


if __name__ == "__main__":
    unittest.main()
