import argparse
import difflib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRACTICE = ROOT / "practice"
RUNNER = Path(__file__).resolve().parent / "run.py"
sys.path.insert(0, str(PRACTICE / "_harness"))

import practice_check

DIFFICULTIES = ("easy", "medium", "hard")
REQUIRED_FILES = ("problem.md", "starter.py", "solution.py", "tests.py", "hints.md", "notes.md", "meta.json", "fixtures.json")
META_KEYS = {
    "id": str,
    "title": str,
    "summary": str,
    "difficulty": str,
    "tags": list,
    "lesson": str,
    "cheatsheet": (str, type(None)),
    "minutes": int,
    "entry": list,
    "collections": list,
    "time_limit_s": (int, float),
    "mutants": dict,
    "kind": str,
}
KINDS = ("implement", "research", "train", "lab")
ARXIV = re.compile(r"^https://arxiv\.org/abs/\d{4}\.\d{4,5}$")
SECTIONS = ("## Task", "## Input and output", "## Constraints", "## Examples")
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LEAK_MIN = 18
MIN_HINTS = 2
MAX_HINTS = 5
DEFAULT_LIMIT = 10
MAX_FIXTURE_BYTES = 80000
MAX_MUTANT_LINES = 12


def problems():
    return sorted(path for path in PRACTICE.iterdir() if path.is_dir() and not path.name.startswith("_") and (path / "meta.json").exists())


def load_collections():
    path = PRACTICE / "collections.json"
    return json.loads(path.read_text()) if path.exists() else []


def run_candidate(problem, code, limit):
    started = time.monotonic()
    try:
        done = subprocess.run(
            [sys.executable, "-I", str(RUNNER), str(problem), str(code), "--json", "--limit", str(limit)],
            capture_output=True,
            text=True,
            timeout=limit + 5,
        )
    except subprocess.TimeoutExpired:
        return None, time.monotonic() - started, "time limit"
    elapsed = time.monotonic() - started
    try:
        return json.loads(done.stdout), elapsed, ""
    except json.JSONDecodeError:
        return None, elapsed, (done.stderr or done.stdout).strip()[-600:]


def meta_problems(problem, meta, collections):
    found = []
    for key, kind in META_KEYS.items():
        if key not in meta:
            found.append(f"meta.json has no {key!r}")
        elif not isinstance(meta[key], kind):
            found.append(f"meta.json {key!r} has the wrong type")
    if found:
        return found
    found += kind_problems(problem, meta)
    if meta["id"] != problem.name:
        found.append(f"meta.json id {meta['id']!r} is not the folder name {problem.name!r}")
    if not ID_PATTERN.match(meta["id"]):
        found.append("the id must be lower case words joined by hyphens")
    if meta["difficulty"] not in DIFFICULTIES:
        found.append(f"difficulty must be one of {', '.join(DIFFICULTIES)}")
    if not (ROOT / meta["lesson"] / "docs" / "en.md").exists():
        found.append(f"lesson {meta['lesson']} has no docs/en.md")
    if not re.match(r"^phases/\d\d-[a-z0-9-]+/\d\d-[a-z0-9-]+$", meta["lesson"]):
        found.append("lesson must be a path like phases/NN-phase/MM-lesson")
    if meta["cheatsheet"] and not (ROOT / "cheatsheets" / f"{meta['cheatsheet']}.md").exists():
        found.append(f"cheat sheet {meta['cheatsheet']} does not exist")
    if not 1 <= len(meta["tags"]) <= 6 or not all(isinstance(tag, str) and ID_PATTERN.match(tag) for tag in meta["tags"]):
        found.append("tags must be 1 to 6 lower case hyphenated words")
    if not 3 <= meta["minutes"] <= 120:
        found.append("minutes must be from 3 to 120")
    if not 1 <= meta["time_limit_s"] <= 30:
        found.append("time_limit_s must be from 1 to 30")
    if len(meta["summary"]) > 160:
        found.append("summary must be 160 characters or fewer")
    known = {item["id"] for item in collections}
    for name in meta["collections"]:
        if name not in known:
            found.append(f"collection {name!r} is not in practice/collections.json")
    files = sorted(path.stem for path in (problem / "mutants").glob("*.py")) if (problem / "mutants").is_dir() else []
    if not 3 <= len(files) <= 6:
        found.append(f"a problem needs 3 to 6 mutants, it has {len(files)}")
    if sorted(meta["mutants"]) != files:
        found.append("meta.json mutants must list each file in mutants/ with a description of its bug")
    return found


