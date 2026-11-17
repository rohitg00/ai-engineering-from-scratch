import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))

from real import TimedChatOllama, chat, settings, machine as rmachine
from instrument import PIN, Recorder, instrument, logging_saver
from langchain.agents import create_agent
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def get_weather(city: str) -> str:
    """Return the weather for a city."""
    return f"{city}: sunny"


def main():
    rec = Recorder()
    model = chat()
    saver = logging_saver(InMemorySaver, rec)
    agent = create_agent(model, [get_weather], checkpointer=saver)
    cfg = {"configurable": {"thread_id": "t1"}}
    with instrument(rec):
        out = agent.invoke({"messages": [{"role": "user", "content": "Weather in Paris and Oslo?"}]}, cfg)
    rec.dump(HERE / "trace.jsonl")

    lines = [f"# Superstep trace, create_agent, 1 run, InMemorySaver, durability=async (default), real model", f"# pin {PIN}", f"# {rmachine()}", f"# model {settings()}", f"# prompt: 'Weather in Paris and Oslo?'", ""]
    for e in rec.events:
        k = e["event"]
        if k == "prepare_next_tasks" and e["for_execution"]:
            lines.append(f"[{e['seq']:3}] PLAN step={e['step']} stop={e['stop']} updated_channels={e['updated_channels']}")
            for t in e["tasks"]:
                lines.append(f"        task {t['kind']:4} {t['name']:<6} id={t['id']} path={t['path']} triggers={t['triggers']}")
            lines.append(f"        versions_seen(before)={e['versions_seen']}")
        elif k == "tick":
            lines.append(f"[{e['seq']:3}] TICK step={e['step']} returns={e['returns']} status={e['status']} run={[t['name'] for t in e['tasks_to_run']]}")
            lines.append(f"        channel_versions={e['channel_versions']}")
        elif k == "loop.put_writes":
            lines.append(f"[{e['seq']:3}]   EXEC-DONE step={e['step']} task={e['task']} id={e['task_id']} writes={e['writes']}")
        elif k == "saver.put_writes":
            lines.append(f"[{e['seq']:3}]     saver.put_writes against ckpt ...{e['against_checkpoint']} task={e['task_id']} path={e['task_path']!r} channels={e['channels']}")
        elif k == "apply_writes":
            lines.append(f"[{e['seq']:3}] UPDATE order={e['task_order']}")
            for w in e["writes_in_apply_order"]:
                lines.append(f"        apply {w['task']:<10} {w['channel']:<22} {w['value']}")
            lines.append(f"        versions_changed={e['versions_changed']}")
            lines.append(f"        versions_seen_updated={e['versions_seen_updated']}")
            lines.append(f"        updated_channels={e['updated_channels']}")
        elif k == "loop._put_checkpoint":
            lines.append(f"[{e['seq']:3}] CHECKPOINT source={e['source']} exiting={e['exiting']} id=...{e['checkpoint_id']} step->{e['step_after']}")
        elif k == "saver.put":
            lines.append(f"[{e['seq']:3}]     saver.put id=...{e['checkpoint_id']} parent=...{e['parent_id']} source={e['source']} step={e['step']} new_versions={e['new_versions']}")
        elif k == "after_tick":
            lines.append(f"[{e['seq']:3}] AFTER_TICK ran step {e['step_ran']} -> next {e['next_step']} updated_channels(ckpt)={e['updated_channels']}")
            lines.append("")
    lines.append("model calls (provider time per call, s): " + json.dumps([round(c["model_s"], 3) for c in TimedChatOllama.calls]) + " tool calls per model call: " + json.dumps([c["n_tool_calls"] for c in TimedChatOllama.calls]) + " tokens in/out: " + json.dumps([(c["prompt_eval_count"], c["eval_count"]) for c in TimedChatOllama.calls]))
    lines.append("final messages: " + json.dumps([f"{m.type}:{m.text[:80]}" for m in out["messages"]]))
    (HERE / "trace.txt").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
