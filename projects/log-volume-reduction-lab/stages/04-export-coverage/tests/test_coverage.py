import unittest,json
from main import coverage
class CoverageTests(unittest.TestCase):
    def row(self,**kw):
        return json.dumps(dict(schemaVersion=1,level='ERROR',template='oops',count=1,firstLine=1,lastLine=1,**kw))
    def test_kept(self): self.assertEqual(coverage('ERROR\toops',self.row())['rareCoverage'],1)
    def test_lost(self): self.assertEqual(coverage('ERROR\toops','')['lostRare'],[{'level':'ERROR','template':'oops'}])
    def test_empty(self): self.assertEqual(coverage('','')['rareCoverage'],1)
    def test_duplicate(self):
        with self.assertRaises(ValueError): coverage('ERROR\toops',self.row()+'\n'+self.row())
    def test_count_tamper(self):
        row=json.loads(self.row());row['count']=9
        with self.assertRaises(ValueError): coverage('ERROR\toops',json.dumps(row))
    def test_unseen_group(self):
        with self.assertRaises(ValueError): coverage('WARN\theldout',self.row())
    def test_bad_locator(self):
        row=json.loads(self.row());row['lastLine']=2
        with self.assertRaises(ValueError): coverage('ERROR\toops',json.dumps(row))
