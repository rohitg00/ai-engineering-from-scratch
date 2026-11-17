# Glossary

> Each term below has one meaning in this manual, and a term that two sections use in two senses lists both, each with its own context.

The meanings come from the code at the pin, the documentation at docs commit `04d4d4a`, and the definitions in the sections. Terms in code font are literal names that you type or read in output.

| Term | Meaning in this manual | Explained in |
|---|---|---|
| Advisory lock | A Postgres lock on a number that your code chooses, held by a session and freed when the session ends. | [9.7](#s-workers-the-advisory-lock-and-cost) |
| `add_messages` | The reducer for a list of messages. It appends a message with a new id, replaces a message with the same id, and deletes the message that a `RemoveMessage` names. | [6.1](#s-stategraph-state-and-reducers) |
| Agent Server | The LangSmith server that runs a compiled graph behind an HTTP API of assistants, threads, and runs. Its package is `langgraph-api`. | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `AgentState` | The state type of every agent, with the keys `messages`, `jump_to`, and `structured_response`. | [4.1](#s-create-agent-and-the-graph-it-builds) |
| `AutoModeMiddleware` | A middleware that asks a decision model if a call to a listed tool is risky, and blocks the call at a probability of 0.5 or more. | [4.8](#s-guardrails-pii-and-the-decision-middleware-beta) |
| Batched mode | The default `interrupt_mode`. One interrupt holds every paused call of one model message, and one resume answers all of them in order. | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| Built-in middleware | A middleware class that `langchain` exports from `langchain.agents.middleware`. There are 19 at the pin. | [4.6](#s-the-built-in-middleware) |
| Capture kit | The program in `capture/` that drives the stack in one Python process, offline, and writes what it sees to `capture/out/`. | [How to read this manual](#s-front) |
| Channel version | A number that the loop stores for each channel in the checkpoint. A channel that changes in a superstep gets a new version. | [2.1](#s-the-superstep-loop-plan-execute-update) |
| Checker | The function of the bench that decides a pass from what the tools changed, such as the lookups that ran, the database, the files, and the notes store. | [The bench method](#s-ref-the-bench-method) |
| Checkpoint | The saved state of one thread after one step, with the step number, the next nodes, and the id of the checkpoint before it. | [1.3](#s-one-create-agent-run) |
| Checkpoint tuple | What a checkpointer returns for one checkpoint: its `config`, its `metadata`, the checkpoint, the config of its parent, and its pending writes. | [5.2](#s-checkpointers-and-threads) |
| Checkpointer | An object that saves the graph state after each step and loads the latest checkpoint when the next run starts. | [5.2](#s-checkpointers-and-threads) |
| Chunk, of a message | A part of a message that a model streams, such as an `AIMessageChunk`. Chunks add with `+` into one message. | [3.3](#s-messages-and-content-blocks) |
| Chunk, of a stream | One item that `stream` yields. Its shape depends on the stream mode, the number of modes, and the stream version. | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `Command` | A value that a node returns to update the state and name the next node in one step, with the fields `update`, `goto`, `graph`, and `resume`. | [6.2](#s-edges-send-and-command) |
| Conditional edge | An edge with a routing function, which reads the state after the source node and returns the next node, a list of nodes, or `END`. | [6.2](#s-edges-send-and-command) |
| Content block | One typed part of a message, a dict with a `type` such as `text`, `reasoning`, `image`, `file`, or `tool_call`. | [3.3](#s-messages-and-content-blocks) |
| Context engineering | The choice of what the model receives on each call: which messages, which tools, and which instructions. | [5.5](#s-context-engineering-and-summarization) |
| Context window | The most tokens that a model accepts in one call, input and output together. | [5.5](#s-context-engineering-and-summarization) |
| `create_agent` | The function in `langchain.agents` that turns a model, tools, a prompt, and middleware into a `CompiledStateGraph`. | [4.1](#s-create-agent-and-the-graph-it-builds) |
| Decision | The answer to one paused tool call, with a `type` of `approve`, `edit`, `reject`, or `respond`. | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| Decision model | A `BaseDecisionModel` from `langchain_core.decisions`, new in `langchain-core` 1.8.0, that answers typed questions. | [4.8](#s-guardrails-pii-and-the-decision-middleware-beta) |
| Deep agent | An agent from `create_deep_agent` in `deepagents`. It is a `create_agent` graph with a fixed stack of middleware around your own. | [7.4](#s-deep-agents-0-7) |
| Deep Agents | The harness project, in the package `deepagents`, that adds file tools, subagents, and summarization to an agent. | [1.1](#s-langchain-langgraph-langsmith-and-deep-agents) |
| `default_retry_on` | The default `retry_on` of both retry middlewares. It retries every `Exception` except a `ModelError` whose `is_retryable` is false. | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| Delivery delay | The time from the moment the model server sends a token to the moment your loop sees it, on one clock. | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `DeltaChannel` | A beta channel type in `langgraph.channels.delta` that saves only the new writes of each step. It saves a full snapshot after `snapshot_frequency` updates, 100 by default, or after 5,000 steps. | [5.5](#s-context-engineering-and-summarization) |
| Distractor tool | A tool that a task does not need, with a plausible name and description. The bench has 95 of them. | [4.4](#s-many-tools-and-the-tool-selector) |
| Distribution | A package as `pip` names it, such as `langchain-core`. Its import name has `_` in place of `-`. | [3.1](#s-install-and-the-package-map) |
| Double texting | A second run on a thread while a first run on that thread is still running. | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| Durability mode | The `durability` argument of `invoke` and `stream`: `sync`, `async`, or `exit`. It decides when the checkpoints of a run are written. | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| Embedding model | An object with `embed_query` and `embed_documents` that turns text into a vector of numbers. | [7.1](#s-embeddings-splitters-vector-stores-and-retrievers) |
| Entrypoint | A function decorated with `@entrypoint`, which LangGraph runs as a graph with one node. | [6.3](#s-the-functional-api-entrypoint-and-task) |
| `entrypoint.final` | A return value of an entrypoint that splits what the caller gets from what the thread saves. | [6.3](#s-the-functional-api-entrypoint-and-task) |
| Error handler | A function that runs after the last failed attempt of a node. It gets the state and a `NodeError`, and returns an update or a `Command`. | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| Eval | One scripted conversation against the running service, followed by assertions on the tool calls, the rows, and the thread state. | [9.6](#s-evals-that-check-state) |
| Evaluator | A function that scores one row of an experiment and returns a dict with a `key` and a `score`. | [7.7](#s-evaluation-with-langsmith) |
| Example | One input with its reference output, as a `langsmith.schemas.Example`. | [7.7](#s-evaluation-with-langsmith) |
| Experiment | One call of `evaluate` over a set of examples. | [7.7](#s-evaluation-with-langsmith) |
| Extraction call | One call of `with_structured_output` after the agent run, which reads the question and the final reply and returns the schema. | [4.3](#s-structured-output-which-strategy-on-which-provider) |
| Failure category | The first matching reason for a failed bench task, such as `wrong_tool`, `wrong_args`, or `wrong_final_state`. | [The bench method](#s-ref-the-bench-method) |
| Failure drill | A script that causes each known failure on purpose, on a machine you can lose, and prints what you would see. | [8.7](#s-a-failure-drill) |
| `FilesystemBackend` | A backend that maps the file tools of a deep agent to a folder on disk, in place of the agent state. | [7.4](#s-deep-agents-0-7) |
| Fork | A new checkpoint whose parent is a past checkpoint. Runs from it form a branch beside the old one. | [6.6](#s-time-travel-replay-update-state-and-forks) |
| Framework time | The wall time of a task minus the time inside the model calls and the tool functions. | [1.2](#s-do-you-need-langchain), [2.6](#s-checkpoint-growth-and-the-cost-of-a-superstep) |
| `GraphRunStream` | The object that `stream_events(..., version="v3")` returns, with raw events and typed views such as `messages`. | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| Guardrail | A check inside the agent that changes, blocks, or stops a request, a reply, or a tool call. | [4.8](#s-guardrails-pii-and-the-decision-middleware-beta) |
| `handle_errors` | The `ToolStrategy` parameter that sets the retry after a parse error. `True`, the default, retries on every parse error. | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `HumanInTheLoopMiddleware` | The middleware that pauses an agent when the model asks for a tool in its `interrupt_on` map, and waits for a decision. | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| Idempotency key | A value that names one side effect, so that the effect can check if it already happened and skip itself. | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| Idempotent tool | A tool that gives the same result and the same side effects when you call it twice with the same arguments. | [9.5](#s-timeouts-retries-backup-model-and-shutdown) |
| Interrupt | A call of `interrupt(value)` inside a node. It stops the run, saves a checkpoint, and gives `value` to the caller. | [6.4](#s-interrupt-and-resume) |
| Item | One value in a store, with its namespace, its key, and the times it was created and updated. | [5.4](#s-stores-and-long-term-memory) |
| Jobs per worker | The number of runs that one queue worker of Agent Server executes at the same time. | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `jump_to` | A key that a node hook returns to move the run to `model`, `tools`, or `end`. | [4.5](#s-middleware-hooks-and-their-order) |
| Lab recording | A run against a real model or a real database on one of our machines, kept as raw files in `capture/lab/`. | [How this manual was made](#s-ref-how-this-manual-was-made) |
| LangChain | The agent framework, in the packages `langchain` and `langchain-core`. | [1.1](#s-langchain-langgraph-langsmith-and-deep-agents) |
| LangGraph | The runtime that runs an agent as a graph of nodes, in the package `langgraph`. | [1.1](#s-langchain-langgraph-langsmith-and-deep-agents) |
| LangSmith | The hosted platform for traces, evaluations, prompts, and deployments, and its client package `langsmith`. | [1.1](#s-langchain-langgraph-langsmith-and-deep-agents) |
| `max_concurrency` | The key of the run config that caps how many tasks of one step run at the same time. | [4.1](#s-create-agent-and-the-graph-it-builds) |
| MCP adapter | The class `MCPAdapter` in `langchain.mcp`. It connects to an MCP server through FastMCP and returns its tools as LangChain tools. | [7.3](#s-mcp-with-langchain-mcp) |
| MCP tool error | A tool result with `isError` set to true. A FastMCP server sends one when the tool raises. | [7.3](#s-mcp-with-langchain-mcp) |
| Message | One entry in the conversation, with a type, a `content`, and an optional `id`. | [3.3](#s-messages-and-content-blocks) |
| Middleware | An object of a subclass of `AgentMiddleware` that `create_agent` runs at fixed points of the agent loop. | [4.5](#s-middleware-hooks-and-their-order) |
| Model profile | A dict on `model.profile` with the limits and features of one model. | [3.2](#s-init-chat-model-and-model-profiles) |
| Model string | The text form of a model, such as `openai:gpt-4.1`, that `init_chat_model` and `create_agent` accept. | [3.2](#s-init-chat-model-and-model-profiles) |
| `ModelFallbackMiddleware` | The middleware that calls the next model in its list when a model call raises. | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| Namespace, of a store | A tuple of strings, such as `("users", "ada", "memories")`, that groups the items of a store. Each string is a label. | [5.4](#s-stores-and-long-term-memory) |
| Namespace, of a subgraph | The path of a subgraph run inside its parent, such as `inner:<task id>`. Stream chunks, checkpoints, and state carry it. | [6.7](#s-subgraphs-and-multi-agent-patterns) |
| Node hook | A middleware hook that `create_agent` turns into a graph node. It takes the state and the runtime. | [4.5](#s-middleware-hooks-and-their-order) |
| Node timeout | The `timeout` of `add_node`, in seconds, for each attempt of an async node. | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| Pending write | A value that a task wrote during a step, saved under the checkpoint that the step started from. It can reach the saver after the checkpoint of its own step. A resume applies it and does not run that task again. | [5.2](#s-checkpointers-and-threads), [2.3](#s-the-checkpoint-write-path-and-durability) |
| Per-call mode | `interrupt_mode="per_call"`. Each paused call gets its own interrupt, and a resume answers any of them by interrupt id. | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| `PIIMiddleware` | A middleware that finds one type of personal data in messages and applies one strategy to each match. | [4.8](#s-guardrails-pii-and-the-decision-middleware-beta) |
| Plain edge | An edge that LangGraph follows every time its source node finishes. | [6.2](#s-edges-send-and-command) |
| Projection | A typed view of one v3 message, such as `message.text`, that yields its own deltas. | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| Python floor | The oldest Python version that a package declares in `requires-python`. | [3.1](#s-install-and-the-package-map) |
| Recursion limit | The number of steps after which a run raises `GraphRecursionError`. Each step counts once, whatever number of nodes run in it. | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| Reducer | A function of the old value and an update that returns the new value of one state key. | [6.1](#s-stategraph-state-and-reducers) |
| `RemainingSteps` | A managed value in the state that holds the number of steps left before the limit. | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| Replay | An `invoke(None, config)` where `config` names a past checkpoint. The nodes in its `next` run again. | [6.6](#s-time-travel-replay-update-state-and-forks) |
| Resume | An `invoke` or `stream` call with `Command(resume=value)` on the thread of the pause. The `interrupt` call then returns `value`. | [6.4](#s-interrupt-and-resume) |
| Resume list | The list of answers that one task has received so far, saved as a write on the channel `__resume__`. | [2.4](#s-interrupt-and-resume-in-the-code) |
| Retriever | An object with `invoke(query)` that returns a list of `Document` objects, with the base class `BaseRetriever`. | [7.1](#s-embeddings-splitters-vector-stores-and-retrievers) |
| Resume map | A `Command(resume=...)` whose value is a dict keyed by interrupt ids. At the pin it goes into the run config only. | [9.3](#s-approvals-and-the-idempotency-key) |
| Retry layer | One piece of code that calls the model or the tool again after a failure, such as the client of a provider package or `ModelRetryMiddleware`. | [3.2](#s-init-chat-model-and-model-profiles), [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| `RetryPolicy` | The settings for running a failed node again: `max_attempts`, the wait between attempts, and `retry_on`. | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| Round trip | A value written into a checkpoint and read back. It round-trips when it comes back with the same type and an equal value. | [5.6](#s-serialization-of-state-and-what-does-not-round-trip) |
| Run | One call of `invoke` or `stream`. | [How to read this manual](#s-front) |
| Run task | The `asyncio` task that iterates `agent.astream` for one run and puts each event on a queue that the response reads. | [9.1](#s-the-run-endpoint-and-its-stream) |
| Run tree | The in-memory object of one traced run, `RunTree` in `langsmith`. | [7.6](#s-langsmith-tracing) |
| `Send` | A value that names a node and the input of one run of it. A list of them from a routing function starts one task for each. | [6.2](#s-edges-send-and-command) |
| Serializer | The object that turns state values into bytes for a checkpointer and back. The default is `JsonPlusSerializer`. | [5.6](#s-serialization-of-state-and-what-does-not-round-trip) |
| Side effect | A change that a node or tool makes outside the graph state, such as a charge or an email. A checkpoint cannot undo it. | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| State | The shared data of one graph run, declared as a schema whose keys the nodes read and write. | [6.1](#s-stategraph-state-and-reducers) |
| State history | The list of checkpoints of one thread, newest first, from `get_state_history(config)`. | [6.6](#s-time-travel-replay-update-state-and-forks) |
| Step | One superstep of the LangGraph loop, in which every node that is ready runs once. | [How to read this manual](#s-front) |
| Span | One timed operation of OpenTelemetry, with a name, attributes, a status, and a parent. | [9.4](#s-opentelemetry-spans-with-langsmith-off) |
| Superstep | One turn of the LangGraph loop. It plans the tasks that are ready, runs them, and then applies all of their writes at once. | [2.1](#s-the-superstep-loop-plan-execute-update) |
| Store | An object that saves JSON items by namespace and key, shared by all threads of a graph. | [5.4](#s-stores-and-long-term-memory) |
| Stratified subset | The 30 bench tasks numbered 01, 04, 07, 10, 13, and 16 in each family, which the models that did not run the full suite ran. | [The bench method](#s-ref-the-bench-method) |
| Stream mode | The name that you pass as `stream_mode`, which decides what `stream` yields at each step. | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `StreamPart` | The dict that `stream(..., version="v2")` yields, with the keys `type`, `ns`, and `data`. | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| Strict pass | A bench pass where the answer also came through the `submit_answer` tool. | [1.2](#s-do-you-need-langchain) |
| Structured output strategy | The way `create_agent` gets an object of your schema from the model, into `structured_response`. | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| Subagent | An agent that another agent calls as a tool. The caller sees only its last message. | [6.7](#s-subgraphs-and-multi-agent-patterns) |
| Subgraph | A compiled graph used as a node of another graph. Shared keys of the two schemas pass between them. | [6.7](#s-subgraphs-and-multi-agent-patterns) |
| Summary evaluator | A function that scores all the rows of an experiment at once, such as an accuracy. | [7.7](#s-evaluation-with-langsmith) |
| Summary message | The human message that `SummarizationMiddleware` writes in place of old messages. | [5.5](#s-context-engineering-and-summarization) |
| System prompt | The instructions that go first in every model request of an agent. | [3.5](#s-the-system-prompt) |
| Target, of an evaluation | The function that `evaluate` calls with the inputs of each example. | [7.7](#s-evaluation-with-langsmith) |
| Target, of an MCP adapter | The first argument of `MCPAdapter`: an `http` or `https` URL, a `Path`, a transport, a server, or a config. | [7.3](#s-mcp-with-langchain-mcp) |
| Task | A function decorated with `@task`. A call returns a future, and LangGraph saves its result when it finishes. | [6.3](#s-the-functional-api-entrypoint-and-task) |
| Task suite | The 99 tasks of the bench kit, in five families, each checked by what its tools changed. | [1.2](#s-do-you-need-langchain) |
| Text splitter | An object that cuts a document into chunks of at most `chunk_size` characters, with `chunk_overlap` characters repeated. | [7.1](#s-embeddings-splitters-vector-stores-and-retrievers) |
| Thread | The series of checkpoints saved under one `thread_id`. A thread is the conversation. | [5.2](#s-checkpointers-and-threads) |
| Tool | A function wrapped by `@tool`, with a name, a description, and a JSON schema for its arguments. | [3.4](#s-tools-toolruntime-and-tool-errors) |
| Tool call | An entry in `AIMessage.tool_calls` with a `name`, parsed `args`, and an `id`. | [3.3](#s-messages-and-content-blocks) |
| Tool call id | The id that the model gives each tool call, which the `ToolMessage` of that call carries back in `tool_call_id`. | [3.4](#s-tools-toolruntime-and-tool-errors) |
| Tool error | A failure while the agent runs a tool call. Its kind decides if the run raises or goes on. | [3.4](#s-tools-toolruntime-and-tool-errors) |
| Tool event | A chunk of the `tools` stream mode: `tool-started`, `tool-output-delta`, `tool-finished`, or `tool-error`. | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `ToolRuntime` | A parameter type that gives a tool the state, the context, the store, the stream writer, and the id of the current tool call. | [3.4](#s-tools-toolruntime-and-tool-errors) |
| Trace | A tree of runs for one top-level call, each with a name, a run type, inputs, outputs, an error, and its child runs. | [7.6](#s-langsmith-tracing) |
| `trim_messages` | A function in `langchain_core.messages` that keeps the first or the last messages of a list up to a token budget. | [5.5](#s-context-engineering-and-summarization) |
| Turn | One human message and everything up to the reply. | [How to read this manual](#s-front) |
| Vector store retriever | The retriever that `as_retriever()` returns. It runs one search on the store with the `search_kwargs` you gave it. | [7.1](#s-embeddings-splitters-vector-stores-and-retrievers) |
| Virtual filesystem | The `files` channel in the state of a deep agent. With the default backend, the file tools never touch the disk. | [7.4](#s-deep-agents-0-7) |
| Wrap hook | A middleware hook that takes a request and a `handler`, and calls the handler to run the model or the tool. | [4.5](#s-middleware-hooks-and-their-order) |

Sources: the definitions in front.md and in every file under sections/; libs/langchain_v1/langchain/agents/factory.py and libs/langchain_v1/langchain/agents/middleware/types.py at langchain==1.5.0; libs/langgraph/langgraph/types.py at langgraph 1.2.22.
