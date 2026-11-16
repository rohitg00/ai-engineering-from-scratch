import json
import os
import time

from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.tools import tool
from langchain_ollama import ChatOllama

LOG = os.environ.get("CHATUI_EVENTS", "/dev/null")
MODEL = "qwen3:4b-instruct-2507-q4_K_M"
WEATHER = {"paris": "14 C, light rain", "tokyo": "19 C, clear", "lagos": "31 C, humid"}


def log(kind, **fields):
    with open(LOG, "a") as f:
        f.write(json.dumps({"t": time.time(), "kind": kind, **fields}) + "\n")


class TokenClock(BaseCallbackHandler):
    def __init__(self):
        self.first = {}

    def on_chat_model_start(self, serialized, messages, *, run_id, **kw):
        self.first[run_id] = None
        log("model_start", run_id=str(run_id))

    def on_llm_new_token(self, token, *, run_id, **kw):
        if self.first.get(run_id) is None and token:
            self.first[run_id] = time.time()
            log("first_token", run_id=str(run_id), token=token[:40])

    def on_llm_end(self, response, *, run_id, **kw):
        msg = response.generations[0][0].message
        log("model_end", run_id=str(run_id), tool_calls=[c["name"] for c in getattr(msg, "tool_calls", [])],
            chars=len(msg.text) if hasattr(msg, "text") else None)


@tool
def get_weather(city: str) -> str:
    """Return the current weather for a city."""
    log("tool_run", name="get_weather", args={"city": city})
    return WEATHER.get(city.strip().lower(), "no data for that city")


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to one address."""
    log("tool_run", name="send_email", args={"to": to, "subject": subject, "body": body})
    return json.dumps({"status": "sent", "to": to, "subject": subject})


def model():
    return ChatOllama(model=MODEL, temperature=0, seed=42, num_predict=512, reasoning=False, callbacks=[TokenClock()])


SYSTEM = "You are a helpful assistant. Use get_weather for weather questions and send_email to send email. Keep replies short."
GATE = {"send_email": {"allowed_decisions": ["approve", "edit", "reject"]}}

agent = create_agent(model(), tools=[get_weather, send_email], system_prompt=SYSTEM,
                     middleware=[HumanInTheLoopMiddleware(GATE)])

agent_percall = create_agent(model(), tools=[get_weather, send_email], system_prompt=SYSTEM,
                             middleware=[HumanInTheLoopMiddleware(GATE, interrupt_mode="per_call")])
