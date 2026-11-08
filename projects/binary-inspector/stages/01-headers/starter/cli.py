import argparse
import json
import sys
from pathlib import Path

from binspect.formats import FormatError
from binspect.report import build_report, diff_reports, render_diff_text, render_html, validate_report


def _read(path):
    file = Path(path)
    if not file.is_file():
        raise FormatError(f"{path}: not a readable file")
    return file.read_bytes()


def _write(path, text):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def _summary_lines(report):
    summary = report["summary"]
    lines = [
        f"{report['file']['name']}: {summary['format']} {summary['arch']} {summary['kind']}, {report['file']['size']} bytes",
        f"  sections {summary['sections']}  segments {summary['segments']}  symbols {summary['symbols']}  "
        f"imports {summary['imports']}  exports {summary['exports']}",
        f"  relocations {summary['relocations']}  fixups {summary['fixups']}  strings {summary['strings']}  "
        f"file entropy {summary['file_entropy']}",
    ]
    for section in report["sections"]:
        if section["file_size"]:
            label = f"{section['segment']},{section['name']}" if section["segment"] else section["name"]
            lines.append(f"  {label:<28} {section['perms']} size {section['size']:>6} entropy {section['entropy']:.4f}")
    for item in report["imports"][:12]:
        slots = " ".join(f"0x{slot:x}" for slot in item["slots"])
        lines.append(f"  import {item['library'] or '?'}/{item['name']} {slots}".rstrip())
    scores = report["function_starts"].get("scores")
    if scores:
        lines.append("  function starts scored against the unstripped build:")
        for method, score in scores.items():
            lines.append(f"    {method:<22} found {score['found']:>3}  true {score['true_positives']:>3}  "
                         f"precision {score['precision']:.4f}  recall {score['recall']:.4f}")
    else:
        lines.append(f"  recovered function starts: {len(report['function_starts']['recovered'])}")
    return lines


def inspect_command(args):
    data = _read(args.file)
    truth = _read(args.truth) if args.truth else None
    report = build_report(data, Path(args.file).name, truth, args.min_string, args.cells)
    problems = validate_report(report)
    if problems:
        raise FormatError("report failed validation: " + "; ".join(problems))
    print("\n".join(_summary_lines(report)))
    if args.json:
        _write(args.json, json.dumps(report, indent=2) + "\n")
        print(f"wrote {args.json}")
    if args.html:
        _write(args.html, render_html(report))
        print(f"wrote {args.html}")
    return 0


def diff_command(args):
    old = build_report(_read(args.old), Path(args.old).name)
    new = build_report(_read(args.new), Path(args.new).name)
    diff = diff_reports(old, new)
    sys.stdout.write(render_diff_text(diff))
    if args.json:
        _write(args.json, json.dumps(diff, indent=2) + "\n")
        print(f"wrote {args.json}")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Static inspector for ELF64, PE32+/COFF, and Mach-O 64 files you compiled.")
    commands = parser.add_subparsers(dest="command", required=True)
    inspect = commands.add_parser("inspect", help="report one file")
    inspect.add_argument("file")
    inspect.add_argument("--truth", help="unstripped build of the same source, used to score function starts")
    inspect.add_argument("--json", help="write the JSON report here")
    inspect.add_argument("--html", help="write the HTML report here")
    inspect.add_argument("--min-string", type=int, default=4)
    inspect.add_argument("--cells", type=int, default=128)
    diff = commands.add_parser("diff", help="compare two builds")
    diff.add_argument("old")
    diff.add_argument("new")
    diff.add_argument("--json", help="write the JSON diff here")
    args = parser.parse_args(argv)
    try:
        return inspect_command(args) if args.command == "inspect" else diff_command(args)
    except (FormatError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
