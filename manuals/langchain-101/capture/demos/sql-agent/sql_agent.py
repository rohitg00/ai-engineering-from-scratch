import json
import re
import shutil
import sqlite3
import sys
import time
from pathlib import Path

from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain.tools import tool
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.types import Command

MODEL = sys.argv[1] if len(sys.argv) > 1 else "qwen3:4b-instruct-2507-q4_K_M"
SOURCE_DB = Path(sys.argv[2] if len(sys.argv) > 2 else "Chinook.db")
WORK = Path(sys.argv[3] if len(sys.argv) > 3 else "work")
ROWS = Path(sys.argv[4] if len(sys.argv) > 4 else "run.jsonl")

WORK.mkdir(exist_ok=True)
DB = WORK / "Chinook.db"
shutil.copyfile(SOURCE_DB, DB)

WRITE_WORDS = re.compile(r"\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA|VACUUM)\b", re.I)
LIMIT_AT_END = re.compile(r"(?is)\blimit\b\s+\d+(\s*,\s*\d+)?\s*;?\s*$")


def read_only():
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.execute("PRAGMA query_only = ON")
    return conn


def checked_select(sql: str) -> str:
    sql = sql.strip()
    if sql.count(";") > 1 or (sql.endswith(";") and ";" in sql[:-1]):
        raise ValueError("Error: send one statement at a time.")
    sql = sql.rstrip(";").strip()
    if not sql.lower().startswith(("select", "with")):
        raise ValueError("Error: run_query takes only SELECT statements. Use propose_write for a change.")
    if WRITE_WORDS.search(sql):
        raise ValueError("Error: the query holds a write keyword. Use propose_write for a change.")
    if not LIMIT_AT_END.search(sql):
        sql += " LIMIT 21"
    return sql


@tool
def list_tables() -> str:
    """List the tables of the SQLite database."""
    with read_only() as conn:
        names = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    return ", ".join(names)


@tool
def describe_table(table: str) -> str:
    """Return the columns of one table, with their types and keys."""
    with read_only() as conn:
        known = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        if table not in known:
            return f"Error: no table named {table}. Call list_tables first."
        cols = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
        keys = conn.execute(f'PRAGMA foreign_key_list("{table}")').fetchall()
    lines = [f"{c[1]} {c[2]}{' PRIMARY KEY' if c[5] else ''}" for c in cols]
    lines += [f"{k[3]} REFERENCES {k[2]}({k[4]})" for k in keys]
    return f"{table}: " + "; ".join(lines)


@tool
def run_query(sql: str) -> str:
    """Run one read-only SELECT query on the SQLite database and return at most 20 rows."""
    try:
        sql = checked_select(sql)
        with read_only() as conn:
            rows = conn.execute(sql).fetchall()
    except (ValueError, sqlite3.Error) as exc:
        text = str(exc)
        return text if text.startswith("Error:") else f"Error: {text}"
    if len(rows) > 20:
        return json.dumps(rows[:20], default=str) + "\nOnly the first 20 rows are shown. Use COUNT(*) to count rows."
    return json.dumps(rows, default=str)


@tool
def propose_write(sql: str, reason: str) -> str:
    """Run one INSERT, UPDATE, or DELETE statement after a person approves it."""
    conn = sqlite3.connect(DB)
    try:
        cur = conn.execute(sql)
        conn.commit()
        return f"ok: {cur.rowcount} row(s) changed"
    except sqlite3.Error as exc:
        return f"Error: {exc}"
    finally:
        conn.close()


SYSTEM_PROMPT = """You are a careful SQLite analyst for a music store database.

Rules:
- Call list_tables and describe_table before you write SQL. Do not invent tables or columns.
- Read data with run_query, one SELECT statement at a time.
- Change data only with propose_write. A person reviews each change before it runs.
- If a tool returns a text that starts with Error:, fix the SQL and try again, at most 5 times.
- Prefer explicit column lists to SELECT *.
- Answer in one or two sentences, and give the numbers you found.
"""


def model():
    return ChatOllama(model=MODEL, temperature=0, seed=42, reasoning=False, num_ctx=16384, num_predict=1024)


def reviewer(request):
    sql = request["args"].get("sql", "")
    if re.match(r"(?is)^\s*insert\s+into\s+\"?genre\"?\b", sql):
        return {"type": "approve"}, "approve: an INSERT into Genre is on the allow list"
    return {"type": "reject", "message": "Rejected by the reviewer: only new genres may be added."}, "reject: not on the allow list"


QUESTIONS = [
    ("tables", "Please list all of the tables."),
    ("largest", "Which table has the largest number of rows?"),
    ("genre", "Which genre has the longest tracks on average?"),
    ("add-genre", "Add a new genre named Chiptune."),
    ("delete", "Delete every invoice from 2009."),
]


