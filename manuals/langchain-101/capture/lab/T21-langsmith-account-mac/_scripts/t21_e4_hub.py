import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import t21_reqlog
from t21_reqlog import REQS, summary

from langchain_core.prompts import ChatPromptTemplate
from langsmith import Client

from t21_common import PREFIX, T21, env_snapshot, scrub

NAME = PREFIX + "calc-prompt"


def step(log, label, fn):
    t = time.perf_counter()
    try:
        v = fn()
        log.append({"step": label, "ok": True, "secs": round(time.perf_counter() - t, 3), "value": v})
    except Exception as e:
        log.append({"step": label, "ok": False, "secs": round(time.perf_counter() - t, 3), "error": f"{type(e).__name__}: {str(e)[:400]}"})
    print(scrub(json.dumps(log[-1], default=str))[:600], flush=True)
    return log[-1].get("value")


def msgs(p):
    return [[type(m).__name__, getattr(getattr(m, "prompt", None), "template", None)] for m in p.messages]


def main(out_name):
    c = Client()
    log = []
    v1 = ChatPromptTemplate.from_messages([("system", "You are a calculator. Answer with the number only."), ("human", "{question}")])
    v2 = ChatPromptTemplate.from_messages([("system", "You are a calculator. Use the tools. Answer with the number only."), ("human", "{question}")])
    step(log, "exists_before", lambda: c._prompt_exists(NAME) if hasattr(c, "_prompt_exists") else None)
    url1 = step(log, "push_v1_tag_v1", lambda: c.push_prompt(NAME, object=v1, description="aiefs T21 synthetic prompt", commit_tags=["v1"]))
    url2 = step(log, "push_v2_tag_v2", lambda: c.push_prompt(NAME, object=v2, commit_tags=["v2"]))
    url3 = step(log, "push_v2_again_unchanged", lambda: c.push_prompt(NAME, object=v2))
    commits = step(log, "list_commits", lambda: [{"commit_hash": x.commit_hash, "parent": getattr(x, "parent_commit_hash", None)} for x in c.list_prompt_commits(NAME)])
    h1 = url1.rstrip("/").split("/")[-1] if isinstance(url1, str) else None
    step(log, "commit_hash_from_url_v1", lambda: h1)
    step(log, "pull_latest", lambda: msgs(c.pull_prompt(NAME)))
    step(log, "pull_by_hash_v1", lambda: msgs(c.pull_prompt(f"{NAME}:{h1}")))
    step(log, "pull_by_short_hash_v1", lambda: msgs(c.pull_prompt(f"{NAME}:{h1[:8]}")))
    step(log, "pull_by_tag_v1", lambda: msgs(c.pull_prompt(f"{NAME}:v1")))
    step(log, "pull_by_tag_v2", lambda: msgs(c.pull_prompt(f"{NAME}:v2")))
    step(log, "pull_by_missing_tag", lambda: msgs(c.pull_prompt(f"{NAME}:no-such-tag")))
    step(log, "pull_prompt_commit_v1_meta", lambda: {k: v for k, v in c.pull_prompt_commit(f"{NAME}:{h1}").dict().items() if k != "manifest"})
    step(log, "get_prompt", lambda: {k: v for k, v in c.get_prompt(NAME).dict().items() if k in ("repo_handle", "is_public", "num_commits", "last_commit_hash", "tags", "full_name", "owner")})
    with open(T21 / out_name, "w") as f:
        f.write(scrub(json.dumps({"env": env_snapshot(), "prompt": NAME, "log": log, "requests_summary": summary(), "requests": REQS}, default=str)) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
