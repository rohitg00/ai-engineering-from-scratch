from pathlib import Path
import subprocess
import tempfile
from main import coverage
import json
with tempfile.TemporaryDirectory() as tmp:
    binary = str(Path(tmp) / 'log-context')
    subprocess.run(['rustc', '--edition', '2021', 'main.rs', '-o', binary], check=True)
    reports = {}
    for policy in ['uniform', 'rarity']:
        output = Path(tmp) / (policy + '.jsonl')
        subprocess.run([binary, 'fixtures/burst.log', '8', policy, str(output)], check=True)
        reports[policy] = coverage(Path('fixtures/burst.log').read_text(), output.read_text())
    print(json.dumps(reports, indent=2))
