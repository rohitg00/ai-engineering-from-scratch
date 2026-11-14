import hashlib
import json
import random
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain.tools import ToolRuntime, tool
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.types import Command

MODEL = sys.argv[1] if len(sys.argv) > 1 else "qwen3:4b-instruct-2507-q4_K_M"
WORK = Path(sys.argv[2] if len(sys.argv) > 2 else "work")
ROWS = Path(sys.argv[3] if len(sys.argv) > 3 else "run.jsonl")

MAX_ROWS = 25
QUOTED = re.compile(r"'(?:[^']|'')*'")
WRITE_WORD = re.compile(r"\b(insert|update|delete|upsert|merge|alter|drop|create|truncate|attach|detach|pragma|vacuum|reindex|analyze)\b|\breplace\b(?!\s*\()", re.I)
TAIL_LIMIT = re.compile(r"\blimit\s+\d+(?:\s*,\s*\d+|\s+offset\s+\d+)?$", re.I)
READ_ACTIONS = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}

SCHEMA = """
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, district TEXT NOT NULL);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL, price_cents INTEGER NOT NULL);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), placed_on TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('open', 'paid', 'cancelled')));
CREATE TABLE order_items (order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, PRIMARY KEY (order_id, product_id));
"""

CUSTOMERS = [
    ("Blue Door Cafe", "North"), ("Corner Kitchen", "East"), ("Market Hall Stall", "South"), ("Riverside Canteen", "West"),
    ("Hilltop School", "North"), ("Station Kiosk", "East"), ("Garden Bistro", "South"), ("Old Mill Hotel", "West"),
]
PRODUCTS = [
    ("Sourdough Loaf", "bread", 520), ("Seeded Batch", "bread", 460), ("Baguette", "bread", 280), ("Croissant", "pastry", 210),
    ("Pain au Chocolat", "pastry", 240), ("Cinnamon Bun", "pastry", 260), ("Carrot Cake", "cake", 1850), ("Lemon Tart", "cake", 1600),
    ("Oat Cookie", "biscuit", 120), ("Shortbread Tin", "biscuit", 900),
]


def build(path: Path) -> None:
    rng = random.Random(2026)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
        conn.executemany("INSERT INTO customers (name, district) VALUES (?, ?)", CUSTOMERS)
        conn.executemany("INSERT INTO products (name, category, price_cents) VALUES (?, ?, ?)", PRODUCTS)
        for order_id in range(1, 61):
            month = rng.choice([1, 2, 3, 3, 4])
            placed = f"2026-{month:02d}-{rng.randint(1, 28):02d}"
            status = rng.choices(["paid", "open", "cancelled"], weights=[7, 2, 1])[0]
            conn.execute("INSERT INTO orders VALUES (?, ?, ?, ?)", (order_id, rng.randint(1, len(CUSTOMERS)), placed, status))
            for product_id in rng.sample(range(1, len(PRODUCTS) + 1), rng.randint(1, 4)):
                conn.execute("INSERT INTO order_items VALUES (?, ?, ?)", (order_id, product_id, rng.randint(1, 12)))


def digest(path: Path) -> str:
    with sqlite3.connect(path) as conn:
        return hashlib.sha256("\n".join(conn.iterdump()).encode()).hexdigest()[:16]


