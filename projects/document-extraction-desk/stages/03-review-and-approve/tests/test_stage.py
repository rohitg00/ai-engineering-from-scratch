import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
WORK=Path(os.environ["PROJECT_WORKSPACE"])
sys.path.insert(0,str(WORK))
from main import validate_schema, extract_candidates, typed_value, review_document, render_review
SCHEMA=[{'name':'seats','type':'integer','required':True,'labels':['Seats','Attendees']}]

class Contract(unittest.TestCase):
    def test_ambiguous(self):
        text='Seats: 18\nSeats: 24'
        self.assertEqual(review_document(text,SCHEMA,extract_candidates(text,SCHEMA))['fields'][0]['state'],'ambiguous')
    def test_approval(self):
        text='Seats: 18'; candidates=extract_candidates(text,SCHEMA)
        report=review_document(text,SCHEMA,candidates)
        approved=review_document(text,SCHEMA,candidates,{'sourceSha256':report['sourceSha256'],'choices':{'seats':{'start':7,'end':9}}})
        self.assertEqual(approved['approvedValues'],{'seats':18})
        self.assertEqual(approved['status'],'approved')
    def test_stale_approval(self):
        with self.assertRaises(ValueError): review_document('Seats: 18',SCHEMA,[],{'sourceSha256':'old','choices':{}})
    def test_fabricated_span(self):
        with self.assertRaises(ValueError): review_document('Seats: 18',SCHEMA,[{'name':'seats','quote':'24','start':7,'end':9}])
    def test_types(self):
        for value,kind in [('1.5','integer'),('NaN','number'),('2026-02-30','date')]:
            with self.assertRaises(ValueError): typed_value(value,kind)
    def test_missing_and_duplicates(self):
        self.assertEqual(review_document('',SCHEMA,[])['status'],'needs_review')
        c=extract_candidates('Seats: 18',SCHEMA)
        self.assertEqual(len(review_document('Seats: 18',SCHEMA,c+c)['fields'][0]['candidates']),1)
