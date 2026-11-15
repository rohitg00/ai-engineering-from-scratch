import json, os, sys, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from langsmith import Client
from t21_common import T21, scrub, env_snapshot
c = Client()
projects = []
total = 0
for p in c.list_projects():
    n = sum(1 for _ in c.list_runs(project_id=p.id))
    total += n
    projects.append({"name": p.name, "id": str(p.id), "n_runs": n, "experiment": bool(p.reference_dataset_id)})
datasets = [{"name": d.name, "id": str(d.id), "examples": d.example_count} for d in c.list_datasets()]
prompts = [{"handle": r.repo_handle, "commits": r.num_commits, "public": r.is_public} for r in c.list_prompts(is_public=False).repos]
out = {"env": env_snapshot(), "projects": projects, "total_runs_stored": total, "datasets": datasets, "prompts": prompts}
open(T21 / sys.argv[1], "w").write(scrub(json.dumps(out, default=str, indent=1)) + "\n")
print(json.dumps(out, default=str)[:4000])
