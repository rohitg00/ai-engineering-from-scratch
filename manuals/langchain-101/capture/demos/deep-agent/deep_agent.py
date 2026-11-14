import json
import sys
import time

from deepagents import create_deep_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_core.callbacks import BaseCallbackHandler
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import InMemorySaver

MODEL = sys.argv[1] if len(sys.argv) > 1 else "qwen3:8b"
ROWS = sys.argv[2] if len(sys.argv) > 2 else "run.jsonl"

CHANGES = """- The sync command now resumes an interrupted upload from the last finished part.
- The config file moved from ~/.tool.toml to the XDG config folder, and the old path still works for one release.
- The --verbose flag was removed. Use --log-level debug in its place."""

TASK = f"""Write release notes for version 2.0 of our command line tool.

The changes are:
{CHANGES}

Do these steps:
1. Write the release notes to /notes/release-2.0.md, with one short paragraph for each change.
2. Ask the editor subagent to review /notes/release-2.0.md.
3. Apply the fixes that the editor returns, with edit_file.
4. Reply with the final text of the file."""

EDITOR = {
    "name": "editor",
    "description": "Reviews a file of release notes and returns a list of fixes. Give it the path of the file.",
    "system_prompt": "You are an editor. Read the file you are given with read_file. Find every sentence with more than 25 words and every sentence in the passive voice. Return a numbered list of fixes, each with the old sentence and the new sentence. Do not edit the file yourself.",
}


class Calls(BaseCallbackHandler):
    def __init__(self):
        self.rows = []
        self.open = {}

    def on_chat_model_start(self, serialized, messages, *, run_id, **kwargs):
        tools = [t.get("function", {}).get("name") for t in (kwargs.get("invocation_params") or {}).get("tools") or []]
        name = (kwargs.get("metadata") or {}).get("lc_agent_name")
        agent = name if name in ("editor", "general-purpose") else "main"
        self.open[run_id] = {"agent": agent, "agent_name": name, "tools": tools, "messages": len(messages[0]), "t0": time.perf_counter()}

    def on_llm_end(self, response, *, run_id, **kwargs):
        row = self.open.pop(run_id)
        msg = response.generations[0][0].message
        usage = msg.usage_metadata or {}
        row.update(seconds=round(time.perf_counter() - row.pop("t0"), 2), input_tokens=usage.get("input_tokens"), output_tokens=usage.get("output_tokens"), tool_calls=[tc["name"] for tc in msg.tool_calls])
        row["n"] = len(self.rows) + 1
        self.rows.append(row)
        print(f"  call {row['n']:>2}  {row['agent']:<6}  in {row['input_tokens']:>5}  out {row['output_tokens']:>4}  {row['seconds']:>5.1f} s  -> {', '.join(row['tool_calls']) or 'answer'}", flush=True)


def main():
    model = ChatOllama(model=MODEL, temperature=0, seed=42, reasoning=False, num_ctx=16384, num_predict=2048)
    agent = create_deep_agent(
        model=model,
        system_prompt="You write clear technical documents. Keep the files you write in /notes/.",
        subagents=[{**EDITOR, "model": model}],
        middleware=[TodoListMiddleware()],
        checkpointer=InMemorySaver(),
    )
    print(f"model {MODEL}, temperature 0, seed 42, deepagents 0.7.38")
    print(f"graph nodes: {', '.join(n for n in agent.get_graph().nodes if not n.startswith('__'))}")
    calls = Calls()
    cfg = {"configurable": {"thread_id": "release-notes"}, "recursion_limit": 60, "callbacks": [calls]}
    started = time.perf_counter()
    error = None
    try:
        agent.invoke({"messages": [{"role": "user", "content": TASK}]}, cfg)
    except Exception as exc:
        error = f"{type(exc).__name__}: {str(exc).splitlines()[0]}"
    seconds = time.perf_counter() - started
    state = agent.get_state(cfg).values
    files = state.get("files", {})
    todos = state.get("todos", [])
    messages = state.get("messages", [])
    print(f"\nrun: {len(calls.rows)} model calls in {seconds:.1f} s{', raised ' + error if error else ''}")
    for agent_name in sorted({r["agent"] for r in calls.rows}):
        mine = [r for r in calls.rows if r["agent"] == agent_name]
        if mine:
            print(f"  {agent_name}: {len(mine)} calls, {sum(r['input_tokens'] or 0 for r in mine)} prompt tokens, {sum(r['output_tokens'] or 0 for r in mine)} output tokens, {len(mine[0]['tools'])} tools bound")
    print(f"  tool calls of the main agent: {', '.join(tc['name'] for m in messages if m.type == 'ai' for tc in m.tool_calls)}")
    for m in messages:
        if m.type == "ai":
            for tc in m.tool_calls:
                if tc["name"] in ("task", "edit_file"):
                    print(f"  call      {tc['name']}({' '.join(json.dumps(tc['args']).split())[:300]})")
        if m.type == "tool" and m.name in ("task", "edit_file"):
            print(f"  result    {m.name}: {' '.join(str(m.content).split())[:900]}")
    print(f"  todos: {json.dumps(todos)}")
    for path, data in sorted(files.items()):
        content = data.get("content") if isinstance(data, dict) else data
        text = "\n".join(content) if isinstance(content, list) else str(content)
        print(f"\nfile {path}, {len(text)} characters:\n{text}")
    print(f"\nlast reply:\n{messages[-1].content if messages else ''}")
    with open(ROWS, "w") as out:
        out.write(json.dumps({"model": MODEL, "seconds": round(seconds, 2), "error": error, "files": sorted(files), "todos": todos, "final": messages[-1].content if messages else None}) + "\n")
        for row in calls.rows:
            out.write(json.dumps(row) + "\n")


if __name__ == "__main__":
    main()
