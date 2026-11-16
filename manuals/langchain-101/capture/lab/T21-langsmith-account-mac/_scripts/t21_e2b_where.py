import json, os, sys, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from langsmith import Client
from t21_common import T21, scrub
c = Client()
d = json.load(open(T21 / "06-e2-false.json"))
targets = {r["target_run_id"] for r in d["rows"]}
out = {"projects": []}
for p in c.list_projects():
    runs = list(c.list_runs(project_id=p.id))
    by = {}
    for r in runs:
        k = f"{r.run_type}:{r.name}:{'child' if r.parent_run_id else 'root'}"
        by[k] = by.get(k, 0) + 1
    orphans = [{"name": r.name, "id": str(r.id), "parent_run_id": str(r.parent_run_id), "trace_id": str(r.trace_id),
                "parent_is_unsent_target": str(r.parent_run_id) in targets, "dotted_order_depth": (r.dotted_order or "").count(".")}
               for r in runs if r.parent_run_id and str(r.parent_run_id) in targets]
    out["projects"].append({"name": p.name, "id": str(p.id), "created": str(p.start_time), "reference_dataset_id": str(p.reference_dataset_id) if p.reference_dataset_id else None,
                            "n_runs": len(runs), "runs_by_type": by, "children_of_unsent_target": orphans[:3], "n_children_of_unsent_target": len(orphans)})
    if orphans:
        o = orphans[0]
        tr = list(c.list_runs(project_id=p.id, trace_id=o["trace_id"]))
        out["orphan_trace_runs"] = [{"name": r.name, "parent": str(r.parent_run_id) if r.parent_run_id else None, "is_trace_root": str(r.id) == o["trace_id"]} for r in tr]
        try:
            c.read_run(o["trace_id"]); out["trace_root_readable"] = True
        except Exception as e:
            out["trace_root_readable"] = type(e).__name__
        try:
            out["is_root_filter_count"] = len(list(c.list_runs(project_id=p.id, is_root=True)))
        except Exception as e:
            out["is_root_filter_count"] = type(e).__name__
open(T21 / sys.argv[1], "w").write(scrub(json.dumps(out, default=str, indent=1)) + "\n")
for p in out["projects"]:
    print(p["name"], p["n_runs"], p["reference_dataset_id"] is not None, p["n_children_of_unsent_target"], json.dumps(p["runs_by_type"])[:300])
for k in ("orphan_trace_runs", "trace_root_readable", "is_root_filter_count"):
    print(k, json.dumps(out.get(k))[:800])