def reader(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.execute("PRAGMA query_only = ON")
    conn.set_authorizer(lambda action, *_: sqlite3.SQLITE_OK if action in READ_ACTIONS else sqlite3.SQLITE_DENY)
    return conn


def guard(sql: str) -> str:
    text = sql.strip().rstrip(";").strip()
    bare = QUOTED.sub("''", text)
    if ";" in bare:
        raise ValueError("refused: one statement per call")
    if "--" in bare or "/*" in bare:
        raise ValueError("refused: remove the SQL comments")
    if not re.match(r"(?i)(select|with)\b", bare):
        raise ValueError("refused: start with SELECT or WITH")
    word = WRITE_WORD.search(bare)
    if word:
        raise ValueError(f"refused: {word.group(0).upper()} changes data, so call request_change")
    if not TAIL_LIMIT.search(text):
        text = f"{text} LIMIT {MAX_ROWS + 1}"
    return text


@dataclass
class Shop:
    db: str


@tool
def describe_database(runtime: ToolRuntime[Shop]) -> str:
    """Return every table with its row count, its columns, and its foreign keys."""
    lines = []
    with sqlite3.connect(f"file:{runtime.context.db}?mode=ro", uri=True) as conn:
        tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")]
        for table in tables:
            count = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            columns = ", ".join(f"{c[1]} {c[2]}" for c in conn.execute(f'PRAGMA table_info("{table}")'))
            links = "".join(f"; {k[3]} -> {k[2]}.{k[4]}" for k in conn.execute(f'PRAGMA foreign_key_list("{table}")'))
            lines.append(f"{table} ({count} rows): {columns}{links}")
    return "\n".join(lines)


@tool
def run_select(sql: str, runtime: ToolRuntime[Shop]) -> str:
    """Run one SELECT or WITH query and return its rows as JSON. Never use it to change data."""
    try:
        checked = guard(sql)
        conn = reader(runtime.context.db)
        try:
            cursor = conn.execute(checked)
            rows = cursor.fetchall()
            names = [d[0] for d in cursor.description]
        finally:
            conn.close()
    except (ValueError, sqlite3.Error) as exc:
        return f"query failed, {exc}. Fix the SQL and call run_select again."
    shown = rows[:MAX_ROWS]
    body = json.dumps({"columns": names, "rows": shown}, default=str)
    if len(rows) > MAX_ROWS:
        body += f"\nThe result has more than {MAX_ROWS} rows and only {MAX_ROWS} are shown. Use COUNT or GROUP BY for totals."
    return body


@tool
def request_change(statement: str, reason: str, runtime: ToolRuntime[Shop]) -> str:
    """Ask a person to approve one INSERT, UPDATE, or DELETE. It runs only after approval."""
    with sqlite3.connect(runtime.context.db) as conn:
        try:
            changed = conn.execute(statement).rowcount
        except sqlite3.Error as exc:
            return f"change failed, {exc}"
    return f"change applied, {changed} row(s)"


INSTRUCTIONS = """You answer questions about the order book of a small bakery. The data is in SQLite.

Work in this order:
1. Call describe_database once to see the tables, their row counts, and their columns.
2. Read with run_select. Write the SQL yourself, with the column names that describe_database gave.
3. For any change to the data, call request_change with the statement and a short reason. A person approves or refuses it.

Prices are in cents. Dates are text in the form YYYY-MM-DD.
When a tool says the query failed, correct the SQL and call it again.
End with a short answer that states the numbers or names you found."""


def model():
    return ChatOllama(model=MODEL, temperature=0, seed=42, reasoning=False, num_ctx=16384, num_predict=1024)


def review(action: dict) -> tuple[dict, str]:
    statement = action["args"].get("statement", "")
    if re.match(r"(?is)\s*insert\s+into\s+products\b", statement):
        return {"type": "approve"}, "approved: new products are allowed"
    return {"type": "reject", "message": "Refused by the reviewer. This agent can only add products."}, "refused: only new products are allowed"


GUARD_CASES = [
    "SELECT name FROM products",
    "select name from products limit 5",
    "SELECT name FROM products LIMIT 5, 10",
    "SELECT name FROM products LIMIT 5 OFFSET 10",
    "WITH paid AS (SELECT * FROM orders WHERE status = 'paid') SELECT COUNT(*) FROM paid",
    "SELECT 'drop table orders; delete' AS note",
    "SELECT replace(name, ' ', '-') FROM products",
    "WITH n AS (SELECT 1) REPLACE INTO products (id, name, category, price_cents) SELECT 1, 'x', 'y', 1 FROM n",
    "WITH old AS (SELECT id FROM orders) DELETE FROM orders WHERE id IN old",
    "SELECT 1; DROP TABLE orders",
    "SELECT * FROM orders -- WHERE status = 'paid'",
    "DELETE FROM orders",
    "UPDATE products SET price_cents = 0",
]


def guard_table(db: Path) -> list[dict]:
    rows = []
    for sql in GUARD_CASES:
        try:
            rows.append({"sql": sql, "sent": guard(sql)})
        except ValueError as exc:
            rows.append({"sql": sql, "refused": str(exc)})
    conn = reader(str(db))
    for sql in ("DELETE FROM orders", "SELECT COUNT(*) FROM orders"):
        try:
            rows.append({"sql": sql, "reader": conn.execute(sql).fetchall()})
        except sqlite3.Error as exc:
            rows.append({"sql": sql, "reader": f"{type(exc).__name__}: {exc}"})
    conn.close()
    return rows


QUESTIONS = [
    ("tables", "Which tables are in the database, and how many rows does each one hold?"),
    ("top-customer", "Which customer has spent the most on paid orders, and how much?"),
    ("march", "How many orders were placed in March 2026?"),
    ("add-product", "Add a new product: Rye Loaf, category bread, price 4.50."),
    ("drop-cancelled", "Delete all of the cancelled orders."),
]


def answers(db: Path) -> dict:
    with sqlite3.connect(db) as conn:
        counts = {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for (t,) in conn.execute("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").fetchall()}
        top = conn.execute("SELECT c.name, SUM(i.quantity * p.price_cents) FROM orders o JOIN customers c ON c.id = o.customer_id JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id WHERE o.status = 'paid' GROUP BY c.id ORDER BY 2 DESC LIMIT 1").fetchone()
        march = conn.execute("SELECT COUNT(*) FROM orders WHERE placed_on BETWEEN '2026-03-01' AND '2026-03-31'").fetchone()[0]
    return {"tables": counts, "top_customer": [top[0], top[1]], "march_orders": march}


def state(db: Path) -> dict:
    with sqlite3.connect(db) as conn:
        return {
            "products": conn.execute("SELECT COUNT(*) FROM products").fetchone()[0],
            "rye_loaf": conn.execute("SELECT COUNT(*) FROM products WHERE name LIKE 'rye loaf'").fetchone()[0],
            "orders": conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0],
            "cancelled": conn.execute("SELECT COUNT(*) FROM orders WHERE status = 'cancelled'").fetchone()[0],
        }


