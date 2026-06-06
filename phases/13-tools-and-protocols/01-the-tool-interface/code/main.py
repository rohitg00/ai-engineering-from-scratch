"""Phase 13 Lesson 01 - the tool interface, four-step loop, no LLM.

Implements the describe -> decide -> execute -> observe cycle used by every
2026 tool-calling stack (OpenAI, Anthropic, Gemini, MCP, A2A). The "decide"
step is faked with a keyword router so the loop runs offline; replace it with
any real provider in Lesson 02.

The harness:
  - registers three tools (add, get_time, get_weather)
  - validates tool-call arguments against a minimal JSON Schema subset
  - prints each step so you can read the choreography
  - bounds iteration at MAX_TURNS to prevent runaway loops

Run: python code/main.py
"""

from __future__ import annotations

import datetime as dt
import json
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any, Callable


MAX_TURNS = 5


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    executor: Callable[[dict], Any]
    consequential: bool = False


def tool_add(args: dict) -> dict:
    return {"sum": args["a"] + args["b"]}


def tool_get_time(args: dict) -> dict:
    tz = args.get("timezone", "UTC")
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    return {"now": now, "timezone": tz}


def tool_get_weather(args: dict) -> dict:
    fake = {"Bengaluru": 28, "Tokyo": 12, "Zurich": 4, "Lagos": 31}
    city = args["city"]
    units = args.get("units", "celsius")
    temp = fake.get(city, 20)
    return {"city": city, "temp": temp, "units": units}


REGISTRY: list[Tool] = [
    Tool(
        name="add",
        description=(
            "Use when the user asks for the sum of two numbers. "
            "Do not use for subtraction, product, or symbolic algebra."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "a": {"type": "number"},
                "b": {"type": "number"},
            },
            "required": ["a", "b"],
        },
        executor=tool_add,
    ),
    Tool(
        name="get_time",
        description=(
            "Use when the user asks what time it is. "
            "Do not use for historical dates or future scheduling."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "timezone": {"type": "string"},
            },
            "required": [],
        },
        executor=tool_get_time,
    ),
    Tool(
        name="get_weather",
        description=(
            "Use when the user asks about current conditions in a named city. "
            "Do not use for forecasts or historical weather data."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "units": {"type": "string", "enum": ["celsius", "fahrenheit"]},
            },
            "required": ["city"],
        },
        executor=tool_get_weather,
    ),
]


def validate(schema: dict, value: Any) -> list[str]:
    errors: list[str] = []
    t = schema.get("type")
    if t == "object":
        if not isinstance(value, dict):
            return [f"expected object, got {type(value).__name__}"]
        for field in schema.get("required", []):
            if field not in value:
                errors.append(f"missing required field '{field}'")
        for key, sub in schema.get("properties", {}).items():
            if key in value:
                errors.extend(validate(sub, value[key]))
        return errors
    if t == "number" and not isinstance(value, (int, float)):
        errors.append(f"expected number, got {type(value).__name__}")
    if t == "string" and not isinstance(value, str):
        errors.append(f"expected string, got {type(value).__name__}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"value {value!r} not in enum {schema['enum']}")
    return errors


def fake_decide(user_msg: str, history: list[dict]) -> dict:
    """Stand-in for the model. Routes by keyword so the loop runs offline.

    Production substitute: swap this for provider.chat.completions.create with
    tools=[t.input_schema for t in REGISTRY]. Same return shape.
    """
    last = history[-1] if history else {}
    if last.get("role") == "tool":
        return {"content": f"Final answer built from tool output: {last.get('content')}"}
    msg = user_msg.lower()
    if re.search(r"\b(add|sum|plus)\b", msg):
        nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", msg)]
        if len(nums) >= 2:
            return {
                "tool_calls": [
                    {
                        "id": f"call_{uuid.uuid4().hex[:8]}",
                        "name": "add",
                        "arguments": {"a": nums[0], "b": nums[1]},
                    }
                ]
            }
    if "time" in msg:
        return {
            "tool_calls": [
                {
                    "id": f"call_{uuid.uuid4().hex[:8]}",
                    "name": "get_time",
                    "arguments": {"timezone": "UTC"},
                }
            ]
        }
    match = re.search(r"weather in (\w+)", msg)
    if match:
        city = match.group(1).title()
        return {
            "tool_calls": [
                {
                    "id": f"call_{uuid.uuid4().hex[:8]}",
                    "name": "get_weather",
                    "arguments": {"city": city, "units": "celsius"},
                }
            ]
        }
    return {"content": "I cannot route that query to any registered tool."}


def run_loop(user_msg: str) -> None:
    print("=" * 72)
    print(f"USER : {user_msg}")
    print("-" * 72)
    tools_by_name = {t.name: t for t in REGISTRY}
    history: list[dict] = [{"role": "user", "content": user_msg}]
    for turn in range(1, MAX_TURNS + 1):
        decision = fake_decide(user_msg, history)
        if "content" in decision:
            print(f"TURN {turn} DECIDE : final answer")
            print(f"MODEL : {decision['content']}")
            return
        for call in decision["tool_calls"]:
            tool = tools_by_name.get(call["name"])
            print(f"TURN {turn} DECIDE : call {call['name']} id={call['id']}")
            print(f"           args = {json.dumps(call['arguments'])}")
            if tool is None:
                print(f"           ERROR : unknown tool {call['name']}")
                return
            errs = validate(tool.input_schema, call["arguments"])
            if errs:
                print(f"           VALIDATION ERRORS : {errs}")
                return
            if tool.consequential:
                print("           GATE : tool is consequential, would confirm")
            start = time.perf_counter()
            result = tool.executor(call["arguments"])
            ms = (time.perf_counter() - start) * 1000
            print(f"TURN {turn} EXECUTE: {tool.name} -> {json.dumps(result)}"
                  f" [{ms:.2f} ms]")
            history.append({
                "role": "tool", "id": call["id"],
                "name": tool.name, "content": json.dumps(result),
            })
        print(f"TURN {turn} OBSERVE: history length = {len(history)}")
    print("LOOP TERMINATED : hit MAX_TURNS circuit breaker")


def describe_registry() -> None:
    print("TOOL REGISTRY")
    print("-" * 72)
    for t in REGISTRY:
        kind = "consequential" if t.consequential else "pure"
        print(f"  {t.name:14s} [{kind}] - {t.description}")
    print()


def main() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 01 - THE TOOL INTERFACE")
    print("=" * 72)
    describe_registry()
    for query in (
        "please add 7 and 35",
        "what time is it?",
        "tell me the weather in Bengaluru",
        "write me a haiku about tea",
    ):
        run_loop(query)
        print()


if __name__ == "__main__":
    main()
