"""Schema-first agent state with atomic writes.

Writes JSON Schema files for `agent_state.json` and `task_board.json`,
implements a tiny stdlib validator that handles the subset we need
(required, type, enum, pattern, items), and a StateManager with
temp-and-rename writes so a partial failure cannot corrupt the file.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

HERE = Path(__file__).parent
WORK = HERE / "workdir"


STATE_SCHEMA: dict[str, Any] = {
    "$id": "agent_state.schema.json",
    "type": "object",
    "required": ["schema_version", "active_task_id", "touched_files", "next_action"],
    "properties": {
        "schema_version": {"type": "integer", "enum": [1]},
        "active_task_id": {"type": ["string", "null"], "pattern": r"^(T-\d{3,}|)$"},
        "touched_files": {"type": "array", "items": {"type": "string"}},
        "assumptions": {"type": "array", "items": {"type": "string"}},
        "blockers": {"type": "array", "items": {"type": "string"}},
        "next_action": {"type": "string"},
    },
}


BOARD_SCHEMA: dict[str, Any] = {
    "$id": "task_board.schema.json",
    "type": "array",
    "items": {
        "type": "object",
        "required": ["id", "goal", "owner", "acceptance", "status"],
        "properties": {
            "id": {"type": "string", "pattern": r"^T-\d{3,}$"},
            "goal": {"type": "string"},
            "owner": {"type": "string", "enum": ["builder", "reviewer", "human"]},
            "acceptance": {"type": "array", "items": {"type": "string"}},
            "status": {"type": "string", "enum": ["todo", "in_progress", "done", "blocked"]},
        },
    },
}


class SchemaError(Exception):
    pass


def _check_type(value: Any, types: str | list[str]) -> bool:
    type_list = [types] if isinstance(types, str) else types
    for t in type_list:
        if t == "object" and isinstance(value, dict):
            return True
        if t == "array" and isinstance(value, list):
            return True
        if t == "string" and isinstance(value, str):
            return True
        if t == "integer" and isinstance(value, int) and not isinstance(value, bool):
            return True
        if t == "null" and value is None:
            return True
    return False


def validate(value: Any, schema: dict[str, Any], path: str = "$") -> None:
    if "type" in schema and not _check_type(value, schema["type"]):
        raise SchemaError(f"{path}: expected {schema['type']}, got {type(value).__name__}")
    if "enum" in schema and value not in schema["enum"]:
        raise SchemaError(f"{path}: {value!r} not in {schema['enum']}")
    if "pattern" in schema and isinstance(value, str) and not re.match(schema["pattern"], value):
        raise SchemaError(f"{path}: {value!r} does not match /{schema['pattern']}/")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                raise SchemaError(f"{path}: missing required field {key!r}")
        properties = schema.get("properties", {})
        unexpected = sorted(set(value.keys()) - set(properties.keys()))
        if unexpected:
            raise SchemaError(f"{path}: unexpected fields {unexpected}")
        for key, sub in properties.items():
            if key in value:
                validate(value[key], sub, f"{path}.{key}")
    if isinstance(value, list) and "items" in schema:
        for idx, item in enumerate(value):
            validate(item, schema["items"], f"{path}[{idx}]")


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write(content)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_name, path)
    except Exception:
        Path(tmp_name).unlink(missing_ok=True)
        raise


class StateManager:
    def __init__(self, state_path: Path, schema: dict[str, Any]):
        self.state_path = state_path
        self.schema = schema

    def load(self) -> Any:
        raw = json.loads(self.state_path.read_text())
        validate(raw, self.schema)
        return raw

    def commit(self, state: Any) -> None:
        validate(state, self.schema)
        atomic_write(self.state_path, json.dumps(state, indent=2) + "\n")


def main() -> None:
    WORK.mkdir(exist_ok=True)
    schema_dir = WORK / "schemas"
    schema_dir.mkdir(exist_ok=True)
    (schema_dir / "agent_state.schema.json").write_text(json.dumps(STATE_SCHEMA, indent=2) + "\n")
    (schema_dir / "task_board.schema.json").write_text(json.dumps(BOARD_SCHEMA, indent=2) + "\n")

    state_path = WORK / "agent_state.json"
    board_path = WORK / "task_board.json"

    mgr = StateManager(state_path, STATE_SCHEMA)
    board_mgr = StateManager(board_path, BOARD_SCHEMA)

    initial_state = {
        "schema_version": 1,
        "active_task_id": None,
        "touched_files": [],
        "assumptions": [],
        "blockers": [],
        "next_action": "pick next task",
    }
    initial_board = [
        {
            "id": "T-001",
            "goal": "validate /signup payloads",
            "owner": "builder",
            "acceptance": ["pytest -x test_app.py::test_signup_rejects_short_password"],
            "status": "todo",
        }
    ]
    mgr.commit(initial_state)
    board_mgr.commit(initial_board)

    state = mgr.load()
    board = board_mgr.load()
    state["active_task_id"] = board[0]["id"]
    state["next_action"] = "read existing /signup handler"
    mgr.commit(state)

    print("state:", json.dumps(mgr.load(), indent=2))
    print("board:", json.dumps(board_mgr.load(), indent=2))

    bad = dict(state)
    bad["active_task_id"] = "T-bogus"
    try:
        mgr.commit(bad)
    except SchemaError as exc:
        print("rejected bad write:", exc)


if __name__ == "__main__":
    main()
