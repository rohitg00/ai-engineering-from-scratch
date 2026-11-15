import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import t21_reqlog
from t21_reqlog import REQS, summary
from langsmith import Client
from t21_common import PREFIX, T21, scrub
NAME = PREFIX + "calc-prompt"
FULL = "b67a55362d28fd4e84902eadb60e90a31f6903b9260faccd2c30bc8b174b831f"
c = Client()
out = []
for label, ident in [("full_hash_v1", f"{NAME}:{FULL}"), ("full_hash_v1_again", f"{NAME}:{FULL}"), ("tag_v1_again", f"{NAME}:v1")]:
    n0 = len(REQS); t = time.perf_counter()
    p = c.pull_prompt(ident)
    out.append({"step": label, "secs": round(time.perf_counter() - t, 3), "http_requests": len(REQS) - n0, "system": p.messages[0].prompt.template})
    print(json.dumps(out[-1]))
open(T21 / sys.argv[1], "w").write(scrub(json.dumps({"log": out, "requests_summary": summary()})) + "\n")
