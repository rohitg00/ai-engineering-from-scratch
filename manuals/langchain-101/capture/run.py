import os
import sys

for key in list(os.environ):
    if key.startswith(("LANGSMITH_", "LANGCHAIN_", "LANGGRAPH_", "OPENAI_", "ANTHROPIC_", "LC_")) or key in ("OLLAMA_HOST",):
        del os.environ[key]
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["OLLAMA_HOST"] = "http://127.0.0.1:9"
os.environ["TZ"] = "UTC"
if os.environ.get("PYTHONHASHSEED") != "0":
    os.environ["PYTHONHASHSEED"] = "0"
    os.execv(sys.executable, [sys.executable, *sys.argv])

import difflib
import shutil
import tempfile
from importlib import metadata

HERE = os.path.dirname(os.path.realpath(__file__))
OUT = os.path.join(HERE, "out")
sys.path.insert(0, HERE)


def pins():
    wanted = {}
    with open(os.path.join(HERE, "requirements.txt"), encoding="utf-8") as handle:
        for line in handle:
            line = line.split("#")[0].strip()
            if "==" in line:
                name, version = line.split("==")
                wanted[name.strip()] = version.strip()
    wrong = []
    if sys.version_info[:2] != (3, 13):
        wrong.append(f"python {sys.version_info[0]}.{sys.version_info[1]} (the captures were made with 3.13)")
    for name, version in wanted.items():
        try:
            found = metadata.version(name)
        except metadata.PackageNotFoundError:
            found = "missing"
        if found != version:
            wrong.append(f"{name} {found} (pinned {version})")
    return wrong


BLOCKED = []


def guard_network():
    import socket
    real = socket.getaddrinfo

    def local_only(host, *args, **kwargs):
        if host in ("localhost", "127.0.0.1", "::1", None):
            return real(host, *args, **kwargs)
        BLOCKED.append(host)
        raise OSError(f"capture kit: network blocked for {host}")

    socket.getaddrinfo = local_only


def scenarios():
    import s_agents
    import s_graph
    import s_integrations
    import s_middleware
    import s_persist
    import s_start
    import s_stream
    listed = [*s_start.SCENARIOS, *s_agents.SCENARIOS, *s_middleware.SCENARIOS, *s_stream.SCENARIOS, *s_persist.SCENARIOS, *s_graph.SCENARIOS, *s_integrations.SCENARIOS]
    return [(f"{index:02d}-{slug}", title, fn) for index, (slug, title, fn) in enumerate(listed)]


def capture(out_dir, only=None):
    from record import Capture
    guard_network()
    os.makedirs(out_dir, exist_ok=True)
    written = []
    failed = []
    for stem, title, fn in scenarios():
        if only and not any(stem.startswith(prefix) or stem[3:].startswith(prefix) for prefix in only):
            continue
        cap = Capture(out_dir, stem, title)
        try:
            with cap.warnings():
                fn(cap)
        except Exception as exc:
            cap.text("SCENARIO FAILED")
            cap.error(exc, frames=True)
            failed.append(stem)
        if BLOCKED:
            cap.text("network attempts blocked: " + ", ".join(sorted(set(BLOCKED))))
            BLOCKED.clear()
        written.extend(cap.finish())
    return written, failed


def check():
    with tempfile.TemporaryDirectory(prefix="lc101-check-") as fresh:
        written, failed = capture(fresh)
        names = sorted(set(written) | {n for n in os.listdir(OUT) if not n.startswith(".")})
        drift = []
        for name in names:
            old_path, new_path = os.path.join(OUT, name), os.path.join(fresh, name)
            if not os.path.exists(old_path):
                drift.append(f"{name}: new in the fresh run, missing in out/")
                continue
            if not os.path.exists(new_path):
                drift.append(f"{name}: in out/, missing in the fresh run")
                continue
            with open(old_path, encoding="utf-8") as a, open(new_path, encoding="utf-8") as b:
                old, new = a.read(), b.read()
            if old != new:
                diff = difflib.unified_diff(old.splitlines(keepends=True), new.splitlines(keepends=True), f"out/{name}", f"fresh/{name}")
                drift.append("".join(list(diff)[:80]))
    if failed:
        drift.append("scenarios that raised: " + ", ".join(failed))
    if drift:
        print("\n".join(drift))
        print(f"drift: {len(drift)} of {len(names)} files differ")
        return 1
    print(f"ok: {len(names)} files match")
    return 0


def pinned_python():
    for candidate in (os.environ.get("LANGCHAIN101_PYTHON"), os.path.join(HERE, ".venv", "bin", "python")):
        if candidate and os.path.exists(candidate) and os.path.realpath(candidate) != os.path.realpath(sys.executable):
            return candidate
    return None


def main():
    args = sys.argv[1:]
    wrong = pins()
    if wrong and not os.environ.get("LANGCHAIN101_REEXEC"):
        other = pinned_python()
        if other:
            os.environ["LANGCHAIN101_REEXEC"] = "1"
            os.execv(other, [other, os.path.realpath(__file__), *args])
    if wrong:
        shown = wrong[:3] + ([f"and {len(wrong) - 3} more"] if len(wrong) > 3 else [])
        print("skipped: the installed packages do not match capture/requirements.txt (" + "; ".join(shown) + "). Create capture/.venv from requirements.txt with Python 3.13, or set LANGCHAIN101_PYTHON.")
        return 0 if "--check" in args else 1
    if "--check" in args:
        return check()
    only = [a for a in args if not a.startswith("-")]
    if not only:
        shutil.rmtree(OUT, ignore_errors=True)
    written, failed = capture(OUT, only)
    print(f"wrote {len(written)} files to {OUT}")
    if failed:
        print("scenarios that raised: " + ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
