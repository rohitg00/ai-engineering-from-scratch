import json

from checks import check
from env import BENCH, FAMILY_TOOLS, Env


def oracle(t, env):
    w = lambda n, **kw: env._wrap(n, getattr(env, n))(**kw)
    fam = t["family"]
    if fam == "chain":
        for r in t["required"]:
            if r["tool"] == "get_item_info":
                w("get_item_info", item=r["value"])
            else:
                w("get_shipping_rate", carrier="swiftpost", zone="domestic")
    if fam == "sql":
        w("sql_query", query=t["truth_sql"] or "SELECT 1")
    if fam == "retrieval":
        w("search_docs", query=t["turns"][0])
        w("read_doc", doc_id=t["support_doc"])
    if fam == "files":
        for p in list(env.fs_state()):
            if p not in t["fs_expected"]:
                w("fs_delete", path=p)
        for p, c in t["fs_expected"].items():
            w("fs_write", path=p, content=c)
    if fam == "multiturn":
        for k in list(env.kv):
            if k not in t["kv_expected"]:
                w("kv_delete", key=k)
        for k, v in t["kv_expected"].items():
            w("kv_set", key=k, value=v)
    if t.get("answer") is not None:
        w("submit_answer", answer=str(t["answer"]))


def main():
    tasks = [json.loads(l) for l in open(BENCH / "data" / "tasks.jsonl")]
    bad = []
    for t in tasks:
        allowed = set(FAMILY_TOOLS[t["family"]])
        e = Env(t)
        oracle(t, e)
        r = check(t, e, [], None, allowed)
        e.close()
        if not r["passed"] or not r["passed_strict"]:
            bad.append((t["id"], "oracle failed", r["checks"]))
        e = Env(t)
        r = check(t, e, [], None, allowed)
        e.close()
        if r["passed"]:
            bad.append((t["id"], "null agent passed", r["checks"]))
    print(f"{len(tasks)} tasks: oracle passes and null agent fails on all" if not bad else bad)


if __name__ == "__main__":
    main()
