import json, os, sys, warnings
from collections import Counter
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from langsmith import Client
from t21_common import T21, scrub
c = Client()
out = {}
try:
    p = c.read_project(project_name="aiefs-lc101-dev")
    runs = list(c.list_runs(project_id=p.id))
    out["n_runs"] = len(runs)
    out["by_type"] = dict(Counter(f"{r.run_type}:{r.name}:{'child' if r.parent_run_id else 'root'}" for r in runs))
    roots = [r for r in runs if not r.parent_run_id]
    out["root_metadata_keys"] = sorted({k for r in roots for k in ((r.extra or {}).get("metadata") or {})})
    out["root_metadata_sample"] = {k: v for k, v in ((roots[0].extra or {}).get("metadata") or {}).items() if k not in ("LANGSMITH_API_KEY",)} if roots else None
    out["root_tags"] = [r.tags for r in roots][:3]
    out["root_ids"] = [str(r.id) for r in roots]
    out["root_tokens"] = [r.total_tokens for r in roots]
except Exception as e:
    out["error"] = f"{type(e).__name__}: {str(e)[:300]}"
runs_file = [json.loads(l) for l in open(T21 / "07-e5-dev-runs.jsonl")]
out["server_run_ids_match_root_ids"] = sorted(r["server_run_id"] for r in runs_file) == sorted(out.get("root_ids", []))
open(T21 / sys.argv[1], "w").write(scrub(json.dumps(out, default=str, indent=1)) + "\n")
print(scrub(json.dumps(out, default=str))[:3000])
