import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
WORK=Path(os.environ["PROJECT_WORKSPACE"])
sys.path.insert(0,str(WORK))
from main import validate_schema, extract_candidates, typed_value, review_document, render_review
SCHEMA=[{'name':'seats','type':'integer','required':True,'labels':['Seats','Attendees']}]

class Contract(unittest.TestCase):
    def test_escape_document(self):
        report=review_document('<script>bad()</script>',SCHEMA,[])
        page=render_review(report)
        self.assertIn('&lt;script&gt;',page)
        self.assertNotIn('<script>bad()',page)
    def test_choice_controls(self):
        text='Seats: 18\nSeats: 24'
        page=render_review(review_document(text,SCHEMA,extract_candidates(text,SCHEMA)))
        self.assertEqual(page.count('type="radio"'),2)
    def test_missing_visible(self):
        self.assertIn('No source candidate',render_review(review_document('',SCHEMA,[])))
    def test_json_script_escape(self):
        page=render_review(review_document('</script><img src=x>',SCHEMA,[]))
        self.assertNotIn('</script><img',page)
    def test_cli_output(self):
        with tempfile.TemporaryDirectory() as temp:
            output=Path(temp)/'review.html'
            run=subprocess.run([sys.executable,str(WORK/'cli.py'),str(WORK/'sample.txt'),'--schema',str(WORK/'schema.json'),'--output',str(output)],capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            report=json.loads(output.with_suffix('.json').read_text())
            self.assertEqual(report['status'],'needs_review')
            self.assertIn('ambiguous',[f['state'] for f in report['fields']])
    def test_approved_page_preserves_selected_span(self):
        from html.parser import HTMLParser
        text='Seats: 18\nSeats: 24';candidates=extract_candidates(text,SCHEMA)
        initial=review_document(text,SCHEMA,candidates)
        decision={'sourceSha256':initial['sourceSha256'],'choices':{'seats':{'start':17,'end':19}}}
        approved=review_document(text,SCHEMA,candidates,decision)
        class Inputs(HTMLParser):
            def __init__(self): super().__init__(); self.choices={}
            def handle_starttag(self,tag,attrs):
                row=dict(attrs)
                if tag=='input' and 'checked' in row:
                    self.choices[row['name']]={'start':int(row['data-start']),'end':int(row['data-end'])}
        parser=Inputs();parser.feed(render_review(approved))
        self.assertEqual(parser.choices,decision['choices'])
        replay=review_document(text,SCHEMA,candidates,{'sourceSha256':approved['sourceSha256'],'choices':parser.choices})
        self.assertEqual(replay['approvedValues'],{'seats':24})
