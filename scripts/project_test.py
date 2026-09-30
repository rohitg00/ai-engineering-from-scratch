"""Grade cumulative project stages with standard-library test runners.

The authoring and completion-evidence contracts live in projects/AUTHORING.md.
Reference solutions are never eligible for learner completion certificates.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time

REPO = Path(__file__).resolve().parent.parent
PROJECTS = REPO / "projects"
LANGUAGES = {"python", "typescript", "rust", "go"}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def contained(root, candidate):
    root, candidate = root.resolve(), candidate.resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"path escapes {root}: {candidate}")
    return candidate


def load_project(project_id):
    if not SLUG.fullmatch(project_id):
        raise ValueError(f"invalid project id: {project_id!r}")
    root = contained(PROJECTS, PROJECTS / project_id)
    manifest = contained(root, root / "project.json")
    if not manifest.is_file():
        raise ValueError(f"unknown project {project_id!r}")
    meta = json.loads(manifest.read_text(encoding="utf-8"))
    if meta.get("id") != project_id or not isinstance(meta.get("stages"), list) or not meta["stages"]:
        raise ValueError(f"{manifest}: id must match directory and stages must be nonempty")
    seen = set()
    for stage in meta["stages"]:
        sid = stage.get("id", "")
        if not SLUG.fullmatch(sid) or sid in seen:
            raise ValueError(f"{manifest}: invalid or duplicate stage id {sid!r}")
        seen.add(sid)
        stage_dir = contained(root, root / "stages" / sid)
        contained(root, stage_dir / "tests")
        runner_specs(stage, meta)
    return root, meta


def stage_dirs(root, meta):
    return [contained(root, root / "stages" / stage["id"]) for stage in meta["stages"]]


def runner_specs(stage, meta):
    language = stage.get("language") or str((meta.get("languages") or ["Python"])[0]).lower()
    specs = stage.get("runners")
    if specs is None:
        specs = [{"language": language, **({"argv": stage["runner"]} if "runner" in stage else {})}]
    if not isinstance(specs, list) or not specs:
        raise ValueError(f"{stage['id']}: runners must be a nonempty array")
    result = []
    for entry in specs:
        if not isinstance(entry, dict):
            raise ValueError(f"{stage['id']}: runner must be an object")
        spec = dict(entry)
        if "optional" in spec and not isinstance(spec["optional"], bool):
            raise ValueError(f"{stage['id']}: optional must be boolean")
        spec["language"] = spec.get("language", language).lower()
        if spec["language"] not in LANGUAGES:
            raise ValueError(f"{stage['id']}: unsupported language {spec['language']!r}")
        timeout = spec.get("timeout", stage.get("timeout", 60))
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not 0 < timeout <= 600:
            raise ValueError(f"{stage['id']}: timeout must be between 0 and 600 seconds")
        spec["timeout"] = timeout
        requirements = stage.get("requires", []) + spec.get("requires", [])
        if not isinstance(requirements, list) or any(not isinstance(item, str) or not item for item in requirements):
            raise ValueError(f"{stage['id']}: requires must list executable names")
        spec["requires"] = list(dict.fromkeys(requirements))
        if "argv" in spec and (not isinstance(spec["argv"], list) or not spec["argv"] or any(not isinstance(arg, str) or not arg for arg in spec["argv"])):
            raise ValueError(f"{stage['id']}: runner argv must be a nonempty string array")
        result.append(spec)
    return result


def summarize_failure(output):
    missing = list(dict.fromkeys(re.findall(r"NotImplementedError: (.+)|(?:not yet implemented: |panic: )?(Stage \d+: implement [A-Za-z_][\w./ -]*)", output)))
    if missing:
        return "not implemented yet: " + next(part for part in missing[0] if part).strip()
    imports = re.findall(r"(?:ModuleNotFoundError|ImportError): (.+)", output)
    if imports:
        return "import failed: " + imports[-1].strip()
    assertions = re.findall(r"^(?:AssertionError: .+|error.+|FAIL.+)", output, re.MULTILINE)
    return (assertions[0][:180] if assertions else "tests failed; rerun with --verbose")


def execute(argv, cwd, env, timeout):
    started = time.monotonic()
    try:
        process = subprocess.Popen(argv, cwd=cwd, env=env, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, start_new_session=os.name != "nt")
    except (OSError, ValueError) as error:
        return 1, str(error), False
    try:
        output, _ = process.communicate(timeout=timeout)
        return process.returncode, output, False
    except subprocess.TimeoutExpired:
        if os.name != "nt":
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
        output, _ = process.communicate()
        return 1, output + f"\ntimeout after {time.monotonic() - started:.1f}s", True


def test_counts(language, output):
    if language == "python":
        matches = re.findall(r"Ran (\d+) tests?", output)
        skipped = sum(int(n) for n in re.findall(r"skipped=(\d+)", output))
        return sum(map(int, matches)), skipped
    if language == "typescript":
        tests = re.findall(r"(?:#|ℹ) tests (\d+)", output)
        skipped = re.findall(r"(?:#|ℹ) (?:skipped|todo) (\d+)", output)
        return sum(map(int, tests)), sum(map(int, skipped))
    if language == "rust":
        summaries = re.findall(r"test result: \w+\. (\d+) passed; (\d+) failed; (\d+) ignored;", output)
        return sum(int(a) + int(b) + int(c) for a, b, c in summaries), sum(int(c) for _, _, c in summaries)
    total = skipped = 0
    for line in output.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("Test") and event.get("Action") in ("pass", "fail", "skip"):
            total += 1
            skipped += event["Action"] == "skip"
    return total, skipped


def runner_result(spec, root, stage_dir, workspace, verbose):
    started = time.monotonic()
    language = spec["language"]
    result = {"language": language, "status": "fail", "tests": 0, "skippedTests": 0, "reason": "", "durationMs": 0}
    runtime = {"python": sys.executable, "typescript": "node", "rust": "rustc", "go": "go"}[language]
    substitutions = {"workspace": str(workspace), "project": str(root), "stage": str(stage_dir), "tests": str(stage_dir / "tests"), "python": sys.executable}
    argv = [arg.format_map(substitutions) for arg in spec["argv"]] if "argv" in spec else None
    packages = [name for name in spec["requires"] if name.startswith(("python:", "node:"))]
    required = [runtime] + [name for name in spec["requires"] if name not in packages] + ([argv[0]] if argv else [])
    missing = [name for name in dict.fromkeys(required) if shutil.which(name) is None]
    if missing:
        result.update(status="skip", reason="missing executable: " + ", ".join(missing))
        return result
    env = dict(os.environ, PROJECT_WORKSPACE=str(workspace), PROJECT_ROOT=str(root), PROJECT_STAGE=str(stage_dir), PYTHONDONTWRITEBYTECODE="1")
    env.pop("NODE_TEST_CONTEXT", None)
    env["PYTHONPATH"] = str(workspace) + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    for requirement in packages:
        ecosystem, name = requirement.split(":", 1)
        if not re.fullmatch(r"[A-Za-z0-9_@][A-Za-z0-9_./@-]*", name):
            raise ValueError(f"invalid dependency requirement: {requirement}")
        if ecosystem == "python":
            probe = "import importlib.util, importlib.machinery, sys\nparts=sys.argv[1].split('.')\nspec=importlib.util.find_spec(parts[0])\nfor index in range(1,len(parts)):\n if spec is None or spec.submodule_search_locations is None: spec=None; break\n spec=importlib.machinery.PathFinder.find_spec('.'.join(parts[:index+1]),spec.submodule_search_locations)\nsys.exit(0 if spec is not None else 1)"
            command = [sys.executable, "-c", probe, name]
            distribution = {"google.adk": "google-adk", "langchain_text_splitters": "langchain-text-splitters", "strands": "strands-agents"}.get(name, name.replace("_", "-"))
            hint = f"python3 -m pip install {distribution}"
        else:
            command = ["node", "--input-type=module", "-e", "try { import.meta.resolve(process.argv[1]); } catch { process.exit(1); }", name]
            hint = f"npm install {name}"
        code, _, _ = execute(command, workspace, env, min(10, spec["timeout"]))
        if code:
            result.update(status="skip", reason=f"missing dependency {requirement}; install with: {hint}")
            return result
    if language == "typescript":
        code, version, timed_out = execute(["node", "--version"], workspace, env, min(10, spec["timeout"]))
        match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", version.strip())
        if code or not match or tuple(map(int, match.groups())) < (22, 18, 0):
            result.update(status="skip", reason="Node.js 22.18 or later is required")
            return result
    tests = stage_dir / "tests"
    outputs, commands = [], []
    with tempfile.TemporaryDirectory(prefix="aifs-project-grade-") as temp:
        temp_path = Path(temp)
        cwd = workspace
        if argv:
            commands = [argv]
        elif language == "python":
            commands = [[sys.executable, "-m", "unittest", "discover", "-s", str(tests), "-p", "test_*.py", "-t", str(tests)]]
        elif language == "typescript":
            files = sorted([*tests.glob("*.test.ts"), *tests.glob("*.test.mjs")])
            if files:
                commands = [["node", "--experimental-strip-types", "--test-reporter=tap", "--test", *map(str, files)]]
        elif language == "rust":
            for index, file in enumerate(sorted(tests.glob("*.rs"))):
                binary = str(temp_path / f"stage-test-{index}")
                commands.extend([["rustc", "--edition", "2021", "--test", str(file), "-o", binary], [binary]])
        elif language == "go":
            shutil.copytree(workspace, temp_path / "workspace", ignore=shutil.ignore_patterns(".git", "node_modules", "target", "__pycache__"))
            cwd = temp_path / "workspace"
            for file in tests.rglob("*.go"):
                target = contained(cwd, cwd / file.relative_to(tests))
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(contained(root, file), target)
            if not (cwd / "go.mod").exists():
                env["GO111MODULE"] = "off"
            env["GOWORK"] = "off"
            commands = [["go", "test", "-json", "./..."]]
        code = 0
        timed_out = False
        for command in commands:
            remaining = spec["timeout"] - (time.monotonic() - started)
            if remaining <= 0:
                code, timed_out = 1, True
                break
            code, output, timed_out = execute(command, cwd, env, remaining)
            outputs.append(output)
            if code:
                break
        output = "\n".join(outputs)
    result["tests"], result["skippedTests"] = test_counts(language, output)
    result["durationMs"] = round((time.monotonic() - started) * 1000)
    if verbose and output:
        print(output, file=sys.stderr)
    if timed_out:
        result["reason"] = f"timeout after {spec['timeout']} seconds"
    elif not result["tests"] and code in (0, 5):
        result["reason"] = "no tests ran; an empty suite is not a pass"
    elif code:
        result["reason"] = summarize_failure(output)
    elif result["skippedTests"]:
        result.update(status="skip", reason=f"{result['skippedTests']} tests skipped or pending")
    else:
        result["status"] = "pass"
    return result


def run_stage(root, info, number, code_path, meta, verbose, optional=False):
    started = time.monotonic()
    stage_dir = contained(root, root / "stages" / info["id"])
    result = {"id": info["id"], "number": number, "language": info.get("language", str(meta.get("languages", ["Python"])[0]).lower()),
              "status": "fail", "tests": 0, "skippedTests": 0, "durationMs": 0, "reason": "", "runners": []}
    if not code_path.is_dir():
        result["reason"] = f"workspace does not exist: {code_path}"
        return result
    for spec in runner_specs(info, meta):
        if spec.get("optional") and not optional:
            continue
        result["runners"].append(runner_result(spec, root, stage_dir, code_path, verbose))
    statuses = [entry["status"] for entry in result["runners"]]
    result["status"] = "fail" if not statuses or "fail" in statuses else "skip" if "skip" in statuses else "pass"
    result["tests"] = sum(entry["tests"] for entry in result["runners"])
    result["skippedTests"] = sum(entry["skippedTests"] for entry in result["runners"])
    result["durationMs"] = round((time.monotonic() - started) * 1000)
    result["reason"] = "; ".join(entry["reason"] for entry in result["runners"] if entry["reason"])
    return result


def init_workspace(root, meta, target, force):
    target = Path(target).resolve()
    if target == root or root in target.parents or target == REPO or target == PROJECTS:
        raise ValueError("initialize a learner workspace outside the project's source directory")
    target.mkdir(parents=True, exist_ok=True)
    copied, skipped = [], []
    for stage in stage_dirs(root, meta):
        starter = contained(root, stage / "starter")
        for source in sorted(starter.rglob("*")):
            if not source.is_file():
                continue
            contained(root, source)
            destination = contained(target, target / source.relative_to(starter))
            if destination.exists() and not force:
                skipped.append(destination)
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            copied.append(destination)
    print(f"workspace  {target}")
    for path in copied:
        print(f"  created  {path.relative_to(target)}")
    for path in skipped:
        print(f"  kept     {path.relative_to(target)}")
    print(f"next: python3 scripts/project_test.py {meta['id']} --stage 1 --path {target}")


def list_stages(meta):
    print(f"{meta['title']}  (level {meta['level']}, ~{meta['hours']}h)")
    for number, stage in enumerate(meta["stages"], 1):
        print(f"  {number}. [{stage.get('difficulty', 'core'):<7}] {stage['title']}  ~{stage['hours']}h")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Grade projects with offline, standard-library runners.")
    parser.add_argument("project", nargs="?", help="project id")
    parser.add_argument("--all", action="store_true", help="all stages, or all ready projects when no id is given")
    parser.add_argument("--stage", type=int, help="grade stages 1..N")
    parser.add_argument("--only", action="store_true", help="grade only --stage N")
    parser.add_argument("--path", default=".", help="learner workspace; with all projects, a parent containing project-id workspaces")
    parser.add_argument("--solution", action="store_true", help="grade reference solutions (no learner certificates)")
    parser.add_argument("--strict", action="store_true", help="fail on missing runtimes or skipped tests")
    parser.add_argument("--optional", action="store_true", help="include optional framework comparison runners")
    parser.add_argument("--report", metavar="FILE", help="write JSON completion evidence")
    parser.add_argument("--init", metavar="DIR", help="copy all stage starter files non-destructively")
    parser.add_argument("--force", action="store_true", help="overwrite existing files with --init")
    parser.add_argument("--list", action="store_true", help="list stages")
    parser.add_argument("--verbose", action="store_true", help="show runner output")
    args = parser.parse_args(argv)
    if not args.project and not args.all:
        parser.error("provide a project id or --all")
    if args.only and args.stage is None:
        parser.error("--only requires --stage")
    if args.all and (args.stage is not None or args.only):
        parser.error("--all cannot be combined with --stage or --only")
    if args.force and not args.init:
        parser.error("--force requires --init")
    if args.init and not args.project:
        parser.error("--init requires a project id")
    try:
        ids = [args.project] if args.project else sorted(p.name for p in PROJECTS.iterdir() if p.is_dir() and not p.name.startswith(("_", ".")) and (p / "project.json").is_file() and json.loads((p / "project.json").read_text()).get("status") == "ready")
        if not ids:
            raise ValueError("no ready projects found")
        report = {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "projects": [], "certificateEligible": False}
        failed = False
        for project_id in ids:
            root, meta = load_project(project_id)
            if args.list:
                list_stages(meta)
                continue
            if args.init:
                init_workspace(root, meta, args.init, args.force)
                continue
            total = len(meta["stages"])
            last = args.stage if args.stage is not None else total
            if not 1 <= last <= total:
                raise ValueError(f"{project_id}: --stage must be between 1 and {total}")
            selected = [last] if args.only else list(range(1, last + 1))
            workspace = contained(root, root / "solution") if args.solution else (Path(args.path) / (project_id if not args.project else "")).resolve()
            reference = contained(root, root / "solution")
            reference_mode = args.solution or workspace == reference or reference in workspace.parents
            entry = {"id": project_id, "title": meta["title"], "mode": "solution" if reference_mode else "learner",
                     "optionalIncluded": args.optional,
                     "manifestHash": hashlib.sha256((root / "project.json").read_bytes()).hexdigest(),
                     "selectedStages": [meta["stages"][n - 1]["id"] for n in selected], "stages": [],
                     "allStagesPassed": False, "certificateEligible": False}
            print(f"{meta['title']}: grading {entry['mode']}")
            for number in selected:
                info = meta["stages"][number - 1]
                result = run_stage(root, info, number, workspace, meta, args.verbose, args.optional)
                entry["stages"].append(result)
                print(f"  {result['status'].upper():4} stage {number}: {info['title']} ({result['tests']} tests)")
                if result["reason"]:
                    print(f"       {result['reason']}")
                failed |= result["status"] == "fail" or (args.strict and result["status"] == "skip")
            entry["allStagesPassed"] = len(selected) == total and all(stage["status"] == "pass" and stage["tests"] > 0 and stage["skippedTests"] == 0 for stage in entry["stages"])
            entry["certificateEligible"] = entry["allStagesPassed"] and entry["mode"] == "learner"
            report["projects"].append(entry)
        report["certificateEligible"] = bool(report["projects"]) and all(entry["certificateEligible"] for entry in report["projects"])
        if args.report:
            output = Path(args.report).resolve()
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            print(f"report: {output}")
        return int(failed)
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"project grader: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
