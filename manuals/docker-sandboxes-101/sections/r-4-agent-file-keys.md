# Agent file keys

> Every key of the agent file at schema version 16, grouped by block, with its type, default, requirement, and meaning from `agent-schema.json` at v1.149.0.

The schema is titled Docker Agent Configuration, and the pinned copy is the file at tag v1.149.0, commit bf4169cdd31229d52385410c52c3dcc59b497858 {{schema Docker Agent Configuration}}. Its `version` enum runs from `"0"` to `"16"`, so `"16"` is the current form {{schema version}}. The top level and every block below set `additionalProperties` to `false`, so an unknown key fails the load. The only required top-level key is `agents` {{schema agents}}. Required says whether the schema lists the key under `required`. Default is the schema `default` value, and `none` means the schema states none.

## Top-level keys

All 16 keys come from the root `properties` object {{schema properties}}. The docs page `configuration/overview` explains the reusable blocks `mcps`, `rag`, `commands`, `skills`, and `toolsets`.

| Key | Type | Default | Required | Meaning |
|---|---|---|---|---|
| `version` | string, `"0"` to `"16"` | none | no | Configuration version |
| `providers` | map of ProviderConfig | none | no | Reusable provider defaults: `base_url`, `token_key`, `api_type` |
| `agents` | map of AgentConfig | none | yes | The agents. At least one is required |
| `models` | map of ModelConfig | none | no | Named model configurations |
| `mcps` | map of MCPToolset | none | no | Reusable MCP server definitions, referenced by name from a toolset |
| `rag` | map of RAGToolset | none | no | Reusable RAG source definitions |
| `commands` | map of Commands | none | no | Named command groups, merged with `use_commands` |
| `skills` | map of SkillsConfig | none | no | Named skill groups, merged with `use_skills` |
| `toolsets` | map of Toolset | none | no | Named toolset definitions, appended with `use_toolsets` |
| `metadata` | Metadata | none | no | Author, license, readme, description, version, tags |
| `permissions` | PermissionsConfig | none | no | Tool approval patterns for the whole file |
| `runtime` | RuntimeDefaults | none | no | Execution defaults the author wants. CLI flags and user settings win |
| `budget` | BudgetConfig | none | no | Ceilings for one run, shared by every sub-session in it |
| `budgets` | map of BudgetConfig | none | no | Named budgets. Agents that share a name share one ceiling |
| `flavors` | map of object or null | none | no | Named YAML patches applied with `--flavor`, with JSON Merge Patch rules, `key+` appends, `key-` removes |
| `evaluators` | map of EvaluatorConfig | none | no | Named provider-backed assessments for `tool_guard` and routing hooks |

## Keys under agents

Every key of one agent comes from `AgentConfig` {{schema AgentConfig}}. The docs page `configuration/agents` explains them, `configuration/structured-output` covers `structured_output`, and `features/harnesses` covers `harness`.

