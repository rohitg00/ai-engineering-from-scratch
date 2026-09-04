import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from src.fizz import fizz


class FizzTests(unittest.TestCase):
    def test_n_5_expected_list(self):
        expected_fizz_result = [1, 2, 'fizz', 4, 5]
        self.assertEqual(fizz(5), expected_fizz_result)

    def test_n_1_expected_single(self):
        self.assertEqual(fizz(1), [1])

    def test_n_3_expected_three(self):
        self.assertEqual(fizz(3), [1, 2, 'fizz'])


if __name__ == "__main__":
    unittest.main()
