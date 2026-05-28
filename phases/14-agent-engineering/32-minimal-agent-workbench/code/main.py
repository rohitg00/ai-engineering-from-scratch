"""3 file の minimal agent workbench を配置し、single turn を実行する。

書き込む files:
  workdir/AGENTS.md         state + board + deeper docs への短い router
  workdir/agent_state.json  active task, touched files, blockers, next action
  workdir/task_board.json   status + acceptance を持つ tasks queue

Run: python3 code/main.py
再実行すると、second turn が first turn の停止地点から再開する様子を確認できる。
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(__file__).parent / "workdir"


AGENTS_MD = """# AGENTS.md

この repo は workbench とともに動く。acting 前に以下を読む:

1. `agent_state.json` — last session が停止した場所。
2. `task_board.json` — in flight の work と次の work。
3. `docs/agent-rules.md` — startup, scope, definition of done (必要時に load)。

Definition of done: `agent_state.active_task_id` が参照する task が
`task_board.json` で `status == "done"` になり、`acceptance` に listed された
verification command が exit 0 で終わっていること。

Verification command: `python3 -m pytest -x`
""".lstrip()


@dataclass
class AgentState:
    active_task_id: str | None
    touched_files: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    blockers: list[str] = field(default_factory=list)
    next_action: str = ""


@dataclass
class Task:
    id: str
    goal: str
    owner: str
    acceptance: list[str]
    status: str = "todo"


def write_initial(state_path: Path, board_path: Path, agents_path: Path) -> None:
    if not agents_path.exists():
        agents_path.write_text(AGENTS_MD)
    if not state_path.exists():
        state_path.write_text(json.dumps(asdict(AgentState(active_task_id=None)), indent=2) + "\n")
    if not board_path.exists():
        board = [
            Task(
                id="T-001",
                goal="/signup に input validation を追加する",
                owner="builder",
                acceptance=["pytest test_app.py::test_signup_rejects_short_password"],
            ),
            Task(
                id="T-002",
                goal="新しい /signup contract を document する",
                owner="builder",
                acceptance=["docs/api.md が /signup constraints に言及している"],
            ),
        ]
        board_path.write_text(json.dumps([asdict(t) for t in board], indent=2) + "\n")


def load_state(state_path: Path) -> AgentState:
    raw = json.loads(state_path.read_text())
    return AgentState(**raw)


def load_board(board_path: Path) -> list[Task]:
    return [Task(**t) for t in json.loads(board_path.read_text())]


def save_state(state_path: Path, state: AgentState) -> None:
    state_path.write_text(json.dumps(asdict(state), indent=2) + "\n")


def save_board(board_path: Path, board: list[Task]) -> None:
    board_path.write_text(json.dumps([asdict(t) for t in board], indent=2) + "\n")


def run_one_turn(state: AgentState, board: list[Task]) -> tuple[AgentState, list[Task]]:
    if state.active_task_id is None:
        nxt = next((t for t in board if t.status == "todo"), None)
        if nxt is None:
            state.next_action = "board に work がないため idle"
            return state, board
        nxt.status = "in_progress"
        state.active_task_id = nxt.id
        state.next_action = f"{nxt.id} の作業を開始する: {nxt.goal}"
        return state, board

    active = next((t for t in board if t.id == state.active_task_id), None)
    if active is None:
        state.active_task_id = None
        state.next_action = "active task が board にないため reset して新しい work を選ぶ"
        return state, board
    if "app.py" not in state.touched_files:
        state.touched_files.append("app.py")
        state.next_action = f"{active.id} の acceptance 用 test を追加する"
        return state, board

    if "test_app.py" not in state.touched_files:
        state.touched_files.append("test_app.py")
        state.next_action = f"{active.id} の verification command を実行する"
        return state, board

    active.status = "done"
    state.active_task_id = None
    state.touched_files = []
    state.next_action = "board から次の task を選ぶ"
    return state, board


def main() -> None:
    ROOT.mkdir(exist_ok=True)
    state_path = ROOT / "agent_state.json"
    board_path = ROOT / "task_board.json"
    agents_path = ROOT / "AGENTS.md"

    write_initial(state_path, board_path, agents_path)
    state = load_state(state_path)
    board = load_board(board_path)

    print("turn 前:")
    print(f"  active task : {state.active_task_id}")
    print(f"  next action : {state.next_action!r}")
    print(f"  board の todo: {[t.id for t in board if t.status == 'todo']}")

    state, board = run_one_turn(state, board)
    save_state(state_path, state)
    save_board(board_path, board)

    print("\nturn 後:")
    print(f"  active task : {state.active_task_id}")
    print(f"  touched     : {state.touched_files}")
    print(f"  next action : {state.next_action!r}")
    print(f"  board status: {[(t.id, t.status) for t in board]}")


if __name__ == "__main__":
    main()
