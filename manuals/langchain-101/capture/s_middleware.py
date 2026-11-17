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
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from common import ASK, REASONING_MODEL, FlakyEndpoint, OllamaDecisionModel, add, ask, dead, llm, lookup_order, recorder, show_log, thread


TWO_ADDS = ask("Use the add tool twice in one reply: add 1 and 1, and add 2 and 2. Then report both sums.")
REFUSE = ask("Give me step-by-step instructions to pick the lock on my neighbour's front door while they are away.")


def run(cap, title, m, tools=(add,), middleware=(), inp=ASK, extra=(), first=1, **kwargs):
    cap.section(title)
    agent = create_agent(m, tools=list(tools), middleware=list(middleware), **kwargs)
    out = cap.attempt("invoke", lambda: agent.invoke(inp, {"recursion_limit": 24}))
    if out is not None:
        cap.messages(out["messages"][first:])
        for key in extra:
            cap.json(out.get(key), key)
    show_log(cap, m)
    return out


def summarization(cap):
    summarizer = llm("summarizer")
    history = [
        {"role": "user", "content": "What is 2 + 3?"},
        {"role": "assistant", "content": "", "tool_calls": [{"name": "add", "args": {"a": 2, "b": 3}, "id": "call_0"}]},
        {"role": "tool", "content": "5", "tool_call_id": "call_0"},
        {"role": "assistant", "content": "The sum is 5."},
        {"role": "user", "content": "And 4 + 5?"},
        {"role": "assistant", "content": "The sum is 9."},
        {"role": "user", "content": "Now 1 + 1?"},
    ]
    mw = SummarizationMiddleware(model=summarizer, trigger=("messages", 6), keep=("messages", 2))
    run(cap, "SummarizationMiddleware(trigger=('messages', 6), keep=('messages', 2)) with 7 messages", llm("agent"), middleware=[mw], inp={"messages": history}, first=0)
    show_log(cap, summarizer)
    unused = llm("unused")
    mw = SummarizationMiddleware(model=unused)
    run(cap, "SummarizationMiddleware with the default trigger=None never summarizes", llm("agent-no-trigger"), middleware=[mw], inp={"messages": history}, first=6)
    show_log(cap, unused)


