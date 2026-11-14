# Symptom, cause, fix

> Each error message in this manual names its cause once you know which layer raised it, and a few failures raise nothing, so look those up by their symptom.

A run fails at 2 a.m. with a message you have not seen. The message names a class from one of five packages, and the stack trace runs through LangGraph code that you did not write. You need the cause and the fix, and the section that explains it.

When you finish this section, you can look up an error message from any part of the stack. You can find its cause, its fix, and its section.

## How to read the tables

Each message below is copied from a capture file or a lab recording, as the stack printed it at the pin. A long message is cut after its first sentence or clause. Search the tables for the class name or for the first words of the message. Text in angle brackets, such as `<seconds>`, is a mask of the capture kit.

The last table lists failures that raise no error. Their symptom is a wrong result, a slow exit, or a tool that ran when it should not.

## Models and tools

| Message | Cause | Fix | Section |
|---|---|---|---|
| `ValueError: Unable to infer model provider for model='qwen3:4b'. Please specify 'model_provider' directly.` | a model string without a provider prefix that `init_chat_model` can infer | write `ollama:qwen3:4b`, or pass `model_provider` | [2.2](#s-init-chat-model-and-model-profiles) |
| `pydantic_core._pydantic_core.ValidationError: 1 validation error for lookup_order` | a tool with a `ToolRuntime` parameter called outside an agent | call it through the agent, or test the function under the tool | [2.4](#s-tools-toolruntime-and-tool-errors) |
| `Error: subtract is not a valid tool, try one of [add].` | the model asked for a tool that the agent does not have | none needed. The agent sends this text back to the model as a `ToolMessage` | [2.4](#s-tools-toolruntime-and-tool-errors) |
| `ValueError: ToolErrorMiddleware requires`, then the names `on_error` and `aon_error` in code marks | `ToolErrorMiddleware` built with no handler | pass `on_error`, or `aon_error` for async tools | [2.4](#s-tools-toolruntime-and-tool-errors) |

## Agents and middleware

| Message | Cause | Fix | Section |
|---|---|---|---|
| `AssertionError: Please remove duplicate middleware instances.` | two instances of one middleware class in the list | keep one, or give a class its own `name` | [3.3](#s-middleware-hooks-and-their-order) |
| `StructuredOutputValidationError: Failed to parse structured output for tool 'Answer': Failed to parse data to Answer: 1 validation error for Answer` | `ToolStrategy` with `handle_errors=False`, and a reply that failed the schema | leave `handle_errors` on, or handle the error in your code | [3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `StructuredOutputValidationError: Failed to parse structured output for tool 'Answer': Native structured output expected valid JSON for Answer, but parsing failed` | `ProviderStrategy` and a reply in plain text. It does not retry | use a provider that enforces the schema, or `ToolStrategy` | [3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `Error: Model incorrectly returned multiple structured responses (Answer, Refusal) when only one is expected.` | two structured calls in one model reply, sent back to the model | none needed. The next call usually answers once | [3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `ValueError: Unsupported schema type: <class 'typing._UnionGenericAlias'>.` | `ProviderStrategy` with a `Union` schema, raised when the agent is built | use `ToolStrategy` for a union | [3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `ModelCallLimitExceededError: Model call limits exceeded: run limit (1/1)` | `ModelCallLimitMiddleware` with `exit_behavior="error"` | raise the limit, or end the run with `exit_behavior="end"` | [3.4](#s-the-built-in-middleware) |
| `ToolCallLimitExceededError: Tool call limit reached: run limit exceeded (2/1 calls).` | `ToolCallLimitMiddleware` with `exit_behavior="error"` | raise the limit, or use `continue` or `end` | [3.4](#s-the-built-in-middleware) |
| `ValueError: ProviderToolSearchMiddleware requires a provider with server-side tool search, but got 'scriptedchatmodel'; supported providers: anthropic, openai` | a model from a provider without server-side tool search | use an Anthropic or OpenAI model, or remove the middleware | [3.4](#s-the-built-in-middleware) |
| `ConnectionError: third is down` | `ModelFallbackMiddleware`, and every model in the chain failed. The run raises the last error | add a model on another provider, and read the earlier errors in the log | [3.5](#s-retries-backup-models-rate-limits-and-caching) |
| `ModelRefusalError: Model refused to produce the requested output: I can't help with that.` | a refusal block, with `ModelRefusalMiddleware` set to raise | change the request, or let the middleware move to a backup model | [3.5](#s-retries-backup-models-rate-limits-and-caching) |
| `PIIDetectionError: Detected 1 instance(s) of email in text content` | `PIIMiddleware` with the strategy `block` | use `redact`, `mask`, or `hash` when the run must go on | [3.6](#s-guardrails-pii-and-the-decision-middleware-beta) |

## Streaming and memory

| Message | Cause | Fix | Section |
|---|---|---|---|
| `TypeError: stream_events(version='v3') / astream_events(version='v3') do not accept stream_mode;` | `stream_mode` passed to v3, which builds its own modes | drop `stream_mode`, and read the projections of the v3 stream | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `NotImplementedError: stream_events(version='v2') is not supported.` | the sync `stream_events` with version v2 | use `astream_events` for v1 and v2, or v3 | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `ValueError: No generations found in stream.` | a stock fake chat model under `create_agent` with streaming | use a fake that implements `bind_tools` and streams tool calls | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `ValueError: Checkpointer requires one or more of the following 'configurable' keys: thread_id, checkpoint_ns, checkpoint_id` | a run on a graph with a checkpointer and no `thread_id` | pass `{"configurable": {"thread_id": ...}}` | [4.2](#s-checkpointers-and-threads) |
| `AttributeError: 'SyncPregelLoop' object has no attribute '_put_checkpoint_fut'` | `durability="sync"` on a graph with no checkpointer, issue #9267 | add a checkpointer, or leave `durability` at its default | [4.3](#s-durability-modes-and-a-crash-between-two-steps) |
| `InvalidNamespaceError: Invalid namespace label 'bob.x' found in ('users', 'bob.x'). Namespace labels cannot contain periods ('.').` | a store label with a period | refuse or replace the period before the id becomes a label | [4.4](#s-stores-and-long-term-memory) |
| `TypeError: Type is not msgpack serializable: Plain` | an instance of a plain class in the state | use a dataclass, a Pydantic model, or a dict | [4.6](#s-serialization-of-state-and-what-does-not-round-trip) |
| `Deserializing unregistered type __main__.Color from checkpoint. This will be blocked in a future version.` | your own enum or class in a checkpoint, with no entry in `allowed_msgpack_modules` | list the module and the class in `allowed_msgpack_modules` | [4.6](#s-serialization-of-state-and-what-does-not-round-trip) |

## Graphs, interrupts, and limits

| Message | Cause | Fix | Section |
|---|---|---|---|
| `InvalidUpdateError: At key 'value': Can receive only one value per step. Use an Annotated key to handle multiple values.` | two nodes wrote one key in the same step, and the key has no reducer | give the key a reducer with `Annotated` | [5.1](#s-stategraph-state-and-reducers) |
| `UnknownInterruptError: Unknown or already-consumed interrupt: <id>` | strict resume, set with the internal key `__pregel_strict_resume`, and a second answer to an interrupt | read the pending interrupts with `get_state`, and answer those | [5.4](#s-interrupt-and-resume) |
| `RuntimeError: When there are multiple pending interrupts, you must specify the interrupt id when resuming.` | a plain resume value while two interrupts wait | resume with a map from each interrupt id to its answer | [5.5](#s-human-in-the-loop-batched-and-per-call) |
| `ValueError: Number of human decisions (1) does not match number of hanging tool calls (2).` | batched review, and fewer decisions than tool calls | send one decision for each call, in order | [5.5](#s-human-in-the-loop-batched-and-per-call) |
| `KeyError: 'checkpoint_ns'` | `update_state` with a config that has only `thread_id` and `checkpoint_id` | pass the full config of a `StateSnapshot` from the history | [5.6](#s-time-travel-replay-update-state-and-forks) |
| `NodeTimeoutError: Node 'slow' exceeded its run timeout of 0.050s (elapsed: <seconds>).` | an async node that ran past its `timeout` | raise the timeout, or handle the error with an `error_handler` | [5.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| `GraphRecursionError: Recursion limit of 10007 reached without hitting a stop condition.` | a loop with no exit, or a run that needs more steps than the limit | fix the exit condition, or pass `recursion_limit` | [5.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |

## Integrations and the server

| Message | Cause | Fix | Section |
|---|---|---|---|
| `ValueError: MCP target 'server.py' is not a valid URL.` | a string target that is not an `http` or `https` URL | pass `Path('server.py')` for a stdio server | [6.2](#s-mcp-with-langchain-mcp) |
| `MCPError: Connection closed` | the stdio server exited in the middle of a call. The run raised | retry the run. The next call starts the server again | [6.2](#s-mcp-with-langchain-mcp) |
| `RemoteProtocolError: Server disconnected without sending a response.` | the HTTP server exited in the middle of a call | restart the server, then retry the run | [6.2](#s-mcp-with-langchain-mcp) |
| `MCPError: Request 'tools/call' timed out` | a `fastmcp.Client` timeout shorter than the tool | raise the timeout of the client. The adapter has no timeout of its own | [6.2](#s-mcp-with-langchain-mcp) |
| `Thread is already running a task. Wait for it to finish or choose a different multitask strategy.` | Agent Server, the strategy `reject`, and a second run on a busy thread. The status is HTTP 409 | retry later, or create the run with `enqueue` | [7.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `ValueError: License verification failed. Please ensure proper configuration:` | `langgraph up` with neither `LANGSMITH_API_KEY` nor `LANGGRAPH_CLOUD_LICENSE_KEY` | set one of the two, or use `langgraph dev` | [7.1](#s-agent-server-langgraph-dev-up-and-deploy) |

## Failures with no error

| Symptom | Cause | Fix | Section |
|---|---|---|---|
| a tool that the reviewer did not approve ran, after an edit or a jump | batched review, where an edit can switch tools and a middleware jump can skip the review | set `interrupt_mode="per_call"` | [5.5](#s-human-in-the-loop-batched-and-per-call) |
| a side effect ran twice after a crash and a resume | the crash came after the tool ran and before its checkpoint | make the effect idempotent with a key, such as the `tool_call_id` | [4.3](#s-durability-modes-and-a-crash-between-two-steps) |
| a warning that `durability` has no effect when no checkpointer is present | a durability mode on a graph with no checkpointer | add a checkpointer, or drop the argument | [4.3](#s-durability-modes-and-a-crash-between-two-steps) |
| the warning `PydanticSerializationUnexpectedValue` for the field `context` | a `context` dict on an agent with no `context_schema` | give the agent a `context_schema` | [4.4](#s-stores-and-long-term-memory) |
| a set of tuples or a time zone came back changed from a checkpoint | types that the serializer does not rebuild | store lists, dicts, and UTC times with a zone name | [4.6](#s-serialization-of-state-and-what-does-not-round-trip) |
| `list_namespaces` returned the namespaces of every user | a prefix built from the user id `*` | refuse `*` in a user id | [4.4](#s-stores-and-long-term-memory) |
| a deep agent never plans with `write_todos` | Deep Agents 0.7 leaves out `TodoListMiddleware` | pass `TodoListMiddleware()` in `middleware` | [6.3](#s-deep-agents-0-7) |
| a script with tracing on takes over a minute to exit | the LangSmith endpoint is down or fails, and the exit waits for the traces | call `wait_for_all_tracers()`, and put a timeout on the job | [6.4](#s-langsmith-tracing) |
| agent runs reached LangSmith inside `tracing_context(enabled="local")` | LangChain code treats `"local"` as on | use `tracing_context(enabled=False)` around LangChain code | [6.4](#s-langsmith-tracing) |
| 100 clients on `langgraph dev` each wait about 13 s | one job per worker, the default of `langgraph dev` | start it with `--n-jobs-per-worker 10` | [7.1](#s-agent-server-langgraph-dev-up-and-deploy) |

```takeaways
- Search these tables for the class name or the first words of the message.
- Read which package raised the error before you change the agent.
- Check the silent failures when a result is wrong and nothing raised.
- Run the capture kit scenario of a section to see the same message on your machine.
```

Sources: capture/out/01-init-chat-model.txt, capture/out/03-tools.txt, capture/out/04-tool-errors.txt, capture/out/08-structured-errors.txt, capture/out/09-middleware-order.txt, capture/out/11-mw-call-limits.txt, capture/out/13-mw-fallback-refusal.txt, capture/out/14-mw-pii.txt, capture/out/18-mw-selection-emulation.txt, capture/out/25-stream-events-v3.txt, capture/out/27-stream-stock-fakes.txt, capture/out/28-checkpoint-memory.txt, capture/out/31-durability.txt, capture/out/33-store.txt, capture/out/34-stategraph-reducers-send-command.txt, capture/out/37-error-handler-timeout.txt, capture/out/38-recursion-limit.txt, capture/out/40-mcp.txt; capture/lab/summary/structured-output-mac.json, capture/lab/T06-structured-output-mac/03-ollama-seq-n10.jsonl, capture/lab/T14-stores-mac/01-memory-sqlite.jsonl, capture/lab/T13-serde-mac/03-round-trip.jsonl, capture/lab/T13-serde-mac/04-round-trip-log.txt, capture/lab/summary/approvals-mac.json, capture/lab/T17-claims-mac/02-replay-and-fork.jsonl, capture/lab/summary/mcp-mac.json, capture/lab/T15-agent-server-x86/04-double-texting.jsonl, capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt, capture/lab/summary/tracing-mac.json, capture/lab/summary/agent-server-x86.json; the sections linked in each row.