def load_methods():
    path = ROOT / "research" / "methods.json"
    return json.loads(path.read_text()) if path.exists() else {"methods": {}, "lessons": {}}


def kind_problems(problem, meta):
    found = []
    kind = meta["kind"]
    if kind not in KINDS:
        return [f"kind must be one of {', '.join(KINDS)}"]
    if kind == "research":
        paper = meta.get("paper")
        if not isinstance(paper, dict) or not all(isinstance(paper.get(key), str) and paper.get(key) for key in ("title", "authors", "url")) or not isinstance(paper.get("year"), int):
            found.append("a research problem needs paper: title, authors, year and url")
        elif not ARXIV.match(paper["url"]):
            found.append("the paper url must be the arXiv abstract page, https://arxiv.org/abs/<id>")
        methods = load_methods()
        method = meta.get("method")
        if method not in methods.get("methods", {}):
            found.append(f"method {method!r} is not in research/methods.json")
        elif not any(item.get("slug") == method for item in methods.get("lessons", {}).get(meta["lesson"], {}).get("methods", [])):
            found.append(f"research/methods.json does not map {meta['lesson']} to the method {method!r}")
    elif "paper" in meta or "method" in meta:
        found.append("only a research problem has paper and method")
    if kind == "train":
        budget = meta.get("budget")
        target = meta.get("target")
        if not isinstance(budget, dict) or not isinstance(budget.get("steps"), int) or not 1 <= budget["steps"] <= 100000:
            found.append("a train problem needs budget.steps from 1 to 100000")
        if not isinstance(target, dict) or not isinstance(target.get("metric"), str) or not isinstance(target.get("value"), (int, float)):
            found.append("a train problem needs target: metric and value")
    elif "budget" in meta or "target" in meta:
        found.append("only a train problem has budget and target")
    return found


def code_lines(text):
    lines = []
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw.strip())
        if len(line) < LEAK_MIN or line.startswith(("def ", "import ", "from ", "class ", "raise NotImplementedError", '"""', "#")):
            continue
        lines.append(line)
    return lines


def normalized(text):
    return re.sub(r"\s+", " ", text)


def leak_problems(problem):
    solution = code_lines((problem / "solution.py").read_text())
    starter = set(code_lines((problem / "starter.py").read_text()))
    if (problem / "support.py").exists():
        starter |= set(code_lines((problem / "support.py").read_text()))
    found = []
    statement = normalized((problem / "problem.md").read_text())
    body = [line for line in solution if line not in starter]
    for line in body:
        if line in statement:
            found.append(f"problem.md shows a solution line: {line}")
    hints = normalized((problem / "hints.md").read_text())
    for first, second in zip(body, body[1:]):
        if first in hints and second in hints and f"{first} {second}" in hints:
            found.append(f"hints.md shows two solution lines in a row: {first}")
    return found


def hint_list(text):
    parts = re.split(r"^## .+$", text, flags=re.M)
    return [part.strip() for part in parts[1:] if part.strip()]


