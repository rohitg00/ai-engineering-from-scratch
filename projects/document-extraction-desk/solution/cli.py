import argparse
import json
from pathlib import Path
import sys

from main import extract_candidates, render_review, review_document


def main():
    parser = argparse.ArgumentParser(description='Review structured fields with exact document evidence.')
    parser.add_argument('document', type=Path)
    parser.add_argument('--schema', type=Path, required=True)
    parser.add_argument('--proposals', type=Path, help='Optional extractor/model JSON candidates; every span is independently checked')
    parser.add_argument('--approve', type=Path, help='Reviewer decisions downloaded from the local HTML desk')
    parser.add_argument('--output', type=Path, default=Path('extraction-review.html'))
    args = parser.parse_args()
    try:
        text = args.document.read_text(encoding='utf-8')
        schema = json.loads(args.schema.read_text())
        proposals = json.loads(args.proposals.read_text()) if args.proposals else extract_candidates(text, schema)
        decisions = json.loads(args.approve.read_text()) if args.approve else None
        report = review_document(text, schema, proposals, decisions)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(render_review(report), encoding='utf-8')
        args.output.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'status': report['status'], 'report': str(args.output), 'fields': {f['name']: f['state'] for f in report['fields']}, 'approvedValues': report['approvedValues']}, indent=2))
    except (ValueError, OSError) as error:
        print('extraction desk: ' + str(error), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
