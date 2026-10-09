import argparse
import json
import re
from collections import Counter
from pathlib import Path

def coverage(source: str, compact: str, rare_max: int = 2) -> dict:
    if rare_max < 1:
        raise ValueError('rare_max must be positive')
    expected = Counter()
    for line in source.splitlines():
        level, message = line.split('\t', 1)
        if level not in {'DEBUG', 'INFO', 'WARN', 'ERROR'} or not message.strip():
            raise ValueError('invalid source record')
        expected[(level, re.sub(r'[0-9]+', '#', message))] += 1
    retained = set()
    represented = 0
    for line in compact.splitlines():
        row = json.loads(line)
        key = (row['level'], row['template'])
        if row.get('schemaVersion') != 1 or key not in expected or key in retained:
            raise ValueError('unknown or duplicate context group')
        if type(row['count']) is not int or row['count'] != expected[key]:
            raise ValueError('group count mismatch')
        if type(row['firstLine']) is not int or type(row['lastLine']) is not int or not 1 <= row['firstLine'] <= row['lastLine'] <= sum(expected.values()):
            raise ValueError('invalid locator')
        retained.add(key)
        represented += row['count']
    rare = {key for key, count in expected.items() if count <= rare_max}
    lost = sorted(rare - retained)
    return {'schemaVersion': 1, 'records': sum(expected.values()), 'templates': len(expected),
            'retainedTemplates': len(retained), 'representedRecords': represented,
            'rareTemplates': len(rare), 'retainedRareTemplates': len(rare & retained),
            'rareCoverage': len(rare & retained) / len(rare) if rare else 1.0,
            'lostRare': [{'level': x[0], 'template': x[1]} for x in lost]}

def main():
    p = argparse.ArgumentParser()
    p.add_argument('source'); p.add_argument('context'); p.add_argument('--out')
    a = p.parse_args()
    report = coverage(Path(a.source).read_text(), Path(a.context).read_text())
    text = json.dumps(report, indent=2)
    if a.out: Path(a.out).write_text(text + '\n')
    print(text)
if __name__ == '__main__': main()
