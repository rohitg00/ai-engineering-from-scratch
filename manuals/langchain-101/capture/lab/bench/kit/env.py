import ast
import hashlib
import json
import operator
import os
import re
import shutil
import sqlite3
import tempfile
import time
from pathlib import Path

from langchain_core.tools import StructuredTool

from corpus import DOCS

BENCH = Path(__file__).resolve().parent.parent
DB_PATH = BENCH / "data" / "shop.db"

CATALOG = {
    "trail lantern": {"price": 42.50, "currency": "EUR", "weight": 1.8, "weight_unit": "lb"},
    "camp stove": {"price": 89.00, "currency": "USD", "weight": 2.4, "weight_unit": "kg"},
    "rain shell": {"price": 120.00, "currency": "GBP", "weight": 14.0, "weight_unit": "oz"},
    "water filter": {"price": 6400, "currency": "JPY", "weight": 350, "weight_unit": "g"},
    "folding chair": {"price": 55.90, "currency": "CHF", "weight": 3.1, "weight_unit": "kg"},
    "sleeping pad": {"price": 74.00, "currency": "EUR", "weight": 1.2, "weight_unit": "lb"},
    "trekking poles": {"price": 98.00, "currency": "USD", "weight": 540, "weight_unit": "g"},
    "dry bag": {"price": 19.50, "currency": "GBP", "weight": 6.0, "weight_unit": "oz"},
    "headlamp": {"price": 4800, "currency": "JPY", "weight": 90, "weight_unit": "g"},
    "cook set": {"price": 63.20, "currency": "CHF", "weight": 2.2, "weight_unit": "lb"},
    "tent footprint": {"price": 38.00, "currency": "EUR", "weight": 0.9, "weight_unit": "kg"},
    "bear canister": {"price": 82.00, "currency": "USD", "weight": 2.6, "weight_unit": "lb"},
}

RATES_TO_EUR = {"EUR": 1.0, "USD": 0.92, "GBP": 1.17, "JPY": 0.0061, "CHF": 1.05}

SHIPPING = {
    ("swiftpost", "domestic"): (4.20, "EUR"),
    ("swiftpost", "international"): (11.80, "EUR"),
    ("cargolink", "domestic"): (3.10, "USD"),
    ("cargolink", "international"): (9.40, "USD"),
    ("royalfreight", "domestic"): (2.90, "GBP"),
    ("royalfreight", "international"): (8.75, "GBP"),
}

UNIT_FACTORS = {
    "mass": {"kg": 1.0, "g": 0.001, "lb": 0.45359237, "oz": 0.028349523125},
    "length": {"m": 1.0, "km": 1000.0, "mi": 1609.344, "ft": 0.3048, "cm": 0.01},
    "volume": {"l": 1.0, "ml": 0.001, "gal": 3.785411784},
}

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.USub: operator.neg, ast.UAdd: operator.pos, ast.Mod: operator.mod}


def rate(frm, to):
    return RATES_TO_EUR[frm] / RATES_TO_EUR[to]


def to_kg(value, unit):
    return value * UNIT_FACTORS["mass"][unit]


def safe_eval(expr):
    def ev(node):
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](ev(node.operand))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in ("round", "abs", "min", "max"):
            return {"round": round, "abs": abs, "min": min, "max": max}[node.func.id](*[ev(a) for a in node.args])
        raise ValueError("unsupported expression")
    return ev(ast.parse(expr.replace("^", "**"), mode="eval"))


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


STOP = set("the a an of in on at to is was what how many which who does do for and by it its are from per".split())


def search(query, k=3):
    q = [t for t in tokenize(query) if t not in STOP]
    scored = []
    for did, (title, body) in DOCS.items():
        words = tokenize(title + " " + body)
        tw = set(tokenize(title))
        s = sum(words.count(t) + 2 * (t in tw) for t in q)
        if s:
            scored.append((-s, did))
    scored.sort()
    return [d for _, d in scored[:k]]


def db_hash():
    return hashlib.sha256(DB_PATH.read_bytes()).hexdigest()


