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
    def test_quotes(self):
        self.assertEqual(load_csv('name,n\n"Hello, team",2\n')['rows'][0][0], 'Hello, team')
    def test_numeric(self):
        self.assertEqual(load_csv('x,y\n2,a\n3,b\n')['types'], ['REAL','TEXT'])
    def test_mixed(self):
        self.assertEqual(load_csv('x\n2\nunknown\n')['types'], ['TEXT'])
    def test_duplicate(self):
        with self.assertRaises(ValueError): load_csv('X,x\n1,2\n')
    def test_ragged(self):
        with self.assertRaises(ValueError): load_csv('x,y\n1\n')
    def test_limit_and_identity(self):
        with self.assertRaises(ValueError): load_csv('x\n1\n2\n',1)
        self.assertNotEqual(load_csv('x\n1\n')['sha256'],load_csv('x\n2\n')['sha256'])
