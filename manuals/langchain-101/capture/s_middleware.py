import os
import tempfile

from langchain.agents import create_agent
from langchain.agents.middleware import (
    AutoModeMiddleware,
    ClearToolUsesEdit,
    ContextEditingMiddleware,
    FilesystemFileSearchMiddleware,
    HostExecutionPolicy,
    HumanInTheLoopMiddleware,
    LLMToolEmulator,
    LLMToolSelectorMiddleware,
    ModelCallLimitMiddleware,
    ModelChoice,
    ModelFallbackMiddleware,
    ModelRefusalMiddleware,
    ModelRetryMiddleware,
    ModelRouterMiddleware,
    PIIMiddleware,
    ProviderToolSearchMiddleware,
    ShellToolMiddleware,
    SummarizationMiddleware,
    TodoListMiddleware,
    ToolCallLimitMiddleware,
    ToolRetryMiddleware,
    dynamic_prompt,
)
from langchain.tools import tool
from langchain_core.decisions import ChoiceAnswer, NoulAnswer
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from common import ASK, add, ask, lookup_order, model, show_log, thread
from fake import ScriptedDecisionModel, call, calls


def run(cap, title, fake, tools=(add,), middleware=(), inp=ASK, extra=(), first=1, **kwargs):
    cap.section(title)
    agent = create_agent(fake, tools=list(tools), middleware=list(middleware), **kwargs)
    out = cap.attempt("invoke", lambda: agent.invoke(inp))
    if out is not None:
        cap.messages(out["messages"][first:])
        for key in extra:
            cap.json(out.get(key), key)
    show_log(cap, fake)
    return out


def summarization(cap):
    summarizer = model("The user asked to add numbers; the tool returned 5 and 9.", label="summarizer")
    history = [
        {"role": "user", "content": "What is 2 + 3?"},
        {"role": "assistant", "content": "", "tool_calls": [{"name": "add", "args": {"a": 2, "b": 3}, "id": "call_0"}]},
        {"role": "tool", "content": "5", "tool_call_id": "call_0"},
        {"role": "assistant", "content": "The sum is 5."},
        {"role": "user", "content": "And 4 + 5?"},
        {"role": "assistant", "content": "The sum is 9."},
        {"role": "user", "content": "Now 1 + 1?"},
    ]
    fake = model("The sum is 2.", label="agent")
    mw = SummarizationMiddleware(model=summarizer, trigger=("messages", 6), keep=("messages", 2))
    run(cap, "SummarizationMiddleware(trigger=('messages', 6), keep=('messages', 2)) with 7 messages", fake, middleware=[mw], inp={"messages": history}, first=0)
    show_log(cap, summarizer)
    fake = model("The sum is 2.", label="agent-no-trigger")
    mw = SummarizationMiddleware(model=model(label="unused"))
    run(cap, "SummarizationMiddleware with the default trigger=None never summarizes", fake, middleware=[mw], inp={"messages": history}, first=6)


def limits(cap):
    run(cap, "ModelCallLimitMiddleware(run_limit=1), exit_behavior='end'",
        model(call("add", {"a": 2, "b": 3}), AIMessage("never sent"), label="limit-end"), middleware=[ModelCallLimitMiddleware(run_limit=1)])
    run(cap, "ModelCallLimitMiddleware(run_limit=1, exit_behavior='error')",
        model(call("add", {"a": 2, "b": 3}), AIMessage("never sent"), label="limit-error"), middleware=[ModelCallLimitMiddleware(run_limit=1, exit_behavior="error")])
    cap.section("ModelCallLimitMiddleware(thread_limit=2) across two turns on one thread")
    fake = model(AIMessage("one"), AIMessage("two"), AIMessage("three"), label="thread-limit")
    agent = create_agent(fake, middleware=[ModelCallLimitMiddleware(thread_limit=2)], checkpointer=InMemorySaver())
    for turn in ("first", "second", "third"):
        out = agent.invoke(ask(turn), thread("limits"))
        cap.messages(out["messages"][-1:], f"turn {turn}: last message")
        values = agent.get_state(thread("limits")).values
        cap.json({k: values.get(k) for k in ("thread_model_call_count", "run_model_call_count")}, f"turn {turn}: counters in the checkpoint")
    def two_adds(label):
        return model(calls(("add", {"a": 1, "b": 1}, "call_a"), ("add", {"a": 2, "b": 2}, "call_b")), AIMessage("done"), label=label)

    run(cap, "ToolCallLimitMiddleware(tool_name='add', run_limit=1), two calls in one message, exit_behavior='continue'",
        two_adds("tool-limit"), middleware=[ToolCallLimitMiddleware(tool_name="add", run_limit=1)])
    run(cap, "ToolCallLimitMiddleware(run_limit=1, exit_behavior='end')",
        two_adds("tool-limit-end"), middleware=[ToolCallLimitMiddleware(run_limit=1, exit_behavior="end")])
    run(cap, "ToolCallLimitMiddleware(run_limit=1, exit_behavior='error')",
        two_adds("tool-limit-error"), middleware=[ToolCallLimitMiddleware(run_limit=1, exit_behavior="error")])


