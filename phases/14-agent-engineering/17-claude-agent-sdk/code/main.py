"""Claude Agent SDK harness shape in stdlib.

Built-in tools, subagents with isolated context, lifecycle hooks, session store.
Demonstrates how spawning subagents keeps the orchestrator's context bounded.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Tool:
    name: str
    description: str
    fn: Callable[..., str]


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return sorted(self._tools)


@dataclass
class Hooks:
    pre_tool_use: list[Callable[[str, dict[str, Any]], None]] = field(default_factory=list)
    post_tool_use: list[Callable[[str, str], None]] = field(default_factory=list)
    session_start: list[Callable[[str], None]] = field(default_factory=list)
    session_end: list[Callable[[str], None]] = field(default_factory=list)


@dataclass
class Turn:
    role: str
    content: str


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, list[Turn]] = {}
        self._subkeys: dict[str, list[str]] = {}

    def append(self, session_id: str, turn: Turn) -> None:
        self._sessions.setdefault(session_id, []).append(turn)

    def load(self, session_id: str) -> list[Turn]:
        return list(self._sessions.get(session_id, []))

    def list_sessions(self) -> list[str]:
        return sorted(self._sessions)

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        for sub in self._subkeys.get(session_id, []):
            self._sessions.pop(sub, None)
        self._subkeys.pop(session_id, None)

    def list_subkeys(self, session_id: str) -> list[str]:
        return list(self._subkeys.get(session_id, []))

    def link_sub(self, parent: str, sub: str) -> None:
        self._subkeys.setdefault(parent, []).append(sub)


@dataclass
class AgentRun:
    session_id: str
    context_tokens: int = 0
    tool_calls: list[tuple[str, dict[str, Any], str]] = field(default_factory=list)
    output: str = ""


class Harness:
    def __init__(self, tools: ToolRegistry, hooks: Hooks,
                 store: SessionStore) -> None:
        self.tools = tools
        self.hooks = hooks
        self.store = store
        self._sub_counter = 0

    def _dispatch(self, tool_name: str, args: dict[str, Any]) -> str:
        for hook in self.hooks.pre_tool_use:
            hook(tool_name, args)
        tool = self.tools.get(tool_name)
        if tool is None:
            result = f"error: unknown tool {tool_name!r}"
        else:
            try:
                result = tool.fn(**args)
            except Exception as e:
                result = f"error: {type(e).__name__}: {e}"
        for hook in self.hooks.post_tool_use:
            hook(tool_name, result)
        return result

    def run_agent(self, session_id: str, prompt: str,
                  tool_calls: list[tuple[str, dict[str, Any]]],
                  parent_session: str | None = None) -> AgentRun:
        for hook in self.hooks.session_start:
            hook(session_id)
        if parent_session is not None:
            self.store.link_sub(parent_session, session_id)

        run = AgentRun(session_id=session_id)
        self.store.append(session_id, Turn("user", prompt))
        run.context_tokens += len(prompt.split())

        for tool_name, args in tool_calls:
            result = self._dispatch(tool_name, args)
            run.tool_calls.append((tool_name, args, result))
            self.store.append(session_id, Turn("tool", f"{tool_name}: {result}"))
            run.context_tokens += len(result.split())

        output = f"processed {len(tool_calls)} tools; session={session_id}"
        run.output = output
        self.store.append(session_id, Turn("assistant", output))
        run.context_tokens += len(output.split())

        for hook in self.hooks.session_end:
            hook(session_id)
        return run

    def spawn_subagents(self, parent_session: str,
                        tasks: list[tuple[str, list[tuple[str, dict[str, Any]]]]]
                        ) -> list[AgentRun]:
        runs: list[AgentRun] = []
        for prompt, tool_calls in tasks:
            self._sub_counter += 1
            sub_session = f"{parent_session}.sub{self._sub_counter:02d}"
            run = self.run_agent(sub_session, prompt, tool_calls,
                                 parent_session=parent_session)
            runs.append(run)
        return runs


def _read_file_demo(path: str) -> str:
    return f"[content of {path}: 42 lines]"


def _list_dir_demo(path: str) -> str:
    return f"[{path}: 7 files]"


def main() -> None:
    print("=" * 70)
    print("CLAUDE AGENT SDK SHAPE — Phase 14, Lesson 17")
    print("=" * 70)

    tools = ToolRegistry()
    tools.register(Tool("read_file", "read a file", _read_file_demo))
    tools.register(Tool("list_dir", "list a directory", _list_dir_demo))

    hook_log: list[str] = []
    hooks = Hooks(
        pre_tool_use=[
            lambda n, a: hook_log.append(f"pre[{n}]: {a}")
        ],
        post_tool_use=[
            lambda n, r: hook_log.append(f"post[{n}]: {r[:30]}")
        ],
        session_start=[lambda s: hook_log.append(f"session_start[{s}]")],
        session_end=[lambda s: hook_log.append(f"session_end[{s}]")],
    )

    store = SessionStore()
    harness = Harness(tools, hooks, store)

    parent = "session_main"
    print("\norchestrator starts")
    orchestrator_run = harness.run_agent(
        parent,
        "review these three modules",
        [("list_dir", {"path": "/project"})],
    )
    print(f"  orchestrator context tokens: {orchestrator_run.context_tokens}")

    print("\nspawn three subagents (context isolation)")
    sub_runs = harness.spawn_subagents(parent, [
        ("review module a", [("read_file", {"path": "a.py"})]),
        ("review module b", [("read_file", {"path": "b.py"})]),
        ("review module c", [("read_file", {"path": "c.py"})]),
    ])
    for run in sub_runs:
        print(f"  sub {run.session_id}  tokens={run.context_tokens}  "
              f"tool_calls={len(run.tool_calls)}")
    print(f"  orchestrator context tokens remain: "
          f"{orchestrator_run.context_tokens}")

    print("\nsession store")
    for sid in store.list_sessions():
        print(f"  {sid}  turns={len(store.load(sid))}")
    print(f"  subkeys of {parent}: {store.list_subkeys(parent)}")

    print("\nhooks fired")
    for line in hook_log[:10]:
        print(f"  {line}")
    print(f"  ... {len(hook_log)} hook events total")

    print("\ndelete parent (cascades to subs)")
    store.delete(parent)
    print(f"  remaining sessions: {store.list_sessions()}")

    print()
    print("subagent results return to orchestrator; orchestrator context is preserved.")


if __name__ == "__main__":
    main()