| Key | Type | Default | Required | Meaning |
|---|---|---|---|---|
| `model` | string | none | no | A model name from `models` or `provider/model` |
| `fallback` | FallbackConfig: `models` (array), `retries` (default `2`), `cooldown` (default `1m`) | none | no | Models tried in order when the primary fails, with retry and cool-down rules |
| `description` | string | none | no | Description of the agent |
| `welcome_message` | string | none | no | Message shown when the agent starts |
| `toolsets` | array of Toolset | none | no | The toolsets of the agent |
| `instruction` | string or array of strings | none | no | The system prompt. A list is joined with blank lines |
| `instruction_file` | string or array of strings | none | no | Files, relative to the config file, whose content is the instruction. Exclusive with `instruction` |
| `harness` | HarnessConfig: `type` (required, `claude-code`, `codex`, `pi`, `opencode`), `model`, `effort`, `agent`, `thinking` | none | no | An external coding CLI that runs the agent instead of a model provider |
| `code_mode_tools` | boolean | none | no | Expose one tool that calls the others through JavaScript |
| `sub_agents` | array of strings | none | no | Agents the parent delegates to with `transfer_task`: local names, OCI references, or `name:reference` |
| `handoffs` | array of strings | none | no | Agents that can receive the whole conversation |
| `force_handoff` | string | none | no | The agent that always receives the conversation after a final response |
| `routing` | AgentRouting: `allowed_agents` (required), `default_agent` | none | no | The agents a routing hook can select, and the one used when an evaluator is uncertain |
| `add_date` | boolean | none | no | Add the date to the context |
| `add_environment_info` | boolean | none | no | Add cwd, git, OS, and arch to the context |
| `readonly` | boolean | none | no | Keep only tools with a read-only annotation in every toolset |
| `safety` | `strict`, `balanced`, `restricted`, `autonomous` | none | no | Default safety mode of new sessions on this agent, below any user choice |
| `redact_secrets` | boolean | `true` | no | Install the `redact_secrets` builtin on tool input, model input, and tool output |
| `max_iterations` | integer | none | no | Maximum loop iterations |
| `budgets` | array of strings | none | no | Names of top-level `budgets` this agent spends against |
| `max_consecutive_tool_calls` | integer | `0`, which means `5` | no | Identical tool calls in a row before the agent stops |
| `max_old_tool_call_tokens` | integer | none, truncation off | no | Tokens kept from old tool arguments and results. `-1` turns truncation off |
| `max_tool_result_tokens` | integer | none | no | Tokens kept from each tool result, cut middle-out |
| `num_history_items` | integer | none | no | History items to keep |
| `session_compaction` | boolean | `true` | no | Compact the session at the threshold and after a context overflow |
| `compaction_threshold` | number | `0.9` | no | Fraction of the context window that starts compaction. The model value wins |
| `compaction_model` | string | none | no | Model that writes the summary. Highest priority of the three levels |
| `add_prompt_files` | array of strings | none | no | Prompt files, such as `AGENTS.md`, added to the context |
| `add_prompt_files_depth` | integer | `0` | no | Levels below the working directory in which the same file names are listed by path |
| `commands` | object or array | none | no | Named prompts for slash commands |
| `structured_output` | object: `name`, `description`, `schema`, `strict` | none | no | A JSON schema that constrains the response, native on OpenAI and Gemini |
| `add_description_parameter` | boolean | none | no | Add a `description` parameter to every tool call |
| `hooks` | HooksConfig | none | no | Lifecycle hooks of this agent |
| `cache` | CacheConfig: `enabled` (default `false`), `case_sensitive` (`false`), `trim_spaces` (`false`), `path` | none | no | Replay the previous answer to the same question |
| `skills` | boolean or array | none | no | `true` loads every discovered skill. A list mixes sources, names, and inline skills |
| `use_commands` | array of strings | none | no | Top-level command groups to merge in |
| `use_skills` | array of strings | none | no | Top-level skill groups to merge in |
| `use_toolsets` | array of strings | none | no | Top-level toolsets to append after the inline ones |

An inline skill under `skills` has `name`, `description`, and `instructions` as required keys, plus `context: fork`, `model`, `allowed_tools`, and `toolsets` {{schema InlineSkill}}. A command under `commands` is a string, or an object with `description`, `instruction`, `agent`, and `url` {{schema CommandConfig}}.

## Keys under models

Every key comes from `ModelConfig` {{schema ModelConfig}}. The docs page `configuration/models` explains them, and `configuration/routing` covers `routing`.