def retries(cap):
    attempts = []

    @tool
    def flaky_fetch(url: str) -> str:
        """Fetch a URL from a service that fails twice."""
        attempts.append(url)
        if len(attempts) < 3:
            raise ConnectionError(f"attempt {len(attempts)} refused")
        return f"200 OK from {url}"

    fast = {"initial_delay": 0.0, "jitter": False}
    run(cap, "ToolRetryMiddleware(max_retries=2): the tool fails twice, then succeeds",
        model(call("flaky_fetch", {"url": "http://svc.local/a"}), AIMessage("fetched"), label="tool-retry"),
        tools=[flaky_fetch], middleware=[ToolRetryMiddleware(max_retries=2, **fast)])
    cap.json(attempts, "tool attempts")
    attempts.clear()
    run(cap, "ToolRetryMiddleware(max_retries=1, on_failure='continue'): retries run out",
        model(call("flaky_fetch", {"url": "http://svc.local/b"}), AIMessage("gave up"), label="tool-retry-out"),
        tools=[flaky_fetch], middleware=[ToolRetryMiddleware(max_retries=1, **fast)])
    cap.json(attempts, "tool attempts")
    attempts.clear()
    run(cap, "ToolRetryMiddleware(max_retries=1, on_failure='error')",
        model(call("flaky_fetch", {"url": "http://svc.local/c"}), AIMessage("never"), label="tool-retry-error"),
        tools=[flaky_fetch], middleware=[ToolRetryMiddleware(max_retries=1, on_failure="error", **fast)])
    run(cap, "ModelRetryMiddleware(max_retries=2): the model fails twice, then answers",
        model(TimeoutError("read timed out"), ConnectionError("connection reset"), AIMessage("The sum is 5."), label="model-retry"),
        tools=[], middleware=[ModelRetryMiddleware(max_retries=2, **fast)])
    run(cap, "ModelRetryMiddleware(max_retries=1), on_failure='continue': the error becomes an AIMessage",
        model(TimeoutError("read timed out"), TimeoutError("read timed out again"), label="model-retry-out"),
        tools=[], middleware=[ModelRetryMiddleware(max_retries=1, **fast)])
    run(cap, "ModelRetryMiddleware(retry_on=(TimeoutError,)) does not retry a ValueError",
        model(ValueError("bad request"), AIMessage("unused"), label="model-retry-filter"),
        tools=[], middleware=[ModelRetryMiddleware(max_retries=2, retry_on=(TimeoutError,), on_failure="error", **fast)])


def fallback(cap):
    primary = model(ConnectionError("primary is down"), label="primary")
    backup = model(AIMessage("The sum is 5, from the backup."), label="backup")
    run(cap, "ModelFallbackMiddleware(backup): the primary raises", primary, tools=[], middleware=[ModelFallbackMiddleware(backup)])
    show_log(cap, backup)
    primary = model(ConnectionError("primary is down"), label="primary-2")
    second = model(ConnectionError("second is down"), label="second")
    third = model(ConnectionError("third is down"), label="third")
    run(cap, "every model in the chain raises", primary, tools=[], middleware=[ModelFallbackMiddleware(second, third)])
    def refuser(label):
        return model(AIMessage(content=[{"type": "refusal", "refusal": "I can't help with that."}]), label=label)

    run(cap, "a refusal block without ModelRefusalMiddleware is a normal answer", refuser("refuser"), tools=[])
    run(cap, "ModelRefusalMiddleware raises on a refusal", refuser("refuser-2"), tools=[], middleware=[ModelRefusalMiddleware()])
    backup = model(AIMessage("Here is a safe answer."), label="backup-2")
    run(cap, "ModelFallbackMiddleware then ModelRefusalMiddleware: the refusal falls back", refuser("refuser-3"), tools=[], middleware=[ModelFallbackMiddleware(backup), ModelRefusalMiddleware()])


