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
import re
import tempfile
import time
from importlib import metadata

HERE = os.path.dirname(os.path.realpath(__file__))
OUT = os.path.join(HERE, "out")
sys.path.insert(0, HERE)
MODEL_NAME = "qwen3:4b-instruct-2507-q4_K_M"
EMBED_NAME = "nomic-embed-text"


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
    import s_draw
    import s_graph
    import s_integrations
    import s_middleware
    import s_persist
    import s_start
    import s_stream
    listed = [*s_start.SCENARIOS, *s_agents.SCENARIOS, *s_middleware.SCENARIOS, *s_stream.SCENARIOS, *s_persist.SCENARIOS, *s_graph.SCENARIOS, *s_integrations.SCENARIOS,
              *s_start.LATE, *s_persist.LATE, *s_graph.LATE, *s_integrations.LATE, *s_draw.LATE]
    return [(f"{index:02d}-{slug}", title, fn, needs_model) for index, (slug, title, fn, needs_model) in enumerate(listed)]


def recorded_line():
    import datetime
    import common
    version = common.ollama_version() or "unknown"
    machine = os.environ.get("LC101_MACHINE", "an unnamed machine")
    day = datetime.datetime.now(datetime.timezone.utc).date().isoformat()

    def line():
        models = ", ".join(sorted(common.USED | common.EMBEDDED)) or "no model call"
        text = f"Recorded on {day} on {machine} with Ollama {version} on CPU. Models: {models}."
        if common.USED:
            text += f" ChatOllama settings: temperature 0, seed {common.SEED}, num_ctx {common.NUM_CTX}, num_predict {common.NUM_PREDICT}."
        if common.EMBEDDED:
            text += " OllamaEmbeddings settings: none beyond the model name."
        return text

    return line


def capture(out_dir, only=None, with_model=True, without_model=True):
    from record import Capture
    import common
    guard_network()
    os.makedirs(out_dir, exist_ok=True)
    line = recorded_line() if with_model else None
    written = []
    failed = []
    for stem, title, fn, needs_model in scenarios():
        if only and not any(stem.startswith(prefix) or stem[3:].startswith(prefix) for prefix in only):
            continue
        if (needs_model and not with_model) or (not needs_model and not without_model):
            continue
        cap = Capture(out_dir, stem, title)
        common.USED.clear()
        common.EMBEDDED.clear()
        started = time.monotonic()
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
        if needs_model:
            cap.recorded = line()
            print(f"recorded {stem} in {time.monotonic() - started:.0f} s", file=sys.stderr, flush=True)
        written.extend(cap.finish())
    return written, failed


RECORDED = re.compile(r"^Recorded on \d{4}-\d{2}-\d{2} on .+ with Ollama \S+ on CPU\. Models: [^.]+(?:\.[^ .][^.]*)*\.(?: ChatOllama settings: temperature 0, seed \d+, num_ctx \d+, num_predict \d+\.)?(?: OllamaEmbeddings settings: none beyond the model name\.)?$", re.M)
SETTINGS = ("ChatOllama settings:", "OllamaEmbeddings settings:")


SIDECARS = {"25-stream-events-v3": ".events.json"}


def structure(folder, stems):
    from expect import EXPECT
    problems = []
    for stem in stems:
        path = os.path.join(folder, f"{stem}.txt")
        if not os.path.exists(path):
            problems.append(f"{stem}.txt: missing")
            continue
        sidecar = SIDECARS.get(stem)
        if sidecar and not os.path.exists(os.path.join(folder, stem + sidecar)):
            problems.append(f"{stem}{sidecar}: missing")
        with open(path, encoding="utf-8") as handle:
            body = handle.read()
        found = RECORDED.search(body)
        if not found or not any(name in found.group(0) for name in SETTINGS):
            problems.append(f"{stem}.txt: no 'Recorded on ...' line with the model and its settings")
        for bad in ("SCENARIO FAILED", "network attempts blocked"):
            if bad in body:
                problems.append(f"{stem}.txt: contains {bad!r}")
        for needle in EXPECT.get(stem[3:], []):
            if needle not in body:
                problems.append(f"{stem}.txt: expected {needle!r}")
    return problems


