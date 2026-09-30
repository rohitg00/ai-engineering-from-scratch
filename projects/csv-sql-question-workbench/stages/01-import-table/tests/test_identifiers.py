import unittest
from main import load_csv
class IdentifierContract(unittest.TestCase):
    def test_large_integer_identity_is_text(self):
        data=load_csv('item_id,units\n9007199254740992,2\n9007199254740993,3\n')
        self.assertEqual(data['types'],['TEXT','REAL'])
        self.assertNotEqual(data['rows'][0][0],data['rows'][1][0])
    def test_leading_zero_identity_is_text(self):
        self.assertEqual(load_csv('id\n001\n002')['types'],['TEXT'])
    def test_underflow_stays_text(self):
        self.assertEqual(load_csv('value\n1e-400\n0')['types'],['TEXT'])
