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
    def test_select(self):
        self.assertEqual(run_query(sample(),'SELECT SUM(units) FROM data')['rows'],[(9.0,)])
    def test_denied_writes(self):
        for sql in ['DELETE FROM data','UPDATE data SET units=0','DROP TABLE data']:
            with self.assertRaises(ValueError): run_query(sample(),sql)
    def test_denied_boundaries(self):
        for sql in ["ATTACH DATABASE '/tmp/other' AS x",'PRAGMA query_only=OFF','SELECT * FROM sqlite_master',"SELECT load_extension('x')"]:
            with self.assertRaises(ValueError): run_query(sample(),sql)
    def test_multi_statement(self):
        with self.assertRaises(ValueError): run_query(sample(),'SELECT * FROM data; DELETE FROM data')
    def test_truncation(self):
        result=run_query(sample(),'SELECT * FROM data',max_rows=2)
        self.assertEqual(len(result['rows']),2)
        self.assertTrue(result['truncated'])
    def test_instruction_budget(self):
        data=load_csv('x\n'+'\n'.join(str(i) for i in range(100)))
        with self.assertRaisesRegex(ValueError,'interrupted'): run_query(data,'SELECT SUM(a.x*b.x*c.x) FROM data a, data b, data c',max_steps=100)