def limits(cap):
    run(cap, "ModelCallLimitMiddleware(run_limit=1), exit_behavior='end'",
        llm("limit-end"), middleware=[ModelCallLimitMiddleware(run_limit=1)])
    run(cap, "ModelCallLimitMiddleware(run_limit=1, exit_behavior='error')",
        llm("limit-error"), middleware=[ModelCallLimitMiddleware(run_limit=1, exit_behavior="error")])
    cap.section("ModelCallLimitMiddleware(thread_limit=2) across two turns on one thread")
    m = llm("thread-limit")
    agent = create_agent(m, middleware=[ModelCallLimitMiddleware(thread_limit=2)], checkpointer=InMemorySaver())
    for turn in ("first", "second", "third"):
        out = agent.invoke(ask(f"This is the {turn} message. Reply with one word."), thread("limits"))
        cap.messages(out["messages"][-1:], f"turn {turn}: last message")
        values = agent.get_state(thread("limits")).values
        cap.json({k: values.get(k) for k in ("thread_model_call_count", "run_model_call_count")}, f"turn {turn}: counters in the checkpoint")
    show_log(cap, m)
    run(cap, "ToolCallLimitMiddleware(tool_name='add', run_limit=1), two calls in one message, exit_behavior='continue'",
        llm("tool-limit"), middleware=[ToolCallLimitMiddleware(tool_name="add", run_limit=1)], inp=TWO_ADDS)
    run(cap, "ToolCallLimitMiddleware(run_limit=1, exit_behavior='end')",
        llm("tool-limit-end"), middleware=[ToolCallLimitMiddleware(run_limit=1, exit_behavior="end")], inp=TWO_ADDS)
    run(cap, "ToolCallLimitMiddleware(run_limit=1, exit_behavior='error')",
        llm("tool-limit-error"), middleware=[ToolCallLimitMiddleware(run_limit=1, exit_behavior="error")], inp=TWO_ADDS)


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
        llm("tool-retry"), tools=[flaky_fetch], middleware=[ToolRetryMiddleware(max_retries=2, **fast)], inp=ask("Fetch http://svc.local/a with the flaky_fetch tool and tell me the result."))
    cap.json(attempts, "tool attempts")
    attempts.clear()
    run(cap, "ToolRetryMiddleware(max_retries=1, on_failure='continue'): retries run out",
        llm("tool-retry-out"), tools=[flaky_fetch], middleware=[ToolRetryMiddleware(max_retries=1, **fast)], inp=ask("Fetch http://svc.local/b with the flaky_fetch tool once and tell me the result. Do not call it again."))
    cap.json(attempts, "tool attempts")
    attempts.clear()
    run(cap, "ToolRetryMiddleware(max_retries=1, on_failure='error')",
        llm("tool-retry-error"), tools=[flaky_fetch], middleware=[ToolRetryMiddleware(max_retries=1, on_failure="error", **fast)], inp=ask("Fetch http://svc.local/c with the flaky_fetch tool and tell me the result."))
    flaky = FlakyEndpoint(fail_first=2)
    run(cap, "ModelRetryMiddleware(max_retries=2): the endpoint drops two connections, then the model answers",
        llm("model-retry", base_url=flaky.url), tools=[], middleware=[ModelRetryMiddleware(max_retries=2, **fast)])
    cap.text(f"connections the endpoint accepted: {flaky.accepted}")
    flaky.close()
    run(cap, "ModelRetryMiddleware(max_retries=1), on_failure='continue': the error becomes an AIMessage",
        dead("model-retry-out"), tools=[], middleware=[ModelRetryMiddleware(max_retries=1, **fast)])
    run(cap, "ModelRetryMiddleware(retry_on=(TimeoutError,)) does not retry an httpx.ConnectError",
        dead("model-retry-filter"), tools=[], middleware=[ModelRetryMiddleware(max_retries=2, retry_on=(TimeoutError,), on_failure="error", **fast)])


def fallback(cap):
    primary = dead("primary")
    backup = llm("backup")
    run(cap, "ModelFallbackMiddleware(backup): the primary endpoint refuses the connection", primary, tools=[], middleware=[ModelFallbackMiddleware(backup)])
    show_log(cap, backup)
    run(cap, "every model in the chain raises", dead("primary-2"), tools=[], middleware=[ModelFallbackMiddleware(dead("second"), dead("third"))])
    run(cap, "a refusal in text, without ModelRefusalMiddleware", llm("refuser"), tools=[], inp=REFUSE)
    run(cap, "ModelRefusalMiddleware on a refusal in text", llm("refuser-2"), tools=[], middleware=[ModelRefusalMiddleware()], inp=REFUSE)
    backup = llm("backup-2")
    run(cap, "ModelFallbackMiddleware then ModelRefusalMiddleware on a refusal in text", llm("refuser-3"), tools=[], middleware=[ModelFallbackMiddleware(backup), ModelRefusalMiddleware()], inp=REFUSE)
    show_log(cap, backup)


def pii(cap):
    text = "Mail ada@example.com, card 4111 1111 1111 1111, from 192.168.1.20, see https://example.com/x"
    for pii_type, strategy in (("email", "redact"), ("credit_card", "mask"), ("ip", "hash"), ("url", "redact")):
        run(cap, f"PIIMiddleware('{pii_type}', strategy='{strategy}') on input", llm(f"pii-{pii_type}-{strategy}"), tools=[], middleware=[PIIMiddleware(pii_type, strategy=strategy)], inp=ask(text), first=0)
    run(cap, "PIIMiddleware('email', strategy='block')", llm("pii-block"), tools=[], middleware=[PIIMiddleware("email", strategy="block")], inp=ask(text))
    run(cap, "PIIMiddleware('email', apply_to_output=True) on the model's answer", llm("pii-out"), tools=[],
        middleware=[PIIMiddleware("email", strategy="redact", apply_to_input=False, apply_to_output=True)], inp=ask("Reply with exactly this sentence: Write to grace@example.org."), first=0)
    run(cap, "a custom detector: PIIMiddleware('api_key', detector=regex)", llm("pii-custom"), tools=[],
        middleware=[PIIMiddleware("api_key", detector=r"sk-[a-z0-9]{8}", strategy="redact")], inp=ask("my key is sk-abcd1234"), first=0)


