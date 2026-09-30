import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
WORK=Path(os.environ["PROJECT_WORKSPACE"])
sys.path.insert(0,str(WORK))
from main import load_csv, plan_question, run_query, render_report
def sample(): return load_csv('region,units\nW,2\nE,3\nW,4\n')
def evaluate(sql):
    import sqlite3
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE data(region TEXT,units REAL)')
        db.executemany('INSERT INTO data VALUES (?,?)',[('W',2),('E',3),('W',4)])
        return db.execute(sql).fetchall()

class Contract(unittest.TestCase):
    def test_html_escaping(self):
        result=run_query(load_csv('x\n<script>alert(1)</script>'),'SELECT * FROM data')
        page=render_report(result)
        self.assertIn('&lt;script&gt;',page)
        self.assertNotIn('<script>alert(1)',page)
    def test_receipt(self):
        result=run_query(sample(),'SELECT COUNT(*) FROM data')
        self.assertEqual(result['sourceSha256'],sample()['sha256'])
        self.assertIn(result['sourceSha256'],render_report(result))
    def test_empty(self):
        result=run_query(load_csv('x\n'),'SELECT * FROM data')
        self.assertEqual(result['rows'],[])
        self.assertIn('<table>',render_report(result))
    def test_limit_visible(self):
        self.assertIn('Result capped',render_report(run_query(sample(),'SELECT * FROM data',max_rows=1)))
    def test_real_cli(self):
        with tempfile.TemporaryDirectory() as temp:
            output=Path(temp)/'report.html'
            run=subprocess.run([sys.executable,str(WORK/'cli.py'),str(WORK/'sample.csv'),'--question','sum units by region','--output',str(output)],capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            receipt=json.loads(output.with_suffix('.json').read_text())
            self.assertIn(['West',21.0],receipt['rows'])
    def test_distinct_large_ids_do_not_collapse_in_sql(self):
        data=load_csv('item_id,units\n9007199254740992,2\n9007199254740993,3\n')
        report=run_query(data,plan_question('sum units by item_id',data))
        self.assertEqual(report['rows'],[('9007199254740992',2.0),('9007199254740993',3.0)])
