import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRACTICE = ROOT / "practice"
sys.path.insert(0, str(PRACTICE / "_harness"))

import practice_check

MARKS = {"pass": "PASS", "fail": "FAIL", "error": "ERROR", "skip": "SKIP"}


def problem_dir(name):
    path = Path(name)
    if path.is_dir() and (path / "meta.json").exists():
        return path.resolve()
    candidate = PRACTICE / name
    if (candidate / "meta.json").exists():
        return candidate
    raise SystemExit(f"No practice problem named {name!r}. Problems are the folders in practice/ that hold a meta.json file.")


def read_fixtures(problem):
    path = problem / "fixtures.json"
    return json.loads(path.read_text()) if path.exists() else {}


def evaluate(problem, code_path, layers=None, limit_s=None):
    source = Path(code_path).read_text()
    return practice_check.evaluate(source, str(problem / "tests.py"), read_fixtures(problem), layers, limit_s)


def build_fixtures(problem, reference_path):
    practice_check.reset()
    practice_check.load_tests(str(problem / "tests.py"))
    reference = practice_check.load_module(str(reference_path), "practice_reference")
    return practice_check.build_fixtures(reference)


def print_report(report, meta):
    print(f"{meta['title']} ({meta['id']})")
    if report["load_error"]:
        print(f"  {report['load_error']}")
    layer = None
    for result in report["results"]:
        if result["layer"] != layer:
            layer = result["layer"]
            print(f"\n  {practice_check.LAYER_TITLES[layer]}")
        print(f"    {MARKS[result['status']]:5} {result['name']}")
        if result["status"] != "pass":
            print(f"          {result['message']}")
            if result["expected"] is not None:
                print("          expected: " + result["expected"].replace("\n", "\n                    "))
            if result["actual"] is not None:
                print("          actual:   " + result["actual"].replace("\n", "\n                    "))
            print(f"          meaning:  {result['explain']}")
    for warning in report.get("warnings", []):
        print(f"\n  Warning from your code: {warning}")
    if report.get("stdout"):
        print("\n  Output of your code:\n    " + report["stdout"].rstrip().replace("\n", "\n    "))
    total = report["summary"]
    print(f"\n  {total['passed']} of {total['total']} checks pass.")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run the checks of one practice problem against your code.")
    parser.add_argument("problem", help="problem id, for example softmax-stable")
    parser.add_argument("code", nargs="?", help="your Python file. The default is the starter of the problem.")
    parser.add_argument("--examples", action="store_true", help="run only the examples, like the Run button")
    parser.add_argument("--layers", default="", help="comma-separated layers: examples, properties, edge, reference")
    parser.add_argument("--limit", type=float, default=0, help="time limit in seconds")
    parser.add_argument("--json", action="store_true", help="print the report as JSON")
    parser.add_argument("--build-fixtures", metavar="REFERENCE", help="print the fixtures that this reference file gives")
    args = parser.parse_args(argv)
    problem = problem_dir(args.problem)
    meta = json.loads((problem / "meta.json").read_text())
    if args.build_fixtures:
        print(json.dumps(build_fixtures(problem, args.build_fixtures), allow_nan=True))
        return 0
    layers = ["examples"] if args.examples else [layer for layer in args.layers.split(",") if layer] or None
    code = args.code or str(problem / "starter.py")
    report = evaluate(problem, code, layers, args.limit or None)
    if args.json:
        print(json.dumps(report, allow_nan=False))
    else:
        print_report(report, meta)
    return 0 if report["summary"]["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
