import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
WORK=Path(os.environ["PROJECT_WORKSPACE"])
sys.path.insert(0,str(WORK))
from main import validate_schema, extract_candidates, typed_value, review_document, render_review
SCHEMA=[{'name':'seats','type':'integer','required':True,'labels':['Seats','Attendees']}]

class Contract(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(validate_schema(SCHEMA),SCHEMA)
    def test_empty(self):
        with self.assertRaises(ValueError): validate_schema([])
    def test_duplicate_name(self):
        with self.assertRaises(ValueError): validate_schema(SCHEMA+SCHEMA)
    def test_label_collision(self):
        with self.assertRaises(ValueError): validate_schema(SCHEMA+[{'name':'other','type':'text','required':False,'labels':['seats']}])
    def test_bad_type(self):
        with self.assertRaises(ValueError): validate_schema([{**SCHEMA[0],'type':'guess'}])
    def test_required_boolean(self):
        with self.assertRaises(ValueError): validate_schema([{**SCHEMA[0],'required':'yes'}])
