import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
WORK=Path(os.environ["PROJECT_WORKSPACE"])
sys.path.insert(0,str(WORK))
from main import validate_schema, extract_candidates, typed_value, review_document, render_review
SCHEMA=[{'name':'seats','type':'integer','required':True,'labels':['Seats','Attendees']}]

class Contract(unittest.TestCase):
    def test_exact_span(self):
        text='Seats: 18\n'
        c=extract_candidates(text,SCHEMA)[0]
        self.assertEqual(text[c['start']:c['end']],'18')
    def test_multiple(self):
        self.assertEqual(len(extract_candidates('Seats: 18\nSeats: 24',SCHEMA)),2)
    def test_unicode(self):
        text='Name: Zoë 🚀\nSeats:  18  '
        c=extract_candidates(text,SCHEMA)[0]
        self.assertEqual(text[c['start']:c['end']],c['quote'])
        self.assertEqual(c['quote'],'18')
    def test_unknown(self):
        self.assertEqual(extract_candidates('Unrelated: 4',SCHEMA),[])
    def test_empty_value(self):
        self.assertEqual(extract_candidates('Seats:   ',SCHEMA),[])
    def test_case(self):
        self.assertEqual(extract_candidates('sEaTs: 2',SCHEMA)[0]['quote'],'2')
