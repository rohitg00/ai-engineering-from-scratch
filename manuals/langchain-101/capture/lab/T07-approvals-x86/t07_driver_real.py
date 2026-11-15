import argparse
import json
import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lr_common import header, jl

OUT = Path(__file__).resolve().parent
CHILD = str(OUT / "t07_child_real.py")
PY = sys.executable

AP = {"type": "approve"}
RJ = {"type": "reject", "message": "not allowed"}
RS = {"type": "respond", "message": "I did it by hand"}

PROMPTS = {
    "single": ["Send an email to a@x. Use the send_email tool once and do nothing else.",
               "Email a@x now with the send_email tool.",
               "Please call send_email with to='a@x'."],
    "parallel": ["In one turn, call send_email with to='a@x' and delete_file with path='/tmp/f' at the same time.",
                 "Do both now, as two parallel tool calls in one reply: send an email to a@x and delete the file /tmp/f.",
                 "Call two tools at once in a single message: send_email(to='a@x') and delete_file(path='/tmp/f')."],
}
WANT = {"single": ["send_email"], "parallel": ["delete_file", "send_email"]}


def ED(name, args):
    return {"type": "edit", "edited_action": {"name": name, "args": args}}


CASES = {
    "B1_single_approve": dict(app="agent", mode="batched", calls="single", steps=[{"decisions": [AP]}]),
    "B2_single_edit_args": dict(app="agent", mode="batched", calls="single", steps=[{"decisions": [ED("send_email", {"to": "b@x"})]}]),
    "B3_single_edit_switch_tool": dict(app="agent", mode="batched", calls="single", steps=[{"decisions": [ED("delete_file", {"path": "/tmp/g"})]}]),
    "B4_single_reject": dict(app="agent", mode="batched", calls="single", steps=[{"decisions": [RJ]}]),
    "B5_single_respond": dict(app="agent", mode="batched", calls="single", steps=[{"decisions": [RS]}]),
    "B6_parallel_approve_both": dict(app="agent", mode="batched", calls="parallel", steps=[{"decisions": [AP, AP]}]),
    "B7_parallel_approve_reject": dict(app="agent", mode="batched", calls="parallel", steps=[{"decisions": [AP, RJ]}]),
    "B8_parallel_edit_approve": dict(app="agent", mode="batched", calls="parallel", steps=[{"decisions": [ED("send_email", {"to": "b@x"}), AP]}]),
    "B9_parallel_one_decision_for_two": dict(app="agent", mode="batched", calls="parallel", steps=[{"decisions": [AP]}]),
    "P1_single_approve": dict(app="agent", mode="per_call", calls="single", steps=[{"by": {"send_email": AP}}]),
    "P2_single_edit_args": dict(app="agent", mode="per_call", calls="single", steps=[{"by": {"send_email": ED("send_email", {"to": "b@x"})}}]),
    "P3_single_edit_switch_tool": dict(app="agent", mode="per_call", calls="single", steps=[{"by": {"send_email": ED("delete_file", {"path": "/tmp/g"})}}]),
    "P4_single_reject": dict(app="agent", mode="per_call", calls="single", steps=[{"by": {"send_email": RJ}}]),
    "P5_single_respond": dict(app="agent", mode="per_call", calls="single", steps=[{"by": {"send_email": RS}}]),
    "P6_parallel_answer_both_at_once": dict(app="agent", mode="per_call", calls="parallel", steps=[{"by": {"send_email": AP, "delete_file": RJ}}]),
    "P7_parallel_answer_one_then_other": dict(app="agent", mode="per_call", calls="parallel", steps=[{"by": {"send_email": AP}}, {"by": {"delete_file": AP}}]),
    "P8_parallel_plain_value_two_pending": dict(app="agent", mode="per_call", calls="parallel", steps=[{"plain": AP}]),
    "J1_batched_jumper_after_hitl_in_list_approve": dict(app="agent", mode="batched", calls="single", jumper="after_hitl_in_list", steps=[{"decisions": [AP]}]),
    "J2_batched_jumper_before_hitl_in_list_reject": dict(app="agent", mode="batched", calls="single", jumper="before_hitl_in_list", steps=[{"decisions": [RJ]}]),
    "J3_batched_jumper_after_hitl_in_list_reject": dict(app="agent", mode="batched", calls="single", jumper="after_hitl_in_list", steps=[{"decisions": [RJ]}]),
    "J4_per_call_jumper_after_hitl_in_list_reject": dict(app="agent", mode="per_call", calls="single", jumper="after_hitl_in_list", steps=[{"by": {"send_email": RJ}}]),
    "J5_per_call_jumper_before_hitl_in_list_reject": dict(app="agent", mode="per_call", calls="single", jumper="before_hitl_in_list", steps=[{"by": {"send_email": RJ}}]),
    "G3_agent_in_subgraph_per_call_resume_one_then_other": dict(app="agent_in_subgraph", calls="parallel", steps=[{"by": {"send_email": AP}}, {"by": {"delete_file": AP}}]),
    "S1_strict_stale_answer": dict(app="agent", mode="per_call", calls="parallel", strict=True, steps=[{"by": {"send_email": AP}}, {"stale": 0}]),
    "S2_nonstrict_stale_answer": dict(app="agent", mode="per_call", calls="parallel", steps=[{"by": {"send_email": AP}}, {"stale": 0}]),
}


