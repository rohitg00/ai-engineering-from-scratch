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
    def test_count(self):
        self.assertEqual(evaluate(plan_question('count rows',sample())),[(3,)])
    def test_sum(self):
        self.assertEqual(evaluate(plan_question('sum units by region',sample())),[('E',3.0),('W',6.0)])
    def test_avg(self):
        self.assertEqual(evaluate(plan_question('average units by region',sample())),[('E',3.0),('W',3.0)])
    def test_unknown_column(self):
        with self.assertRaises(ValueError): plan_question('sum missing by region',sample())
    def test_nonnumeric(self):
        with self.assertRaises(ValueError): plan_question('sum region by units',sample())
    def test_unsupported(self):
        with self.assertRaises(ValueError): plan_question('predict next month',sample())
