# Toolsets

> The 27 toolset types of docker-agent 1.149.0, each with the tools it exposes, its options, and what it needs outside the agent file.

`docker-agent toolsets` printed 27 types on 2026-10-08 (research/sources/probes/docker-agent-toolsets.txt), and the `type` enum of the schema holds the same 27 names {{schema Toolset}}. The Tools column comes from the docs page of each type under `tools/`, and `not documented` marks a type with no page. Options are the keys of [R.4](#s-ref-agent-file-keys) that the type reads, with the defaults the docs state. Needs says what the toolset reaches beyond the agent file: nothing, the host shell, the network, a credential, a binary, or Docker. The shared keys `instruction`, `tools`, `readonly`, `model`, `defer`, and `toon` apply to every type and are not repeated {{docs-agent Tool Configuration}}.

## The 27 types

| Type | Tools | Options | Needs |
|---|---|---|---|
| `a2a` | one tool per remote agent, named by `name` or from the agent card {{docs-agent A2A Tool}} | `url` (required), `name`, `headers`, `allow_private_ips` | the network and the remote A2A server. A token in `headers` when the server was started with `--auth-token` |
| `api` | one tool per `api_config`, named by `api_config.name` {{docs-agent API Tool}} | `api_config` with `name`, `endpoint`, `method` (`GET` or `POST` in the docs, five verbs in the schema), `instruction`, `args`, `required`, `headers`, `output_schema`. `timeout` (`30`), `allow_private_ips` | the network. Tokens in `headers` through `${env.VAR}` |
| `background_agents` | `run_background_agent`, `list_background_agents`, `view_background_agent`, `stop_background_agent` {{docs-agent Background Agents Tool}} | none | agents listed under `sub_agents` |
| `background_jobs` | `run_background_job`, `list_background_jobs`, `view_background_job`, `stop_background_job`, `wait_background_job` (`timeout` default `60`) {{docs-agent Background Jobs Tool}} | `env`, `recall` (`false`) | the host shell |
| `environment` | not documented. The probe summary says it reports the OS and the resolved shell, read-only, with no arguments | none documented | nothing |
| `fetch` | `fetch` with `urls`, `format` (`text`, `markdown`, `html`), `timeout` (`1` to `300`) {{docs-agent Fetch Tool}} | `timeout` (`30`), `allowed_domains`, `blocked_domains`, `allow_private_ips` (`false`), `headers`, `escape_html` (`false`) | the network. `GET` only. Non-public addresses are refused by default |
| `file` | not documented. The probe summary says it reads, writes, and edits individual files | `post_edit`, `allow_list`, `deny_list`, which the schema names for `filesystem` and `file` | nothing |
| `filesystem` | `read_file`, `read_multiple_files`, `write_file`, `edit_file`, `list_directory`, `directory_tree`, `create_directory`, `remove_directory`, `search_files_content` {{docs-agent Filesystem Tool}} | `ignore_vcs` (`true`), `post_edit` (`path`, `cmd`), `allow_list`, `deny_list` | nothing |
| `git` | `git_status`, `git_log` (`limit` default `20`, `path`), `git_branches`, `git_show` (`ref`), `git_blame` (`path` required, `rev`) {{docs-agent Git Tool}} | none | nothing. It uses go-git and needs no `git` binary |
| `lsp` | `lsp_workspace`, `lsp_hover`, `lsp_definition`, `lsp_references`, `lsp_document_symbols`, `lsp_workspace_symbols`, `lsp_diagnostics`, `lsp_code_actions`, `lsp_rename`, `lsp_format`, `lsp_call_hierarchy`, `lsp_type_hierarchy`, `lsp_implementations`, `lsp_signature_help`, `lsp_inlay_hints` {{docs-agent LSP Tool}} | `command` (required), `args`, `env`, `file_types`, `working_dir`, `version`, `lifecycle` | a language server binary, installed from the aqua registry when absent |
| `mcp` | the tools the server lists, filtered by `tools` {{docs-agent MCP Tool}} | `ref` (`docker:<name>` or an `mcps` name), or `command`, `args`, `env`, `version`, `working_dir`, or `remote` with `url`, `transport_type` (`streamable` or `sse`), `headers`, `oauth`. `config`, `lifecycle`, `allow_private_ips` | `ref: docker:` needs the MCP Gateway and Docker. `command` needs the binary. `remote` needs the network and an OAuth login when the server asks for one |
| `mcp_catalog` | `search_remote_mcp_servers`, `enable_remote_mcp_server`, `list_remote_mcp_servers`, `disable_remote_mcp_server`, `reset_remote_mcp_server_auth` {{docs-agent MCP Catalog Tool}} | `allowed_servers`, `blocked_servers` | the network. OAuth for servers that require it. No gateway, because the catalog subset is streamable HTTP only |
| `memory` | `add_memory`, `get_memories`, `delete_memory`, `search_memories`, `update_memory` {{docs-agent Memory Tool}} | `path` (`~/.cagent/memory/<config-name>/memory.db`) | a SQLite file on disk |
| `model_picker` | `change_model` (`model` required), `revert_model` {{docs-agent Model Picker Tool}} | `models` (required) | credentials for the listed models |
| `open_url` | one tool, `open_url` by default {{docs-agent Open URL Tool}} | `url` (required), `name` | a browser on the host, through `open`, `xdg-open`, or `rundll32` |
| `openapi` | one tool per operation of the document {{docs-agent OpenAPI Tool}} | `url` (required), `headers`, `timeout` (`30`), `max_output_bytes` (`30000`), `allow_private_ips` | the network, for the document and every call |
| `plan` | `write_plan`, `read_plan`, `list_plans`, `delete_plan`, `update_plan_from_file`, `export_plan_to_file`, `set_plan_status`, `get_plan_status` {{docs-agent Plan Tool}} | none | the store under `~/.cagent/plans/`, shared by every agent with the type |
| `rag` | one search tool named in `rag_config.tool` {{docs-agent RAG Tool}} | `rag_config` with `docs`, `strategies` (`chunked-embeddings`, `semantic-embeddings`, `bm25`), `results`, `respect_vcs` (`true`), `indexing_timeout` | an embedding model, so a provider credential or Docker Model Runner, and a SQLite database per strategy |
| `scheduler` | `create_schedule` (`prompt`, `when` required, `name`), `list_schedules`, `cancel_schedule` (`id` required) {{docs-agent Scheduler Tool}} | none | a running session that supports recall. Schedules are not persisted |
| `script` | one tool per entry under `shell`, named by the key {{docs-agent Script Tool}} | `shell.<name>.cmd`, `description`, `args`, `required`, `env`, `working_dir` | the host shell |
| `session_context` | `list_sessions`, `read_session` {{docs-agent Session Context Tool}} | none | the session database |
| `shell` | `shell` with `cmd` (required), `cwd` (`.`), `timeout` (`30`) {{docs-agent Shell Tool}} | `env`, `sudo_askpass` (`false`), `safer` (deprecated and ignored) | the host shell. Every command is classified `safe`, `destructive`, or `unknown` before approval |
| `tasks` | `create_task`, `get_task`, `update_task`, `delete_task`, `list_tasks`, `next_task`, `add_dependency`, `remove_dependency` {{docs-agent Tasks Tool}} | `path` (`tasks.json`) | a JSON file on disk |
| `think` | one reasoning tool. The page names no tool {{docs-agent Think Tool}} | `shared` in the schema | nothing. No side effects |
| `todo` | `create_todo`, `create_todos`, `update_todos`, `list_todos` {{docs-agent Todo Tool}} | `shared` (`false`) | nothing |
| `user_prompt` | `user_prompt` with `message` (required), `title`, `schema` {{docs-agent User Prompt Tool}} | none | an elicitation handler, which the TUI and CLI provide and some MCP clients do not |
| `webhook` | `send_webhook` with `message` {{docs-agent Webhook Tool}} | `webhook_config` with `url` (required), `provider` (`generic` by default, or `slack`, `discord`, `ifttt`, `telegram`, `mattermost`, `rocketchat`, `googlechat`, `teams`), `headers`, `chat_id` | the network. The URL is itself the credential on Slack and Mattermost |

## Names that are not types

Two tools arrive without a `toolsets` entry. `sub_agents` injects `transfer_task`, and `handoffs` injects the tool of the same name ([conflict C56](#s-ref-sources-and-the-conflicts-register)). The docs built-in table lists both as types, and the schema enum and the probe exclude both.

| Name | Tool | Injected by | Needs |
|---|---|---|---|
| `transfer_task` | `transfer_task` with `agent`, `task`, `expected_output` (all required), always auto-approved {{docs-agent Transfer Task Tool}} | `sub_agents` on the caller | the named sub-agent |
| the tool of `handoffs` | one tool with `agent` (required) that moves the conversation to a local agent and opens no network connection {{docs-agent Handoff Tool}} | `handoffs` on the caller | the named agent in the same file |
| `session_plan` | `write_session_plan`, `read_session_plan`, `exit_plan_mode` {{docs-agent Session Plan Tool}} | the docs list it as a built-in type. The v1.149.0 enum and the probe do not name it, so the pinned binary does not accept it as a `type` | a per-session file under `~/.cagent/session_plans/` |

The docs name `session_plan` as a type, and the schema names 27 types without it. The schema ranks above the docs in this manual, so the manual treats `session_plan` as not available at the pin.

Sources: research/sources/probes/docker-agent-toolsets.txt; research/sources/agent-schema.json (`Toolset`, `MCPToolset`, `Remote`, `ApiConfig`, `WebhookConfig`, `RAGConfig`, `ScriptShellToolConfig`, `PostEditConfig`, `Lifecycle`); research/sources/docs-docker-agent.md (page configuration/tools and the 28 pages under tools/: a2a, api, background-agents, background-jobs, fetch, filesystem, git, handoff, lsp, mcp-catalog, mcp, memory, model-picker, open-url, openapi, plan, rag, scheduler, script, session_context, session_plan, shell, tasks, think, todo, transfer-task, user-prompt, webhook); research/conflicts-register.md row C56