| Key | Type | Default | Required | Meaning |
|---|---|---|---|---|
| `provider` | string | none | no in the schema, yes in the docs unless `first_available` is set | The provider id, such as `openai`, `anthropic`, `dmr` |
| `model` | string | none | no in the schema, yes in the docs | The model name |
| `description` | string | none | no | A human summary, not sent to the model |
| `temperature` | number | none | no | Sampling temperature |
| `max_tokens` | integer | none | no | Maximum output tokens per response, not the context window |
| `top_p` | number | none | no | Top-p sampling |
| `frequency_penalty` | number | none | no | Frequency penalty |
| `presence_penalty` | number | none | no | Presence penalty |
| `base_url` | string | none | no | The API base URL, with `${env.VAR}` substitution |
| `parallel_tool_calls` | boolean | none | no | Allow parallel tool calls |
| `token_key` | string | none | no | Environment variable that holds the token |
| `bypass_models_gateway` | boolean | none | no | Connect to the provider directly even when a models gateway is set |
| `provider_opts` | object | none | no | Provider options. For `dmr`: `runtime_flags`, `context_size`, `keep_alive`, and more in [R.6](#s-ref-providers-and-models) |
| `track_usage` | boolean | none | no | Track usage |
| `thinking_budget` | string or integer | none | no | Reasoning effort or token budget, in the forms [R.6](#s-ref-providers-and-models) lists |
| `task_budget` | integer or object | none | no | Total token budget of a task, sent to Anthropic as `output_config.task_budget` |
| `routing` | array of RoutingRule: `model`, `examples` (both required) | none | no | Rules that pick a model from example phrases. This model becomes the router |
| `auth` | AuthConfig: `type` (required, `workload_identity_federation`), `workload_identity_federation` | none | no | A non-API-key scheme that wins over the provider path |
| `first_available` | array of strings | none | no | Candidates in priority order. The first with credentials is used. Exclusive with the other keys |
| `title_model` | string | none | no | Model that writes session titles |
| `compaction_model` | string | none | no | Model that writes compaction summaries |
| `compaction_threshold` | number | `0.9` | no | Compaction threshold for agents on this model |
| `capabilities` | CapabilitiesConfig: `image`, `pdf`, `audio`, `video` | none | no | Attachment capabilities, when the models.dev catalogue is wrong or silent |
| `output_capabilities` | OutputCapabilitiesConfig: `image` | none | no | Whether the model can generate images |
| `cost` | CostConfig: `input`, `output`, `cache_read`, `cache_write`, USD per million tokens | none | no | Prices that override the catalogue |

## Keys under providers

Every key comes from `ProviderConfig` {{schema ProviderConfig}}. The docs page `providers/custom` explains them.

| Key | Type | Default | Required | Meaning |
|---|---|---|---|---|
| `provider` | string | `openai` when unset | no | The underlying type: `openai`, `anthropic`, `google`, `amazon-bedrock`, `dmr`, or a built-in alias |
| `api_type` | `openai_chatcompletions`, `openai_responses` | `openai_chatcompletions` in the schema, model-dependent in the docs | no | The API schema of an OpenAI-compatible provider |
| `base_url` | string | none | no | The endpoint, required for OpenAI-compatible providers, with `${env.VAR}` substitution |
| `token_key` | string | none | no | Environment variable that holds the token |
| `unload_api` | string | none | no | Path or URL of the model unload endpoint, used by the `unload` builtin |
| `temperature` | number | none | no | Default temperature |
| `max_tokens` | integer | none | no | Default output tokens |
| `top_p` | number | none | no | Default top-p |
| `frequency_penalty` | number | none | no | Default frequency penalty |
| `presence_penalty` | number | none | no | Default presence penalty |
| `parallel_tool_calls` | boolean | none | no | Default for parallel tool calls |
| `provider_opts` | object | none | no | Provider options passed to the client |
| `track_usage` | boolean | none | no | Default usage tracking |
| `thinking_budget` | integer or string | none | no | Default reasoning budget |
| `task_budget` | integer or object | none | no | Default task budget |
| `auth` | AuthConfig | none | no | A non-API-key scheme |
| `compaction_model` | string | none | no | Default compaction model, lowest of the three levels |

The federation block under `auth` requires `federation_rule_id` (prefix `fdrl_`), `organization_id`, and `identity_token`, and accepts `service_account_id` {{schema FederationAuthConfig}}. The token source has `file`, `env`, `command`, `url`, `headers`, and `response_field` {{schema IdentityTokenSourceConfig}}.

## Keys under toolsets

Every key of one toolset entry comes from `Toolset` {{schema Toolset}}. The docs page `configuration/tools` explains the shared keys, and [R.5](#s-ref-toolsets) says which type uses which.

| Key | Type | Default | Required | Meaning |
|---|---|---|---|---|
| `type` | one of 27 names | none | no in the schema | The toolset type |
| `instruction` | string | none | no | Replaces the built-in instructions, or extends them with `{ORIGINAL_INSTRUCTIONS}` |
| `toon` | string | none | no | Comma-separated regular expressions of tools whose JSON output is re-encoded as TOON |
| `readonly` | boolean | none | no | Keep only tools with a read-only annotation |
| `model` | string | none | no | Model for the turn that processes results from this toolset |
| `ref` | string | none | no | `docker:<name>` or a name from `mcps` |
| `config` | any | none | no | Tool-specific configuration |
| `command` | string | none | no | Command of a stdio MCP or LSP server |
| `remote` | Remote: `url` (required), `transport_type`, `headers`, `oauth` | none | no | A remote MCP server |
| `args` | array of strings | none | no | Arguments of the command |
| `tools` | array of strings | none | no | Allow-list of tool names |
| `env` | map of strings | none | no | Environment variables |
| `shared` | boolean | none | no | Share the tool state across agents, for `think` and `todo` |
| `path` | string | none | no | Storage path of `memory` or `tasks` |
| `shell` | object | none | no | Script definitions of `script`: `cmd`, `description`, `args`, `required`, `env`, `working_dir` |
| `post_edit` | array of PostEditConfig: `path`, `cmd` (both required) | none | no | Commands after an edit of `filesystem` or `file` |
| `api_config` | ApiConfig: `name`, `endpoint`, `method` (required), `instruction`, `headers`, `args`, `required`, `output_schema` | none | no | The HTTP tool of `api` |
| `webhook_config` | WebhookConfig: `url` (required), `provider`, `headers`, `chat_id` | none | no | The destination of `webhook` |
| `rag_config` | RAGConfig: `strategies` (required), `tool`, `docs`, `respect_vcs` (default `true`), `indexing_timeout`, `results` | none | no | The sources and strategies of `rag` |
| `ignore_vcs` | boolean | `true` | no | Exclude `.git` and `.gitignore` patterns from filesystem operations |
| `allow_list` | array of strings | none | no | Directories the file tools can reach |
| `deny_list` | array of strings | none | no | Directories the file tools cannot reach. Wins over `allow_list` |
| `defer` | boolean or array | none | no | Load tools on demand through `search_tool` and `add_tool` |
| `timeout` | integer | `30` when omitted | no | HTTP timeout in seconds for `fetch`, `api`, `openapi` |
| `max_output_bytes` | integer | `30000` | no | Text cutoff of `openapi` output. `0` turns it off |
| `escape_html` | boolean | `false` | no | Legacy HTML escaping in multi-URL `fetch` results |
| `allowed_domains` | array of strings | none | no | Hosts `fetch` can reach |
| `blocked_domains` | array of strings | none | no | Hosts `fetch` cannot reach. Exclusive with `allowed_domains` |
| `allow_private_ips` | boolean | none | no | Permit non-public addresses for `fetch`, `api`, `openapi`, `a2a`, and remote `mcp` |
| `sudo_askpass` | boolean | none | no | Prompt for a sudo password through the host UI, for `shell` |
| `recall` | boolean | none | no | Expose a `recall` parameter on `run_background_job` |
| `url` | string | none | no | URL of `a2a`, `openapi`, or `open_url` |
| `headers` | map of strings | none | no | HTTP headers for `openapi`, `a2a`, and `fetch` |
| `name` | string | none | no | Tool name of `a2a` |
| `file_types` | array of strings | none | no | Extensions an `lsp` server handles |
| `allowed_servers` | array of strings | none | no | Catalog server ids `mcp_catalog` offers |
| `blocked_servers` | array of strings | none | no | Catalog server ids removed from the offer |
| `models` | array of strings | none | no | Models `model_picker` can choose |
| `version` | string | none | no | `owner/repo@version` for auto-install, or `false` to turn it off |
| `working_dir` | string | none | no | Working directory of an `mcp` or `lsp` subprocess |
| `lifecycle` | Lifecycle: `profile` (`resilient`, `strict`, `best-effort`), `required`, `startup_timeout`, `call_timeout`, `restart`, `max_restarts`, `backoff` | none | no | The supervisor rules of an `mcp` or `lsp` toolset |

A reusable entry under `mcps` has `command`, `args`, `ref`, `remote`, `config`, `version`, `env`, `tools`, `instruction`, `name`, `defer`, `working_dir`, and `lifecycle` {{schema MCPToolset}}. An OAuth block under `remote` has `clientId`, `clientSecret`, `callbackPort`, `scopes`, and `callbackRedirectURL` {{schema RemoteOAuthConfig}}.

## Keys under permissions

The three keys come from `PermissionsConfig` {{schema PermissionsConfig}}, and the docs page `configuration/permissions` gives the pattern grammar.

| Key | Type | Default | Required | Meaning |
|---|---|---|---|---|
| `allow` | array of strings | none | no | Patterns approved without confirmation, such as `read_*` or `shell:cmd=ls*` |
| `ask` | array of strings | none | no | Patterns that always ask, even for read-only tools |
| `deny` | array of strings | none | no | Patterns always rejected. Wins over `allow` |

## Keys under hooks

The events come from `HooksConfig` {{schema HooksConfig}}, and the docs page `configuration/hooks` explains each one. Every event holds an array. Matcher events hold `HookMatcherConfig` entries with `matcher`, `hooks` (required), and `preempt_yolo` {{schema HookMatcherConfig}}. The other events hold hook definitions directly.

| Event | Entries | When it runs |
|---|---|---|
| `prompt_file_guard` | definitions | Before a loaded prompt file is stored or used. Every hook must approve |
| `skill_content_guard` | definitions | Before raw skill text is expanded. Every hook must approve |
| `pre_tool_use` | matchers | Before a tool runs. Can allow, deny, or modify |
| `post_tool_use` | matchers | After a tool completes, with its response |
| `permission_request` | matchers | Before the user is asked to approve a call |
| `session_start` | definitions | When a session begins |
| `user_prompt_submit` | definitions | Once per user message, before the first model call |
| `user_steering_messages_submit` | definitions | When queued mid-turn messages are appended |
| `user_followup_submit` | definitions | When a follow-up message starts a fresh turn |
| `turn_start` | definitions | At the start of every model call, with transient context |
| `turn_end` | definitions | When a turn ends, for any reason |
| `before_llm_call` | definitions | Just before each model call |
| `after_llm_call` | definitions | After each successful model call |
| `session_end` | definitions | When a session ends |
| `pre_compact` | definitions | Before the transcript is compacted |
| `subagent_stop` | definitions | When a sub-agent finishes |
| `on_user_input` | definitions | When the agent needs user input |
| `stop` | definitions | When the model finishes responding |
| `notification` | definitions | When the agent sends an error or warning |
| `on_error` | definitions | When a turn hits an error |
| `on_max_iterations` | definitions | When `max_iterations` is reached |
| `on_agent_switch` | definitions | When the active agent changes |
| `on_session_resume` | definitions | When the user lets the run continue past `max_iterations` |
| `on_tool_approval_decision` | definitions | After the approval chain decides, before the call runs or the denial is recorded |
| `before_compaction` | definitions | Immediately before a compaction. Can veto it |
| `after_compaction` | definitions | After a successful compaction |
| `tool_response_transform` | matchers | Between a tool run and the record of its response. Can rewrite the output |
| `tool_input_transform` | matchers | Before every tool call, ahead of approval. Can patch the arguments |
| `tool_guard` | matchers | After the input transform and before approval. No safety mode bypasses it |
| `before_agent_run` | routing definitions | Once per agent activation. Can route to another agent |
| `after_agent_complete` | routing definitions | After an agent completes. Can route to another agent |
| `worktree_create` | definitions | Once, after `--worktree` creates a worktree |

A hook definition comes from `HookDefinition` {{schema HookDefinition}}.

| Key | Type | Default | Required | Meaning |
|---|---|---|---|---|
| `type` | `command`, `builtin`, `model`, `evaluator` | none | yes | What runs: a shell command, a named in-process function, a model, or an evaluator |
| `command` | string | none | no | The shell command or the builtin name |
| `args` | array of strings | none | no | Arguments for the handler |
| `name` | string | none | no | A name for logs and events |
| `timeout` | integer | `60` | no | Seconds before the hook is cut off |
| `env` | map of strings | none | no | Environment for this hook only |
| `working_dir` | string | none | no | Working directory of this hook |
| `on_error` | `warn`, `ignore`, `block` | `warn` | no | What an error, timeout, or bad output does. `pre_tool_use` and `tool_guard` always fail closed |
| `strict_output` | boolean | `false` | no | Require one JSON object and reject unknown fields |
| `model` | string | none | no | The `provider/model` of a `model` hook |
| `prompt` | string | none | no | The Go template a `model` hook renders |
| `schema` | string | none | no | `pre_tool_use_decision` turns the model reply into a verdict |
| `system_prompt` | string | none | no | A literal system message for a `model` hook |
| `evaluator` | string | none | no | The top-level evaluator of an `evaluator` hook |
| `evaluator_policy` | EvaluatorPolicy: `decisions`, `min_probability`, `fallback` (all required) | none | no | How an evaluator verdict maps to a guard decision |
| `routing_policy` | RoutingPolicy: `routes`, `min_probability` (both required) | none | no | How an evaluator choice maps to an agent |

The `type` description names 17 builtins {{schema HookDefinition}}. They are `add_context`, `add_date`, `add_environment_info`, `add_prompt_files`, `add_git_status`, `add_git_diff`, `add_directory_listing`, `add_user_info`, `add_recent_commits`, `max_iterations`, `redact_secrets`, `transform_json`, `limit_large_tool_results`, `safer_shell`, `http_post`, `snapshot`, and `unload`.

## Keys under runtime, budget, metadata, and evaluators

| Block | Key | Type | Default | Required | Meaning |
|---|---|---|---|---|---|
| `runtime` | `sandbox` | boolean | none | no | Run in a sandbox by default, as `--sandbox` does {{schema RuntimeDefaults}} |
| `runtime` | `network_allowlist` | array of strings | none | no | Hosts added to the sandbox allowlist, `host` or `host:port` |
| `runtime` | `safety` | one of four modes | none | no | Default safety mode of the file, below a per-agent `safety` |
| `budget` | `max_cost` | number | none | no | Maximum USD per run, counting only priced responses {{schema BudgetConfig}} |
| `budget` | `max_tokens` | integer | none | no | Maximum input plus output tokens over the run |
| `budget` | `max_time` | string | none | no | Maximum sum of turn durations, as a Go duration |
| `metadata` | `author`, `license`, `readme`, `description`, `version`, `tags` | strings, `tags` an array | none | no | Descriptive fields. `version` is used for OCI publishing {{schema Metadata}} |
| `evaluators` | `provider`, `model`, `type`, `instructions` | strings, `type` one of `boolean`, `choice`, `score` | none | yes | A named assessment on the `typesafe` or `openai` Decisions backend {{schema EvaluatorConfig}} |
| `evaluators` | `base_url`, `endpoint`, `token_key`, `bypass_models_gateway`, `choices`, `levels`, `timeout`, `cost` | mixed | `timeout` 10s in the description | no | Endpoint, credential, and output shape of the evaluator |

The docs pages `configuration/budget` and `configuration/flavors` explain `budget` and `flavors` with examples.

Sources: research/sources/agent-schema.json at tag v1.149.0 (root `properties`, and the definitions `AgentConfig`, `ModelConfig`, `ProviderConfig`, `AuthConfig`, `FederationAuthConfig`, `IdentityTokenSourceConfig`, `Toolset`, `MCPToolset`, `Remote`, `RemoteOAuthConfig`, `PostEditConfig`, `ApiConfig`, `WebhookConfig`, `RAGConfig`, `Lifecycle`, `PermissionsConfig`, `HooksConfig`, `HookMatcherConfig`, `HookDefinition`, `RuntimeDefaults`, `BudgetConfig`, `Metadata`, `EvaluatorConfig`, `EvaluatorPolicy`, `AgentRouting`, `RoutingPolicy`, `RoutingRule`, `FallbackConfig`, `CacheConfig`, `CapabilitiesConfig`, `OutputCapabilitiesConfig`, `CostConfig`, `HarnessConfig`, `InlineSkill`, `CommandConfig`); research/sources/docs-docker-agent.md (pages configuration/overview, configuration/agents, configuration/models, providers/custom, configuration/tools, configuration/permissions, configuration/hooks, configuration/budget, configuration/flavors, configuration/routing); research/sources/README.md (the pin of the schema copy)
