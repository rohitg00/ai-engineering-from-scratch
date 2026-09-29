from pathlib import Path
import os
import re
import signal
import stat
import subprocess
import sys
import tempfile


def safe_path(workspace, relative):
    root = Path(workspace).resolve()
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError("relative workspace path required")
    target = (root / candidate).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise ValueError("workspace file required")
    return target


def apply_patch(workspace, relative, old, new):
    target = safe_path(workspace, relative)
    if not isinstance(old, str) or not old or (not isinstance(new, str)):
        raise ValueError("nonempty old text and string replacement required")
    content = target.read_text()
    if content.count(old) != 1:
        raise ValueError("patch must match exactly once")
    permissions = stat.S_IMODE(target.stat().st_mode)
    name = None
    try:
        with tempfile.NamedTemporaryFile("w", dir=target.parent, delete=False) as temporary:
            name = temporary.name
            temporary.write(content.replace(old, new, 1))
        os.chmod(name, permissions)
        os.replace(name, target)
    finally:
        if name is not None and os.path.exists(name):
            os.unlink(name)
    return {"path": relative, "replacements": 1}


def run_tests(workspace, timeout=5):
    root = Path(workspace).resolve()
    if not isinstance(timeout, (int, float)) or timeout <= 0:
        raise ValueError("positive timeout required")
    if not (root / "tests").is_dir():
        return {
            "state": "failed",
            "passed": False,
            "tests": 0,
            "output": "missing tests directory",
        }
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONPATH": str(root)}
    try:
        process = subprocess.Popen(
            [sys.executable, "-B", "-m", "unittest", "discover", "-s", "tests"],
            cwd=root,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        stdout, stderr = process.communicate(timeout=timeout)
        result = subprocess.CompletedProcess(
            process.args, process.returncode, stdout, stderr
        )
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
        return {
            "state": "timeout",
            "passed": False,
            "tests": 0,
            "output": "test time budget exhausted",
        }
    output = result.stdout + result.stderr
    summary = re.search(
        r"^Ran (\d+) tests? in [^\n]+\n\n"
        r"(OK|FAILED|NO TESTS RAN)(?: \(([^\n]*)\))?\s*\Z",
        result.stderr,
        re.MULTILINE,
    )
    tests = int(summary.group(1)) if summary else 0
    skipped = (
        re.search(r"\bskipped=(\d+)\b", summary.group(3) or "") if summary else None
    )
    passed = bool(
        result.returncode == 0
        and summary
        and summary.group(2) == "OK"
        and tests > 0
        and not (skipped and int(skipped.group(1)) > 0)
    )
    return {
        "state": "passed" if passed else "failed",
        "passed": passed,
        "tests": tests,
        "output": output,
    }


def agent_loop(workspace, actions, max_steps=6):
    if not isinstance(max_steps, int) or max_steps < 1:
        raise ValueError("positive step budget required")
    trace = []
    for action in actions[:max_steps]:
        try:
            if action.get("tool") == "patch":
                result = apply_patch(
                    workspace, action["path"], action["old"], action["new"]
                )
            elif action.get("tool") == "test":
                result = run_tests(workspace)
            else:
                raise ValueError("unknown tool")
        except (ValueError, KeyError, OSError) as error:
            trace.append({"tool": action.get("tool"), "error": str(error)})
            return {"state": "failed", "trace": trace}
        trace.append({"tool": action["tool"], "result": result})
        if action["tool"] == "test" and result["passed"]:
            return {"state": "completed", "trace": trace}
    return {
        "state": "budget_exhausted" if len(actions) >= max_steps else "failed",
        "trace": trace,
    }


def drive(workspace, planner, max_steps=6):
    """Call the planner after every observation. Tests are executable trusted code."""
    if not isinstance(max_steps, int) or max_steps < 1:
        raise ValueError("positive step budget required")
    trace = []
    for step in range(max_steps):
        action = planner(tuple(trace))
        if action is None:
            return {"state": "failed", "reason": "planner abstained", "trace": trace}
        result = agent_loop(workspace, [action], 1)
        for row in result["trace"]:
            row["action"] = action
        trace.extend(result["trace"])
        if result["state"] == "completed":
            return {"state": "completed", "trace": trace}
        if any("error" in row for row in result["trace"]):
            return {"state": "failed", "trace": trace}
    return {"state": "budget_exhausted", "trace": trace}


def proposal_planner(proposals):
    """Select an exact repair only when its failure marker appears in a test result."""

    def json_key(action):
        return tuple(action.get(key) for key in ("path", "old", "new"))

    def choose(trace):
        if not trace or trace[-1]["tool"] == "patch":
            return {"tool": "test"}
        output = trace[-1].get("result", {}).get("output", "")
        used = {
            json_key(row.get("action", {})) for row in trace if row["tool"] == "patch"
        }
        for proposal in proposals:
            if (
                proposal["failure_contains"] in output
                and json_key(
                    {
                        "path": proposal["path"],
                        "old": proposal["old"],
                        "new": proposal["new"],
                    }
                )
                not in used
            ):
                return {
                    "tool": "patch",
                    "path": proposal["path"],
                    "old": proposal["old"],
                    "new": proposal["new"],
                }
        return None

    return choose
