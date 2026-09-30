import unittest
from main import typed_value, extract_candidates, review_document


class NumericSyntax(unittest.TestCase):
    def test_finite_float_text_forms(self):
        for text, expected in [('1', 1.0), ('-2.5', -2.5), ('+3.5', 3.5),
                               ('1e3', 1000.0), ('.5', .5), ('1.', 1.0),
                               ('1_000', 1000.0), ('1_0.2_5', 10.25)]:
            with self.subTest(text=text):
                self.assertEqual(typed_value(text, 'number'), expected)

    def test_nonfinite_and_unsupported_text_rejects(self):
        for text in ['inf', '-Infinity', 'NaN', '1e309', '3.5 kg', '1,000', '1__000']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                typed_value(text, 'number')

    def test_nonfinite_candidate_cannot_be_approved(self):
        schema = [{'name': 'count', 'type': 'number', 'required': True, 'labels': ['Count']}]
        for quote in ['inf', '1e309']:
            with self.subTest(quote=quote):
                text = 'Count: ' + quote
                candidates = extract_candidates(text, schema)
                report = review_document(text, schema, candidates)
                self.assertEqual(report['fields'][0]['state'], 'invalid')
                selection = {key: candidates[0][key] for key in ['start', 'end']}
                with self.assertRaises(ValueError):
                    review_document(text, schema, candidates, {
                        'sourceSha256': report['sourceSha256'], 'choices': {'count': selection},
                    })
