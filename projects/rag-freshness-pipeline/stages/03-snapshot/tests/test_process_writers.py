import os, subprocess, sys, tempfile, unittest
from pathlib import Path
from snapshot import read_snapshot


class Writers(unittest.TestCase):
    def test_only_one_process_commits_expected_zero(self):
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder) / "index.json")
            code = "from snapshot import commit;import sys;commit(sys.argv[1],{},0)"
            jobs = [
                subprocess.Popen(
                    [sys.executable, "-c", code, path],
                    env=os.environ.copy(),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                for _ in range(4)
            ]
            exits = []
            for job in jobs:
                job.communicate(timeout=10)
                exits.append(job.returncode)
            self.assertEqual(exits.count(0), 1)
            self.assertEqual(read_snapshot(path)["version"], 1)