def check(live):
    listed = scenarios()
    free = [stem for stem, _, _, needs_model in listed if not needs_model]
    recorded = [stem for stem, _, _, needs_model in listed if needs_model]
    drift = []
    with tempfile.TemporaryDirectory(prefix="lc101-check-") as fresh:
        written, failed = capture(fresh, with_model=False)
        for name in sorted(written):
            old_path, new_path = os.path.join(OUT, name), os.path.join(fresh, name)
            if not os.path.exists(old_path):
                drift.append(f"{name}: new in the fresh run, missing in out/")
                continue
            with open(old_path, encoding="utf-8") as a, open(new_path, encoding="utf-8") as b:
                old, new = a.read(), b.read()
            if old != new:
                diff = difflib.unified_diff(old.splitlines(keepends=True), new.splitlines(keepends=True), f"out/{name}", f"fresh/{name}")
                drift.append("".join(list(diff)[:80]))
    if failed:
        drift.append("model-free scenarios that raised: " + ", ".join(failed))
    known = set(written) | {f"{stem}.txt" for stem in recorded}
    sidecars = {n for n in os.listdir(OUT) if any(n.startswith(stem + ".") for stem in recorded)}
    for name in sorted(n for n in os.listdir(OUT) if not n.startswith(".")):
        if name not in known and name not in sidecars:
            drift.append(f"{name}: in out/, written by no scenario")
    drift.extend(structure(OUT, recorded))
    if live:
        with tempfile.TemporaryDirectory(prefix="lc101-live-") as fresh:
            _, failed = capture(fresh, without_model=False)
            drift.extend(f"live: {p}" for p in structure(fresh, recorded))
    if drift:
        print("\n".join(drift))
        print(f"drift: {len(drift)} problems")
        return 1
    print(f"ok: {len(written)} model-free files match")
    print(f"ok: {len(recorded)} recorded files have their model line and expected structure")
    if live:
        print(f"ok: {len(recorded)} recorded scenarios ran again against Ollama and kept that structure")
    else:
        print(f"skipped: running the {len(recorded)} recorded scenarios again needs Ollama with {MODEL_NAME} and {EMBED_NAME}; run.py --check --live does it")
    return 0


def pinned_python():
    for candidate in (os.environ.get("LANGCHAIN101_PYTHON"), os.path.join(HERE, ".venv", "bin", "python")):
        if candidate and os.path.exists(candidate) and os.path.abspath(candidate) != os.path.abspath(sys.executable):
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
    only = [a for a in args if not a.startswith("-")]
    import labsum
    if "--check" in args:
        drift = labsum.check()
        if drift:
            print("\n".join(drift))
            print(f"drift: {len(drift)} lab summaries differ from capture/lab/")
            return 1
        print(f"ok: {len(labsum.SUMMARIES)} lab summaries, {len(labsum.prodapp_outputs())} production app summaries, and {len(labsum.chat_ui_outputs())} chat UI summaries match capture/lab/")
        print("skipped: recording the lab runs again, which needs Ollama and Postgres on the Mac and on an x86 server guest")
    elif not only:
        labsum.write(labsum.SUMMARY)
        labsum.write_prodapp()
        labsum.write_chat_ui()
    if wrong:
        shown = wrong[:3] + ([f"and {len(wrong) - 3} more"] if len(wrong) > 3 else [])
        print("skipped: the installed packages do not match capture/requirements.txt (" + "; ".join(shown) + "). Create capture/.venv from requirements.txt with Python 3.13, or set LANGCHAIN101_PYTHON.")
        return 0 if "--check" in args else 1
    if "--check" in args:
        return check("--live" in args)
    with_model = "--model-free" not in args
    if with_model:
        import common
        if common.ollama_version() is None:
            print(f"no Ollama at {common.OLLAMA_URL}; set LC101_OLLAMA_URL, or run with --model-free to write only the model-free files")
            return 1
    written, failed = capture(OUT, only, with_model=with_model)
    print(f"wrote {len(written)} files to {OUT}")
    if failed:
        print("scenarios that raised: " + ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
