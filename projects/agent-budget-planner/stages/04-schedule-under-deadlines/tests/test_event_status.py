import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from main import schedule

WORKSPACE = Path(os.environ['PROJECT_WORKSPACE'])


class EventStatus(unittest.TestCase):
    def test_replay_reports_every_gate_through_status(self):
        result = schedule([
            {'id': 'fits', 'cost': 4, 'duration_ms': 2},
            {'id': 'over-budget', 'cost': 7, 'duration_ms': 1},
            {'id': 'late', 'cost': 1, 'duration_ms': 4},
            {'id': 'boundary', 'cost': 6, 'duration_ms': 3},
        ], 10, 5)
        self.assertEqual([(event['id'], event['status'], event.get('reason'))
                          for event in result['events']], [
            ('fits', 'completed', None),
            ('over-budget', 'rejected', 'budget exceeded'),
            ('late', 'rejected', 'deadline'),
            ('boundary', 'completed', None),
        ])
        self.assertEqual(result['ledger']['spent'], 10)
        self.assertEqual(result['elapsed_ms'], 5)

    def test_cli_modes_share_the_outcome_field(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'jobs.json'
            source.write_text(json.dumps({
                'schema_version': 1, 'unit': 'teaching_units',
                'limit': 10, 'deadline_ms': 100000,
                'jobs': [
                    {'id': 'done', 'cost': 4, 'duration_ms': 1,
                     'action': {'kind': 'sha256', 'text': 'Orchard'}},
                    {'id': 'over-budget', 'cost': 7, 'duration_ms': 1},
                ],
            }), encoding='utf-8')
            for mode in ['replay', 'execute']:
                with self.subTest(mode=mode):
                    run = subprocess.run([sys.executable, str(WORKSPACE / 'cli.py'),
                                          str(source), '--mode', mode],
                                         capture_output=True, text=True, timeout=10)
                    self.assertEqual(run.returncode, 0, run.stderr)
                    receipt = json.loads(run.stdout)
                    self.assertEqual(receipt['schema_version'], 1)
                    self.assertEqual([event['status'] for event in receipt['events']],
                                     ['completed', 'rejected'])
