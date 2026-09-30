"""Command line entry point for the Research Report Agent.

Lesson: projects/research-report-agent/README.md
Usage: python3 solution/run_report.py "question" --out out/
       python3 solution/run_report.py --eval heldout/questions.json [--code DIR]
"""

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_CORPUS = HERE.parent / "fixtures" / "corpus"


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Generate a cited research report from a local corpus."
    )
    parser.add_argument("question", nargs="?", help="research question")
    parser.add_argument(
        "--corpus", default=str(DEFAULT_CORPUS), help="directory of markdown documents"
    )
    parser.add_argument(
        "--out", default="out", help="output directory for report.html and trace.json"
    )
    parser.add_argument(
        "--eval",
        dest="eval_path",
        help="score a questions.json file instead of one question",
    )
    parser.add_argument(
        "--code",
        default=str(HERE),
        help="directory holding the report_agent package to run",
    )
    parser.add_argument(
        "--model",
        choices=["rules", "replay", "live"],
        default="rules",
        help="planner adapter; writing remains extractive",
    )
    parser.add_argument("--cassette", help="recorded planner cassette for replay")
    parser.add_argument("--compare", help="previous report.json for the same question")
    args = parser.parse_args(argv)
    if not args.eval_path and not args.question:
        parser.error("give a question or --eval")
    return args


def main(argv=None):
    args = parse_args(argv)
    sys.path.insert(0, str(Path(args.code).resolve()))
    from report_agent.evaluate import evaluate, format_scorecard
    from report_agent.pipeline import run_pipeline

    if args.eval_path:
        print(format_scorecard(evaluate(args.eval_path, args.corpus)))
        return 0
    from report_agent.model import ReplayModel, LiveModel

    model = None
    if args.model == "replay":
        if not args.cassette:
            raise ValueError("--replay requires --cassette")
        model = ReplayModel(args.cassette)
    elif args.model == "live":
        model = LiveModel()
    report, trace, _ = run_pipeline(
        args.question, args.corpus, out_dir=args.out, model=model
    )
    if args.compare:
        from report_agent.changes import compare_reports

        previous = json.loads(Path(args.compare).read_text())
        current = json.loads((Path(args.out) / "report.json").read_text())
        (Path(args.out) / "changes.json").write_text(
            json.dumps(compare_reports(previous, current), indent=2) + "\n"
        )
    print(f"state      {trace['terminal_state']}")
    print(f"sections   {len(report.sections)}")
    print(
        f"sentences  {trace['counts']['sentences']} (dropped {trace['counts']['dropped']})"
    )
    print(f"report     {Path(args.out) / 'report.html'}")
    print(f"trace      {Path(args.out) / 'trace.json'}")
    return 0 if trace["terminal_state"] != "failed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