def pii(cap):
    text = "Mail ada@example.com, card 4111 1111 1111 1111, from 192.168.1.20, see https://example.com/x"
    for pii_type, strategy in (("email", "redact"), ("credit_card", "mask"), ("ip", "hash"), ("url", "redact")):
        fake = model(AIMessage("Noted."), label=f"pii-{pii_type}-{strategy}")
        run(cap, f"PIIMiddleware('{pii_type}', strategy='{strategy}') on input", fake, tools=[], middleware=[PIIMiddleware(pii_type, strategy=strategy)], inp=ask(text), first=0)
    run(cap, "PIIMiddleware('email', strategy='block')", model(AIMessage("unused"), label="pii-block"), tools=[], middleware=[PIIMiddleware("email", strategy="block")], inp=ask(text))
    run(cap, "PIIMiddleware('email', apply_to_output=True) on the model's answer", model(AIMessage("Write to grace@example.org."), label="pii-out"), tools=[],
        middleware=[PIIMiddleware("email", strategy="redact", apply_to_input=False, apply_to_output=True)], inp=ask("Who do I write to?"), first=0)
    run(cap, "a custom detector: PIIMiddleware('api_key', detector=regex)", model(AIMessage("ok"), label="pii-custom"), tools=[],
        middleware=[PIIMiddleware("api_key", detector=r"sk-[a-z0-9]{8}", strategy="redact")], inp=ask("my key is sk-abcd1234"), first=0)


def hitl_batched(cap):
    checkpointer = InMemorySaver()
    fake = model(calls(("add", {"a": 2, "b": 3}, "call_a"), ("lookup_order", {"order_id": "A-17"}, "call_b")), AIMessage("Done."), label="hitl-batched")
    agent = create_agent(fake, tools=[add, lookup_order], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True, "lookup_order": {"allowed_decisions": ["approve", "reject"]}})], checkpointer=checkpointer)
    cfg = thread("hitl-batched")
    cap.section("batched: two gated calls, one interrupt")
    result = agent.invoke(ASK, cfg, version="v2")
    cap.json(result.interrupts, "interrupts")
    cap.json(agent.get_state(cfg).next, "state.next")
    cap.section("resume with one decision per call, in order: edit the first, reject the second")
    decisions = {"decisions": [
        {"type": "edit", "edited_action": {"name": "add", "args": {"a": 20, "b": 30}}},
        {"type": "reject", "message": "Do not look up orders."},
    ]}
    result = agent.invoke(Command(resume=decisions), cfg, version="v2")
    cap.messages(result.value["messages"][1:])
    cap.section("a wrong number of decisions")
    fake = model(calls(("add", {"a": 2, "b": 3}, "call_a"), ("add", {"a": 1, "b": 1}, "call_b")), AIMessage("Done."), label="hitl-count")
    agent = create_agent(fake, tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True})], checkpointer=InMemorySaver())
    agent.invoke(ASK, thread("hitl-count"))
    cap.attempt("resume with 1 decision for 2 calls", lambda: agent.invoke(Command(resume={"decisions": [{"type": "approve"}]}), thread("hitl-count")))
    cap.section("respond: the human answers in place of the tool")
    fake = model(call("add", {"a": 2, "b": 3}), AIMessage("Thanks."), label="hitl-respond")
    agent = create_agent(fake, tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True})], checkpointer=InMemorySaver())
    agent.invoke(ASK, thread("hitl-respond"))
    out = agent.invoke(Command(resume={"decisions": [{"type": "respond", "message": "It is 5, I checked."}]}), thread("hitl-respond"))
    cap.messages(out["messages"][1:])


