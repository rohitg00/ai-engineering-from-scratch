import collections
import dataclasses
import datetime
import decimal
import enum
import json
import os
import pathlib
import sqlite3
import sys
import tempfile
import uuid
from importlib import metadata
from typing import Any, TypedDict
from zoneinfo import ZoneInfo

os.environ["LANGSMITH_TRACING"] = "false"

from langchain_core.messages import AIMessage
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel


class Color(enum.Enum):
    RED = "red"


@dataclasses.dataclass
class Point:
    x: int
    y: int


class Card(BaseModel):
    name: str
    tags: list[str]


class Plain:
    def __init__(self, v):
        self.v = v

    def __repr__(self):
        return f"Plain({self.v!r})"

    def __eq__(self, other):
        return isinstance(other, Plain) and other.v == self.v


def cases():
    counts = collections.Counter("abca")
    nested = collections.defaultdict(list)
    nested["k"].append(1)
    return [
        ("str", "hello"),
        ("int", 7),
        ("float", 0.1),
        ("bool", True),
        ("None", None),
        ("list", [1, 2]),
        ("tuple", (1, 2)),
        ("dict with int keys", {1: "one"}),
        ("set of int", {1, 2}),
        ("frozenset of int", frozenset({1, 2})),
        ("set of tuples", {(1, 2), (3, 4)}),
        ("frozenset of tuples", frozenset({(1, 2)})),
        ("bytes", b"\x00\x01"),
        ("Decimal", decimal.Decimal("1.10")),
        ("UUID", uuid.UUID("12345678-1234-5678-1234-567812345678")),
        ("Path", pathlib.Path("data/file.txt")),
        ("datetime UTC", datetime.datetime(2026, 11, 14, 9, 30, tzinfo=datetime.timezone.utc)),
        ("datetime ZoneInfo", datetime.datetime(2026, 11, 14, 9, 30, tzinfo=ZoneInfo("Asia/Kolkata"))),
        ("datetime fold=1", datetime.datetime(2026, 11, 1, 1, 30, fold=1, tzinfo=ZoneInfo("America/New_York"))),
        ("date", datetime.date(2026, 11, 14)),
        ("timedelta", datetime.timedelta(seconds=90)),
        ("Enum", Color.RED),
        ("dataclass", Point(1, 2)),
        ("pydantic model", Card(name="a", tags=["x"])),
        ("AIMessage", AIMessage("hi", id="m1")),
        ("defaultdict", nested),
        ("Counter", counts),
        ("OrderedDict", collections.OrderedDict([("b", 1), ("a", 2)])),
        ("plain class", Plain(3)),
    ]


def describe(value):
    out = {"type": type(value).__qualname__, "repr": repr(value)}
    if isinstance(value, datetime.datetime):
        out["tzinfo"] = type(value.tzinfo).__name__ if value.tzinfo else None
        out["fold"] = value.fold
        out["utcoffset"] = str(value.utcoffset())
    return out


def compare(before, after):
    same_type = type(before) is type(after)
    try:
        equal = bool(before == after)
    except Exception as exc:
        equal = f"compare raised {type(exc).__name__}"
    row = {"same_type": same_type, "equal": equal}
    if isinstance(before, datetime.datetime) and isinstance(after, datetime.datetime):
        row["same_tzinfo_type"] = type(before.tzinfo) is type(after.tzinfo)
        row["same_fold"] = before.fold == after.fold
    return row


class S(TypedDict):
    value: Any


def graph_round_trip(saver, value):
    def keep(state):
        return {"value": state["value"]}

    g = StateGraph(S)
    g.add_node("keep", keep)
    g.add_edge(START, "keep")
    g.add_edge("keep", END)
    app = g.compile(checkpointer=saver)
    cfg = {"configurable": {"thread_id": f"t-{uuid.uuid4().hex[:8]}"}}
    app.invoke({"value": value}, cfg)
    return app.get_state(cfg).values.get("value")


def main():
    out = sys.stdout
    meta = {name: metadata.version(name) for name in ("langgraph", "langgraph-checkpoint", "langgraph-checkpoint-sqlite", "langchain-core", "pydantic")}
    meta["python"] = ".".join(map(str, sys.version_info[:3]))
    meta["LANGGRAPH_STRICT_MSGPACK"] = os.environ.get("LANGGRAPH_STRICT_MSGPACK")
    out.write(json.dumps({"meta": meta}) + "\n")
    serde = JsonPlusSerializer()
    folder = tempfile.mkdtemp(prefix="t13rt-")
    conn = sqlite3.connect(os.path.join(folder, "rt.sqlite"), check_same_thread=False)
    saver = SqliteSaver(conn)
    saver.setup()
    for name, value in cases():
        row = {"case": name, "before": describe(value)}
        try:
            kind, blob = serde.dumps_typed(value)
            after = serde.loads_typed((kind, blob))
            row["serde"] = {"kind": kind, "after": describe(after), **compare(value, after)}
        except Exception as exc:
            row["serde"] = {"raised": f"{type(exc).__name__}: {exc}"}
        try:
            after = graph_round_trip(saver, value)
            row["sqlite_graph"] = {"after": describe(after), **compare(value, after)}
        except Exception as exc:
            row["sqlite_graph"] = {"raised": f"{type(exc).__name__}: {exc}"}
        out.write(json.dumps(row, default=str) + "\n")
    conn.close()


if __name__ == "__main__":
    main()
