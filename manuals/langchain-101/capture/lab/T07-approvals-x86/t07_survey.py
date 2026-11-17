import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lr_common import MODEL, MODEL8, chat, header, jl

from langchain.tools import tool


@tool
def send_email(to: str) -> str:
    """Send an email to one address."""
    return f"sent to {to}"


@tool
def delete_file(path: str) -> str:
    """Delete one file by its path."""
    return f"deleted {path}"


SINGLE = ["Send an email to a@x.", "Email a@x to say the report is ready.", "Please notify a@x by email.", "Tell a@x by email that the build passed.",
          "Write to a@x.", "Delete the file /tmp/f.", "Remove /tmp/f please.", "Clean up /tmp/f.", "Can you send a quick note to a@x?",
          "Get rid of the file at /tmp/f."]
TWO = ["Send an email to a@x and delete the file /tmp/f.", "Email a@x, then remove /tmp/f.", "Delete /tmp/f and tell a@x by email that it is gone.",
       "Two things: notify a@x by email, and clean up /tmp/f.", "Please remove /tmp/f and also send a note to a@x.",
       "In one turn, call send_email with to='a@x' and delete_file with path='/tmp/f' at the same time.",
       "Email a@x and b@x.", "Delete /tmp/f and /tmp/g.", "Send an email to a@x, and delete /tmp/f, /tmp/g.",
       "Do both now: email a@x, delete /tmp/f."]


def main():
    out = Path(__file__).resolve().parent / sys.argv[1]
    jl(out, header("t07_survey.py", note="one model call per prompt, tools bound, no agent; temperature 0, seed 42"))
    for model in (MODEL, MODEL8):
        llm = chat(model=model).bind_tools([send_email, delete_file])
        for intent, prompts in (("single", SINGLE), ("two_actions", TWO)):
            for i, pr in enumerate(prompts):
                t0 = time.time()
                m = llm.invoke(pr)
                rec = {"model": model, "intent": intent, "i": i, "prompt": pr, "n_calls": len(m.tool_calls),
                       "calls": [[t["name"], t["args"], bool(t.get("id"))] for t in m.tool_calls], "text": str(m.content)[:200],
                       "invalid": len(m.invalid_tool_calls), "secs": round(time.time() - t0, 2)}
                jl(out, rec)
                print(json.dumps(rec)[:240], flush=True)


if __name__ == "__main__":
    main()