class Env:
    def __init__(self, task):
        self.task = task
        self.log = []
        self.answers = []
        self.kv = dict(task.get("kv_init", {}))
        self.tool_time = 0.0
        self.sandbox = None
        if task["family"] == "files":
            self.sandbox = Path(tempfile.mkdtemp(prefix="lcbench-fs-")).resolve()
            for rel, content in task["fs_init"].items():
                p = self.sandbox / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(content)
        self.db_hash_before = db_hash() if task["family"] == "sql" else None

    def close(self):
        if self.sandbox and self.sandbox.exists():
            shutil.rmtree(self.sandbox)

    def fs_state(self):
        out = {}
        for p in sorted(self.sandbox.rglob("*")):
            if p.is_file():
                out[str(p.relative_to(self.sandbox))] = p.read_text()
        return out

    def _resolve(self, path):
        p = (self.sandbox / path.lstrip("/")).resolve()
        if p != self.sandbox.resolve() and self.sandbox.resolve() not in p.parents:
            raise ValueError("path escapes the workspace")
        return p

    def _wrap(self, name, fn):
        def run(**kwargs):
            t0 = time.perf_counter()
            try:
                result = fn(**kwargs)
                ok = True
            except Exception as e:
                result = f"ERROR: {e}"
                ok = False
            dt = time.perf_counter() - t0
            self.tool_time += dt
            text = result if isinstance(result, str) else json.dumps(result)
            if ok and text.startswith("ERROR"):
                ok = False
            self.log.append({"tool": name, "args": kwargs, "ok": ok, "result": text[:400]})
            return text
        return run

    def submit_answer(self, answer: str) -> str:
        self.answers.append(str(answer))
        return "Answer recorded."

    def get_item_info(self, item: str):
        key = item.strip().lower()
        if key not in CATALOG:
            return f"ERROR: unknown item '{item}'. Known items: " + ", ".join(sorted(CATALOG))
        return {"item": key, **CATALOG[key]}

    def get_exchange_rate(self, from_currency: str, to_currency: str):
        f, t = from_currency.strip().upper(), to_currency.strip().upper()
        if f not in RATES_TO_EUR or t not in RATES_TO_EUR:
            return "ERROR: supported currencies are " + ", ".join(RATES_TO_EUR)
        return {"from": f, "to": t, "rate": round(rate(f, t), 6), "meaning": f"1 {f} = {round(rate(f, t), 6)} {t}"}

    def get_shipping_rate(self, carrier: str, zone: str):
        key = (carrier.strip().lower(), zone.strip().lower())
        if key not in SHIPPING:
            return "ERROR: carriers are swiftpost, cargolink, royalfreight; zones are domestic, international"
        price, cur = SHIPPING[key]
        return {"carrier": key[0], "zone": key[1], "price_per_kg": price, "currency": cur}

    def convert_units(self, value: float, from_unit: str, to_unit: str):
        f, t = from_unit.strip().lower(), to_unit.strip().lower()
        for dim in UNIT_FACTORS.values():
            if f in dim and t in dim:
                return {"value": round(float(value) * dim[f] / dim[t], 6), "unit": t}
        return "ERROR: units must share a dimension; supported: " + ", ".join(u for d in UNIT_FACTORS.values() for u in d)

    def calculator(self, expression: str):
        return {"expression": expression, "result": round(safe_eval(expression), 6)}

    def sql_list_tables(self):
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        rows = con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        con.close()
        return [r[0] for r in rows]

    def sql_describe(self, table: str):
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        row = con.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
        con.close()
        return row[0] if row else f"ERROR: no table '{table}'"

    def sql_query(self, query: str):
        if not re.match(r"^\s*(select|with)\b", query, re.I):
            return "ERROR: only read-only SELECT queries are allowed"
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        try:
            cur = con.execute(query)
            cols = [d[0] for d in cur.description]
            rows = cur.fetchmany(51)
        finally:
            con.close()
        more = len(rows) > 50
        return {"columns": cols, "rows": [list(r) for r in rows[:50]], "truncated": more}

    def search_docs(self, query: str):
        return [{"doc_id": d, "title": DOCS[d][0], "snippet": DOCS[d][1][:90] + "..."} for d in search(query)]

    def read_doc(self, doc_id: str):
        d = doc_id.strip()
        if d not in DOCS:
            return f"ERROR: no document '{doc_id}'"
        return {"doc_id": d, "title": DOCS[d][0], "text": DOCS[d][1]}

    def fs_list(self, path: str = "."):
        p = self._resolve(path)
        if not p.is_dir():
            return f"ERROR: '{path}' is not a directory"
        return sorted(str(c.relative_to(self.sandbox)) + ("/" if c.is_dir() else "") for c in p.iterdir())

    def fs_read(self, path: str):
        p = self._resolve(path)
        if not p.is_file():
            return f"ERROR: no file '{path}'"
        return p.read_text()

    def fs_write(self, path: str, content: str):
        p = self._resolve(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
        return f"wrote {len(content)} chars to {path}"

    def fs_rename(self, src: str, dst: str):
        s, d = self._resolve(src), self._resolve(dst)
        if not s.exists():
            return f"ERROR: no file '{src}'"
        d.parent.mkdir(parents=True, exist_ok=True)
        s.rename(d)
        return f"renamed {src} -> {dst}"

    def fs_delete(self, path: str):
        p = self._resolve(path)
        if not p.is_file():
            return f"ERROR: no file '{path}'"
        p.unlink()
        return f"deleted {path}"

    def kv_set(self, key: str, value: str):
        self.kv[key] = str(value)
        return f"set {key}"

    def kv_get(self, key: str):
        return self.kv.get(key, f"ERROR: no key '{key}'")

    def kv_delete(self, key: str):
        if key not in self.kv:
            return f"ERROR: no key '{key}'"
        del self.kv[key]
        return f"deleted {key}"

    def kv_list(self):
        return dict(sorted(self.kv.items()))


DESCRIPTIONS = {
    "submit_answer": "Submit the final answer to the user's question. Call this exactly once when you know the answer. Pass only the answer value (a number, name or short phrase), no units unless asked.",
    "get_item_info": "Look up a catalog item by name. Returns its unit price, the price currency, its unit weight and the weight unit.",
    "get_exchange_rate": "Get the exchange rate between two currencies (ISO codes such as EUR, USD, GBP, JPY, CHF). Returns how many units of to_currency one unit of from_currency buys.",
    "get_shipping_rate": "Get the shipping price per kilogram for a carrier (swiftpost, cargolink, royalfreight) and zone (domestic or international). Returns price_per_kg and its currency.",
    "convert_units": "Convert a value between units of the same dimension. Mass: kg, g, lb, oz. Length: m, km, mi, ft, cm. Volume: l, ml, gal.",
    "calculator": "Evaluate an arithmetic expression with + - * / ** % and round(). Example: '3 * (4.5 + 2)'.",
    "sql_list_tables": "List the tables in the shop database.",
    "sql_describe": "Show the CREATE TABLE statement for a table in the shop database.",
    "sql_query": "Run one read-only SQLite SELECT query on the shop database. Returns columns and up to 50 rows.",
    "search_docs": "Search the Orrin Valley document collection by keywords. Returns the top 3 documents with id, title and a short snippet.",
    "read_doc": "Read the full text of a document by its doc_id (for example 'd07').",
    "fs_list": "List files and folders in a workspace directory. Use '.' for the workspace root.",
    "fs_read": "Read a text file in the workspace.",
    "fs_write": "Create or overwrite a text file in the workspace with exactly the given content.",
    "fs_rename": "Rename or move a file in the workspace.",
    "fs_delete": "Delete a file in the workspace.",
    "kv_set": "Save a value under a key in the user's persistent notes store.",
    "kv_get": "Read the value stored under a key in the user's notes store.",
    "kv_delete": "Delete a key from the user's notes store.",
    "kv_list": "List all keys and values in the user's notes store.",
}

FAMILY_TOOLS = {
    "chain": ["get_item_info", "get_exchange_rate", "get_shipping_rate", "convert_units", "calculator", "submit_answer"],
    "sql": ["sql_list_tables", "sql_describe", "sql_query", "calculator", "submit_answer"],
    "retrieval": ["search_docs", "read_doc", "submit_answer"],
    "files": ["fs_list", "fs_read", "fs_write", "fs_rename", "fs_delete"],
    "multiturn": ["kv_set", "kv_get", "kv_delete", "kv_list", "calculator", "get_exchange_rate", "submit_answer"],
}


def build_tools(env, names, extra=()):
    tools = []
    for n in names:
        tools.append(StructuredTool.from_function(func=env._wrap(n, getattr(env, n)), name=n, description=DESCRIPTIONS[n],
                                                  args_schema=_schema_for(getattr(env, n), n)))
    tools.extend(extra)
    return tools


def _schema_for(method, name):
    import inspect
    from pydantic import create_model
    sig = inspect.signature(method)
    fields = {}
    for pname, p in sig.parameters.items():
        ann = p.annotation if p.annotation is not inspect._empty else str
        fields[pname] = (ann, ... if p.default is inspect._empty else p.default)
    return create_model(f"{name}_args", **fields)