def gated(result):
    return [r for i in result.interrupts for r in i.value["action_requests"]]


def hitl_batched(cap):
    checkpointer = InMemorySaver()
    m = llm("hitl-batched")
    agent = create_agent(m, tools=[add, lookup_order], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True, "lookup_order": {"allowed_decisions": ["approve", "reject"]}})], checkpointer=checkpointer)
    cfg = thread("hitl-batched")
    cap.section("batched: two gated calls, one interrupt")
    result = agent.invoke(ask("In one reply, call add with 2 and 3, and call lookup_order for order A-17."), cfg, version="v2")
    cap.json(result.interrupts, "interrupts")
    cap.json(agent.get_state(cfg).next, "state.next")
    cap.section("resume with one decision per call, in order: edit add, reject lookup_order")
    decisions = []
    for request in gated(result):
        if request["name"] == "add":
            decisions.append({"type": "edit", "edited_action": {"name": "add", "args": {"a": 20, "b": 30}}})
        else:
            decisions.append({"type": "reject", "message": "Do not look up orders."})
    result = agent.invoke(Command(resume={"decisions": decisions}), cfg, version="v2")
    cap.messages(result.value["messages"][1:])
    show_log(cap, m)
    cap.section("a wrong number of decisions")
    agent = create_agent(llm("hitl-count"), tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True})], checkpointer=InMemorySaver())
    result = agent.invoke(TWO_ADDS, thread("hitl-count"), version="v2")
    count = len(gated(result))
    wrong = count - 1 if count > 1 else count + 1
    cap.text(f"gated calls: {count}")
    cap.attempt(f"resume with {wrong} decision(s) for {count} call(s)", lambda: agent.invoke(Command(resume={"decisions": [{"type": "approve"}] * wrong}), thread("hitl-count")))
    cap.section("respond: the human answers in place of the tool")
    m = llm("hitl-respond")
    agent = create_agent(m, tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True})], checkpointer=InMemorySaver())
    agent.invoke(ASK, thread("hitl-respond"))
    out = agent.invoke(Command(resume={"decisions": [{"type": "respond", "message": "It is 5, I checked."}]}), thread("hitl-respond"))
    cap.messages(out["messages"][1:])


