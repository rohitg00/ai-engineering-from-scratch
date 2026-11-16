import os
import json
import time
from importlib.metadata import version
from pathlib import Path

from deepagents.backends import StoreBackend
from langgraph.store.memory import InMemoryStore
from langgraph.store.postgres import PostgresStore

OUT = Path(__file__).parent / "data"
OUT.mkdir(exist_ok=True)
PG = os.environ.get("LAB_PG_URL", "postgresql://localhost:5432/lc_sec_store")


def keys(items):
    return sorted(f"{'/'.join(i.namespace)}:{i.key}" for i in items)


def probes(store):
    rows = []

    def rec(name, setup, call, fn):
        try:
            got = fn()
        except Exception as e:
            got = f"{type(e).__name__}: {str(e)[:120]}"
        rows.append({"probe": name, "setup": setup, "call": call, "result": got})

    store.put(("users", "alice", "memories"), "locker", {"text": "alice locker code 4417"})
    store.put(("users", "bob", "memories"), "locker", {"text": "bob locker code 9022"})
    store.put(("users", "alice", "profile"), "email", {"text": "alice@example.org"})
    setup = "alice and bob each under ('users', <id>, 'memories')"
    rec("own namespace", setup, "search(('users','bob','memories'))", lambda: keys(store.search(("users", "bob", "memories"))))
    rec("prefix one level up", setup, "search(('users',))", lambda: keys(store.search(("users",))))
    rec("empty prefix", setup, "search(())", lambda: keys(store.search(())))
    rec("list_namespaces all", setup, "list_namespaces()", lambda: [list(n) for n in store.list_namespaces()])
    rec("list_namespaces prefix", setup, "list_namespaces(prefix=('users',))", lambda: [list(n) for n in store.list_namespaces(prefix=("users",))])
    rec("list_namespaces wildcard", setup, "list_namespaces(prefix=('users','*'))", lambda: [list(n) for n in store.list_namespaces(prefix=("users", "*"))])
    rec("list_namespaces wildcard suffix", setup, "list_namespaces(suffix=('memories',))", lambda: [list(n) for n in store.list_namespaces(suffix=("memories",))])
    rec("search wildcard in prefix", setup, "search(('users','*','memories'))", lambda: keys(store.search(("users", "*", "memories"))))
    rec("partial component", setup, "search(('users','ali'))", lambda: keys(store.search(("users", "ali"))))
    rec("get other user's key", setup, "get(('users','alice','memories'),'locker')", lambda: (store.get(("users", "alice", "memories"), "locker") or {}).value if store.get(("users", "alice", "memories"), "locker") else None)

    setup2 = "one-component namespace (user_id,), ids with dots"
    rec("put with dotted id", setup2, "put(('bob@acme.com',), ...)", lambda: store.put(("bob@acme.com",), "/notes.md", {"text": "pin 5530"}) or "stored")
    rec("put with dotted label", setup2, "put(('a.b',), 'k', ...)", lambda: store.put(("a.b",), "k", {"text": "x"}) or "stored")
    rec("dotted id prefix (bob@acme sees bob@acme.com?)", setup2, "search(('bob@acme',))", lambda: keys(store.search(("bob@acme",))))
    rec("dotted id collision get", setup2, "get(('a','b'),'k') after put(('a.b',),'k')", lambda: (store.get(("a", "b"), "k").value if store.get(("a", "b"), "k") else None))
    rec("dotted id collision search", setup2, "search(('a','b'))", lambda: keys(store.search(("a", "b"))))
    rec("dotted id list_namespaces", setup2, "list_namespaces(prefix=('a',))", lambda: [list(n) for n in store.list_namespaces(prefix=("a",))])
    return rows


def backend_probes(store):
    rows = []

    def rec(name, call, fn):
        try:
            got = fn()
        except Exception as e:
            got = f"{type(e).__name__}: {str(e)[:160]}"
        rows.append({"probe": name, "call": call, "result": got})

    rec("StoreBackend without namespace", "StoreBackend(store=s)", lambda: repr(StoreBackend(store=store)))
    rec("StoreBackend wildcard namespace", "StoreBackend(namespace=lambda _: ('*',)).ls('/')", lambda: StoreBackend(store=store, namespace=lambda _: ("*",)).ls("/"))
    victim = StoreBackend(store=store, namespace=lambda _: ("carol@acme.com",))
    rec("StoreBackend write with email id", "StoreBackend(namespace=lambda _: ('carol@acme.com',)).write(...)", lambda: str(victim.write("/payroll.md", "carol payroll pin 7781"))[:160])
    other = StoreBackend(store=store, namespace=lambda _: ("carol@acme",))
    rec("dotted id: ls('/') as carol@acme", "StoreBackend(namespace=lambda _: ('carol@acme',)).ls('/')", lambda: [e["path"] for e in (other.ls("/").entries or [])])
    rec("dotted id: grep('pin') as carol@acme", "....grep('pin', '/')", lambda: str(other.grep("pin", "/"))[:200])
    rec("dotted id: read('/payroll.md') as carol@acme", "....read('/payroll.md')", lambda: str(other.read("/payroll.md"))[:200])
    rec("dotted id: glob('**') as carol@acme", "....glob('**', '/')", lambda: str(other.glob("**", "/"))[:200])
    shared_a = StoreBackend(store=store, namespace=lambda _: ("memories",))
    shared_a.write("/dave.md", "dave allergy: penicillin")
    shared_b = StoreBackend(store=store, namespace=lambda _: ("memories",))
    rec("docs constant namespace ('memories',)", "user B read('/dave.md')", lambda: str(shared_b.read("/dave.md"))[:160])
    return rows


def main():
    res = {"meta": {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "langgraph": version("langgraph"), "langgraph-checkpoint-postgres": version("langgraph-checkpoint-postgres"),
                    "deepagents": version("deepagents"), "postgres_db": "lc_sec_store (PostgreSQL 14.21 on the Mac)", "model": "none (model-free)"}}
    res["InMemoryStore"] = {"store": probes(InMemoryStore()), "backend": backend_probes(InMemoryStore())}
    with PostgresStore.from_conn_string(PG) as s:
        s.setup()
        with s._cursor() as cur:
            cur.execute("DELETE FROM store")
        res["PostgresStore"] = {"store": probes(s)}
    with PostgresStore.from_conn_string(PG) as s:
        with s._cursor() as cur:
            cur.execute("DELETE FROM store")
        res["PostgresStore"]["backend"] = backend_probes(s)
    (OUT / "store6_free.json").write_text(json.dumps(res, indent=1, default=str))
    for sname in ("InMemoryStore", "PostgresStore"):
        for part in ("store", "backend"):
            for r in res[sname][part]:
                print(f"{sname:13} | {r['probe']:46} | {str(r['result'])[:170]}")


if __name__ == "__main__":
    main()