def shape_problems(problem):
    found = []
    statement = (problem / "problem.md").read_text()
    for heading in SECTIONS:
        if not re.search(rf"^{re.escape(heading)}\s*$", statement, flags=re.M):
            found.append(f"problem.md needs the section {heading!r}")
    if re.search(r"^# ", statement, flags=re.M):
        found.append("problem.md must not have a level 1 heading. The page uses the title from meta.json")
    for name in ("hints.md", "notes.md", "problem.md"):
        if re.search(r"\]\(\s*https?:", (problem / name).read_text()) or re.search(r"<a\s", (problem / name).read_text()):
            found.append(f"{name} links to another site. Keep the text on this site; a research task cites its paper in meta.json")
    hints = hint_list((problem / "hints.md").read_text())
    if not MIN_HINTS <= len(hints) <= MAX_HINTS:
        found.append(f"hints.md needs {MIN_HINTS} to {MAX_HINTS} hints, each under a ## heading")
    if "NotImplementedError" not in (problem / "starter.py").read_text():
        found.append("starter.py must raise NotImplementedError in each function the learner writes")
    support = ("support.py",) if (problem / "support.py").exists() else ()
    for name in ("starter.py", "solution.py", "tests.py") + support + tuple(f"mutants/{path.name}" for path in sorted((problem / "mutants").glob("*.py"))):
        text = (problem / name).read_text()
        if re.search(r"(^|\s)#", "\n".join(line for line in text.splitlines() if not re.search(r"[\"'].*#.*[\"']", line))):
            found.append(f"{name} has a code comment. Put explanations in problem.md, hints.md or notes.md")
        for module in re.findall(r"^\s*(?:import|from)\s+([A-Za-z_][\w.]*)", text, flags=re.M):
            base = module.split(".")[0]
            if base not in {"numpy", "math", "json", "re", "collections", "copy", "heapq", "itertools", "functools", "practice_check", "dataclasses", "typing", "string", "support"}:
                found.append(f"{name} imports {module}. The browser runner has numpy and the standard library only")
    return found


def changed_lines(reference, mutant):
    diff = difflib.ndiff(reference.read_text().splitlines(), mutant.read_text().splitlines())
    return sum(line.startswith(("+ ", "- ")) for line in diff)


def mutant_shape_problems(problem):
    found = []
    for mutant in sorted((problem / "mutants").glob("*.py")):
        count = changed_lines(problem / "solution.py", mutant)
        if not 1 <= count <= MAX_MUTANT_LINES:
            found.append(f"mutant {mutant.stem} changes {count} lines of solution.py. A mutant has one bug: 1 to {MAX_MUTANT_LINES} changed lines")
    tests = (problem / "tests.py").read_text()
    if re.search(r"^\s*(?:import|from)\s+(?:solution|starter|mutants)\b", tests, flags=re.M):
        found.append("tests.py imports a solution file. Checks get the code under test as their argument")
    return found


def entry_problems(problem, meta):
    found = []
    for name in ("starter.py", "solution.py"):
        text = (problem / name).read_text()
        for entry in meta["entry"]:
            if not re.search(rf"^def {re.escape(entry)}\(", text, flags=re.M) and not re.search(rf"^class {re.escape(entry)}\b", text, flags=re.M):
                found.append(f"{name} does not define {entry}")
    return found


def layer_problems(problem):
    practice_check.reset()
    practice_check.load_tests(str(problem / "tests.py"))
    layers = {item["layer"] for item in practice_check._checks}
    found = [f"tests.py has no check in the layer {layer!r}" for layer in practice_check.LAYERS if layer not in layers]
    names = [item["name"] for item in practice_check._checks]
    if len(names) != len(set(names)):
        found.append("two checks in tests.py have the same name")
    return found