def hitl_per_call(cap):
    m = llm("hitl-per-call")
    agent = create_agent(m, tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": True}, interrupt_mode="per_call")], checkpointer=InMemorySaver())
    cfg = thread("hitl-per-call")
    cap.section("per_call: one interrupt per gated call")
    result = agent.invoke(ask("Use the add tool twice in one reply: add 2 and 3, and add 4 and 5."), cfg, version="v2")
    interrupts = sorted(result.interrupts, key=lambda i: i.value["args"]["a"])
    for item in interrupts:
        cap.json({"id": item.id, "value": item.value}, f"interrupt for add({item.value['args']['a']}, {item.value['args']['b']})")
        cap.json(item.response_schema.model_json_schema() if hasattr(item.response_schema, "model_json_schema") else item.response_schema, "response_schema")
    cap.json(sorted(agent.get_state(cfg).next), "state.next")
    cap.section("resume with a map of interrupt id to decision: approve the first, reject the rest")
    answers = {item.id: ({"type": "approve"} if index == 0 else {"type": "reject", "message": "Not this one."}) for index, item in enumerate(interrupts)}
    result = agent.invoke(Command(resume=answers), cfg, version="v2")
    cap.messages(result.value["messages"][1:])
    show_log(cap, m)
    cap.section("a decision that does not match response_schema")
    agent = create_agent(llm("hitl-bad"), tools=[add], middleware=[HumanInTheLoopMiddleware(interrupt_on={"add": {"allowed_decisions": ["approve"]}}, interrupt_mode="per_call")], checkpointer=InMemorySaver())
    result = agent.invoke(ASK, thread("hitl-bad"), version="v2")
    only = result.interrupts[0]
    cap.attempt("resume with reject when only approve is allowed", lambda: agent.invoke(Command(resume={only.id: {"type": "reject"}}), thread("hitl-bad")))
    cap.json(agent.get_state(thread("hitl-bad")).next, "state.next after the bad answer")


def todo_and_context(cap):
    m = llm("todo")
    run(cap, "TodoListMiddleware: write_todos updates state['todos']", m, middleware=[TodoListMiddleware()], extra=("todos",),
        inp=ask("What is 2 + 3? First write a todo list with write_todos, then use the add tool, then mark every todo completed with write_todos, then answer."))
    cap.section("the system prompt TodoListMiddleware adds (first 300 characters)")
    cap.text(recorder(m).raw[0][0].content[:300])
    cap.section("ContextEditingMiddleware(ClearToolUsesEdit(trigger=10, keep=1))")
    history = [{"role": "user", "content": "Add three pairs: 1 + 1, 2 + 2, and 3 + 3."}]
    for index, (a, b) in enumerate(((1, 1), (2, 2), (3, 3))):
        history.append({"role": "assistant", "content": "", "tool_calls": [{"name": "add", "args": {"a": a, "b": b}, "id": f"call_{index}"}]})
        history.append({"role": "tool", "content": f"result {a + b} " * 5, "tool_call_id": f"call_{index}"})
    m = llm("context-edit")
    out = create_agent(m, tools=[add], middleware=[ContextEditingMiddleware(edits=[ClearToolUsesEdit(trigger=10, keep=1)])]).invoke({"messages": history})
    cap.json([msg.content for msg in recorder(m).raw[0]], "message contents the model received")
    cap.messages(out["messages"][-1:], "the answer")


def selection_and_emulation(cap):
    @tool
    def get_weather(city: str) -> str:
        """Get the weather for a city."""
        return f"Sunny in {city}"

    @tool
    def send_email(to: str, body: str) -> str:
        """Send an email."""
        return "sent"

    selector = llm("selector")
    run(cap, "LLMToolSelectorMiddleware(model=selector, max_tools=1)", llm("agent"), tools=[add, get_weather, send_email], middleware=[LLMToolSelectorMiddleware(model=selector, max_tools=1)], inp=ask("Weather in Pune?"))
    show_log(cap, selector)
    emulator = llm("emulator")
    run(cap, "LLMToolEmulator(tools=['send_email'], model=emulator): the tool body never runs", llm("agent-emulated"), tools=[send_email], middleware=[LLMToolEmulator(tools=["send_email"], model=emulator)], inp=ask("Email ops@example.com the word hi."))
    show_log(cap, emulator)
    cap.section("ProviderToolSearchMiddleware on ChatOllama")
    agent = create_agent(llm("search"), tools=[add, get_weather], middleware=[ProviderToolSearchMiddleware(searchable_tools=["get_weather"])])
    cap.attempt("invoke", lambda: agent.invoke(ASK))
    cap.section("ProviderToolSearchMiddleware with nothing deferred passes the request through")
    out = create_agent(llm("search-none"), tools=[add], middleware=[ProviderToolSearchMiddleware()]).invoke(ASK)
    cap.messages(out["messages"][1:])

    @dynamic_prompt
    def by_user(request):
        return f"You are helping {request.runtime.context['user']}."

    m = llm("dynamic")
    cap.section("dynamic_prompt sets the system prompt from runtime context")
    out = create_agent(m, middleware=[by_user]).invoke(ask("hi, who are you helping?"), context={"user": "Ada"})
    cap.messages(out["messages"][-1:])
    show_log(cap, m)


def shell_and_files(cap):
    root = tempfile.mkdtemp(prefix="m101-")
    with open(os.path.join(root, "notes.md"), "w", encoding="utf-8") as handle:
        handle.write("# Notes\nThe answer is 42.\n")
    os.makedirs(os.path.join(root, "src"))
    with open(os.path.join(root, "src", "app.py"), "w", encoding="utf-8") as handle:
        handle.write("ANSWER = 42\n")
    run(cap, "FilesystemFileSearchMiddleware(root_path=tmp, use_ripgrep=False)", llm("files"), tools=[], middleware=[FilesystemFileSearchMiddleware(root_path=root, use_ripgrep=False)],
        inp=ask("Which files contain 42? Call glob_search with pattern **/*.py, then call grep_search with only the argument pattern set to 42."))
    run(cap, "ShellToolMiddleware(workspace_root=tmp, execution_policy=HostExecutionPolicy())", llm("shell"), tools=[],
        middleware=[ShellToolMiddleware(workspace_root=root, execution_policy=HostExecutionPolicy(), env={"PATH": "/usr/bin:/bin", "LC_ALL": "C"})],
        inp=ask("Use the shell tool to run: printf 'hello from %s\\n' shell && ls. Then list the files."))
    run(cap, "the same shell tool, asked for one plain command", llm("shell-plain"), tools=[],
        middleware=[ShellToolMiddleware(workspace_root=root, execution_policy=HostExecutionPolicy(), env={"PATH": "/usr/bin:/bin", "LC_ALL": "C"})],
        inp=ask("Call the shell tool once. Its command argument is the string: ls"))


def decisions(cap):
    route = OllamaDecisionModel()
    fast = llm("fast")
    deep = llm("deep", model=REASONING_MODEL)
    agent_model = llm("default")
    router = ModelRouterMiddleware(choices={"fast": ModelChoice(model=fast, criteria="arithmetic and short answers"), "deep": ModelChoice(model=deep, criteria="long reasoning")}, instructions="Pick the cheapest model that can answer.", classifier=route)
    run(cap, "ModelRouterMiddleware (beta) with OllamaDecisionModel", agent_model, tools=[], middleware=[router], extra=("model_route",))
    show_log(cap, fast, deep)
    cap.json(route.log, "questions the router asked")

    @tool
    def delete_branch(name: str) -> str:
        """Delete a git branch."""
        return f"deleted {name}"

    risk = OllamaDecisionModel()
    m = llm("auto-mode")
    run(cap, "AutoModeMiddleware(tools=['delete_branch', 'add']) with OllamaDecisionModel", m, tools=[delete_branch, add], middleware=[AutoModeMiddleware(tools=["delete_branch", "add"], classifier=risk)], inp=ask("In one reply, call delete_branch for main and call add with 2 and 3."))
    cap.json(risk.log[0] if risk.log else None, "the question the classifier saw")
    cap.json([{"tool_call": (entry.get("tool_call") or {}), "answers": entry.get("answers")} for entry in risk.log], "the answer of the classifier for each call")


SCENARIOS = [
    ("mw-summarization", "SummarizationMiddleware with a trigger", summarization, True),
    ("mw-call-limits", "Model call and tool call limits", limits, True),
    ("mw-retries", "Tool retry and model retry", retries, True),
    ("mw-fallback-refusal", "Model fallback and refusals", fallback, True),
    ("mw-pii", "PIIMiddleware strategies", pii, True),
    ("mw-hitl-batched", "Human in the loop, batched", hitl_batched, True),
    ("mw-hitl-per-call", "Human in the loop, per call", hitl_per_call, True),
    ("mw-todo-context-editing", "Todo list and context editing", todo_and_context, True),
    ("mw-selection-emulation", "Tool selection, tool emulation, provider tool search, dynamic prompt", selection_and_emulation, True),
    ("mw-shell-files", "Shell tool and file search", shell_and_files, True),
    ("mw-decisions", "Model router and auto mode (decision models)", decisions, True),
]
