# Errors

> Each error and warning in this manual has one class, one package that raises it, and one line at the pin, and the text below is copied from a capture.

This page is the lookup by class. [Symptom, cause, fix](#s-symptom-cause-fix) is the lookup by symptom, with the fix for each message. Each message is copied from a capture file or a lab recording. Text in angle brackets, such as `<seconds>`, is a mask of the capture kit. A long message is cut after its first sentence, and a cut line ends where the capture continues.

## langchain

| Class | Message | Raised at |
|---|---|---|
| `AssertionError` | `Please remove duplicate middleware instances.` | {{code libs/langchain_v1/langchain/agents/factory.py:1164}} |
| `ValueError` | `Unable to infer model provider for model='qwen3:4b'. Please specify 'model_provider' directly.` | {{code libs/langchain_v1/langchain/chat_models/base.py:641}} |
| `StructuredOutputValidationError` | `Failed to parse structured output for tool 'Answer': Failed to parse data to Answer: 1 validation error for Answer` | {{code libs/langchain_v1/langchain/agents/structured_output.py:62-104}} |
| `StructuredOutputValidationError` | `Failed to parse structured output for tool 'Answer': Native structured output expected valid JSON for Answer, but parsing failed` | {{code libs/langchain_v1/langchain/agents/structured_output.py:426}} |
| `MultipleStructuredOutputsError`, sent to the model as text | `Error: Model incorrectly returned multiple structured responses (Answer, Refusal) when only one is expected.` | {{code libs/langchain_v1/langchain/agents/structured_output.py:43-57}} |
| `ValueError` | `Unsupported schema type: <class 'typing._UnionGenericAlias'>.` | {{code libs/langchain_v1/langchain/agents/structured_output.py:191}} |
| `ModelCallLimitExceededError` | `Model call limits exceeded: run limit (1/1)` | {{code libs/langchain_v1/langchain/agents/middleware/model_call_limit.py:60-63}} |
| `ToolCallLimitExceededError` | `Tool call limit reached: run limit exceeded (2/1 calls).` | {{code libs/langchain_v1/langchain/agents/middleware/tool_call_limit.py:97-105}} |
| `ValueError` | `ToolErrorMiddleware requires `, then the names of the two handlers | {{code libs/langchain_v1/langchain/agents/middleware/tool_error.py:112}} |
| `ValueError` | `ProviderToolSearchMiddleware requires a provider with server-side tool search, but got 'scriptedchatmodel'; supported providers: anthropic, openai` | {{code libs/langchain_v1/langchain/agents/middleware/provider_tool_search.py:146-151}} |
| `PIIDetectionError` | `Detected 1 instance(s) of email in text content` | {{code libs/langchain_v1/langchain/agents/middleware/_redaction.py:29-42}} |
| `ValueError` | `Number of human decisions (1) does not match number of hanging tool calls (2).` | {{code libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py:822}} |
| `ValueError` | `MCP target 'server.py' is not a valid URL.` | {{code libs/langchain_v1/langchain/mcp/adapter.py:108}} |
| `NotImplementedError`, sent to the model as an error `ToolMessage` after `Error calling tool 'ask_legacy': ` | `This MCP server asked for input over the legacy server-initiated elicitation path, which interrupt-based elicitation cannot answer.` | {{code libs/langchain_v1/langchain/mcp/elicitation.py:236-242}} |

The retry text of `ToolStrategy` is the template `Error: {error}\n Please fix your mistakes.` {{code libs/langchain_v1/langchain/agents/factory.py:128}}. The agent sends it to the model as a `ToolMessage`, and the run goes on.

## langchain-core

| Class | Message | Raised at |
|---|---|---|
| `ModelRefusalError` | `Model refused to produce the requested output: I can't help with that.` | {{code libs/core/langchain_core/exceptions.py:137-154}} |
| `ValueError` | `No generations found in stream.` | {{code libs/core/langchain_core/language_models/chat_models.py:276}} |
| `NotImplementedError` | `stream_events(version='v2') is not supported.` | {{code libs/core/langchain_core/runnables/base.py:1818}} |
| `NotImplementedError`, empty text | raised by `bind_tools` on a stock fake chat model | {{code libs/core/langchain_core/language_models/chat_models.py:2409-2426}} |

`ModelRefusalError` is a subclass of `ModelError` {{code libs/core/langchain_core/exceptions.py:73}}. `ModelRefusalMiddleware` raises it from a refusal block {{code libs/langchain_v1/langchain/agents/middleware/model_refusal.py:27-30}}.

## langgraph

| Class | Message | Raised at |
|---|---|---|
| `GraphRecursionError` | `Recursion limit of 10007 reached without hitting a stop condition. You can increase the limit by setting the `, then `recursion_limit` and `config key.` | {{code libs/langgraph/langgraph/pregel/main.py:3119-3126}} |
| `InvalidUpdateError` | `At key 'value': Can receive only one value per step. Use an Annotated key to handle multiple values.` | {{code libs/langgraph/langgraph/channels/last_value.py:61}} |
| `ValueError` | `Checkpointer requires one or more of the following 'configurable' keys: thread_id, checkpoint_ns, checkpoint_id` | {{code libs/langgraph/langgraph/pregel/main.py:2701-2705}} |
| `AttributeError` | `'SyncPregelLoop' object has no attribute '_put_checkpoint_fut'` | {{code libs/langgraph/langgraph/pregel/main.py:3105}} |
| `NodeTimeoutError` | `Node 'slow' exceeded its run timeout of 0.050s (elapsed: <seconds>).` | {{code libs/langgraph/langgraph/errors.py:232-275}} |
| `TypeError` | `stream_events(version='v3') / astream_events(version='v3') do not accept stream_mode;` | {{code libs/langgraph/langgraph/pregel/main.py:395-400}} |
| `UnknownInterruptError` | `Unknown or already-consumed interrupt: <id>` | {{code libs/langgraph/langgraph/pregel/_loop.py:1059}} |
| `RuntimeError` | `When there are multiple pending interrupts, you must specify the interrupt id when resuming.` | {{code libs/langgraph/langgraph/pregel/_loop.py:1068}} |
| `RuntimeError`, not in a capture | `Cannot use Command(resume=...) without checkpointer` | {{code libs/langgraph/langgraph/pregel/_loop.py:1034}} |
| `KeyError` | `'checkpoint_ns'` | lab `T17-claims-mac` |
| `KeyError` | `'__pregel_scratchpad'`, from `interrupt()` outside a graph, such as an MCP tool that asks for input | {{code libs/langgraph/langgraph/types.py:1030}} |
| `TypeError` | `Tool lookup returned unexpected type: <class 'str'>`, for a tool named `lookup` | {{code libs/prebuilt/langgraph/prebuilt/tool_node.py:1486}} |

The other error classes of `langgraph.errors` are `GraphBubbleUp`, `GraphInterrupt`, `NodeInterrupt`, `ParentCommand`, `EmptyInputError`, `TaskNotFound`, `NodeCancelledError`, and `GraphDrained` {{code libs/langgraph/langgraph/errors.py:52-210}}. `GraphBubbleUp` is the base class of `GraphInterrupt`, `ParentCommand`, and `GraphDrained`. These carry control flow, and the loop handles them. You see them only when you call a node outside a graph.

## The checkpoint and store packages

| Class | Message | Raised at |
|---|---|---|
| `InvalidNamespaceError` | `Invalid namespace label 'bob.x' found in ('users', 'bob.x'). Namespace labels cannot contain periods ('.').` | {{code libs/checkpoint/langgraph/store/base/__init__.py:1333-1334}} |
| `TypeError` | `Type is not msgpack serializable: Plain` | the `ormsgpack` encoder, in lab `T13-serde-mac` |
| `ValueError` | `LANGGRAPH_AES_KEY environment variable is not set.` | {{code libs/checkpoint/langgraph/checkpoint/serde/encrypted.py:54-56}} |

## Other packages, from the lab

| Class | Message | Raised by | Lab folder |
|---|---|---|---|
| `MCPError` | `Connection closed` | `mcp`, when a stdio server exits during a call | `T12-mcp-mac` |
| `MCPError` | `Request 'tools/call' timed out` | `mcp`, at the timeout of a `fastmcp.Client` | `T12-mcp-mac` |
| `RemoteProtocolError` | `Server disconnected without sending a response.` | `httpx`, when an HTTP server exits during a call | `T12-mcp-mac` |
| `MCPError` | `Elicitation not supported` | `mcp`, for a client with no elicitation handler on protocol `2026-07-28` | `T20-mcp-edges-mac` |
| `MCPError` | `Tool 'ask_name' returned an InputRequiredResult to request client input, but the multi-round-trip result type (SEP-2322) only exists at MCP 2026-07-28; this connection negotiated '2025-11-25'.` | the FastMCP server, on a legacy connection | `T20-mcp-edges-mac` |
| `LangSmithConnectionError` | `Connection error caused failure to GET /datasets in LangSmith API. Please confirm your internet connection.` | `langsmith`, from the pytest plugin with tracking on and no connection | `T19-pytest-plugin-mac` |
| `ValueError` | `log_outputs should only be called within a pytest test decorated with @pytest.mark.langsmith, and with tracing enabled (by setting the LANGSMITH_TRACING environment variable to 'true').` | `langsmith`, for an unmarked test with tracking on | `T19-pytest-plugin-mac` |
| `ValueError`, as a pytest `INTERNALERROR` with exit code 3 | `--langsmith-output not supported when env varLANGSMITH_TEST_TRACKING='false'. Please remove the'--langsmith-output' option or enable test tracking.` The two missing spaces are in the code | `langsmith`, at {{code src/langsmith/pytest_plugin.py:311-317}} | `T19-pytest-plugin-mac` |
| HTTP 409 | `Thread is already running a task. Wait for it to finish or choose a different multitask strategy.` | `langgraph-api` 0.18.0, strategy `reject` | `T15-agent-server-x86` |
| `ValueError` | `License verification failed. Please ensure proper configuration:` | `langgraph-api` 0.18.0 under `langgraph up` | `T15-agent-server-x86` |

## Warnings

| Category | Message | Raised at |
|---|---|---|
| `LangChainBetaWarning` | the module name `langchain.mcp`, then `is in beta. It is actively being worked on, so the API may change.` | {{code libs/langchain_v1/langchain/mcp/__init__.py:25-29}} |
| `LangChainBetaWarning` | `The middleware `, then `ModelRouterMiddleware` and `is in beta.` | {{code libs/core/langchain_core/_api/beta_decorator.py:252}} |
| `LangChainBetaWarning` | `The v3 streaming protocol on Pregel is experimental.` | {{code libs/langgraph/langgraph/pregel/main.py:3617}} |
| `LangGraphDeprecatedSinceV10` | the name `checkpoint_during`, then `is deprecated and will be removed. Please use`, the name `durability`, and `instead.` | {{code libs/langgraph/langgraph/pregel/main.py:2837-2840}} |
| `LangGraphDeprecatedSinceV10` | `NodeInterrupt is deprecated. Please use `, then `langgraph.types.interrupt` and `instead.` | {{code libs/langgraph/langgraph/errors.py:113-121}} |
| `LangGraphDeprecatedSinceV10` | `Importing Send from langgraph.constants is deprecated.` | {{code libs/langgraph/langgraph/constants.py:37}} |
| `LangGraphDeprecatedSinceV11` | `Accessing GraphOutput via`, then `result[key]` and `is deprecated.` | capture `24-stream-v2.txt` |
| `UserWarning`, from `warnings.warn` | the name `durability`, then `has no effect when no checkpointer is present.` | {{code libs/langgraph/langgraph/pregel/main.py:2929-2932}} |
| a logged warning | `Deserializing unregistered type __main__.Color from checkpoint. This will be blocked in a future version.` | {{code libs/checkpoint/langgraph/checkpoint/serde/jsonplus.py:600}} |
| `LangSmithBetaWarning` | `'upload_results' parameter is in beta.` | {{code src/langsmith/evaluation/_runner.py:402}} |
| `UserWarning` | `Pydantic serializer warnings:`, then `PydanticSerializationUnexpectedValue` for the field `context` | `pydantic`, for a `context` dict on an agent with no `context_schema` |

Sources: capture/out/01-init-chat-model.txt, capture/out/04-tool-errors.txt, capture/out/08-structured-errors.txt, capture/out/09-middleware-order.txt, capture/out/11-mw-call-limits.txt, capture/out/13-mw-fallback-refusal.txt, capture/out/14-mw-pii.txt, capture/out/15-mw-hitl-batched.txt, capture/out/18-mw-selection-emulation.txt, capture/out/20-mw-decisions.txt, capture/out/24-stream-v2.txt, capture/out/25-stream-events-v3.txt, capture/out/27-stream-stock-fakes.txt, capture/out/28-checkpoint-memory.txt, capture/out/31-durability.txt, capture/out/33-store.txt, capture/out/34-stategraph-reducers-send-command.txt, capture/out/37-error-handler-timeout.txt, capture/out/38-recursion-limit.txt, capture/out/40-mcp.txt, capture/out/42-langsmith.txt; capture/lab/T06-structured-output-mac/03-ollama-seq-n10.jsonl, capture/lab/T07-approvals-mac/01-cases.jsonl, capture/lab/T08-parallel-tools-mac/02-idless-and-dupnames.jsonl, capture/lab/T12-mcp-mac/01-langchain-mcp.jsonl, capture/lab/T13-serde-mac/03-round-trip.jsonl, capture/lab/T13-serde-mac/04-round-trip-log.txt, capture/lab/T14-stores-mac/01-memory-sqlite.jsonl, capture/lab/T15-agent-server-x86/04-double-texting.jsonl, capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt, capture/lab/T17-claims-mac/02-replay-and-fork.jsonl, capture/lab/T19-pytest-plugin-mac/02-off-noenv-output-rep1-stdout.txt, capture/lab/T19-pytest-plugin-mac/02-on-noenv-refuse-rep1-stdout.txt, capture/lab/T20-mcp-edges-mac/01-mcp-edges.jsonl; the code files named in each row, at langchain==1.5.0, langchain-core 1.8.0, langgraph 1.2.22, and langsmith 0.14.17.