def hitl_per_call(cap):
    fake = model(calls(("add", {"a": 2, "b": 3}, "call_a"), ("add", {"a": 4, "b": 5}, "call_b")), AIMessage("Done."), label="hitl-per-call")
    agent = create_agent(fake, tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True}, interrupt_mode="per_call")], checkpointer=InMemorySaver())
    cfg = thread("hitl-per-call")
    cap.section("per_call: one interrupt per gated call")
    result = agent.invoke(ASK, cfg, version="v2")
    interrupts = sorted(result.interrupts, key=lambda i: i.value["tool_call_id"])
    for item in interrupts:
        cap.json({"id": item.id, "value": item.value}, f"interrupt for {item.value['tool_call_id']}")
        cap.json(item.response_schema.model_json_schema() if hasattr(item.response_schema, "model_json_schema") else item.response_schema, "response_schema")
    cap.json(sorted(agent.get_state(cfg).next), "state.next")
    cap.section("resume with a map of interrupt id to decision")
    answers = {interrupts[0].id: {"type": "approve"}, interrupts[1].id: {"type": "reject", "message": "Not this one."}}
    result = agent.invoke(Command(resume=answers), cfg, version="v2")
    cap.messages(result.value["messages"][1:])
    cap.section("a decision that does not match response_schema")
    fake = model(call("add", {"a": 2, "b": 3}), AIMessage("Done."), label="hitl-bad")
    agent = create_agent(fake, tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": {"allowed_decisions": ["approve"]}}, interrupt_mode="per_call")], checkpointer=InMemorySaver())
    result = agent.invoke(ASK, thread("hitl-bad"), version="v2")
    only = result.interrupts[0]
    cap.attempt("resume with reject when only approve is allowed", lambda: agent.invoke(Command(resume={only.id: {"type": "reject"}}), thread("hitl-bad")))
    cap.json(agent.get_state(thread("hitl-bad")).next, "state.next after the bad answer")


def todo_and_context(cap):
    todos = [{"content": "Add 2 and 3", "status": "in_progress"}, {"content": "Report the sum", "status": "pending"}]
    done = [{"content": "Add 2 and 3", "status": "completed"}, {"content": "Report the sum", "status": "completed"}]
    fake = model(call("write_todos", {"todos": todos}, "call_t1"), call("add", {"a": 2, "b": 3}, "call_a"), call("write_todos", {"todos": done}, "call_t2"), AIMessage("The sum is 5."), label="todo")
    out = run(cap, "TodoListMiddleware: write_todos updates state['todos']", fake, middleware=[TodoListMiddleware()], extra=("todos",))
    cap.section("the system prompt TodoListMiddleware adds (first 300 characters)")
    first_call = fake.log[0]["messages"][0]
    cap.text(first_call[:300])
    cap.section("ContextEditingMiddleware(ClearToolUsesEdit(trigger=10, keep=1))")
    history = [{"role": "user", "content": "Add three pairs."}]
    for index, (a, b) in enumerate(((1, 1), (2, 2), (3, 3))):
        history.append({"role": "assistant", "content": "", "tool_calls": [{"name": "add", "args": {"a": a, "b": b}, "id": f"call_{index}"}]})
        history.append({"role": "tool", "content": f"result {a + b} " * 5, "tool_call_id": f"call_{index}"})
    seen = []
    fake = model(lambda messages: seen.append([m.content for m in messages]) or AIMessage("2, 4, 6."), label="context-edit")
    create_agent(fake, tools=[add], middleware=[ContextEditingMiddleware(edits=[ClearToolUsesEdit(trigger=10, keep=1)])]).invoke({"messages": history})
    cap.json(seen[0], "message contents the model received")


def selection_and_emulation(cap):
    @tool
    def get_weather(city: str) -> str:
        """Get the weather for a city."""
        return f"Sunny in {city}"

    @tool
    def send_email(to: str, body: str) -> str:
        """Send an email."""
        return "sent"

    selector = model(call("ToolSelectionResponse", {"tools": ["get_weather"]}, "call_s1"), call("ToolSelectionResponse", {"tools": ["get_weather"]}, "call_s2"), label="selector")
    fake = model(call("get_weather", {"city": "Pune"}), AIMessage("It is sunny in Pune."), label="agent")
    run(cap, "LLMToolSelectorMiddleware(model=selector, max_tools=1)", fake, tools=[add, get_weather, send_email], middleware=[LLMToolSelectorMiddleware(model=selector, max_tools=1)], inp=ask("Weather in Pune?"))
    show_log(cap, selector)
    emulator = model(AIMessage("Emulated: sent to ops@example.com"), label="emulator")
    fake = model(call("send_email", {"to": "ops@example.com", "body": "hi"}), AIMessage("Email sent."), label="agent-emulated")
    run(cap, "LLMToolEmulator(tools=['send_email'], model=emulator): the tool body never runs", fake, tools=[send_email], middleware=[LLMToolEmulator(tools=["send_email"], model=emulator)], inp=ask("Email ops."))
    show_log(cap, emulator)
    cap.section("ProviderToolSearchMiddleware on a model with no tool search")
    agent = create_agent(model(AIMessage("unused"), label="search"), tools=[add, get_weather], middleware=[ProviderToolSearchMiddleware(searchable_tools=["get_weather"])])
    cap.attempt("invoke", lambda: agent.invoke(ASK))
    cap.section("ProviderToolSearchMiddleware with nothing deferred passes the request through")
    fake = model(AIMessage("No search needed."), label="search-none")
    out = create_agent(fake, tools=[add], middleware=[ProviderToolSearchMiddleware()]).invoke(ASK)
    cap.messages(out["messages"][1:])

    @dynamic_prompt
    def by_user(request):
        return f"You are helping {request.runtime.context['user']}."

    fake = model(AIMessage("Hello Ada."), label="dynamic")
    cap.section("dynamic_prompt sets the system prompt from runtime context")
    create_agent(fake, middleware=[by_user]).invoke(ask("hi"), context={"user": "Ada"})
    show_log(cap, fake)


def shell_and_files(cap):
    root = tempfile.mkdtemp(prefix="m101-")
    with open(os.path.join(root, "notes.md"), "w", encoding="utf-8") as handle:
        handle.write("# Notes\nThe answer is 42.\n")
    os.makedirs(os.path.join(root, "src"))
    with open(os.path.join(root, "src", "app.py"), "w", encoding="utf-8") as handle:
        handle.write("ANSWER = 42\n")
    fake = model(call("glob_search", {"pattern": "**/*.py"}, "call_g"), call("grep_search", {"pattern": "42"}, "call_r"), AIMessage("Found it."), label="files")
    run(cap, "FilesystemFileSearchMiddleware(root_path=tmp, use_ripgrep=False)", fake, tools=[], middleware=[FilesystemFileSearchMiddleware(root_path=root, use_ripgrep=False)], inp=ask("Where is 42?"))
    fake = model(call("shell", {"command": "printf 'hello from %s\\n' shell && ls"}, "call_sh"), AIMessage("Listed."), label="shell")
    run(cap, "ShellToolMiddleware(workspace_root=tmp, execution_policy=HostExecutionPolicy())", fake, tools=[],
        middleware=[ShellToolMiddleware(workspace_root=root, execution_policy=HostExecutionPolicy(), env={"PATH": "/usr/bin:/bin", "LC_ALL": "C"})], inp=ask("List the files."))


def decisions(cap):
    route = ScriptedDecisionModel(answer=lambda state, questions: {"model_route": ChoiceAnswer(type="choice", choice="fast", probabilities={"fast": 0.9, "deep": 0.1}, confidence=0.8)})
    fast = model(AIMessage("5, from the fast model."), label="fast")
    deep = model(AIMessage("unused"), label="deep")
    agent_model = model(AIMessage("unused"), label="default")
    router = ModelRouterMiddleware(choices={"fast": ModelChoice(model=fast, criteria="arithmetic and short answers"), "deep": ModelChoice(model=deep, criteria="long reasoning")}, instructions="Pick the cheapest model that can answer.", classifier=route)
    run(cap, "ModelRouterMiddleware (beta) with a scripted decision model", agent_model, tools=[], middleware=[router], extra=("model_route",))
    show_log(cap, fast)
    cap.json(route.log, "questions the router asked")

    @tool
    def delete_branch(name: str) -> str:
        """Delete a git branch."""
        return f"deleted {name}"

    risk = ScriptedDecisionModel(answer=lambda state, questions: {"is_risky": NoulAnswer(type="noul", noul=0.93 if state["tool_call"]["name"] == "delete_branch" else 0.05)})
    fake = model(calls(("delete_branch", {"name": "main"}, "call_d"), ("add", {"a": 2, "b": 3}, "call_a")), AIMessage("I could not delete main."), label="auto-mode")
    run(cap, "AutoModeMiddleware(tools=['delete_branch', 'add']) with a scripted decision model", fake, tools=[delete_branch, add], middleware=[AutoModeMiddleware(tools=["delete_branch", "add"], classifier=risk)], inp=ask("Delete main and add 2 and 3."))
    cap.json(risk.log[0], "the question the classifier saw")


SCENARIOS = [
    ("mw-summarization", "SummarizationMiddleware with a trigger", summarization),
    ("mw-call-limits", "Model call and tool call limits", limits),
    ("mw-retries", "Tool retry and model retry", retries),
    ("mw-fallback-refusal", "Model fallback and refusals", fallback),
    ("mw-pii", "PIIMiddleware strategies", pii),
    ("mw-hitl-batched", "Human in the loop, batched", hitl_batched),
    ("mw-hitl-per-call", "Human in the loop, per call", hitl_per_call),
    ("mw-todo-context-editing", "Todo list and context editing", todo_and_context),
    ("mw-selection-emulation", "Tool selection, tool emulation, provider tool search, dynamic prompt", selection_and_emulation),
    ("mw-shell-files", "Shell tool and file search", shell_and_files),
    ("mw-decisions", "Model router and auto mode (decision models)", decisions),
]
