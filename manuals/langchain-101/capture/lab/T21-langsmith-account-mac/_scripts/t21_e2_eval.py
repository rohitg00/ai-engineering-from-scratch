import asyncio
import json
import os
import sys
import time
import warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import t21_reqlog
from t21_reqlog import REQS, summary

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tracers.langchain import wait_for_all_tracers
from langsmith import Client, aevaluate, evaluate
from langsmith.run_trees import get_cached_client

from t21_agent import QUESTIONS, ask, make_agent, make_llm
from t21_common import PREFIX, T21, env_snapshot, scrub

DS = PREFIX + "arith-10"
AGENT = make_agent()
JUDGE = ChatPromptTemplate.from_messages([
    ("system", "You grade a calculator. Reply with exactly one word: CORRECT or WRONG."),
    ("human", "Question: {q}\nReference answer: {ref}\nCalculator answer: {ans}"),
]) | make_llm() | StrOutputParser()


def target(inputs):
    ans, _ = ask(AGENT, inputs["question"])
    return {"answer": ans}


async def atarget(inputs):
    out = await AGENT.ainvoke({"messages": [{"role": "user", "content": inputs["question"]}]})
    return {"answer": out["messages"][-1].content}


def exact(outputs, reference_outputs):
    return {"key": "exact", "score": int(outputs["answer"].strip() == reference_outputs["answer"])}


def judge(inputs, outputs, reference_outputs):
    raw = JUDGE.invoke({"q": inputs["question"], "ref": reference_outputs["answer"], "ans": outputs["answer"]})
    return {"key": "judge", "score": int(raw.strip().upper().startswith("CORRECT")), "comment": raw[:80]}


def setup():
    c = Client()
    if c.has_dataset(dataset_name=DS):
        ds = c.read_dataset(dataset_name=DS)
    else:
        ds = c.create_dataset(DS, description="aiefs langchain-101 T21: synthetic addition questions")
        c.create_examples(dataset_id=ds.id, inputs=[{"question": q} for q, _ in QUESTIONS], outputs=[{"answer": str(a)} for _, a in QUESTIONS])
    ex = list(c.list_examples(dataset_id=ds.id))
    print(json.dumps({"dataset": DS, "id": str(ds.id), "n_examples": len(ex)}))
    return ds


def rows_of(res):
    rows = []
    for r in res:
        rows.append({"example_id": str(r["example"].id), "target_run_id": str(r["run"].id), "target_run_name": r["run"].name,
                     "answer": (r["run"].outputs or {}).get("answer"),
                     "scores": {e.key: e.score for e in r["evaluation_results"]["results"]},
                     "judge_comment": next((e.comment for e in r["evaluation_results"]["results"] if e.key == "judge"), None)})
    return rows


def inspect(c, exp_name, rows, wait_s):
    time.sleep(wait_s)
    info = {"experiment_name": exp_name}
    try:
        p = c.read_project(project_name=exp_name, include_stats=True)
        info["project"] = {"id": str(p.id), "reference_dataset_id": str(p.reference_dataset_id) if p.reference_dataset_id else None,
                           "run_count": p.run_count, "start_time": str(p.start_time), "end_time": str(p.end_time),
                           "feedback_stats": p.feedback_stats, "metadata": (p.extra or {}).get("metadata")}
        runs = list(c.list_runs(project_name=exp_name))
        by = {}
        for r in runs:
            k = f"{r.run_type}:{r.name}:{'child' if r.parent_run_id else 'root'}"
            by[k] = by.get(k, 0) + 1
        info["runs_by_type"] = by
        info["n_runs"] = len(runs)
        roots = [r for r in runs if not r.parent_run_id]
        fb = list(c.list_feedback(run_ids=[r.id for r in roots]))
        info["feedback"] = {"n": len(fb), "keys": sorted({f.key for f in fb}),
                            "source_types": sorted({str((f.feedback_source or {}).get("type") if isinstance(f.feedback_source, dict) else getattr(f.feedback_source, "type", None)) for f in fb})}
        info["roots_reference_example"] = sum(1 for r in roots if r.reference_example_id)
    except Exception as e:
        info["project_error"] = f"{type(e).__name__}: {str(e)[:300]}"
    orphan = []
    for row in rows[:3]:
        d = {"target_run_id": row["target_run_id"]}
        try:
            c.read_run(row["target_run_id"])
            d["target_run_readable"] = True
        except Exception as e:
            d["target_run_readable"] = False
            d["error"] = type(e).__name__
        orphan.append(d)
    info["target_run_check"] = orphan
    return info


def find_children(c, parent_ids):
    out = []
    for proj in c.list_projects(name_contains=PREFIX):
        for r in c.list_runs(project_id=proj.id, filter='eq(name, "LangGraph")'):
            if str(r.parent_run_id) in parent_ids:
                out.append({"project": proj.name, "run_id": str(r.id), "name": r.name, "parent_run_id": str(r.parent_run_id),
                            "trace_id": str(r.trace_id), "is_root_field": getattr(r, "is_root", None)})
    return out


def run(mode, out_name):
    c = Client()
    projects_before = sorted(p.name for p in c.list_projects(name_contains=PREFIX))
    t = time.perf_counter()
    if mode == "true":
        res = evaluate(target, data=DS, evaluators=[exact, judge], experiment_prefix=PREFIX + "eval-true", upload_results=True,
                       metadata={"model": "qwen3:4b-instruct-2507-q4_K_M"})
    elif mode == "false":
        res = evaluate(target, data=DS, evaluators=[exact, judge], experiment_prefix=PREFIX + "eval-false", upload_results=False)
    else:
        res = asyncio.run(_arun())
    rows = rows_of(res) if mode != "async" else res[1]
    exp_name = res.experiment_name if mode != "async" else res[0]
    eval_s = time.perf_counter() - t
    nreq_eval = len(REQS)
    wait_for_all_tracers()
    get_cached_client().flush()
    info = inspect(c, exp_name, rows, 25)
    projects_after = sorted(p.name for p in c.list_projects(name_contains=PREFIX))
    new_projects = [p for p in projects_after if p not in projects_before]
    children = find_children(c, {r["target_run_id"] for r in rows}) if mode == "false" else None
    rec = {"env": env_snapshot(), "mode": mode, "n_examples": len(rows), "eval_s": round(eval_s, 2), "rows": rows, "inspect": info,
           "new_projects": new_projects, "langgraph_children_of_unsent_target": children,
           "requests_summary": summary(), "requests_during_eval": nreq_eval, "requests": list(REQS)}
    with open(T21 / out_name, "w") as f:
        f.write(scrub(json.dumps(rec, default=str)) + "\n")
    print(scrub(json.dumps({k: rec[k] for k in ("mode", "n_examples", "eval_s", "new_projects", "requests_summary")}, default=str)))
    print(scrub(json.dumps(info, default=str))[:2500])
    if children is not None:
        print(json.dumps(children)[:1500])


async def _arun():
    res = await aevaluate(atarget, data=DS, evaluators=[exact, judge], experiment_prefix=PREFIX + "aeval", max_concurrency=2, upload_results=True)
    rows = []
    async for r in res:
        rows.append({"example_id": str(r["example"].id), "target_run_id": str(r["run"].id), "target_run_name": r["run"].name,
                     "answer": (r["run"].outputs or {}).get("answer"), "scores": {e.key: e.score for e in r["evaluation_results"]["results"]}})
    return res.experiment_name, rows


if __name__ == "__main__":
    if sys.argv[1] == "setup":
        setup()
    else:
        run(sys.argv[1], sys.argv[2])