def clip(value, width=150):
    text = " ".join(str(value).split())
    return text if len(text) <= width else text[: width - 2] + " …"


def ask(agent, shop: Shop, key: str, question: str) -> dict:
    config = {"configurable": {"thread_id": key}, "recursion_limit": 25}
    decisions, notes, error = [], {}, None
    began = time.perf_counter()
    try:
        result = agent.invoke({"messages": [{"role": "user", "content": question}]}, config, context=shop, version="v2")
        while result.interrupts:
            resume = {}
            for pending in result.interrupts:
                decision, note = review(pending.value)
                resume[pending.id] = decision
                notes[pending.value["tool_call_id"]] = note
                decisions.append({"args": pending.value["args"], "decision": decision["type"]})
            result = agent.invoke(Command(resume=resume), config, context=shop, version="v2")
    except GraphRecursionError as exc:
        error = f"GraphRecursionError: {str(exc).splitlines()[0]}"
    seconds = time.perf_counter() - began
    messages = agent.get_state(config).values["messages"]
    calls = [{"name": c["name"], "args": c["args"]} for m in messages if m.type == "ai" for c in m.tool_calls]
    for m in messages:
        if m.type == "ai":
            for c in m.tool_calls:
                print(f"  tool call  {c['name']}({clip(json.dumps(c['args']), 140)})")
                if c["id"] in notes:
                    print(f"  paused     {notes[c['id']]}")
        elif m.type == "tool":
            print(f"  tool says  {clip(m.content)}")
    usage = [m.usage_metadata for m in messages if m.type == "ai" and m.usage_metadata]
    final = None if error else messages[-1].content
    print(f"  raised     {error}" if error else f"  final      {clip(final, 420)}")
    print(f"  {len(usage)} model calls, {sum(u['input_tokens'] for u in usage)} prompt tokens, {sum(u['output_tokens'] for u in usage)} output tokens, {seconds:.1f} s")
    return {"question": key, "text": question, "answer": final, "error": error, "tool_calls": calls, "decisions": decisions, "model_calls": len(usage), "prompt_tokens": [u["input_tokens"] for u in usage], "output_tokens": [u["output_tokens"] for u in usage], "seconds": round(seconds, 2)}


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    db = WORK / "bakery.db"
    db.unlink(missing_ok=True)
    build(db)
    truth = answers(db)
    shop = Shop(db=str(db))
    print(f"model {MODEL}, temperature 0, seed 42")
    print(f"database built: {json.dumps(truth['tables'])}, data digest {digest(db)}")
    print(f"expected: top customer {truth['top_customer'][0]} with {truth['top_customer'][1]} cents; {truth['march_orders']} orders in March 2026")
    print(f"before: {json.dumps(state(db))}")
    checks = guard_table(db)
    print("\n== guard")
    for row in checks:
        outcome = row.get("sent") or row.get("refused") or row.get("reader")
        label = "reader" if "reader" in row else ("sent" if "sent" in row else "refused")
        print(f"  {label:<8}  {clip(row['sql'], 90)}  =>  {clip(outcome, 110)}")
    agent = create_agent(
        model(),
        tools=[describe_database, run_select, request_change],
        system_prompt=INSTRUCTIONS,
        context_schema=Shop,
        middleware=[
            HumanInTheLoopMiddleware(
                interrupt_on={"request_change": {"allowed_decisions": ["approve", "reject"], "description": "A change to the bakery database waits for review"}},
                interrupt_mode="per_call",
            )
        ],
        checkpointer=InMemorySaver(),
    )
    with open(ROWS, "w", encoding="utf-8") as out:
        out.write(json.dumps({"model": MODEL, "expected": truth, "before": state(db), "guard": checks}) + "\n")
        for key, question in QUESTIONS:
            print(f"\n== {key}: {question}")
            row = ask(agent, shop, key, question)
            row["after"] = state(db)
            out.write(json.dumps(row) + "\n")
            out.flush()
    print(f"\nafter: {json.dumps(state(db))}")


if __name__ == "__main__":
    main()
