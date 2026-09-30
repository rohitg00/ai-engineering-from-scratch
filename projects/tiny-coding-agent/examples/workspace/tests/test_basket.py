import unittest
from basket import total


class Basket(unittest.TestCase):
    def test_three_items(self):
        self.assertEqual(total(7, 3), 21)

    def test_empty_basket(self):
        self.assertEqual(total(7, 0), 0)