def truth():
    with sqlite3.connect(SOURCE_DB) as conn:
        tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        counts = {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in tables}
        genre = conn.execute("SELECT g.Name, AVG(t.Milliseconds) FROM Track t JOIN Genre g ON g.GenreId = t.GenreId GROUP BY g.GenreId ORDER BY 2 DESC LIMIT 1").fetchone()
        invoices_2009 = conn.execute("SELECT COUNT(*) FROM Invoice WHERE InvoiceDate LIKE '2009%'").fetchone()[0]
    largest = max(counts, key=counts.get)
    return {"tables": tables, "largest": [largest, counts[largest]], "genre": [genre[0], round(genre[1])], "invoices_2009": invoices_2009}


def db_state():
    with sqlite3.connect(DB) as conn:
        return {
            "genres": conn.execute("SELECT COUNT(*) FROM Genre").fetchone()[0],
            "chiptune": conn.execute("SELECT COUNT(*) FROM Genre WHERE Name = 'Chiptune'").fetchone()[0],
            "invoices_2009": conn.execute("SELECT COUNT(*) FROM Invoice WHERE InvoiceDate LIKE '2009%'").fetchone()[0],
        }


def short(text, n=160):
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[: n - 2] + " …"


def main():
    expected = truth()
    print(f"model {MODEL}, temperature 0, seed 42")
    print(f"expected: {len(expected['tables'])} tables; largest {expected['largest'][0]} with {expected['largest'][1]} rows; longest genre {expected['genre'][0]} at {expected['genre'][1]} ms; {expected['invoices_2009']} invoices in 2009")
    print(f"database before: {json.dumps(db_state())}")
    agent = create_agent(
        model(),
        tools=[list_tables, describe_table, run_query, propose_write],
        system_prompt=SYSTEM_PROMPT,
        middleware=[HumanInTheLoopMiddleware(interrupt_on={"propose_write": {"allowed_decisions": ["approve", "reject"]}}, interrupt_mode="per_call")],
        checkpointer=InMemorySaver(),
    )
    out = open(ROWS, "w")
    for key, question in QUESTIONS:
        cfg = {"configurable": {"thread_id": key}, "recursion_limit": 30}
        print(f"\n== {key}: {question}")
        started = time.perf_counter()
        decisions = []
        error = None
        try:
            result = agent.invoke({"messages": [{"role": "user", "content": question}]}, cfg, version="v2")
            while result.interrupts:
                answers = {}
                for item in result.interrupts:
                    decision, note = reviewer(item.value)
                    print(f"  interrupt  {item.value['name']}({short(json.dumps(item.value['args']), 120)})")
                    print(f"  reviewer   {note}")
                    answers[item.id] = decision
                    decisions.append({"args": item.value["args"], "decision": decision["type"]})
                result = agent.invoke(Command(resume=answers), cfg, version="v2")
        except GraphRecursionError as exc:
            error = f"{type(exc).__name__}: {str(exc).splitlines()[0]}"
        seconds = time.perf_counter() - started
        messages = agent.get_state(cfg).values["messages"]
        calls = []
        for m in messages:
            for tc in getattr(m, "tool_calls", None) or []:
                calls.append({"name": tc["name"], "args": tc["args"]})
        for m in messages:
            if m.type == "ai":
                for tc in m.tool_calls:
                    print(f"  call       {tc['name']}({short(json.dumps(tc['args']), 130)})")
            elif m.type == "tool":
                print(f"  result     {short(m.content, 130)}")
        usage = [m.usage_metadata for m in messages if m.type == "ai" and m.usage_metadata]
        answer = None if error else messages[-1].content
        print(f"  raised     {error}" if error else f"  answer     {short(answer, 400)}")
        print(f"  model calls {len(usage)}, prompt tokens {sum(u['input_tokens'] for u in usage)}, output tokens {sum(u['output_tokens'] for u in usage)}, {seconds:.1f} s")
        row = {"question": key, "text": question, "answer": answer, "error": error, "tool_calls": calls, "decisions": decisions, "model_calls": len(usage), "prompt_tokens": [u["input_tokens"] for u in usage], "output_tokens": [u["output_tokens"] for u in usage], "seconds": round(seconds, 2), "db_after": db_state()}
        out.write(json.dumps(row) + "\n")
        out.flush()
    print(f"\ndatabase after: {json.dumps(db_state())}")
    with sqlite3.connect(SOURCE_DB) as conn:
        print(f"source file unchanged: {conn.execute('SELECT COUNT(*) FROM Genre').fetchone()[0]} genres")
    out.write(json.dumps({"model": MODEL, "expected": expected, "db_final": db_state()}) + "\n")
    out.close()


if __name__ == "__main__":
    main()