def same(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    if isinstance(a, float) or isinstance(b, float):
        if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
            return False
        if a == b or (a != a and b != b):
            return True
        return abs(a - b) <= 1e-9 + 1e-9 * abs(b)
    return a == b


def fixture_problems(problem, write):
    practice_check.reset()
    practice_check.load_tests(str(problem / "tests.py"))
    reference = practice_check.load_module(str(problem / "solution.py"), "practice_reference")
    built = practice_check.build_fixtures(reference)
    path = problem / "fixtures.json"
    text = json.dumps(built, allow_nan=True, separators=(",", ":")) + "\n"
    found = [f"fixtures.json has {len(text)} bytes, the limit is {MAX_FIXTURE_BYTES}. Use fewer or smaller cases"] if len(text) > MAX_FIXTURE_BYTES else []
    if write:
        path.write_text(text)
        return found
    if not path.exists():
        return ["fixtures.json is missing. Run python3 scripts/practice/validate.py --write"]
    if not same(json.loads(path.read_text()), built):
        found.append("fixtures.json does not match the output of solution.py. Run python3 scripts/practice/validate.py --write")
    return found


def failing(report):
    return [result["name"] for result in report["results"] if result["status"] != "pass"]


def validate(problem, collections, write=False, log=print):
    meta = json.loads((problem / "meta.json").read_text())
    missing = [name for name in REQUIRED_FILES if not (problem / name).exists() and not (write and name == "fixtures.json")]
    if missing:
        return {"id": problem.name, "problems": [f"missing {name}" for name in missing], "mutants": {}}
    found = meta_problems(problem, meta, collections)
    if found:
        return {"id": problem.name, "problems": found, "mutants": {}}
    found += shape_problems(problem) + mutant_shape_problems(problem) + entry_problems(problem, meta) + leak_problems(problem) + layer_problems(problem) + fixture_problems(problem, write)
    limit = meta["time_limit_s"] or DEFAULT_LIMIT
    caught = {}
    report, elapsed, error = run_candidate(problem, problem / "solution.py", limit)
    if error:
        found.append(f"solution.py did not finish: {error}")
    elif not report["summary"]["ok"]:
        found.append(f"solution.py fails: {', '.join(failing(report))}")
    elif elapsed > limit / 3:
        found.append(f"solution.py takes {elapsed:.1f}s. The browser is slower, so it must finish in a third of the {limit}s limit")
    report, _, error = run_candidate(problem, problem / "starter.py", limit)
    if not error and report["summary"]["ok"]:
        found.append("starter.py passes every check. The starter must fail")
    for mutant in sorted((problem / "mutants").glob("*.py")):
        report, _, error = run_candidate(problem, mutant, limit)
        if error == "time limit":
            caught[mutant.stem] = ["time limit"]
            continue
        if error:
            found.append(f"mutant {mutant.stem} crashed the runner: {error}")
            continue
        names = failing(report)
        if not names:
            found.append(f"mutant {mutant.stem} passes every check. Add a check that rejects it: {meta['mutants'][mutant.stem]}")
        layers = sorted({result["layer"] for result in report["results"] if result["status"] != "pass"}, key=practice_check.LAYERS.index)
        caught[mutant.stem] = layers
    return {"id": problem.name, "problems": found, "mutants": caught, "seconds": round(elapsed, 2)}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Validate the practice problems: the solution passes, the starter and every mutant fail, the fixtures are current and the statement does not leak the solution.")
    parser.add_argument("ids", nargs="*", help="problem ids. The default is every problem")
    parser.add_argument("--write", action="store_true", help="write fixtures.json from solution.py before the checks")
    parser.add_argument("--summary", help="write a JSON summary to this file")
    args = parser.parse_args(argv)
    collections = load_collections()
    found = []
    ids = {item["id"] for item in collections}
    if len(ids) != len(collections):
        found.append("practice/collections.json has two collections with the same id")
    targets = [path for path in problems() if not args.ids or path.name in args.ids]
    unknown = sorted(set(args.ids) - {path.name for path in targets})
    for name in unknown:
        found.append(f"unknown problem {name}")
    results = []
    for problem in targets:
        result = validate(problem, collections, args.write)
        results.append(result)
        mark = "ok" if not result["problems"] else "FAIL"
        mutants = ", ".join(f"{name}: {'/'.join(layers) or '-'}" for name, layers in result["mutants"].items())
        print(f"{mark:4} {result['id']:32} {len(result['mutants'])} mutants caught ({mutants}) {result.get('seconds', 0)}s")
        for problem_text in result["problems"]:
            print(f"       {problem_text}")
    used = {name for problem in targets for name in json.loads((problem / "meta.json").read_text()).get("collections", [])}
    if not args.ids:
        for item in collections:
            if item["id"] not in used:
                found.append(f"collection {item['id']} has no problem")
    for problem_text in found:
        print(f"FAIL {problem_text}")
    total = sum(len(result["problems"]) for result in results) + len(found)
    if args.summary:
        Path(args.summary).write_text(json.dumps({"problems": results, "errors": found}, indent=2) + "\n")
    print(f"Checked {len(results)} problems. {total} problems found.")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
