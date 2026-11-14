# Middleware hooks and classes

> `AgentMiddleware` has six hooks with a sync and an async form each, and `langchain` 1.5.0 builds 19 middleware classes on them.

Every middleware is a subclass of `AgentMiddleware` in `langchain.agents.middleware`. The module exports 50 names {{code libs/langchain_v1/langchain/agents/middleware/__init__.py}}. A path in this page is relative to `libs/langchain_v1/langchain/agents/middleware/` at `langchain==1.5.0`, unless it names another package. [Section 3.3](#s-middleware-hooks-and-their-order) gives the order of the hooks, and [section 3.4](#s-the-built-in-middleware) tells you when to use each class.

## The six hooks

`AgentMiddleware` starts at line 387 of `types.py` {{code libs/langchain_v1/langchain/agents/middleware/types.py:387}}.

| Hook | Async form | Kind | Arguments | Returns | Line |
|---|---|---|---|---|---|
| `before_agent` | `abefore_agent` | node | `state`, `runtime` | a state update or `None` | 433, 444 |
| `before_model` | `abefore_model` | node | `state`, `runtime` | a state update or `None` | 457, 468 |
| `wrap_model_call` | `awrap_model_call` | wrap | `request`, `handler` | a `ModelResponse`, an `AIMessage`, or an `ExtendedModelResponse` | 505, 600 |
| `after_model` | `aafter_model` | node | `state`, `runtime` | a state update or `None` | 481, 492 |
| `wrap_tool_call` | `awrap_tool_call` | wrap | `request`, `handler` | a `ToolMessage` or a `Command` | 676, 758 |
| `after_agent` | `aafter_agent` | node | `state`, `runtime` | a state update or `None` | 652, 663 |

A middleware with only the sync form of a wrap hook raises `NotImplementedError` under `ainvoke`. The message lists three ways to fix it, and the reverse case raises too {{code libs/langchain_v1/langchain/agents/middleware/types.py:588-598}} {{code libs/langchain_v1/langchain/agents/middleware/types.py:640-650}}.

## Order and names

| Rule | Where in the code |
|---|---|
| A node hook becomes the graph node `<name>.<hook>`, such as `HumanInTheLoopMiddleware.after_model`. | {{code libs/langchain_v1/langchain/agents/factory.py:1639-1716}} |
| The default `name` is the class name. Two middlewares with one name raise `AssertionError`. | {{code libs/langchain_v1/langchain/agents/middleware/types.py:425-431}} {{code libs/langchain_v1/langchain/agents/factory.py:1163-1165}} |
| `before_agent` and `before_model` run in list order. | {{code libs/langchain_v1/langchain/agents/factory.py:1816-1857}} |
| `after_model` runs in reverse list order, because the `model` node leads to the last one. | {{code libs/langchain_v1/langchain/agents/factory.py:1858-1873}} |
| `after_agent` also runs in reverse list order, once at the end of the run. | {{code libs/langchain_v1/langchain/agents/factory.py:1875-1898}} |
| The first middleware in the list is the outer layer of each wrap hook. | {{code libs/langchain_v1/langchain/agents/middleware/types.py:515-517}} |
| A node hook can return `jump_to` only to targets that it declares with `hook_config(can_jump_to=...)`. | {{code libs/langchain_v1/langchain/agents/middleware/types.py:881}} |

Capture `09-middleware-order.txt` records the order for one tool round trip with three middlewares.

## Decorators

Each decorator turns one function into a middleware class with one hook {{code libs/langchain_v1/langchain/agents/middleware/types.py:881-2039}}.

| Decorator | Hook | Line |
|---|---|---|
| `before_agent` | `before_agent` | 1320 |
| `before_model` | `before_model` | 954 |
| `after_model` | `after_model` | 1143 |
| `after_agent` | `after_agent` | 1532 |
| `wrap_model_call` | `wrap_model_call` | 1866 |
| `wrap_tool_call` | `wrap_tool_call` | 2039 |
| `dynamic_prompt` | `wrap_model_call`, and it sets the system message | 1706 |
| `hook_config` | none. It declares `can_jump_to` on a hook method | 881 |

The node hook decorators take the keywords `state_schema`, `tools`, `can_jump_to`, and `name`. The two wrap decorators take no `can_jump_to`.

## Request and response types

| Type | Fields | Line |
|---|---|---|
| `ModelRequest` | `model`, `messages` without the system message, `system_message`, `tool_choice`, `tools`, `response_format`, `state`, `runtime`, `model_settings`. Change it with `override(**kw)` | `types.py:90` |
| `ModelResponse` | `result`, a list of messages, and `structured_response` | `types.py:275` |
| `ExtendedModelResponse` | `model_response` and an optional `command` | `types.py:293` |
| `ToolCallRequest` | `tool_call`, `tool`, `state`, `runtime`. Change it with `override(**kw)` | `langgraph.prebuilt` `tool_node.py:141` |

{{code libs/langchain_v1/langchain/agents/middleware/types.py:90-317}} {{code libs/prebuilt/langgraph/prebuilt/tool_node.py:141-175}}

## The 19 classes

Each row gives the hooks, the constructor defaults that change behaviour, and the file and line of the class and of its `__init__`. A parameter without a default is required.

| Class | Hooks | Constructor defaults | File and line |
|---|---|---|---|
| `SummarizationMiddleware` | `before_model` | `model` required, `trigger=None`, `keep=("messages", 20)`, `trim_tokens_to_summarize=4000` | `summarization.py:263`, `:282` |
| `ContextEditingMiddleware` | `wrap_model_call` | `edits=None`, `token_count_method="approximate"` | `context_editing.py:187`, `:201` |
| `HumanInTheLoopMiddleware` | `after_model`, `wrap_tool_call` | `interrupt_on` required, `description_prefix="Tool execution requires approval"`, `interrupt_mode="batched"` | `human_in_the_loop.py:398`, `:491` |
| `ModelCallLimitMiddleware` | `before_model`, `after_model` | `thread_limit=None`, `run_limit=None`, `exit_behavior="end"` | `model_call_limit.py:94`, `:126` |
| `ToolCallLimitMiddleware` | `after_model` | `tool_name=None`, `thread_limit=None`, `run_limit=None`, `exit_behavior="continue"` | `tool_call_limit.py:141`, `:202` |
| `ToolRetryMiddleware` | `wrap_tool_call` | `max_retries=2`, `tools=None`, `on_failure="continue"`, `backoff_factor=2.0`, `initial_delay=1.0`, `max_delay=60.0`, `jitter=True` | `tool_retry.py:32`, `:133` |
| `ModelRetryMiddleware` | `wrap_model_call` | `max_retries=2`, `on_failure="continue"`, `backoff_factor=2.0`, `initial_delay=1.0`, `max_delay=60.0`, `jitter=True` | `model_retry.py:33`, `:116` |
| `ModelFallbackMiddleware` | `wrap_model_call` | `first_model`, then any number of other models | `model_fallback.py:342`, `:368` |
| `ModelRefusalMiddleware` | `wrap_model_call` | no parameters | `model_refusal.py:39` |
| `ToolErrorMiddleware` | `wrap_tool_call` | `on_error=None`, `aon_error=None`, `tools=None`. With neither handler it raises `ValueError` | `tool_error.py:37`, `:84` |
| `PIIMiddleware` | `before_model`, `after_model` | `pii_type` required, `strategy="redact"`, `apply_to_input=True`, `apply_to_output=False`, `apply_to_tool_results=False` | `pii.py:513`, `:577` |
| `ModelRouterMiddleware` | `before_agent`, `wrap_model_call` | `choices`, `instructions`, and `classifier` required. Beta, marked with `@beta`, new in 1.5.0 | `model_router.py:72`, `:121` |
| `AutoModeMiddleware` | `wrap_tool_call` | `tools` and `classifier` required, `criteria=None`. Beta in its docstring only, with no `@beta` mark and no warning, new in 1.5.0 | `auto_mode.py:64`, `:117` |
| `TodoListMiddleware` | `wrap_model_call`, `after_model` | a default system prompt and tool description | `todo.py:174`, `:203` |
| `LLMToolSelectorMiddleware` | `wrap_model_call` | `model=None`, `max_tools=None`, `always_include=None`, `max_retries=1` | `tool_selection.py:121`, `:150` |
| `LLMToolEmulator` | `wrap_tool_call` | `tools=None`, `model=None` | `tool_emulator.py:27`, `:71` |
| `ProviderToolSearchMiddleware` | `wrap_model_call` | `searchable_tools=None` | `provider_tool_search.py:57`, `:93` |
| `ShellToolMiddleware` | `before_agent`, `after_agent` | `workspace_root=None`, `execution_policy=None`, which becomes `HostExecutionPolicy()`, `tool_name="shell"` | `shell_tool.py:518`, `:537` |
| `FilesystemFileSearchMiddleware` | none. It adds tools only | `root_path` required, `use_ripgrep=True`, `max_file_size_mb=10` | `file_search.py:108`, `:133` |

{{code libs/langchain_v1/langchain/agents/middleware/model_retry.py:116-125}} {{code libs/langchain_v1/langchain/agents/middleware/tool_call_limit.py:202-208}} {{code libs/langchain_v1/langchain/agents/middleware/model_call_limit.py:126-131}} {{code libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py:491-498}} {{code libs/langchain_v1/langchain/agents/middleware/summarization.py:282-292}} {{code libs/langchain_v1/langchain/agents/middleware/pii.py:577-586}} {{code libs/langchain_v1/langchain/agents/middleware/file_search.py:133-138}} {{code libs/langchain_v1/langchain/agents/middleware/auto_mode.py:117-124}} {{code libs/langchain_v1/langchain/agents/middleware/model_router.py:121-127}}

A `max_retries` of 2 means 3 attempts in all. `retry_on` defaults to `default_retry_on` in both retry classes, as [section 3.5](#s-retries-backup-models-rate-limits-and-caching) explains. With the default `trigger=None`, `SummarizationMiddleware` never summarizes {{code libs/langchain_v1/langchain/agents/middleware/summarization.py:698-701}}.

## Types of human review

| Name | Values or fields | Line in `human_in_the_loop.py` |
|---|---|---|
| `DecisionType` | `approve`, `edit`, `reject`, `respond` | 87 |
| `InterruptMode` | `batched`, `per_call` | 170 |
| `HITLRequest` | `action_requests`, `review_configs` | 107 |
| `HITLResponse` | `decisions` | 289 |
| `InterruptOnConfig` | `allowed_decisions`, `description`, `args_schema`, `when` | 306 |

`True` in `interrupt_on` allows all four decisions {{code libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py:586}}. [Section 5.5](#s-human-in-the-loop-batched-and-per-call) runs both modes.

Sources: libs/langchain_v1/langchain/agents/middleware/__init__.py, types.py, summarization.py, context_editing.py, human_in_the_loop.py, model_call_limit.py, tool_call_limit.py, tool_retry.py, model_retry.py, model_fallback.py, model_refusal.py, tool_error.py, pii.py, model_router.py, auto_mode.py, todo.py, tool_selection.py, tool_emulator.py, provider_tool_search.py, shell_tool.py, file_search.py, and libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0; libs/prebuilt/langgraph/prebuilt/tool_node.py at langgraph 1.2.22; capture/out/09-middleware-order.txt.