def read_jsonl(p):
    p = Path(p)
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()] if p.exists() else []


def key_of(it):
    v = it["value"]
    if isinstance(v, dict):
        return v.get("name") or (v.get("action_requests") and "batched")
    return None


def first_ai_calls(report):
    for m in report.get("messages", []):
        if m[0] == "ai" and m[3]:
            return [t[0] for t in m[3]]
    return []


def run_case(name, spec, rep):
    sinkdir = OUT / "sinks"
    sinkdir.mkdir(exist_ok=True)
    attempts = []
    for k, prompt in enumerate(PROMPTS[spec["calls"]]):
        tmp = Path(tempfile.mkdtemp(prefix="t07r-"))
        sink = sinkdir / f"{name}__{rep}__a{k}.jsonl"
        if sink.exists():
            sink.unlink()
        thread = f"{name}-{rep}-{k}-{uuid.uuid4().hex[:6]}"
        base = [PY, "-W", "ignore", CHILD, "--app", spec["app"], "--mode", spec.get("mode", "per_call"),
                "--jumper", spec.get("jumper", "none"), "--db", str(tmp / "cp.sqlite"), "--sink", str(sink), "--thread", thread]
        if spec.get("strict"):
            base.append("--strict")
        reports = []

        def call(phase, step, resume=None):
            cmd = base + ["--phase", phase, "--step", str(step)] + (["--prompt", prompt] if phase == "start" else [])
            if resume is not None:
                cmd += ["--resume", json.dumps(resume)]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            line = [l for l in r.stdout.splitlines() if l.startswith("REPORT")]
            rep_ = json.loads(line[0][7:]) if line else {"crash": r.stderr[-800:]}
            rep_["resume_sent"] = resume
            reports.append(rep_)
            return rep_

        last = call("start", 0)
        calls = first_ai_calls(last) or [it["value"].get("name") for it in (last.get("pending_interrupts") or []) if isinstance(it["value"], dict) and it["value"].get("name")]
        shape_ok = sorted(calls) == WANT[spec["calls"]]
        attempts.append({"prompt_index": k, "first_ai_calls": calls, "shape_ok": shape_ok})
        if not shape_ok:
            continue
        sent = []
        reordered = False
        for i, st in enumerate(spec["steps"], start=1):
            pending = last.get("pending_interrupts") or last.get("interrupts") or []
            if "decisions" in st:
                decs = list(st["decisions"])
                reqs = [a["name"] for it in pending for a in (it["value"].get("action_requests") or [])] if pending else []
                if len(decs) == 2 and reqs[:1] == ["delete_file"]:
                    decs = decs[::-1]
                    reordered = True
                resume = {"decisions": decs}
            elif "plain" in st:
                resume = st["plain"]
            elif "stale" in st:
                resume = sent[st["stale"]]
            else:
                resume = {}
                for it in pending:
                    kk = key_of(it)
                    if kk in st["by"]:
                        resume[it["id"]] = st["by"][kk]
            sent.append(resume)
            last = call("resume", i, resume)
        events = read_jsonl(sink)
        return {"case": name, "rep": rep, "spec": spec, "attempts": attempts, "prompt": prompt, "decisions_reordered": reordered,
                "reports": reports, "events": events,
                "tool_execs": [[e["tool"], e["args"], e["step"]] for e in events if e["kind"] == "tool_exec"],
                "model_calls": sum(1 for e in events if e["kind"] == "model_call"),
                "jumper_fired": sum(1 for e in events if e["kind"] == "jumper")}
    return {"case": name, "rep": rep, "spec": spec, "attempts": attempts, "shape_never_matched": True}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--reps", type=int, default=3)
    p.add_argument("--only", default="")
    p.add_argument("--out", default="01-cases.jsonl")
    a = p.parse_args()
    names = [n for n in CASES if not a.only or n in a.only.split(",")]
    jl(OUT / a.out, header("t07_driver_real.py", prompts=PROMPTS))
    for rep in range(a.reps):
        for n in names:
            r = run_case(n, CASES[n], rep)
            jl(OUT / a.out, r)
            errs = [x.get("error") or x.get("crash") for x in r.get("reports", []) if not x.get("ok", True) or x.get("crash")]
            print(n, rep, "attempts", [(x["prompt_index"], x["first_ai_calls"]) for x in r["attempts"]], "tool_execs", r.get("tool_execs"),
                  "model_calls", r.get("model_calls"), "errors", [e[:120] for e in errs if e], flush=True)


if __name__ == "__main__":
    main()
