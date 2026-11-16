# Symptom, cause, fix

> Each error message in this manual names its cause once you know which layer raised it, and a few failures raise nothing, so look those up by their symptom.

A run fails at 2 a.m. with a message you have not seen. The message names a class from one of five packages, and the stack trace runs through LangGraph code that you did not write. You need the cause and the fix, and the section that explains it.

When you finish this section, you can look up an error message from any part of the stack. You can find its cause, its fix, and its section.

## How to read the tables

Each message below is copied from a capture file or a lab recording, as the stack printed it at the pin. Rows marked "not in a capture" come from the code. A long message is cut after its first sentence or clause. Search the tables for the class name or for the first words of the message. Text in angle brackets, such as `<seconds>`, is a mask of the capture kit.

The last table lists failures that raise no error. Their symptom is a wrong result, a slow exit, or a tool that ran when it should not.

## Models and tools

| Message | Cause | Fix | Section |
|---|---|---|---|
| `ValueError: Unable to infer model provider for model='qwen3:4b'. Please specify 'model_provider' directly.` | a model string without a provider prefix that `init_chat_model` can infer | write `ollama:qwen3:4b`, or pass `model_provider` | [3.2](#s-init-chat-model-and-model-profiles) |
| `pydantic_core._pydantic_core.ValidationError: 1 validation error for lookup_order` | a tool with a `ToolRuntime` parameter called outside an agent | call it through the agent, or test the function under the tool | [3.4](#s-tools-toolruntime-and-tool-errors) |
| `Error: subtract is not a valid tool, try one of [add].` | the model asked for a tool that the agent does not have | none needed. The agent sends this text back to the model as a `ToolMessage` | [3.4](#s-tools-toolruntime-and-tool-errors) |
| `ValueError: ToolErrorMiddleware requires`, then the names `on_error` and `aon_error` in code marks | `ToolErrorMiddleware` built with no handler | pass `on_error`, or `aon_error` for async tools | [3.4](#s-tools-toolruntime-and-tool-errors) |

## Agents and middleware

| Message | Cause | Fix | Section |
|---|---|---|---|
| `AssertionError: Please remove duplicate middleware instances.` | two instances of one middleware class in the list | keep one, or give a class its own `name` | [4.5](#s-middleware-hooks-and-their-order) |
| `StructuredOutputValidationError: Failed to parse structured output for tool 'Answer': Failed to parse data to Answer: 1 validation error for Answer` | `ToolStrategy` with `handle_errors=False`, and a reply that failed the schema | leave `handle_errors` on, or handle the error in your code | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `StructuredOutputValidationError: Failed to parse structured output for tool 'Answer': Native structured output expected valid JSON for Answer, but parsing failed` | `ProviderStrategy` and a reply in plain text. It does not retry. On Ollama with tools, the first call fails this way | on Ollama with tools, leave `response_format` off and make one `with_structured_output` call after the run. On Claude, `ProviderStrategy` returned the value in 39 of 39 tasks | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy), [4.3](#s-structured-output-which-strategy-on-which-provider) |
| `Error: Model incorrectly returned multiple structured responses (Answer, Refusal) when only one is expected.` | two structured calls in one model reply, sent back to the model | none needed. The next call usually answers once | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `ValueError: Unsupported schema type: <class 'typing._UnionGenericAlias'>.` | `ProviderStrategy` with a `Union` schema, raised when the agent is built | use `ToolStrategy` for a union | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `ModelCallLimitExceededError: Model call limits exceeded: run limit (1/1)` | `ModelCallLimitMiddleware` with `exit_behavior="error"` | raise the limit, or end the run with `exit_behavior="end"` | [4.6](#s-the-built-in-middleware) |
| `ToolCallLimitExceededError: Tool call limit reached: run limit exceeded (2/1 calls).` | `ToolCallLimitMiddleware` with `exit_behavior="error"` | raise the limit, or use `continue` or `end` | [4.6](#s-the-built-in-middleware) |
| `ValueError: ProviderToolSearchMiddleware requires a provider with server-side tool search, but got 'ollama'; supported providers: anthropic, openai` | a model from a provider without server-side tool search | use an Anthropic or OpenAI model, or remove the middleware | [4.6](#s-the-built-in-middleware) |
| `ConnectionError: third is down`, not in a capture | `ModelFallbackMiddleware`, and every model in the chain failed. The run raises the last error | add a model on another provider, and read the earlier errors in the log | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| `ModelRefusalError: Model refused to produce the requested output: I can't help with that.`, not in a capture | a refusal block, with `ModelRefusalMiddleware` set to raise | change the request, or let the middleware move to a backup model | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| `PIIDetectionError: Detected 1 instance(s) of email in text content` | `PIIMiddleware` with the strategy `block` | use `redact`, `mask`, or `hash` when the run must go on | [4.8](#s-guardrails-pii-and-the-decision-middleware-beta) |

## Streaming and memory

| Message | Cause | Fix | Section |
|---|---|---|---|
| `TypeError: stream_events(version='v3') / astream_events(version='v3') do not accept stream_mode;` | `stream_mode` passed to v3, which builds its own modes | drop `stream_mode`, and read the projections of the v3 stream | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `NotImplementedError: stream_events(version='v2') is not supported.` | the sync `stream_events` with version v2 | use `astream_events` for v1 and v2, or v3 | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `ValueError: No generations found in stream.`, not in a capture | a stock fake chat model under `create_agent` with streaming | test with a real model, or with a fake that implements `bind_tools` and streams tool calls {{code libs/core/langchain_core/language_models/fake_chat_models.py}} | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `ValueError: Checkpointer requires one or more of the following 'configurable' keys: thread_id, checkpoint_ns, checkpoint_id` | a run on a graph with a checkpointer and no `thread_id` | pass `{"configurable": {"thread_id": ...}}` | [5.2](#s-checkpointers-and-threads) |
| `AttributeError: 'SyncPregelLoop' object has no attribute '_put_checkpoint_fut'` | `durability="sync"` on a graph with no checkpointer, issue #9267 | add a checkpointer, or leave `durability` at its default | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| `InvalidNamespaceError: Invalid namespace label 'bob.x' found in ('users', 'bob.x'). Namespace labels cannot contain periods ('.').` | a store label with a period | refuse or replace the period before the id becomes a label | [5.4](#s-stores-and-long-term-memory) |
| `TypeError: Type is not msgpack serializable: Plain` | an instance of a plain class in the state | use a dataclass, a Pydantic model, or a dict | [5.6](#s-serialization-of-state-and-what-does-not-round-trip) |
| `Deserializing unregistered type __main__.Color from checkpoint. This will be blocked in a future version.` | your own enum or class in a checkpoint, with no entry in `allowed_msgpack_modules` | list the module and the class in `allowed_msgpack_modules` | [5.6](#s-serialization-of-state-and-what-does-not-round-trip) |

## Graphs, interrupts, and limits

| Message | Cause | Fix | Section |
|---|---|---|---|
| `InvalidUpdateError: At key 'value': Can receive only one value per step. Use an Annotated key to handle multiple values.` | two nodes wrote one key in the same step, and the key has no reducer. With a checkpointer, both writes are saved, so `get_state`, `invoke(None)`, and every new turn on the thread raise the same error, issue #9712 | give the key a reducer with `Annotated` and deploy it, then resume with `invoke(None)`. The thread finishes from its saved writes, with no node run again. `update_state` also makes the thread readable, and the old graph raises again on its next run | [6.1](#s-stategraph-state-and-reducers), [2.2](#s-channels-and-colliding-writes) |
| `UnknownInterruptError: Unknown or already-consumed interrupt: <id>` | strict resume, set with the internal key `__pregel_strict_resume`, and a second answer to an interrupt | read the pending interrupts with `get_state`, and answer those | [6.4](#s-interrupt-and-resume) |
| `RuntimeError: When there are multiple pending interrupts, you must specify the interrupt id when resuming.` | a plain resume value while two interrupts wait | resume with a map from each interrupt id to its answer | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| `ValueError: Number of human decisions (1) does not match number of hanging tool calls (2).` | batched review, and fewer decisions than tool calls | send one decision for each call, in order | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| `KeyError: 'checkpoint_ns'` | `update_state` with a config that has only `thread_id` and `checkpoint_id` | pass the full config of a `StateSnapshot` from the history | [6.6](#s-time-travel-replay-update-state-and-forks) |
| `NodeTimeoutError: Node 'slow' exceeded its run timeout of 0.050s (elapsed: <seconds>).` | an async node that ran past its `timeout` | raise the timeout, or handle the error with an `error_handler` | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| `GraphRecursionError: Recursion limit of 10007 reached without hitting a stop condition.` | a loop with no exit, or a run that needs more steps than the limit | fix the exit condition, or pass `recursion_limit` | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |

## Integrations and the server

| Message | Cause | Fix | Section |
|---|---|---|---|
| `ValueError: MCP target 'server.py' is not a valid URL.` | a string target that is not an `http` or `https` URL | pass `Path('server.py')` for a stdio server | [7.3](#s-mcp-with-langchain-mcp) |
| `MCPError: Connection closed` | the stdio server exited in the middle of a call. The run raised | retry the run only when the tool is idempotent, and check the outside result first when it is not. The next call starts the server again | [7.3](#s-mcp-with-langchain-mcp) |
| `RemoteProtocolError: Server disconnected without sending a response.` | the HTTP server exited in the middle of a call | restart the server, then retry the run only when the tool is idempotent. Check the outside result first when it is not | [7.3](#s-mcp-with-langchain-mcp) |
| `MCPError: Request 'tools/call' timed out` | a `fastmcp.Client` timeout shorter than the tool | raise the timeout of the client. The adapter has no timeout of its own | [7.3](#s-mcp-with-langchain-mcp) |
| `Thread is already running a task. Wait for it to finish or choose a different multitask strategy.` | Agent Server, the strategy `reject`, and a second run on a busy thread. The status is HTTP 409 | retry later, or create the run with `enqueue` | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `ValueError: License verification failed. Please ensure proper configuration:` | `langgraph up` with neither `LANGSMITH_API_KEY` nor `LANGGRAPH_CLOUD_LICENSE_KEY` | set one of the two, or use `langgraph dev` | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |

## Failures with no error

| Symptom | Cause | Fix | Section |
|---|---|---|---|
| a tool that the reviewer did not approve ran, after an edit or a jump | batched review, where an edit can switch tools and a middleware jump can skip the review | set `interrupt_mode="per_call"` | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| a side effect ran twice after a crash and a resume | the crash came after the tool ran and before its writes or checkpoint were saved. `durability="sync"` does not cover a task that just returned | key the effect on what it means, such as the thread and the order id, and check your records first. `tool_call_id` and `checkpoint_ns` work as keys in `sync` and `async` only | [5.3](#s-durability-modes-and-a-crash-between-two-steps), [2.3](#s-the-checkpoint-write-path-and-durability) |
| one request charged twice with no crash, or twice more after a keyed resume | the model asked for the same tool call twice in one reply | check the order in your records before the charge, because a `tool_call_id` key lets the second call through | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| a warning that `durability` has no effect when no checkpointer is present | a durability mode on a graph with no checkpointer | add a checkpointer, or drop the argument | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| the warning `PydanticSerializationUnexpectedValue` for the field `context` | a `context` dict on an agent with no `context_schema` | give the agent a `context_schema` | [5.4](#s-stores-and-long-term-memory) |
| a set of tuples or a time zone came back changed from a checkpoint | types that the serializer does not rebuild | store lists, dicts, and UTC times with a zone name | [5.6](#s-serialization-of-state-and-what-does-not-round-trip) |
| `list_namespaces` returned the namespaces of every user | a prefix built from the user id `*` | refuse `*` in a user id | [5.4](#s-stores-and-long-term-memory) |
| a deep agent never plans with `write_todos` | Deep Agents 0.7 leaves out `TodoListMiddleware` | pass `TodoListMiddleware()` in `middleware` | [7.4](#s-deep-agents-0-7) |
| a script with tracing on waits at exit, or never exits | the LangSmith endpoint is down or fails, and the exit waits for the traces | call `wait_for_all_tracers()`, and put a timeout on the job | [7.6](#s-langsmith-tracing) |
| agent runs reached LangSmith inside `tracing_context(enabled="local")` | LangChain code treats `"local"` as on | use `tracing_context(enabled=False)` around LangChain code | [7.6](#s-langsmith-tracing) |
| the same approval was pending again after a worker crashed, and the refund row existed | a resume map stays in the run config, so a crash inside the `tools` task loses the decision | key the tool on what the checkpoint saved, so that the second approve is a replay | [9.3](#s-approvals-and-the-idempotency-key) |
| the model told the customer that an order did not exist after the lookup timed out | the model did not follow the error text of the tool | test the reply to each fault in your evals, and choose a model that passes | [9.5](#s-timeouts-retries-backup-model-and-shutdown) |
| clients of a busy service got `ReadTimeout`, and their runs went on | the stream sent no byte while the run waited for the model server | read the thread state after a dropped stream, and add model capacity | [9.7](#s-workers-the-advisory-lock-and-cost) |
| the agent read `.env` or deleted a dotfile although a deny rule covers `/**` | Deep Agents passes rule patterns to `wcmatch` with no `DOTGLOB`, so `*` and `**` skip names that start with a dot | deny `/**/.*` and `/**/.*/**` first, and allow `/workspace` as well as `/workspace/**` | [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| a user of a deep agent was told the files of another user | a constant namespace factory, such as `("memories",)`, in `StoreBackend` | build the namespace from the user id in the run context | [5.4](#s-stores-and-long-term-memory) |
| the model said that it sent the email, and no email left | a message typed over a pending approval, which Agent Chat UI closes with a placeholder tool result | make the tool safe on its own, and disable the input while an approval is pending | [8.2](#s-agent-chat-ui-in-front-of-langgraph-dev) |
| 20 background runs of a 2 s graph with no model took 41.0 s | one job per worker, the default of `langgraph dev` | start it with `--n-jobs-per-worker 10`, which took 5.1 s in the same test | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |

```takeaways
- Search these tables for the class name or the first words of the message.
- Read which package raised the error before you change the agent.
- Check the silent failures when a result is wrong and nothing raised.
- Run the capture kit scenario of a section to see the same message on your machine.
```

Sources: capture/out/01-init-chat-model.txt, capture/out/03-tools.txt, capture/out/04-tool-errors.txt, capture/out/08-structured-errors.txt, capture/out/09-middleware-order.txt, capture/out/11-mw-call-limits.txt, capture/out/13-mw-fallback-refusal.txt, capture/out/14-mw-pii.txt, capture/out/18-mw-selection-emulation.txt, capture/out/25-stream-events-v3.txt, libs/core/langchain_core/language_models/fake_chat_models.py at langchain==1.5.0, capture/out/28-checkpoint-memory.txt, capture/out/31-durability.txt, capture/out/33-store.txt, capture/out/34-stategraph-reducers-send-command.txt, capture/lab/internals/02-channels/trace.txt, capture/lab/internals/02-channels/repair.txt, capture/lab/T02-crash-resume-x86/10-summary.txt, capture/lab/failure-drill-x86/drill-run1.log, capture/out/37-error-handler-timeout.txt, capture/out/38-recursion-limit.txt, capture/out/40-mcp.txt; capture/lab/summary/structured-output-mac.json, capture/lab/T06-structured-output-mac/03-ollama-seq-n10.jsonl, capture/lab/T14-stores-mac/01-memory-sqlite.jsonl, capture/lab/T13-serde-mac/03-round-trip.jsonl, capture/lab/T13-serde-mac/04-round-trip-log.txt, capture/lab/summary/approvals-x86.json, capture/lab/T17-claims-mac/02-replay-and-fork.jsonl, capture/lab/summary/mcp-mac.json, capture/lab/T15-agent-server-x86/04-double-texting.jsonl, capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt, capture/lab/summary/tracing-mac-real.json, capture/lab/summary/agent-server-x86.json; the sections linked in each row; capture/lab/chat-ui-mac/summary/extracts.json, capture/lab/summary/permissions-mac.json, capture/lab/summary/store-namespace-mac.json.
