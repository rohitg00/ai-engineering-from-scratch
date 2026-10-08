# Changelog

All notable changes to this project will be documented in this file.


## [v1.148.0] - 2026-10-05

This release fixes two issues: oversized tool output handling and duplicate line rendering in the lean TUI.

## Bug Fixes
- Fixes oversized tool results from blocking chat or compaction requests by bounding complete tool results to 50 KiB and sanitizing historical tool results on outgoing requests
- Fixes duplicate lines appearing while streaming wrapped text in the lean TUI by avoiding replay of archived lines when markdown changes only affect ANSI formatting
### Pull Requests

- [#4503](https://github.com/docker/docker-agent/pull/4503) - fix(leantui): avoid duplicate lines while streaming wrapped text
- [#4515](https://github.com/docker/docker-agent/pull/4515) - fix: bound tool results and recover oversized session history
- [#4517](https://github.com/docker/docker-agent/pull/4517) - docs: update CHANGELOG.md for v1.147.0


## [v1.147.0] - 2026-10-05

This release adds hook-driven agent routing, a lean TUI settings panel, codemode tool call visibility, and several new CLI and eval capabilities, alongside a broad set of bug fixes for assistant message handling, DMR routing, and TUI rendering.

## What's New

- Adds a `/settings` command to the lean TUI with an inline settings panel supporting keyboard navigation, save/cancel, and persistence of preferences
- Adds hook-driven agent routing with a `routing` block (`allowed_agents`, `default_agent`) and new `before_agent_run`/`after_agent_complete` hook events
- Adds native JSON field selection (`transform_json`) as a builtin hook for trimming tool response payloads
- Adds a `debug tool` command (`docker agent debug tool <config> <tool> [JSON params]`) to call tools directly outside of any LLM loop
- Adds `--last` flag to `docker agent run --exec` to print only the final answer, buffering intermediate output
- Adds `max_output_bytes` field to the `openapi` toolset to cap response text size (omitting it keeps the 30,000-byte default; `0` disables the cutoff)
- Adds `SessionRecovered` event for idle recovery boundaries in the runtime
- Exposes codemode tool calls and highlights scripts in TUIs, emitting standard tool-call, streamed-output, and response events for tools invoked inside Code Mode
- Returns promises from codemode tool calls, supporting concurrent execution, `Promise.all`, `Promise.allSettled`, and top-level await
- Supports `DOCKER_AGENT_DATA_DIR` environment variable for setting the data directory
- Adds repeat stability and cost outlier reporting to eval runs with `--repeat > 1`
- Adds `--flavor` support and structured tool output capture to `docker agent eval`

## Improvements

- Lean TUI unmatched slash queries now fall back to model selection instead of dismissing the menu, supporting multi-term queries like `/openai astra`
- Prompt history now follows `--data-dir` (including `~` expansion) and forwards the setting to the sandbox
- Eval judge model default updated to `openai/gpt-5.6-terra`

## Bug Fixes

- Fixes DMR commands routing through the selected Docker connection (context/host/config/TLS) instead of falling back to a hardcoded local socket
- Fixes DMR transport errors to include the name of the selected Docker connection (`--host`, `--context`, etc.)
- Fixes assistant messages being dropped across TUIs, remote sessions, and recovery
- Fixes tool-call XML leaking into canonical and reloaded assistant text
- Fixes generated media losing stable identity on redraw in the TUI
- Fixes remote session history loss across idle recovery, OAuth elicitation, and snapshots taken mid-turn
- Fixes lean TUI tool updates duplicating content in terminal scrollback
- Fixes lean TUI replaying the full offscreen suffix on every redraw
- Fixes tool argument declaration order not being preserved in generated schemas
- Fixes reasoning and response output running together in exec text mode — a blank line is now inserted between them
- Fixes eval containers picking up a stale local agent image digest instead of the most recently built one
- Fixes `--data-dir` not expanding `~` and not forwarding the path to the sandbox
- Clarifies `/speak` transcription requirements: requires `OPENAI_API_KEY` and does not work with the Docker models gateway

## Technical Changes

- Removes flaky `TestTmuxVisibilityLifecycle` tmux integration test
### Pull Requests

- [#4481](https://github.com/docker/docker-agent/pull/4481) - fix: route DMR through the selected Docker connection safely
- [#4482](https://github.com/docker/docker-agent/pull/4482) - chore: refresh models.dev snapshot (+38 -14 ~95)
- [#4483](https://github.com/docker/docker-agent/pull/4483) - chore: refresh models.dev snapshot (+30 -14 ~39)
- [#4484](https://github.com/docker/docker-agent/pull/4484) - feat: add settings command to lean TUI
- [#4487](https://github.com/docker/docker-agent/pull/4487) - feat: return promises from codemode tool calls
- [#4488](https://github.com/docker/docker-agent/pull/4488) - test(tui): remove flaky tmux visibility lifecycle test
- [#4489](https://github.com/docker/docker-agent/pull/4489) - docs: auto-update for merged PRs (2026-10-01)
- [#4490](https://github.com/docker/docker-agent/pull/4490) - feat(openapi): add max_output_bytes to cap response text size
- [#4491](https://github.com/docker/docker-agent/pull/4491) - fix: name selected Docker connection in DMR transport errors
- [#4492](https://github.com/docker/docker-agent/pull/4492) - feat: add debug tool command to call tools directly
- [#4493](https://github.com/docker/docker-agent/pull/4493) - fix: stop dropping assistant turns across TUIs, remote sessions and recovery
- [#4494](https://github.com/docker/docker-agent/pull/4494) - feat: expose codemode tool calls and highlight scripts in TUIs
- [#4495](https://github.com/docker/docker-agent/pull/4495) - feat: add hook-driven agent routing
- [#4496](https://github.com/docker/docker-agent/pull/4496) - feat: honor --data-dir for prompt history and sandbox forwarding
- [#4498](https://github.com/docker/docker-agent/pull/4498) - fix: clarify speech input requirements
- [#4499](https://github.com/docker/docker-agent/pull/4499) - feat(eval): forward --flavor overrides and record structured tool output
- [#4500](https://github.com/docker/docker-agent/pull/4500) - feat(eval): report repeat stability and cost outliers
- [#4501](https://github.com/docker/docker-agent/pull/4501) - fix: prevent lean TUI tool updates from duplicating scrollback
- [#4502](https://github.com/docker/docker-agent/pull/4502) - docs: auto-update for merged PRs (2026-10-03)
- [#4504](https://github.com/docker/docker-agent/pull/4504) - feat: add --last flag for exec to print only the final answer
- [#4505](https://github.com/docker/docker-agent/pull/4505) - feat(hooks): add transform_json builtin for field selection
- [#4506](https://github.com/docker/docker-agent/pull/4506) - fix(eval): pin local agent image digest when building containers
- [#4507](https://github.com/docker/docker-agent/pull/4507) - fix(leantui): switch unmatched slash queries to model selection
- [#4508](https://github.com/docker/docker-agent/pull/4508) - fix: preserve tool argument declaration order
- [#4509](https://github.com/docker/docker-agent/pull/4509) - docs: auto-update for merged PRs (2026-10-05)
- [#4511](https://github.com/docker/docker-agent/pull/4511) - chore: refresh models.dev snapshot (+132 -38 ~155)
- [#4513](https://github.com/docker/docker-agent/pull/4513) - fix(cli): separate reasoning from response in exec text mode
- [#4514](https://github.com/docker/docker-agent/pull/4514) - eval: default judge model to openai/gpt-5.6-terra


## [v1.145.0] - 2026-09-28

This release adds ACP request trace propagation, new lint cops for code quality, and a fix for lean TUI scrollback preservation during partial tool calls.

## What's New
- Adds ACP request trace propagation using W3C `traceparent`/`tracestate` headers, with server spans for each of the 13 implemented agent protocol handlers
- Adds `Lint/FieldsSeqLookup` cop to detect `strings.Fields` lookup patterns that could use `strings.FieldsSeq` instead
- Adds `Lint/SlicesConcat` cop to flag nested `append` chains that could be replaced with `slices.Concat`

## Bug Fixes
- Fixes lean TUI scrollback being lost during partial tool calls by repainting only visible rows when a streaming tool call changes above the viewport

## Technical Changes
- Replaces multi-source `append` chains with `slices.Concat` across the codebase
- Warms Linux and Windows Go build caches on main when tests are skipped
### Pull Requests

- [#4456](https://github.com/docker/docker-agent/pull/4456) - feat(lint): detect strings.FieldsSeq lookup opportunities
- [#4461](https://github.com/docker/docker-agent/pull/4461) - refactor: replace append chains with slices.Concat
- [#4471](https://github.com/docker/docker-agent/pull/4471) - feat(acp): propagate request traces and test capability matrix
- [#4472](https://github.com/docker/docker-agent/pull/4472) - docs: update CHANGELOG.md for v1.144.0
- [#4473](https://github.com/docker/docker-agent/pull/4473) - ci: warm Linux/Windows build caches when tests are skipped on main
- [#4474](https://github.com/docker/docker-agent/pull/4474) - test(tui): fix startup resize race in hidden-frame tests
- [#4477](https://github.com/docker/docker-agent/pull/4477) - fix: preserve lean TUI scrollback during partial tool calls
- [#4478](https://github.com/docker/docker-agent/pull/4478) - chore(deps): bump the actions group across 2 directories with 6 updates


## [v1.144.0] - 2026-09-25

This release expands ACP v1 compatibility with session management, audio prompts, client terminals, remote MCP servers, and host credential authentication, while also closing several sandbox and filesystem confinement gaps and improving TUI rendering performance.

## What's New

- Adds ACP session deletion after draining owned work, with `sessionCapabilities.delete` support
- Adds ACP elicitation bridge supporting negotiated form and URL elicitation capabilities
- Adds ACP session model reasoning and safety options, including `session/set_config_option` and legacy `session/set_mode`
- Adds ACP shell tool execution through client terminals via `terminal/create` and related wire methods
- Adds ACP support for client-supplied Streamable HTTP and legacy SSE MCP servers in `session/new`, `session/resume`, and `session/load`
- Adds ACP host credential authentication and connection-local logout
- Adds ACP audio prompt support and bounded history replay
- Adds ACP message identity persistence and tool name exposure
- Adds sandbox cloud mode (`--cloud`) and v3 kit support for running sandboxes without a local Docker dependency
- Adds evaluator support for exact endpoints on compatible services via an optional `endpoint` field in `EvaluatorConfig`
- Adds `Lint/CutPrefix` cop to detect `HasPrefix`+`TrimPrefix` patterns that should use `strings.CutPrefix`
- Adds `Lint/CutSuffix` cop to detect `HasSuffix`+`TrimSuffix` patterns that should use `strings.CutSuffix`
- Adds `Lint/SlicesClone` cop to detect manual slice-copy idioms that should use `slices.Clone`
- Adds `Lint/SortStableFunc` cop to detect `sort.SliceStable` calls that should use `slices.SortStableFunc`
- Adds additional lint cops: `Lint/SplitTrimJoin`, `Lint/NewExpr`, `Lint/FieldsSeq`, and detectors for AWS scalar pointer helpers, paired reflection field loops, stdlib UUID string opportunities, equivalent manual URL clones, buffered JSON newline workarounds, and simple benchmark loop modernization

## Improvements

- Streams bang command progress in TUIs, running commands asynchronously and emitting lifecycle/output events in both lean and full TUIs
- Replaces tmux focus-events heuristic with an async poll that checks real pane visibility, so only hidden panes pause rendering
- Keeps tmux chooser previews rendering continuously
- Reuses chat pane formatting while scrolling the sidebar, avoiding redundant re-formatting on unchanged message content
- Migrates `sort.SliceStable` usages to `slices.SortStableFunc` in model picker, lean TUI, and deferred search ranking
- Migrates manual slice-copy idioms to `slices.Clone` across the codebase
- Migrates `HasPrefix`+`TrimPrefix` and `HasSuffix`+`TrimSuffix` patterns to `strings.CutPrefix`/`strings.CutSuffix` across multiple packages

## Bug Fixes

- Fixes `none` reasoning effort being ignored on GPT-6 Sol/Luna models, which caused silent fallback to `"low"` effort
- Fixes skill supporting-file reads to be confined to the skill directory using `os.OpenRoot`, preventing symlink escapes
- Fixes filesystem path policies to reject dangling symlinks
- Fixes prompt file staging to be confined to the kit directory
- Fixes sandbox skill staging reads to be anchored to the source root
- Fixes tool extraction to use `os.Root` confinement, closing a symlink-swap gap during archive extraction
- Fixes forked skill output and session IDs from bleeding across message groups by keying batching on session ID in addition to agent name
- Fixes active segment offset going stale when an earlier message resizes while scrolled up, preventing clipped transcript rendering

## Technical Changes

- Refactors TUI command contracts, tool confirmation dialogs, and tool renderer registry to be dependency-light and reusable
- Enables `errorsastype` and `reflecttypeassert` lint modernization checks
- Switches to shared cops from `rubocop-go v1.0.0`, removing duplicate local implementations
### Pull Requests

- [#4423](https://github.com/docker/docker-agent/pull/4423) - fix: stream bang command progress in TUIs
- [#4424](https://github.com/docker/docker-agent/pull/4424) - feat(lint): flag split-trim-join, new-expr, and fields-seq waste
- [#4429](https://github.com/docker/docker-agent/pull/4429) - fix(tui): pause rendering only for hidden tmux panes
- [#4430](https://github.com/docker/docker-agent/pull/4430) - docs: update CHANGELOG.md for v1.143.0
- [#4431](https://github.com/docker/docker-agent/pull/4431) - feat(acp): delete sessions after draining owned work
- [#4432](https://github.com/docker/docker-agent/pull/4432) - feat(evaluators): support exact endpoints for compatible services
- [#4433](https://github.com/docker/docker-agent/pull/4433) - feat(lint): enforce recent Go modernization patterns
- [#4434](https://github.com/docker/docker-agent/pull/4434) - feat(acp): bridge negotiated form and URL elicitation
- [#4435](https://github.com/docker/docker-agent/pull/4435) - fix: support none reasoning effort on GPT-6 Sol/Luna
- [#4436](https://github.com/docker/docker-agent/pull/4436) - test: make timer coverage deterministic with synctest
- [#4437](https://github.com/docker/docker-agent/pull/4437) - test(httpclient): use in-memory HTTP for SSE filter tests
- [#4438](https://github.com/docker/docker-agent/pull/4438) - fix(skills): confine supporting-file reads to the skill directory
- [#4439](https://github.com/docker/docker-agent/pull/4439) - test(tui): wait for shell completion in bang command tests
- [#4440](https://github.com/docker/docker-agent/pull/4440) - fix: close filesystem and sandbox kit confinement gaps
- [#4441](https://github.com/docker/docker-agent/pull/4441) - chore(lint): use shared cops from rubocop-go v1.0.0
- [#4442](https://github.com/docker/docker-agent/pull/4442) - chore(deps): bump charm.land/bubbletea/v2 v2.0.9→v2.0.10
- [#4443](https://github.com/docker/docker-agent/pull/4443) - chore(deps): bump github.com/docker/cli to v29.8.1
- [#4444](https://github.com/docker/docker-agent/pull/4444) - test: speed up slow test suites with deterministic waits
- [#4445](https://github.com/docker/docker-agent/pull/4445) - feat(acp): expose session model reasoning and safety options
- [#4446](https://github.com/docker/docker-agent/pull/4446) - fix: confine tool extraction with os.Root
- [#4447](https://github.com/docker/docker-agent/pull/4447) - test: make board heartbeat checks deterministic
- [#4448](https://github.com/docker/docker-agent/pull/4448) - feat(acp): execute shell tools through client terminals
- [#4449](https://github.com/docker/docker-agent/pull/4449) - docs: auto-update for merged PRs (2026-09-25)
- [#4450](https://github.com/docker/docker-agent/pull/4450) - feat(acp): support client-supplied HTTP and SSE MCP servers
- [#4451](https://github.com/docker/docker-agent/pull/4451) - fix: stop forked skill output from bleeding across message groups
- [#4452](https://github.com/docker/docker-agent/pull/4452) - feat(acp): add host credential authentication and connection logout
- [#4454](https://github.com/docker/docker-agent/pull/4454) - fix: keep active segment offset in sync when earlier item resizes
- [#4455](https://github.com/docker/docker-agent/pull/4455) - feat(lint): detect strings.CutPrefix opportunities
- [#4457](https://github.com/docker/docker-agent/pull/4457) - test: fix encrypt mode timestamp flake
- [#4458](https://github.com/docker/docker-agent/pull/4458) - feat(lint): add CutSuffix cop and fix its findings
- [#4459](https://github.com/docker/docker-agent/pull/4459) - test: synchronize askpass helper cancellation test
- [#4460](https://github.com/docker/docker-agent/pull/4460) - lint: add SortStableFunc cop for sort.SliceStable migrations
- [#4462](https://github.com/docker/docker-agent/pull/4462) - lint: add SlicesClone cop and migrate manual slice-copy idioms
- [#4464](https://github.com/docker/docker-agent/pull/4464) - feat(acp): support audio prompts and bounded history replay
- [#4465](https://github.com/docker/docker-agent/pull/4465) - feat(sandbox): add cloud mode and v3 kit support
- [#4466](https://github.com/docker/docker-agent/pull/4466) - chore(deps): bump AWS SDK v2 direct dependencies
- [#4468](https://github.com/docker/docker-agent/pull/4468) - feat(acp): persist message identities and expose tool names
- [#4469](https://github.com/docker/docker-agent/pull/4469) - perf(tui): reuse chat pane formatting while scrolling sidebar
- [#4470](https://github.com/docker/docker-agent/pull/4470) - refactor(tui): make reusable components dependency-light


## [v1.143.0] - 2026-09-24

This release delivers a large set of ACP (Agent Control Protocol) compatibility improvements, new evaluator and provider features, and significant TUI stability fixes, alongside broad test modernization using Go's synctest framework.

## What's New

- Adds `session/load` ACP endpoint that reconnects to a session and replays persisted history before returning the load response
- Adds support for client-supplied stdio MCP servers in ACP `session/new` and `session/resume`, with eager initialization and per-session ownership
- Adds provider-backed evaluators with TypeSafe Jev support, wiring named evaluators into the hook system
- Tracks evaluator token usage and cost across sessions, budgets, and the cost dialog
- Adds `provider_opts.extra_body` passthrough for Chat Completions, enabling vendor-specific fields (e.g., `reasoning_effort`, `enable_thinking`) to be forwarded to backends
- Implements ACP slash commands `/compact`, `/usage`, and `/new` with real dispatch under session turn admission and cancellation handling
- Adds `skill_content_guard` and `prompt_file_guard` hook events for operator-controlled interception of skill content and prompt file loading
- Adds custom lint rules detecting split-trim-join suffix loops, temporary pointer returns with `new` expressions, and fields slices used only for iteration

## Improvements

- Keeps the TUI composing frames and running animation ticks when the terminal is unfocused or in an inactive tmux pane; removes the tmux startup focus probe and deferred-render behavior
- Trims textarea padding using `strings.CutLast` in the TUI for faster word wrapping
- Iterates wrapped and dialog words in the TUI without allocating a fields slice

## Bug Fixes

- Fixes ACP "Allow and remember my choice" scoping so approval is remembered only for the selected tool, not the entire session
- Fixes ACP iteration-limit permission handler to require an exact `continue` selection, rejecting unknown, empty, or wrong-case option IDs
- Fixes stale scrollbar state causing the conversation view to jump to incorrect positions on mouse release
- Fixes ACP to load a fresh team and provider registry per session, so workspace-rooted toolsets resolve paths against the correct session workspace
- Fixes ACP to enforce filesystem policies and post-edit hooks before read/write/edit RPCs, and to reject dangling symlinks
- Fixes ACP resume to validate workspace identity with `os.SameFile` and replace additional roots correctly without rewriting persisted workspace provenance
- Fixes ACP session close to drain foreground turns, runtime cleanup, and toolset shutdown before acknowledging close, preventing races with resume
- Fixes ACP to decline unsupported elicitation requests immediately rather than waiting indefinitely
- Fixes ACP to report accurate prompt outcomes (`end_turn`, `max_tokens`, `refusal`, `max_turn_requests`, `error`) instead of always returning `end_turn`
- Fixes ACP to filter and paginate `session/list` results (max 50 per page, ordered by creation time), honoring optional `cwd` filters and keyset cursors
- Fixes ACP to capture accurate edit diffs from full client-read content and to resolve tool locations to absolute paths
- Fixes ACP tool-call lifecycle reporting to track each tool with a stable ACP ID through `pending`, `in_progress`, and completion states
- Fixes ACP to honor client filesystem capabilities during tool discovery and to read client-provided content in `read_multiple_files`
- Fixes ACP to preserve prompt attachments (embedded text, blobs, images, file links) and decode file URIs only once
- Fixes ACP multi-agent cost tracking to accumulate costs by runtime session ID rather than replacing root-session display with child costs
- Fixes ACP to emit empty plan snapshots so clients clear stale plans when the todo list is emptied
- Fixes `GOOGLE_GENAI_USE_VERTEXAI` to be parsed as a boolean, so setting it to `false` or `0` correctly disables Vertex AI routing
- Fixes TUI goroutine leaks when sessions close (throttler and fan-out goroutines now stop with the app context)
- Fixes TUI to reconcile transcript geometry before scroll-state clamping, preventing the conversation view from jumping during background updates
- Fixes ACP to preserve parallel tool batches when replaying evaluator events
- Fixes ACP to validate and fully account evaluator request usage
- Fixes runtime to preserve tool callback scope during manual compaction
- Fixes `SkillContent` type placement to break a tools→skills→httpclient→desktop import cycle

## Technical Changes

- Refreshes the models.dev catalog snapshot embedded in the binary (multiple updates)
- Marks models.dev snapshot files as linguist-generated in `.gitattributes` to collapse diffs on GitHub
- Migrates UUID generation and parsing to Go 1.27 stdlib `uuid` package, removing the `github.com/google/uuid` dependency from the common path
- Adopts `errors.AsType` generic helper across 34 call sites, replacing the `var target *Type; errors.As` pattern
- Adopts `sync.WaitGroup.Go` in the scheduler and test workers
- Adopts `reflect.Value.Fields` for hook field iteration and `reflect.TypeAssert` in TUI test helpers
- Replaces Bedrock AWS pointer helpers (`aws.String`, `aws.Int32`, `aws.Float32`) with Go 1.26 `new(expr)`
- Replaces manual URL struct copy in `EgressProxyFromContext` with `url.URL.Clone`
- Simplifies JSON tool result encoding using `encoding/json/v2`
- Converts a large number of concurrency-heavy tests across the codebase to use Go's `synctest` framework for deterministic timing
- Stores TUI frame dumps in test artifact directories via `testing.TB.ArtifactDir()`
- Reverts OpenAI SDK bump pending license approval
### Pull Requests

- [#4368](https://github.com/docker/docker-agent/pull/4368) - chore(deps): bump the actions group across 1 directory with 2 updates
- [#4369](https://github.com/docker/docker-agent/pull/4369) - chore: refresh models.dev snapshot (+262 -186 ~399)
- [#4370](https://github.com/docker/docker-agent/pull/4370) - docs: update CHANGELOG.md for v1.142.0
- [#4371](https://github.com/docker/docker-agent/pull/4371) - chore: mark models.dev snapshot files as generated in .gitattributes
- [#4373](https://github.com/docker/docker-agent/pull/4373) - feat: add skill_content_guard and prompt_file_guard hook events
- [#4374](https://github.com/docker/docker-agent/pull/4374) - chore(deps): bump Go dependencies (anthropic, openai, goja, libopenapi, doublestar, smithy-go, x/tools)
- [#4375](https://github.com/docker/docker-agent/pull/4375) - feat: add provider-backed evaluators with TypeSafe Jev
- [#4376](https://github.com/docker/docker-agent/pull/4376) - fix(acp): scope remembered approval to the selected tool
- [#4377](https://github.com/docker/docker-agent/pull/4377) - fix(acp): reject unknown iteration-limit permission choices
- [#4378](https://github.com/docker/docker-agent/pull/4378) - fix(tui): prevent stale scrollbar state from jumping the conversation
- [#4379](https://github.com/docker/docker-agent/pull/4379) - fix(acp): load workspace-rooted teams per session
- [#4380](https://github.com/docker/docker-agent/pull/4380) - fix(acp): enforce filesystem policies and post-edit hooks
- [#4381](https://github.com/docker/docker-agent/pull/4381) - fix(acp): validate resume workspaces and replace additional roots
- [#4382](https://github.com/docker/docker-agent/pull/4382) - chore(deps): bump portcullis v1.0.0→v1.1.0 and libopenapi v0.39.0→v0.39.1
- [#4383](https://github.com/docker/docker-agent/pull/4383) - fix(acp): synchronize session close and shutdown
- [#4385](https://github.com/docker/docker-agent/pull/4385) - fix(acp): decline unsupported elicitation requests
- [#4386](https://github.com/docker/docker-agent/pull/4386) - feat(acp): support client-supplied stdio MCP servers
- [#4387](https://github.com/docker/docker-agent/pull/4387) - feat: track evaluator usage and cost across sessions and budgets
- [#4388](https://github.com/docker/docker-agent/pull/4388) - fix(acp): report accurate prompt outcomes and structured errors
- [#4389](https://github.com/docker/docker-agent/pull/4389) - chore: refresh models.dev snapshot (+247 -54 ~151)
- [#4390](https://github.com/docker/docker-agent/pull/4390) - fix(acp): filter and paginate session listings
- [#4391](https://github.com/docker/docker-agent/pull/4391) - feat(acp): implement supported slash commands
- [#4392](https://github.com/docker/docker-agent/pull/4392) - chore: refresh models.dev snapshot (+58 -0 ~74)
- [#4393](https://github.com/docker/docker-agent/pull/4393) - fix(acp): capture accurate edit diffs and absolute tool locations
- [#4394](https://github.com/docker/docker-agent/pull/4394) - fix(acp): report consistent tool-call lifecycles
- [#4395](https://github.com/docker/docker-agent/pull/4395) - fix: treat GOOGLE_GENAI_USE_VERTEXAI as a boolean
- [#4396](https://github.com/docker/docker-agent/pull/4396) - fix(acp): honor client filesystem capabilities and batch reads
- [#4397](https://github.com/docker/docker-agent/pull/4397) - feat(providers): add provider_opts.extra_body passthrough for Chat Completions
- [#4398](https://github.com/docker/docker-agent/pull/4398) - test: stabilize failed-turn conversation cache coverage
- [#4399](https://github.com/docker/docker-agent/pull/4399) - refactor(httpclient): use URL.Clone for egress proxy URLs
- [#4402](https://github.com/docker/docker-agent/pull/4402) - refactor: simplify JSON tool result encoding
- [#4403](https://github.com/docker/docker-agent/pull/4403) - test(wire): use in-memory HTTP test servers
- [#4404](https://github.com/docker/docker-agent/pull/4404) - refactor: migrate UUID generation and parsing to Go 1.27 stdlib
- [#4405](https://github.com/docker/docker-agent/pull/4405) - test: remove environment and timing dependencies from flaky tests
- [#4406](https://github.com/docker/docker-agent/pull/4406) - refactor(config): iterate hook fields with reflect.Value.Fields
- [#4407](https://github.com/docker/docker-agent/pull/4407) - refactor(bedrock): use new expressions for pointer values
- [#4408](https://github.com/docker/docker-agent/pull/4408) - test: store TUI frame dumps in test artifacts
- [#4409](https://github.com/docker/docker-agent/pull/4409) - refactor: adopt errors.AsType in error handlers
- [#4410](https://github.com/docker/docker-agent/pull/4410) - test(telemetry): use t.Output() for two lifetime-safe stderr loggers
- [#4411](https://github.com/docker/docker-agent/pull/4411) - refactor: adopt WaitGroup.Go for scheduler and test workers
- [#4412](https://github.com/docker/docker-agent/pull/4412) - fix(acp): preserve prompt attachments and decode file URIs once
- [#4413](https://github.com/docker/docker-agent/pull/4413) - test(tui): use reflect.TypeAssert in command helpers
- [#4414](https://github.com/docker/docker-agent/pull/4414) - fix: stop TUI goroutines when sessions close
- [#4415](https://github.com/docker/docker-agent/pull/4415) - test: harden flaky-test isolation and failure cleanup
- [#4416](https://github.com/docker/docker-agent/pull/4416) - test(acp): allow headroom for Windows workspace shell checks
- [#4418](https://github.com/docker/docker-agent/pull/4418) - fix(acp): separate root context from multi-agent cost
- [#4419](https://github.com/docker/docker-agent/pull/4419) - fix(tui): reconcile transcript geometry before scroll-state clamping
- [#4421](https://github.com/docker/docker-agent/pull/4421) - fix(acp): emit empty plan snapshots
- [#4422](https://github.com/docker/docker-agent/pull/4422) - chore(deps): bump github.com/pb33f/libopenapi v0.39.1→v0.40.0
- [#4424](https://github.com/docker/docker-agent/pull/4424) - feat(lint): flag split-trim-join, new-expr, and fields-seq waste
- [#4425](https://github.com/docker/docker-agent/pull/4425) - test(app): use B.Loop in event merging benchmarks
- [#4426](https://github.com/docker/docker-agent/pull/4426) - fix(tui): keep redrawing when unfocused
- [#4427](https://github.com/docker/docker-agent/pull/4427) - test: make isolated concurrency tests deterministic with synctest
- [#4428](https://github.com/docker/docker-agent/pull/4428) - feat(acp): load sessions with persisted history replay


## [v1.142.0] - 2026-09-21

This release adds several new features including background agent synchronization, native Anthropic compaction, expanded Gemini capabilities, OpenAI provider options, and a WebAssembly shared runtime, alongside numerous bug fixes for token accounting, streaming usage, and cost tracking.

## What's New

- Adds `wait_background_agents` tool that performs an all-settled join on a caller-supplied list of task IDs, waiting up to a configurable timeout and returning an ordered result array
- Adds native Anthropic conversation compaction with replay guards and prefix mismatch controls, opt-in progress updates, strict tool argument enforcement, cache diagnostics, and request-context secret redaction
- Adds `cache_diagnostics`, `preserve_reasoning`, and `native_tool_search` provider opts for OpenAI's Responses API
- Adds native Gemini text embeddings support, enabling RAG use-cases on Gemini via the dedicated embeddings API
- Adds support for Gemini service tiers via `provider_opts.service_tier`, including flex tier with extended idle timeout handling
- Adds support for Gemini URL Context via `provider_opts.url_context: true`, allowing the model to fetch and reason over public URLs at inference time
- Adds Docker Model Runner model metadata and context limit discovery via the `/engines/_configure` endpoint, enabling auto-compaction and context gauge support for DMR models
- Replaces the WebAssembly bespoke event loop with the shared `embeddedchat`-backed agent runtime, adding portable tools, in-memory storage, egress proxy, session-scoped MCP OAuth token stores, and opt-in cloud provider builds

## Improvements

- Defers TUI frame composition while the terminal is blurred, avoiding unnecessary rendering work during unfocused sessions

## Bug Fixes

- Fixes deferred tail buffer not being cleared when a different assistant message becomes the active owner, preventing old content from bleeding into new message output
- Fixes Gemini native tool-call IDs being stripped instead of preserved, and fixes tool-response name matching to prevent malformed conversation history
- Fixes Gemini native tool-call `ProviderID` not being preserved in the WASM accumulator
- Fixes session compaction not drawing from the session's cost or token budgets, allowing spend beyond configured ceilings
- Fixes TUI animations continuing to run in unfocused and detached (tmux) sessions
- Fixes empty, refused, or reasoning-only assistant responses being skipped even when the provider reported billable usage
- Fixes OpenAI WebSocket pool allowing a single idle connection to be shared across concurrent streaming requests, which could corrupt both responses
- Fixes concurrent map and slice access on session model-state fields (`AgentModelOverrides`, `CustomModelsUsed`) causing data races
- Fixes unsafe concurrent `Close` and `Next`/retry calls on WebSocket and Anthropic streams
- Fixes runtime streams being abandoned before fully drained, which could release streaming locks or turn tokens prematurely
- Fixes cache tokens not being counted toward `max_tokens` token budgets; previously only input+output tokens were counted, allowing cache-heavy calls to bypass configured limits
- Fixes Gemini tool-use input tokens (`ToolUsePromptTokenCount`) being dropped, understating token usage and cost
- Fixes Anthropic streaming input token counts and cache read/write metrics being dropped because they were read from `message_delta` instead of the accumulated usage object
- Fixes per-call telemetry costs being reported incorrectly; previously cumulative session cost was emitted before the current call was charged
- Fixes context limits not being bounded before narrowing to int in the runtime
- Fixes deferral state not being preserved across session reloads for tools
- Fixes Bedrock SDK bearer authentication scheme configuration
- Fixes concurrent indexing usage accounting in RAG

## Technical Changes

- Refactors external reference name and config import suffix parsing to use `strings.CutLast`
- Simplifies test sleep-and-wait pairs using Go 1.27's `synctest.Sleep`
- Simplifies composite literals in runtime and config packages using Go 1.27 promoted fields
- Adds `Lint/ExclusiveStreamLease` analyzer to detect shared WebSocket stream leases
- Adds `Lint/SessionStateAccessors` cop to require session model-state accessors
- Adds `Lint/StreamCloseSafety` cop to detect unsafe stream close access
- Adds lint detection for abandoned runtime streams
- Consolidates and deduplicates documentation across custom commands, thinking/task budgets, provider credentials, MCP configuration, server CLI flags, generated media, provider inheritance examples, and tool concepts
### Pull Requests

- [#4305](https://github.com/docker/docker-agent/pull/4305) - test(tui): fix ordering race in TestThemeWatcher_WatchUserTheme
- [#4323](https://github.com/docker/docker-agent/pull/4323) - test: simplify sleep-and-wait pairs with synctest.Sleep
- [#4324](https://github.com/docker/docker-agent/pull/4324) - refactor: simplify literals with Go 1.27 promoted fields
- [#4325](https://github.com/docker/docker-agent/pull/4325) - refactor: parse reference names and import suffixes with strings.CutLast
- [#4326](https://github.com/docker/docker-agent/pull/4326) - docs: update CHANGELOG.md for v1.141.0
- [#4327](https://github.com/docker/docker-agent/pull/4327) - chore(deps): bump openai-go/v3 to v3.61.0
- [#4328](https://github.com/docker/docker-agent/pull/4328) - fix: preserve final TUI responses across deferred message transitions
- [#4330](https://github.com/docker/docker-agent/pull/4330) - feat: add wait_background_agents join tool
- [#4331](https://github.com/docker/docker-agent/pull/4331) - docs: consolidate custom command documentation
- [#4332](https://github.com/docker/docker-agent/pull/4332) - docs: consolidate thinking and task budget references
- [#4333](https://github.com/docker/docker-agent/pull/4333) - docs: centralize provider credential reference
- [#4334](https://github.com/docker/docker-agent/pull/4334) - docs: separate MCP and shared tool configuration references
- [#4335](https://github.com/docker/docker-agent/pull/4335) - docs: centralize server CLI flag tables
- [#4336](https://github.com/docker/docker-agent/pull/4336) - docs: consolidate generated media documentation
- [#4337](https://github.com/docker/docker-agent/pull/4337) - docs: reuse provider inheritance examples
- [#4338](https://github.com/docker/docker-agent/pull/4338) - docs: link tool concepts to the canonical catalog
- [#4339](https://github.com/docker/docker-agent/pull/4339) - fix(gemini): preserve native tool-call IDs and fix tool-response matching
- [#4340](https://github.com/docker/docker-agent/pull/4340) - feat(dmr): discover model metadata and context limits
- [#4341](https://github.com/docker/docker-agent/pull/4341) - fix: report per-call costs in telemetry
- [#4342](https://github.com/docker/docker-agent/pull/4342) - perf(tui): defer frame composition while blurred
- [#4343](https://github.com/docker/docker-agent/pull/4343) - fix: charge compaction to shared session budgets
- [#4344](https://github.com/docker/docker-agent/pull/4344) - fix(tui): pause animations in unfocused and detached sessions
- [#4345](https://github.com/docker/docker-agent/pull/4345) - fix(runtime): retain costs for empty assistant responses
- [#4346](https://github.com/docker/docker-agent/pull/4346) - fix(openai): lease WebSocket connections exclusively
- [#4347](https://github.com/docker/docker-agent/pull/4347) - fix(app): guard session model state with an accessor cop
- [#4348](https://github.com/docker/docker-agent/pull/4348) - feat: support Gemini service tiers
- [#4349](https://github.com/docker/docker-agent/pull/4349) - feat: support Gemini URL Context
- [#4350](https://github.com/docker/docker-agent/pull/4350) - feat: support native Gemini text embeddings
- [#4352](https://github.com/docker/docker-agent/pull/4352) - fix: detect and repair unsafe stream closure
- [#4353](https://github.com/docker/docker-agent/pull/4353) - fix: drain runtime streams before releasing turn ownership
- [#4354](https://github.com/docker/docker-agent/pull/4354) - feat(anthropic): native compaction, progress updates, strict tools, cache diagnostics, and secret redaction
- [#4355](https://github.com/docker/docker-agent/pull/4355) - feat(openai): add cache_diagnostics, preserve_reasoning, and native_tool_search provider opts
- [#4357](https://github.com/docker/docker-agent/pull/4357) - feat(wasm): shared runtime, portable tools, in-memory storage, egress proxy, and cloud provider builds
- [#4358](https://github.com/docker/docker-agent/pull/4358) - fix(runtime): count cache tokens toward token budgets
- [#4359](https://github.com/docker/docker-agent/pull/4359) - fix: account for Gemini tool-use input tokens
- [#4360](https://github.com/docker/docker-agent/pull/4360) - fix: preserve Anthropic streaming input and cache usage
- [#4361](https://github.com/docker/docker-agent/pull/4361) - chore(deps): bump anyio from 4.9.0 to 4.14.2 in /examples/dhi/dhi_mcp_server in the pip group across 1 directory
- [#4362](https://github.com/docker/docker-agent/pull/4362) - docs: auto-update for merged PRs (2026-09-19)
- [#4367](https://github.com/docker/docker-agent/pull/4367) - docs: auto-update for merged PRs (2026-09-21)


## [v1.141.0] - 2026-09-16

This release adds an opt-in shared plans sidebar to the TUI, delivers multiple performance improvements across session handling, tools, and filesystem operations, and fixes several bugs including lost user config updates and OpenCode session header handling.

## What's New

- Adds an opt-in shared plans sidebar to the TUI (`settings.layout.show_plans`), listing the five most recently updated shared plans with support for opening, refreshing, and browsing all plans

## Improvements

- Avoids HTML escaping in JSON tool results, reducing unnecessary escape sequences in LLM payloads
- Trims redundant prompt text in the fetch tool
- Fixes O(n²) string conversion in URL prefix scanning (`urldetect`)
- Eliminates wasted `strings.Join` allocation in `scrollview.compose` for the two most common render paths
- Replaces `strings.Split` with lazy `strings.SplitSeq` in `search_files_content` to avoid materializing full line slices (~9.5% allocation reduction)
- Reduces attachment data URI allocations by replacing `fmt.Sprintf` with plain string concatenation
- Adds `OwnMessageCount` to count session messages without cloning the full message slice
- Adds `AllMessageCount` to count all messages across the session tree without cloning
- Avoids cloning the session tree in last-message lookups (`getLastMessageContentByRole`)

## Bug Fixes

- Fixes sending of `x-opencode-session` header to OpenCode providers via a shared transport for all clients, gated on the host
- Fixes plans sidebar reconciliation with upstream tab lifecycle in the TUI
- Fixes lost user config updates after file-lock timeouts by serializing in-process `Update` calls with a mutex
- Fixes eval agent validation to occur before judge setup, so missing or invalid agent configs fail early

## Technical Changes

- Warms PowerShell before hook tests on Windows to avoid cold-start overhead interfering with the 60-second hook timeout
- Widens the program-quiescence settle window in TUI tests under `-race` to reduce flakiness
- Records client lifetimes in `AGENTS.md` and points to the contributing guide
- Documents `options.WithTokenSource` in the Go SDK guide
- Trims comments in the OpenCode session transport, its tests, and the OpenCode gate/WebSocket fallback
### Pull Requests

- [#4190](https://github.com/docker/docker-agent/pull/4190) - fix: send x-opencode-session header to OpenCode providers
- [#4197](https://github.com/docker/docker-agent/pull/4197) - docs: record client lifetimes in AGENTS.md and point at the contributing guide
- [#4253](https://github.com/docker/docker-agent/pull/4253) - feat(tui): add an opt-in shared plans sidebar
- [#4280](https://github.com/docker/docker-agent/pull/4280) - feat(provider): add request-time TokenSource authentication for OpenAI and Vertex AI
- [#4298](https://github.com/docker/docker-agent/pull/4298) - chore: update docker-agent-action to v2.0.8
- [#4301](https://github.com/docker/docker-agent/pull/4301) - docs: update CHANGELOG.md for v1.140.0
- [#4302](https://github.com/docker/docker-agent/pull/4302) - test(tui): widen the program-quiescence settle window for -race
- [#4304](https://github.com/docker/docker-agent/pull/4304) - chore: update docker-agent-action to v2.0.9
- [#4306](https://github.com/docker/docker-agent/pull/4306) - test: warm PowerShell before hook tests on Windows
- [#4307](https://github.com/docker/docker-agent/pull/4307) - test(tui): widen the program-quiescence settle window for -race
- [#4308](https://github.com/docker/docker-agent/pull/4308) - docs: auto-update for merged PRs (2026-09-16)
- [#4311](https://github.com/docker/docker-agent/pull/4311) - chore(deps): bump direct Go dependencies
- [#4313](https://github.com/docker/docker-agent/pull/4313) - fix(eval): validate agent before judge setup
- [#4314](https://github.com/docker/docker-agent/pull/4314) - perf(tools/fetch): avoid HTML escaping in JSON results and trim fetch prompt overhead
- [#4315](https://github.com/docker/docker-agent/pull/4315) - perf(urldetect): avoid O(n²) string conversion in URL prefix scan
- [#4316](https://github.com/docker/docker-agent/pull/4316) - perf(tui): avoid discarded strings.Join in scrollview.compose
- [#4317](https://github.com/docker/docker-agent/pull/4317) - perf(filesystem): use strings.SplitSeq to avoid allocating line slice in search
- [#4318](https://github.com/docker/docker-agent/pull/4318) - perf: reduce attachment data URI allocations
- [#4319](https://github.com/docker/docker-agent/pull/4319) - perf(session): add OwnMessageCount to avoid cloning OwnMessages for a count
- [#4320](https://github.com/docker/docker-agent/pull/4320) - perf(session): avoid cloning session tree in getLastMessageContentByRole
- [#4321](https://github.com/docker/docker-agent/pull/4321) - perf(session): count messages without cloning session history
- [#4322](https://github.com/docker/docker-agent/pull/4322) - fix(userconfig): prevent lost updates after lock timeouts


## [v1.140.0] - 2026-09-15

This release adds file autocomplete to the lean TUI, fixes several tab and session management bugs, improves MCP callback safety under concurrent use, and introduces multiple new lint rules to enforce codebase consistency.

## What's New

- Adds `@` file autocomplete to the lean TUI, reusing VCS-aware file discovery and fuzzy matching, and preserving surrounding editor text when inserting selected paths
- Adds request-time `TokenSource` authentication for OpenAI and Vertex AI providers
- Adds request-scoped MCP callbacks (elicitation, sampling, OAuth) via a new `HandlerScope` type, preventing cross-request callback collisions; also adds safe MCP routing and multi-subscriber event delivery
- Adds lint rule to enforce shared tool argument decoding via `tools.UnmarshalToolArguments` instead of raw `json.Unmarshal`
- Adds lint rule to reject branching on `err.Error()` string content (`strings.Contains`, `strings.HasPrefix`, `strings.HasSuffix`)
- Adds lint rule to prevent direct `os.Stdout` writes in library packages under `pkg/`
- Adds lint rule to enforce `DOCKER_AGENT_` environment variable prefix, flagging legacy `CAGENT_*` names
- Adds lint rule to require `atomicfile.Write` for marshalled state instead of `os.WriteFile`
- Adds lint rule to flag bare `&http.Client{}` without an explicit `Transport`
- Adds lint rule to sync the Toolset schema enum with `DefaultToolsetCreators`
- Adds lint rule to enforce state paths go through `pkg/paths` instead of hard-coded `.cagent` literals

## Improvements

- Fuses assistant line styling and measurement into a single pass in the TUI, reducing redundant work on large message histories

## Bug Fixes

- Fixes `token_key` not being read in the Anthropic and Gemini clients; they now check `token_key` before falling back to their native environment variables
- Fixes lean TUI not finalizing in-flight tool calls when a stream stops without a tool response; interrupted tools are now rendered as errors before the cancellation marker
- Fixes TUI scoping of asynchronous input results and dialogs to their originating page, preventing responses from appearing in the wrong tab or on stale UI state
- Fixes TUI session identity tracking by separating the live session ID from the immutable tab routing key, and preserving the previous session ID when clearing a tab
- Fixes attention dialogs racing with tab switches and surviving their page lifetime by serializing attention delivery on the owning tab
- Fixes the API server not forwarding the agent config envelope in gateway-bound requests
- Fixes CI failure reporting to read job logs through the API (instead of `gh run view --log-failed`) and to allow ANSI escape sequences in log output

## Technical Changes

- Refactors `StartableToolSet` to be the single lifecycle owner for toolset startup, removing parallel state machines in Code Mode
- Refactors toolset startup coordination into a unified `StartToolSets` function in `pkg/tools`
- Centralizes model provider interfaces (`Provider`, `EmbeddingProvider`, `BatchEmbeddingProvider`, `RerankingProvider`) into a single `pkg/model/provider/contracts` package
- Replaces `ProviderRegistry any` field with a typed `RebuildProviderFunc` closure to eliminate unsafe type assertions
- Centralizes per-request gateway HTTP client setup into `base.NewGatewayClient`, removing duplicated boilerplate across OpenAI, Anthropic, and Gemini providers
- Extracts shared `instrumentedBase` struct for capability-specific tracing wrappers, removing duplicated method bodies
- Defers `GatewayToolset` temp-file creation to `Start`/`Restart` so secrets are not written to disk until the subprocess launches
- Refactors TUI to return explicit `UpdateEffects` from `chat.Update` instead of using a routed-timer contract
- Refactors TUI attention dialog handling into a dedicated `attention.go` file
- Introduces `tabstate` package to hold synchronized per-tab status and attention state shared between the tab renderer and the owning tab
### Pull Requests

- [#4263](https://github.com/docker/docker-agent/pull/4263) - perf(tui): fuse assistant line styling and measurement
- [#4264](https://github.com/docker/docker-agent/pull/4264) - docs: update CHANGELOG.md for v1.139.0
- [#4265](https://github.com/docker/docker-agent/pull/4265) - feat(lint): enforce shared tool argument decoding
- [#4266](https://github.com/docker/docker-agent/pull/4266) - feat(lint): add ErrorStringMatching cop and fix call sites
- [#4267](https://github.com/docker/docker-agent/pull/4267) - feat(lint): add NoStdoutInLibraries cop and fix pkg/ violations
- [#4269](https://github.com/docker/docker-agent/pull/4269) - feat(lint): add EnvironmentVariablePrefix cop and migrate pprof to DOCKER_AGENT_PPROF_ADDR
- [#4270](https://github.com/docker/docker-agent/pull/4270) - fix(tui): fix session identity, attention state, and /clear persistence across tabs
- [#4271](https://github.com/docker/docker-agent/pull/4271) - refactor(tools): establish StartableToolSet as single lifecycle owner
- [#4272](https://github.com/docker/docker-agent/pull/4272) - refactor(provider): centralize model provider interfaces in contracts package
- [#4273](https://github.com/docker/docker-agent/pull/4273) - feat(lint): sync Toolset schema enum with DefaultToolsetCreators
- [#4274](https://github.com/docker/docker-agent/pull/4274) - feat(lint): add StatePathViaPathsPackage cop and fix call sites
- [#4275](https://github.com/docker/docker-agent/pull/4275) - feat(lint): require atomicfile.Write for marshalled state
- [#4276](https://github.com/docker/docker-agent/pull/4276) - feat(lint): add HTTPClientTransport cop to flag bare &http.Client{} without Transport
- [#4277](https://github.com/docker/docker-agent/pull/4277) - refactor(tools): unify toolset startup coordination
- [#4278](https://github.com/docker/docker-agent/pull/4278) - refactor(provider): replace ProviderRegistry any with typed RebuildProviderFunc
- [#4279](https://github.com/docker/docker-agent/pull/4279) - fix(tui): scope asynchronous results and dialogs to their originating page
- [#4280](https://github.com/docker/docker-agent/pull/4280) - feat(provider): add request-time TokenSource authentication for OpenAI and Vertex AI
- [#4281](https://github.com/docker/docker-agent/pull/4281) - refactor(provider): centralize per-request gateway client setup
- [#4282](https://github.com/docker/docker-agent/pull/4282) - feat(tools): request-scoped callbacks, safe MCP routing, and multi-subscriber event delivery
- [#4283](https://github.com/docker/docker-agent/pull/4283) - refactor(tui): replace routed-timer contract with explicit UpdateEffects
- [#4285](https://github.com/docker/docker-agent/pull/4285) - fix: read token_key in the Anthropic and Gemini clients
- [#4286](https://github.com/docker/docker-agent/pull/4286) - refactor(mcp): make GatewayToolset construction side-effect free
- [#4287](https://github.com/docker/docker-agent/pull/4287) - refactor(provider): compose capability-specific tracing wrappers
- [#4288](https://github.com/docker/docker-agent/pull/4288) - fix(ci): read job logs through the API so main failures get reported
- [#4289](https://github.com/docker/docker-agent/pull/4289) - test(tui): freeze the animation clock in the scrolled-up stream program test
- [#4290](https://github.com/docker/docker-agent/pull/4290) - fix(tui): serialize attention delivery on the owning tab
- [#4291](https://github.com/docker/docker-agent/pull/4291) - fix(server): forward the agent config envelope in API-server mode
- [#4293](https://github.com/docker/docker-agent/pull/4293) - fix(ci): let gh print job logs that contain ANSI escapes
- [#4295](https://github.com/docker/docker-agent/pull/4295) - feat(leantui): add file autocomplete
- [#4296](https://github.com/docker/docker-agent/pull/4296) - ci: skip lint and test jobs on a main push the merge queue already tested
- [#4297](https://github.com/docker/docker-agent/pull/4297) - fix(leantui): finalize interrupted tool calls
- [#4299](https://github.com/docker/docker-agent/pull/4299) - docs: auto-update for merged PRs (2026-09-15)


## [v1.139.0] - 2026-09-14

This release delivers several bug fixes for runtime delegation, TUI message handling, and configuration isolation, alongside new API capabilities, TUI performance improvements, and new lint enforcement tooling.

## What's New

- Adds `GET /api/sessions?active=true` query parameter for lightweight listing of currently attached sessions without reading full session history from disk
- Adds toolset graph traversal and explicit `RuntimeHandler` identity to correctly wire capabilities for composite or decorator-wrapped toolsets
- Adds `HookBuiltinsDocumented` lint cop and documents previously missing hook builtins (`http_post`, `limit_large_tool_results`, `safer_shell`, `snapshot`) in schema and docs
- Adds `EnvironmentVariablePrefix` lint cop enforcing the `DOCKER_AGENT_` prefix for public environment variables; migrates `CAGENT_PPROF_ADDR` to `DOCKER_AGENT_PPROF_ADDR`
- Adds `TUIKeyBindings` lint cop to enforce safe key binding comparisons in TUI code, preventing silent mismatches from raw `msg.String()` comparisons

## Improvements

- Retains message renders on height-only terminal resize, skipping redundant re-renders when width is unchanged
- Preallocates transcript lines from cached heights to reduce allocations during TUI layout

## Bug Fixes

- Fixes race condition in `LoadWithConfig` by always cloning `RuntimeConfig` to keep resolved models, providers, and encrypted config isolated per load
- Fixes TUI to allow editing pending (steered/follow-up/queued) messages via Alt+Up, withdrawing them back into the editor in submission order
- Fixes pending-message restoration integrated with tab ownership in the TUI
- Fixes classification of idle streams before output in the runtime
- Fixes retry admission for delegated idle streams with a one-time direct-transfer retry
- Fixes recovery of direct task transfers in the runtime
- Fixes preservation of omitted default model policies in config
- Fixes isolation of per-agent CLI model override policies while preserving real model identity
- Fixes `--record`/`--fake` capture proxy to require Docker Desktop authentication only for HTTPS `docker.com` gateway requests, not loopback or third-party gateways

## Technical Changes

- Consolidates per-tab UI state into `tabModel` in the TUI, replacing six separate maps and top-level aliases
- Makes empty provider registry explicit by renaming `DefaultRegistry` to `EmptyRegistry` and removing silent nil-registry fallbacks
- Refreshes the embedded models.dev catalog snapshot (+310 added, -83 removed, ~331 updated)
- Adds CI reporting for failed main test runs, filing deduplicated bug issues with throttled repeat comments
- Stabilizes the zizmor workflow audit in CI
- Speeds up Go tests in CI and improves failure reporting with timing summaries and raw JSON output artifacts
### Pull Requests

- [#4227](https://github.com/docker/docker-agent/pull/4227) - chore(deps): bump the actions group across 1 directory with 3 updates
- [#4240](https://github.com/docker/docker-agent/pull/4240) - docs: update CHANGELOG.md for v1.138.1
- [#4241](https://github.com/docker/docker-agent/pull/4241) - fix: always clone RuntimeConfig in LoadWithConfig to prevent race
- [#4243](https://github.com/docker/docker-agent/pull/4243) - chore: bump direct Go dependencies (20 of 22)
- [#4244](https://github.com/docker/docker-agent/pull/4244) - feat: add GET /api/sessions?active=true for lightweight attached-session listing
- [#4245](https://github.com/docker/docker-agent/pull/4245) - feat(ci): report failed main test runs
- [#4247](https://github.com/docker/docker-agent/pull/4247) - fix: recover delegated idle streams and preserve model override policy
- [#4248](https://github.com/docker/docker-agent/pull/4248) - fix(tui): allow editing pending messages
- [#4249](https://github.com/docker/docker-agent/pull/4249) - ci: speed up Go tests and improve CI failure reporting
- [#4251](https://github.com/docker/docker-agent/pull/4251) - docs: auto-update for merged PRs (2026-09-12)
- [#4252](https://github.com/docker/docker-agent/pull/4252) - fix(record): require Docker auth only for HTTPS docker.com gateways
- [#4254](https://github.com/docker/docker-agent/pull/4254) - chore(deps): bump docker/docs/.github/workflows/validate-upstream.yml from 920ee0bb1e638c6a39d7c2a1075fa2b1d8f451a7 to bbf8dfd2f0205fd5c754eedceac8f8b69aa91f81 in the actions group across 1 directory
- [#4255](https://github.com/docker/docker-agent/pull/4255) - refactor(tui): consolidate tab UI ownership
- [#4256](https://github.com/docker/docker-agent/pull/4256) - refactor(provider): make empty registry explicit
- [#4257](https://github.com/docker/docker-agent/pull/4257) - feat: toolset graph traversal and explicit RuntimeHandler identity
- [#4258](https://github.com/docker/docker-agent/pull/4258) - chore: refresh models.dev snapshot (+310 -83 ~331)
- [#4259](https://github.com/docker/docker-agent/pull/4259) - perf(tui): avoid redundant renders on height-only resize
- [#4260](https://github.com/docker/docker-agent/pull/4260) - feat(lint): add HookBuiltinsDocumented cop and document missing builtins
- [#4261](https://github.com/docker/docker-agent/pull/4261) - feat(lint): add EnvironmentVariablePrefix cop and migrate pprof to DOCKER_AGENT_PPROF_ADDR
- [#4262](https://github.com/docker/docker-agent/pull/4262) - feat(lint): enforce TUI key bindings


## [v1.138.1] - 2026-09-11

This release adds kubectl and AWS CLI to sandbox templates, introduces secure HTTP relay packages and improved share signing, fixes session and race condition bugs, and includes several CI pipeline improvements.

## What's New
- Adds `kubectl` and AWS CLI to the `sbx-templates` image, making them available in sandboxes without manual installation
- Adds secure HTTP relay packages (`pkg/config/httprelay` and `pkg/modelsgateway/relay`) for agent configuration fetching and model-API forwarding
- Changes `share push --key` to sign a DSSE-wrapped in-toto statement instead of raw YAML bytes, adding metadata about where and when the artifact was published

## Bug Fixes
- Fixes the starred flag being silently dropped when forking a starred session (the `AddSession` insert omitted the `starred` column)
- Fixes a production data race in `App` where `ReplaceSession` wrote `a.session` from the update loop while background goroutines started by `App.Start` read it concurrently
- Fixes a data race in evaluation tests where container stderr was read without going through `exec.Cmd`
- Fixes HCL examples not being decoded through the HCL loader during the live models check in `TestExamplesAgainstLiveModelsDev`

## Technical Changes
- Consolidates CI workflows: single gate job, merged image job, shared composite actions, merged docs workflows, shared module/build caches, and checksum-verified tools
- Adds race detector job (`go test -race -shuffle=on`) on pushes to `main`
- Skips Go CI jobs on docs-only PRs and skips redundant lint/license checks on main push (already verified in merge queue)
- Stops sidebar tests from reading the checkout's git branch to avoid environment-dependent failures in CI
- Tears down bubbletea programs in `t.Cleanup` and freezes animation clock in exact-frame TUI tests to eliminate test flakiness
- Stops parallel tests from mutating `version.Version` to prevent race conditions
### Pull Requests

- [#4182](https://github.com/docker/docker-agent/pull/4182) - fix(session): preserve the starred flag in AddSession
- [#4218](https://github.com/docker/docker-agent/pull/4218) - feat(sandbox): add kubectl and aws cli to sbx-templates image
- [#4221](https://github.com/docker/docker-agent/pull/4221) - ci: single gate, merged image job, shared composite actions, docs workflow merge
- [#4222](https://github.com/docker/docker-agent/pull/4222) - revert: remove foreign-OS path rejection from filesystem tool
- [#4226](https://github.com/docker/docker-agent/pull/4226) - docs: update CHANGELOG.md for v1.138.0
- [#4228](https://github.com/docker/docker-agent/pull/4228) - ci: fix the failures in the new test-race job
- [#4230](https://github.com/docker/docker-agent/pull/4230) - fix(app): snapshot the session before spawning background goroutines
- [#4231](https://github.com/docker/docker-agent/pull/4231) - test(tui): stop sidebar tests from reading the checkout's git branch
- [#4234](https://github.com/docker/docker-agent/pull/4234) - docs: auto-update for merged PRs (2026-09-11)
- [#4235](https://github.com/docker/docker-agent/pull/4235) - feat: add secure HTTP relay packages
- [#4236](https://github.com/docker/docker-agent/pull/4236) - fix(test): load HCL examples in live models check
- [#4237](https://github.com/docker/docker-agent/pull/4237) - ci: skip redundant main push checks
- [#4238](https://github.com/docker/docker-agent/pull/4238) - feat(share): sign a DSSE-wrapped in-toto statement, not just the YAML bytes


## [v1.138.0] - 2026-09-10

This release introduces generated image output support with workspace-safe storage and portable session blobs, a new tool hook execution model with mandatory phases, and several other feature additions and fixes.

## What's New

- Adds streaming support for model-generated media deltas, accumulating complete image bytes in runtime stream results
- Adds workspace media writes with collision-safe naming, MIME-corrected extensions, and no-overwrite publication for generated images
- Adds generated media materialization as workspace files with no-resend history placeholders stored in session JSON instead of raw base64
- Keeps all generated-media writes inside the owning workspace; external, traversal, and symlink-escaping paths are redirected to a sanitized basename
- Names generated media via private `[media-file:]` response markers with fallback to user-prompt filename, provider name, or `generated-N`
- Renders generated images through manifest-gated authorization, revalidating against the current manifest on every resolution
- Restores generated media from portable session blobs when resuming sessions
- Adds `output_capabilities.image` configuration support to resolve image output capability from models.dev metadata
- Guards image-output requests across Google surfaces (gateway, direct Gemini API, and Vertex), rejecting custom function tools and structured output before dispatch
- Adds tool hook phases with a fixed mandatory execution order: `tool_input_transform` runs first, followed by `tool_guard`; includes hook deduplication, config validation, and a shared events catalog with centralized contracts
- Adds `provider_opts.service_tier` field for OpenAI provider, forwarded unchanged to the underlying API for Fast mode support
- Marks lean TUI user prompts with OSC 133 semantic prompt boundaries in terminal scrollback, enabling navigation between turns in supported terminals (e.g., iTerm2); also restores session transcripts when the lean TUI starts with a resumed session

## Bug Fixes

- Fixes Gemini session title generation by omitting `thinkingConfig` and reserving 128-token reasoning headroom with a separate 50-character visible title limit
- Fixes session title selection to keep image-output-capable models eligible as title candidates
- Fixes sanitization and bounding of generated-media metadata
- Classifies generated-media save failures into safe, reportable reasons

## Technical Changes

- Reverts "fail fast on foreign-OS paths and explain path resolution" from the filesystem tool
- Moves CI image builds to Docker Build Cloud
- Reverts CI feedback-loop shortening changes (parallel jobs, warm Go cache, Build Cloud pipeline)
- Fixes CI image builds for fork pull requests that lack cloud credentials
### Pull Requests

- [#3996](https://github.com/docker/docker-agent/pull/3996) - feat(#3996): stream model-generated media deltas
- [#4019](https://github.com/docker/docker-agent/pull/4019) - feat(#3996): resolve image output capability from models.dev
- [#4020](https://github.com/docker/docker-agent/pull/4020) - feat(#3996): guard image-output requests across Google surfaces
- [#4021](https://github.com/docker/docker-agent/pull/4021) - fix(#3996): keep image-output models eligible for session titles
- [#4023](https://github.com/docker/docker-agent/pull/4023) - feat(#3996): stream model-generated media deltas
- [#4024](https://github.com/docker/docker-agent/pull/4024) - feat(#3996): add workspace media writes and session provenance
- [#4025](https://github.com/docker/docker-agent/pull/4025) - feat(#3996): save generated media with no-resend placeholders
- [#4026](https://github.com/docker/docker-agent/pull/4026) - feat(#3996): keep generated media workspace-only with portable session copies
- [#4027](https://github.com/docker/docker-agent/pull/4027) - feat(#3996): name generated media with private markers and prompt fallback
- [#4028](https://github.com/docker/docker-agent/pull/4028) - fix(#3996): leave reasoning headroom for Gemini session titles
- [#4029](https://github.com/docker/docker-agent/pull/4029) - feat(#3996): render generated images from manifest-gated portable blobs
- [#4030](https://github.com/docker/docker-agent/pull/4030) - docs(#3996): describe portable generated media and Gemini output limits
- [#4208](https://github.com/docker/docker-agent/pull/4208) - chore: update docker-agent-action to v2.0.7
- [#4211](https://github.com/docker/docker-agent/pull/4211) - feat(hooks): tool hook phases — mandatory guards, transforms, dedup and strict output
- [#4212](https://github.com/docker/docker-agent/pull/4212) - docs: update CHANGELOG.md for v1.137.0
- [#4214](https://github.com/docker/docker-agent/pull/4214) - feat(openai): support provider_opts.service_tier for Fast mode
- [#4215](https://github.com/docker/docker-agent/pull/4215) - docs: fix CLI completion, debug visibility, task dev parallelism, DCO clarification
- [#4216](https://github.com/docker/docker-agent/pull/4216) - docs: auto-update for merged PRs (2026-09-10)
- [#4219](https://github.com/docker/docker-agent/pull/4219) - ci: move image builds to Docker Build Cloud
- [#4220](https://github.com/docker/docker-agent/pull/4220) - ci: shorten the feedback loop (parallel jobs, warm Go cache, Build Cloud)
- [#4222](https://github.com/docker/docker-agent/pull/4222) - revert: remove foreign-OS path rejection from filesystem tool
- [#4223](https://github.com/docker/docker-agent/pull/4223) - Revert "ci: shorten the feedback loop (parallel jobs, warm Go cache, Build Cloud)"
- [#4224](https://github.com/docker/docker-agent/pull/4224) - feat: mark lean TUI prompts in terminal scrollback


## [v1.137.0] - 2026-09-09

This release removes the `session_plan` toolset, adds audio/video/image input and output capability handling, expands hook functionality with new builtins and sequential pipelines, and includes several bug fixes and safety improvements.

## Breaking Changes
- Removes the `session_plan` toolset, including its tool handlers, stream event, plans service, TUI `/plans` browser, and `--session`/`--scope` addressing on the `plans` command

## What's New
- Adds detection and filtering of audio/video input modalities per request model, stripping unsupported media parts and preserving provider-specific fallbacks
- Adds `output_capabilities.image` model override to resolve image output capability from models.dev metadata
- Adds guard for image-output requests across Google (gateway, direct Gemini API, and Vertex) surfaces, rejecting incompatible custom tools and structured output before dispatch
- Adds `add_context` builtin hook for dependency-free Go template-based context injection into the model's conversation
- Adds sequential pipeline execution for `pre_tool_use`, `before_llm_call`, and `tool_response_transform` hooks, replacing the previous concurrent first-rewrite-wins strategy
- Adds 56 new safe and 27 new destructive shell safety patterns, covering Git read operations, GitHub CLI queries, Go tooling, `rg`/`ripgrep`, and common inspection commands

## Bug Fixes
- Fixes Gemini keepalive SSE events (`event: keepalive` with `data: {}`) being passed to the SDK parser, causing parse failures; these frames are now dropped at the transport layer
- Fixes image-output-capable models being incorrectly excluded from session title generation
- Fixes shell metacharacter detection and corrects `gh`/`rg` pattern classifications
- Fixes SQLite stores not being closed deterministically on Windows, causing `TempDir` cleanup failures in tests
- Fixes `pkg/session` importing the SQLite driver, keeping the package free of that dependency

## Technical Changes
- Adds request-shape diagnostics for Gemini image requests (excluding prompt, schema, media-payload, and credential fields)
- Adds shared UTF-8-safe display-name sanitization helpers
- Classifies Gemini API 400 errors into bounded actionable categories
- Adds documentation tip for injecting session ID into model context using a `session_start` hook
### Pull Requests

- [#3996](https://github.com/docker/docker-agent/pull/3996) - feat(#3996): detect audio/video input modalities
- [#4016](https://github.com/docker/docker-agent/pull/4016) - feat(#3996): resolve and filter input media per request model
- [#4017](https://github.com/docker/docker-agent/pull/4017) - fix(#3996): diagnose Gemini requests and sanitize API failures
- [#4019](https://github.com/docker/docker-agent/pull/4019) - feat(#3996): resolve image output capability from models.dev
- [#4020](https://github.com/docker/docker-agent/pull/4020) - feat(#3996): guard image-output requests across Google surfaces
- [#4021](https://github.com/docker/docker-agent/pull/4021) - fix(#3996): keep image-output models eligible for session titles
- [#4022](https://github.com/docker/docker-agent/pull/4022) - fix(#3996): filter gateway SSE keepalives and test image requests
- [#4199](https://github.com/docker/docker-agent/pull/4199) - feat(plan)!: remove the session_plan toolset
- [#4202](https://github.com/docker/docker-agent/pull/4202) - docs: update CHANGELOG.md for v1.136.0
- [#4203](https://github.com/docker/docker-agent/pull/4203) - fix: drop Gemini keepalive SSE events before SDK parsing
- [#4205](https://github.com/docker/docker-agent/pull/4205) - docs: add tip for injecting session ID with a session_start hook
- [#4206](https://github.com/docker/docker-agent/pull/4206) - feat(hooks): add add_context builtin for dependency-free template context injection
- [#4207](https://github.com/docker/docker-agent/pull/4207) - feat(hooks): sequential pipeline for pre_tool_use, before_llm_call, and tool_response_transform
- [#4209](https://github.com/docker/docker-agent/pull/4209) - feat(safety): expand shell safety patterns and harden substitution checks
- [#4210](https://github.com/docker/docker-agent/pull/4210) - fix(tui): close SQLite stores deterministically so Windows can delete t.TempDir


## [v1.136.0] - 2026-09-08

This release adds support for carrying encrypted agent config in the request body instead of headers, addressing potential header-size limit issues.

## What's New
- Adds support for carrying encrypted agent config in the request body (as `encrypted_agent_config` field) and config-load envelope, replacing the previous `X-Cagent-Encrypted-Config` header approach to avoid header-size limit constraints

## Technical Changes
- Updates `docker-agent-action` reference to v2.0.6 in the PR review workflow
### Pull Requests

- [#4196](https://github.com/docker/docker-agent/pull/4196) - docs: update CHANGELOG.md for v1.135.0
- [#4200](https://github.com/docker/docker-agent/pull/4200) - chore: update docker-agent-action to v2.0.6
- [#4201](https://github.com/docker/docker-agent/pull/4201) - feat(gateway): carry encrypted agent config in request body and config-load envelope


## [v1.135.0] - 2026-09-08

This release delivers a broad set of stability and security hardening fixes across session management, pricing, and background job handling, plus a new `/copy` command in the lean TUI.

## What's New
- Adds a `/copy` command to the lean TUI that copies the last assistant response to the clipboard via OSC 52 and the native clipboard API, with feedback on success or when no response exists
- Adds per-runtime harness factory configuration via `WithHarnessFactory`
- Adds per-instance command evaluator configuration for the runtime

## Bug Fixes
- Fixes delayed title events leaking across session streams
- Fixes blocked session event sends not being cancelled
- Fixes remote MCP connections to protect against SSRF
- Fixes live session permission updates to be properly synchronized
- Fixes ACP session turns to be serialized correctly
- Fixes app turns being incorrectly shared across sessions instead of bound to their own session
- Fixes OCI cache references to be scoped by registry
- Fixes message updates to be scoped to their own session
- Fixes session model switches to be serialized
- Fixes background agent admission to be atomic
- Fixes background jobs to terminate reliably
- Fixes scheduled recalls to retry on failure
- Fixes task description file reads to be confined
- Fixes task store updates to be transactional
- Fixes unreadable task stores being overwritten instead of preserved
- Fixes stale Unix sockets to be safely reclaimed
- Fixes remote agent configuration size to be limited
- Fixes long-context model pricing tiers not being accounted for (e.g. GPT-5.4 above 272k tokens, Gemini 2.5 Pro above 200k tokens were previously billed at the base flat rate)
- Fixes fallback model requests being billed against the primary model's rates instead of the model that actually handled the call
- Fixes catalog refresh to be limited to long-context pricing tiers
- Fixes config cost not being applied after fallback model resolution
- Fixes WASM provider registration to be explicit, removing implicit inclusion of all browser-compatible SDKs

## Technical Changes
- Extracts a JavaScript-free HTTP tool client into a new `pkg/tools/builtin/api/client` leaf package, removing `goja`, `regexp2/v2`, `go-sourcemap`, and `google/pprof` from the dependency closure of non-JS embedders
- Inlines the single-use context tier constant
### Pull Requests

- [#4185](https://github.com/docker/docker-agent/pull/4185) - fix: harden concurrent and external resource handling
- [#4186](https://github.com/docker/docker-agent/pull/4186) - fix(http): bound the SSRF pre-check DNS lookup in desktopAwareTransport
- [#4187](https://github.com/docker/docker-agent/pull/4187) - docs: update CHANGELOG.md for v1.134.0
- [#4188](https://github.com/docker/docker-agent/pull/4188) - feat: add copy command to lean TUI
- [#4189](https://github.com/docker/docker-agent/pull/4189) - fix: account for long-context tiers and fallback model pricing
- [#4192](https://github.com/docker/docker-agent/pull/4192) - fix: make WASM provider registration explicit
- [#4193](https://github.com/docker/docker-agent/pull/4193) - refactor(api): extract JavaScript-free HTTP client leaf and per-runtime factory options
- [#4194](https://github.com/docker/docker-agent/pull/4194) - docs: auto-update for merged PRs (2026-09-08)


## [v1.134.0] - 2026-09-07

This release adds machine-readable output to debug commands, improves RAG indexing reliability, fixes config handling for removed fields, and includes a large batch of documentation corrections.

## What's New

- Adds `--json` flag to `debug toolsets` and `debug skills` subcommands for machine-readable output
- Accepts positional flavor names on `debug config` (e.g., `docker agent debug config examples/flavors.yaml cheap with-shell`)
- Decouples RAG indexing from the caller timeout via a new `indexing_timeout` config option, preventing large knowledge base indexing from being discarded when the 30s startup budget is exceeded
- Pins the injected docker-agent image to the host CLI version by default in `docker agent eval`

## Bug Fixes

- Fixes config upgrade hinting at removed fields (e.g., `safer`) instead of silently re-adding them
- Always records the resolved agent image in saved eval run JSON
- Bounds the SSRF pre-check DNS lookup in `desktopAwareTransport` to 2 seconds to prevent hangs on corporate networks
- Replaces removed `github-copilot/gpt-4.1` model with `gpt-5.5` in the models snapshot

## Technical Changes

- Freezes config schema v15 as an immutable package and advances `latest` to v16
- Refreshes the embedded models.dev catalog snapshot (129 models added, 67 removed, ~322 updated)
- Corrects 53 documentation inaccuracies across 34 files covering SDK examples, CLI flags, telemetry, permissions, and integrations
### Pull Requests

- [#4073](https://github.com/docker/docker-agent/pull/4073) - Merge pull request #4172 from docker/feat/4073-rag-indexing-timeout
- [#4170](https://github.com/docker/docker-agent/pull/4170) - feat(config): freeze v15 and start v16 as latest
- [#4171](https://github.com/docker/docker-agent/pull/4171) - docs: update CHANGELOG.md for v1.133.0
- [#4172](https://github.com/docker/docker-agent/pull/4172) - feat(rag): decouple indexing from caller timeout via indexing_timeout config (#4073)
- [#4173](https://github.com/docker/docker-agent/pull/4173) - feat(debug): add --json flag to debug toolsets and skills
- [#4174](https://github.com/docker/docker-agent/pull/4174) - feat(debug): accept positional flavors on `debug config`
- [#4176](https://github.com/docker/docker-agent/pull/4176) - feat(eval): pin injected docker-agent image to host CLI version by default
- [#4177](https://github.com/docker/docker-agent/pull/4177) - fix(config): hint at removed fields instead of re-adding them
- [#4178](https://github.com/docker/docker-agent/pull/4178) - docs: auto-update for merged PRs (2026-09-05)
- [#4183](https://github.com/docker/docker-agent/pull/4183) - chore: refresh models.dev snapshot (+129 -67 ~322)
- [#4184](https://github.com/docker/docker-agent/pull/4184) - docs: fix inaccuracies across SDK examples, CLI flags, telemetry, permissions, and integrations
- [#4186](https://github.com/docker/docker-agent/pull/4186) - fix(http): bound the SSRF pre-check DNS lookup in desktopAwareTransport


## [v1.133.0] - 2026-09-04

This release improves safety classification for background jobs and shell commands, enhances the `--key` option for share commands, and advances the internal config schema to v16.

## Breaking Changes

- The `safer` boolean flag removed from the shell toolset (see Technical Changes below) is now rejected outright: a config that still sets `safer: true` on a shell toolset fails to load with `unknown field "safer"` instead of loading silently, including version-less configs (which resolve to the latest schema). Delete the flag — it has had no effect since v1.117.0, superseded by session-wide [safety modes](https://github.com/docker/docker-agent/blob/main/examples/safety_modes.yaml). Pinning `version: "14"` (or lower) is not the fix, since frozen schema versions are not maintained long-term; the field must be removed from the YAML. The load-time error now includes a hint naming the last config version that accepted the field.

## What's New

- Adds classification of `run_background_job` commands using the same safety rules as shell commands, so background jobs are now properly evaluated (and prompted or denied) based on their actual command content
- The `--key` flag for `docker agent share push` and `docker agent share pull` now accepts either inline key material directly or a `file://`-prefixed path, in addition to the previous file path behavior

## Bug Fixes

- Fixes atomic per-file vector store persistence so that file hash updates and chunk deletions no longer occur prematurely during the embedding process
- Fixes safety classification to resolve `cmd`/`command` arguments the same way the handlers do, ensuring the classified command matches what is actually executed

## Technical Changes

- Removes the deprecated `safer` boolean flag from the shell toolset in config version 15
- Freezes config schema v15 as an immutable package and advances `latest` to v16
### Pull Requests

- [#4073](https://github.com/docker/docker-agent/pull/4073) - fix(rag): atomic per-file vector store persistence (#4073)
- [#4158](https://github.com/docker/docker-agent/pull/4158) - fix(rag): atomic per-file vector store persistence (#4073)
- [#4166](https://github.com/docker/docker-agent/pull/4166) - feat(safety): classify run_background_job commands like shell
- [#4167](https://github.com/docker/docker-agent/pull/4167) - docs: update CHANGELOG.md for v1.132.0
- [#4168](https://github.com/docker/docker-agent/pull/4168) - feat(share): accept inline key or file:// path for --key
- [#4169](https://github.com/docker/docker-agent/pull/4169) - refactor(config): remove deprecated safer shell flag from v15
- [#4170](https://github.com/docker/docker-agent/pull/4170) - feat(config): freeze v15 and start v16 as latest


## [v1.132.0] - 2026-09-04

This release adds OCI artifact signing/encryption for shared agents, live git branch updates in TUI footers, and a range of bug fixes across the OpenAI provider, runtime streaming, RAG toolsets, and schema handling.

## What's New

- Adds `--key` flag to `docker agent share push` to sign or encrypt agent YAML in OCI artifacts
- Forwards encrypted agent config to the Docker models gateway at runtime for verification
- Adds live git branch updates in TUI footers using an event-driven watcher (supports repositories and linked worktrees)
- Accepts `instruction` as a list of strings in config, allowing flavors to append to a base prompt instead of replacing it wholesale
- Adds `config.Requires` to audit a config's providers, toolsets, and features; adds `WithStrict` to reject configs using unenabled providers, toolsets, or features
- Removes the context usage progress bar (`██████░░░░`) from the lean TUI footer
- Adds non-blocking `StartableToolSet` status check to avoid blocking on long-running toolset starts
- Adds `EmbeddedSnapshot` and `Fetch` helpers to the modelsdev package
- Recognizes the `gpt-6` model family via generation-based parsing, enabling correct Responses API, reasoning effort, and token field handling

## Improvements

- Config now hints at the newer version on type errors, not just unknown keys
- `docker agent share push` now pushes HCL configs as resolved, self-contained YAML (previously broken for HCL agents)
- Exports per-toolset `Creator` funcs and `provider.Adapt` for hand-picked registries in lean YAML loading

## Bug Fixes

- Fixes TUI stuck on "Working…" after stream ends by delivering `StreamStopped` with a bounded blocking send and synthesizing it when the runtime stream closes without one
- Fixes `oneOf`/`allOf` and `$defs`/`$ref` not being validated before enabling OpenAI strict mode, which could cause tool schema errors
- Stops injecting `type:object` onto `anyOf`/`oneOf`/`allOf` nodes; handles Responses API `response.incomplete`/`failed` events
- Fixes OpenAI provider to degrade gracefully on Chat Completions for `gpt-5.4+` when `tools+effort` is used, and warns on ignored `thinking_budget`
- Fixes `protect` package to require signatures for asymmetric keys, harden key parsing, parse `authorized_keys` with options, tighten key-kind detection, reject impossible encrypted copies, fail closed on any PEM or OpenSSH marker in a key file, and match OpenSSH key-type markers as plain substrings
- Fixes pacing of retryable partial-start failures in code-mode composites to prevent burst-retrying on every turn
- Propagates sustained RAG 5xx/408 indexing failures to the backoff gate (previously only 429 was gated)
- Fixes stale Fireworks `kimi-k2-instruct` model reference, replacing it with `accounts/fireworks/models/kimi-k3`
- Fixes config handling of a forced reload that still returns 304
- Fixes external agents to inherit every loader capability option
- Fixes strict audit to run before any network or environment access
- Fixes `provider` to serve OpenAI protocol variants from the `"openai"` factory
- Fixes config to audit per-toolset and fork-skill model overrides in `Requires`
- Fixes `tools` to keep config-free toolset packages free of `pkg/config`
- Logs raw incomplete/unhandled Responses payloads untruncated; logs `response.incomplete` at debug level

## Technical Changes

- Splits agent config sources so embedders link only the source types they use
- Refactors `teamloader` to probe Docker Model Runner through `dmrmodels` instead of the full provider
- Makes JavaScript expansion and code mode opt-in in `teamloader`
- Makes TOON output and deferred tools opt-in in `teamloader`
- Merges sibling toolsets through `tools.Mergeable` instead of hardwiring LSP in `teamloader`
- Runs harness agents through a registered driver in `runtime`
- Adds scheduled models.dev live-catalog drift check in CI
- Validates `DefaultModels` against the committed models.dev snapshot in tests
- Makes `TestParseExamples` validate against the committed models.dev snapshot only (not live HTTP)
### Pull Requests

- [#4073](https://github.com/docker/docker-agent/pull/4073) - feat(tools): non-blocking StartableToolSet status check (#4073)
- [#4097](https://github.com/docker/docker-agent/pull/4097) - fix(#4097): propagate sustained RAG 5xx/408 indexing failures to backoff gate
- [#4106](https://github.com/docker/docker-agent/pull/4106) - fix(openai): reject oneOf/allOf and validate $defs/$ref before enabling strict mode (#4106)
- [#4122](https://github.com/docker/docker-agent/pull/4122) - feat(leantui): support bang commands
- [#4129](https://github.com/docker/docker-agent/pull/4129) - feat: live-update git branch in TUI footers
- [#4136](https://github.com/docker/docker-agent/pull/4136) - fix(runtime): deliver StreamStopped with a bounded blocking send
- [#4140](https://github.com/docker/docker-agent/pull/4140) - feat(shell): name PowerShell substitutes for the POSIX utilities models reach for
- [#4141](https://github.com/docker/docker-agent/pull/4141) - feat(shell): correct known shell-dialect errors in the tool output
- [#4143](https://github.com/docker/docker-agent/pull/4143) - docs: update CHANGELOG.md for v1.131.0
- [#4144](https://github.com/docker/docker-agent/pull/4144) - feat: accept `instruction` as a list, let flavors append to it
- [#4145](https://github.com/docker/docker-agent/pull/4145) - fix: update stale Fireworks kimi-k2-instruct model reference
- [#4146](https://github.com/docker/docker-agent/pull/4146) - test(config): validate DefaultModels against the models.dev catalog
- [#4147](https://github.com/docker/docker-agent/pull/4147) - test: make TestParseExamples validate against the committed models.dev snapshot
- [#4148](https://github.com/docker/docker-agent/pull/4148) - feat(share): sign or encrypt agent YAML in OCI artifacts with --key
- [#4149](https://github.com/docker/docker-agent/pull/4149) - feat: lean YAML loading with hand-picked registries and strict mode
- [#4150](https://github.com/docker/docker-agent/pull/4150) - fix: pace retryable partial-start failures in code-mode composites
- [#4151](https://github.com/docker/docker-agent/pull/4151) - fix(#4097): propagate sustained RAG 5xx/408 indexing failures to backoff gate
- [#4152](https://github.com/docker/docker-agent/pull/4152) - fix(share): push HCL configs as resolved, self-contained YAML
- [#4153](https://github.com/docker/docker-agent/pull/4153) - fix(runtime): deliver StreamStopped with a bounded blocking send
- [#4154](https://github.com/docker/docker-agent/pull/4154) - fix(app): synthesize StreamStopped when the runtime stream closes without one
- [#4155](https://github.com/docker/docker-agent/pull/4155) - fix(openai): reject oneOf/allOf and validate $defs/$ref before enabling strict mode (#4106)
- [#4157](https://github.com/docker/docker-agent/pull/4157) - feat(leantui): remove context usage progress bar
- [#4159](https://github.com/docker/docker-agent/pull/4159) - feat(tools): non-blocking StartableToolSet status check (#4073)
- [#4160](https://github.com/docker/docker-agent/pull/4160) - docs: auto-update for merged PRs (2026-09-04)
- [#4161](https://github.com/docker/docker-agent/pull/4161) - fix(tools,openai): don't inject type:object onto anyOf nodes; handle Responses API response.incomplete/failed
- [#4163](https://github.com/docker/docker-agent/pull/4163) - feat: forward the encrypted agent config to the Docker models gateway
- [#4165](https://github.com/docker/docker-agent/pull/4165) - fix(openai): recognise the gpt-6 family (Responses API, reasoning effort, token field)


## [v1.131.0] - 2026-09-03

This release brings significant enhancements to the Lean TUI experience, adds new evaluation and shell tooling capabilities, and improves startup reliability through expanded backoff handling.

## What's New

- Adds a `/sessions` command to the Lean TUI for browsing and resuming past sessions from the current directory
- Adds support for `!` bang commands in the Lean TUI, running local shell commands directly without queuing an agent turn
- Adds labels for pending steering and follow-up messages in the Lean TUI
- Adds `add_prompt_files_depth` config attribute for discovering nested prompt files in monorepo subdirectories
- Adds code-based assertion support to evaluation criteria, enabling declarative grading checks (`contains`, `not_contains`, `equals`, `regex`, `cost_threshold`, `tool_called`, and more)
- Wires the assertion runner into the evaluation pipeline so assertions declared in eval JSON files execute after agent runs complete
- Includes assertion pass rates and pass@k/pass^k consistency metrics in baseline regression comparison
- Adds `get_environment_info` read-only tool for exposing environment details to the model
- Adds PowerShell substitute names for common POSIX utilities in the shell tool description for Windows
- Prepends a self-correction hint on known shell-syntax errors in the shell tool output

## Bug Fixes

- Fixes lean TUI not persisting prompt history to the shared global history used by the normal TUI
- Fixes tool calls not being restored when resuming a saved session in the Lean TUI
- Fixes Shift+Enter not inserting a newline in the Lean TUI (Kitty keyboard protocol support)
- Fixes Shift+Tab thinking cycle broken by Kitty keyboard protocol changes in the Lean TUI
- Fixes Escape not interrupting active agent runs and pending tool calls in the Lean TUI
- Fixes Option+Backspace word deletion not working with Kitty keyboard mode enabled in the Lean TUI
- Fixes Ctrl+A and Ctrl+E not recognized through the Kitty keyboard protocol in the Lean TUI
- Fixes user messages not being visually highlighted in the Lean TUI
- Fixes cancellation marker appearing before buffered partial responses in the Lean TUI
- Fixes agent failing to start when a deferred MCP source is still initializing (`deferred start failed: toolset not started`)
- Adds bounded jittered exponential backoff to `StartableToolSet` retry path to prevent burst retries on rate-limited or failing tool sources
- Extends backoff gate to remote MCP HTTP errors (503/429/5xx during initialize handshake)
- Extends backoff gate to A2A agent-card HTTP errors
- Wires LSP crash-loop failures through the backoff gate to prevent persistently-crashing LSP servers from relaunching at full speed
- Fixes security and robustness issues in `add_prompt_files_depth` implementation

## Technical Changes

- Simplifies the built-in coder agent by removing planner and librarian sub-agents, limiting it to file, shell, and fetch toolsets
- Updates Go version declaration format in `go.mod` to use separate `go` (minimum) and `toolchain` (pinned) directives
- Removes the Nebius example due to model availability issues
### Pull Requests

- [#4060](https://github.com/docker/docker-agent/pull/4060) - Merge pull request #4062 from docker/fix/startable-toolset-backoff
- [#4062](https://github.com/docker/docker-agent/pull/4062) - fix(#4060): add bounded jittered backoff to StartableToolSet retry path
- [#4074](https://github.com/docker/docker-agent/pull/4074) - fix(#4060): extend backoff gate to remote MCP HTTP errors
- [#4088](https://github.com/docker/docker-agent/pull/4088) - feat: add assertions schema to EvalCriteria for code-based grading
- [#4092](https://github.com/docker/docker-agent/pull/4092) - feat: expose pass@k and pass^k metrics for --repeat runs
- [#4098](https://github.com/docker/docker-agent/pull/4098) - fix: extend backoff gate to A2A agent-card HTTP errors (#4098)
- [#4100](https://github.com/docker/docker-agent/pull/4100) - feat: wire assertion runner into runSingleEval execution pipeline
- [#4101](https://github.com/docker/docker-agent/pull/4101) - docs: update CHANGELOG.md for v1.130.0
- [#4103](https://github.com/docker/docker-agent/pull/4103) - feat: include assertions and pass@k in baseline regression comparison
- [#4104](https://github.com/docker/docker-agent/pull/4104) - fix(#4098): extend backoff gate to A2A agent-card HTTP errors
- [#4105](https://github.com/docker/docker-agent/pull/4105) - refactor: update go version declaration format
- [#4108](https://github.com/docker/docker-agent/pull/4108) - fix(#4060): wire LSP crash-loop pacing through backoff gate
- [#4109](https://github.com/docker/docker-agent/pull/4109) - docs: auto-update for merged PRs (2026-09-02)
- [#4110](https://github.com/docker/docker-agent/pull/4110) - ci(update-models): sign commits with bot identity, add semantic catalog diff
- [#4111](https://github.com/docker/docker-agent/pull/4111) - feat: add add_prompt_files_depth for monorepo nested prompt file discovery
- [#4113](https://github.com/docker/docker-agent/pull/4113) - Update linter config
- [#4114](https://github.com/docker/docker-agent/pull/4114) - fix(deferred): don't fail to start when a source is still starting
- [#4118](https://github.com/docker/docker-agent/pull/4118) - chore: simplify built-in coder agent
- [#4119](https://github.com/docker/docker-agent/pull/4119) - feat(leantui): add sessions command
- [#4120](https://github.com/docker/docker-agent/pull/4120) - fix(leantui): support shift-enter newlines
- [#4121](https://github.com/docker/docker-agent/pull/4121) - chore: refresh models.dev snapshot (+79 -75 ~196)
- [#4122](https://github.com/docker/docker-agent/pull/4122) - feat(leantui): support bang commands
- [#4123](https://github.com/docker/docker-agent/pull/4123) - fix: highlight user messages in lean TUI
- [#4124](https://github.com/docker/docker-agent/pull/4124) - fix(leantui): restore shift-tab thinking cycle
- [#4125](https://github.com/docker/docker-agent/pull/4125) - feat(leantui): label steering and follow-up messages
- [#4126](https://github.com/docker/docker-agent/pull/4126) - fix(leantui): restore interrupt and editing shortcuts
- [#4127](https://github.com/docker/docker-agent/pull/4127) - fix: persist lean TUI prompt history
- [#4128](https://github.com/docker/docker-agent/pull/4128) - fix(leantui): restore tool calls on session resume
- [#4130](https://github.com/docker/docker-agent/pull/4130) - Remove the nebius example
- [#4131](https://github.com/docker/docker-agent/pull/4131) - docs: auto-update for merged PRs (2026-09-03)
- [#4138](https://github.com/docker/docker-agent/pull/4138) - fix(leantui): support ctrl+a and ctrl+e
- [#4139](https://github.com/docker/docker-agent/pull/4139) - chore: bump stale model references to current-generation values
- [#4140](https://github.com/docker/docker-agent/pull/4140) - feat(shell): name PowerShell substitutes for the POSIX utilities models reach for
- [#4141](https://github.com/docker/docker-agent/pull/4141) - feat(shell): correct known shell-dialect errors in the tool output
- [#4142](https://github.com/docker/docker-agent/pull/4142) - feat: add get_environment_info read-only tool


## [v1.130.0] - 2026-09-01

This release expands the safety classifier coverage, improves skills handling, and adds new evaluation capabilities including assertions, verify scripts, and pass@k metrics.

## What's New

- Adds `assertions` schema and `verify` field to `EvalCriteria` for code-based grading checks against agent output
- Adds a verify script runner that executes a shell script via `docker exec` on the eval container after the agent completes
- Upgrades the relevance judge prompt with a rubric, chain-of-thought guidance, and anti-bias rules for more consistent evaluation judgments
- Exposes `pass@k` and `pass^k` metrics when using `--repeat` runs to quantify answer consistency across repetitions
- Adds PowerShell `Remove-Item` and `Clear-Content` patterns to the safety classifier
- Adds destructive SQL, app-CLI, and key-value-store patterns to the safety classifier
- Safely gates embedded skill commands, asking user permission before running commands embedded in skills
- Expands embedded commands in inline skills so they go through the normal approval path

## Bug Fixes

- Fixes flag-order variants for `docker system prune --volumes` and `compose down -v` in the safety classifier
- Fixes shell-metachar patterns to anchor on whitespace instead of word boundaries in the safety classifier
- Fixes safety classifier to use wildcards for flag-order and quoted-path gaps, and narrows SQL patterns
- Fixes inline skills to override discovered skills when the same name exists in both
- Fixes inline skill names to reject whitespace, preventing unreachable slash commands
- Stabilizes slash command description alignment in the TUI completion list

## Technical Changes

- Refreshes the embedded models.dev catalog snapshot
- Updates CI to run checks on pull requests targeting any base branch, not just `main`
### Pull Requests

- [#4075](https://github.com/docker/docker-agent/pull/4075) - ci: run ci and codeql checks on pull requests to any base branch
- [#4078](https://github.com/docker/docker-agent/pull/4078) - chore: refresh embedded models.dev snapshot
- [#4079](https://github.com/docker/docker-agent/pull/4079) - docs: update CHANGELOG.md for v1.129.0
- [#4080](https://github.com/docker/docker-agent/pull/4080) - chore: bump direct Go dependencies
- [#4081](https://github.com/docker/docker-agent/pull/4081) - safety: close four classifier coverage gaps
- [#4088](https://github.com/docker/docker-agent/pull/4088) - feat: add assertions schema to EvalCriteria for code-based grading
- [#4089](https://github.com/docker/docker-agent/pull/4089) - feat: add verify script runner for post-agent outcome verification
- [#4090](https://github.com/docker/docker-agent/pull/4090) - fix(tui): stabilize slash command description alignment
- [#4091](https://github.com/docker/docker-agent/pull/4091) - feat: upgrade relevance judge prompt with rubric, CoT, and anti-bias rules
- [#4092](https://github.com/docker/docker-agent/pull/4092) - feat: expose pass@k and pass^k metrics for --repeat runs
- [#4093](https://github.com/docker/docker-agent/pull/4093) - feat: safely gate embedded skill commands
- [#4094](https://github.com/docker/docker-agent/pull/4094) - fix(skills): let inline skills override discovered ones
- [#4095](https://github.com/docker/docker-agent/pull/4095) - fix(skills): reject whitespace in inline skill names
- [#4096](https://github.com/docker/docker-agent/pull/4096) - feat(skills): expand embedded commands in inline skills


## [v1.129.0] - 2026-08-31

This release adds MCP protocol revision support, names the resolved shell in environment info, and migrates the A2A server to adka2a v2.

## What's New
- Adds support for MCP protocol revision `2026-07-28`, including stateless Streamable HTTP transport, updated protocol negotiation, and rejection of unsupported keep-alive combinations for HTTP and attach modes
- Names the resolved shell in the environment info block so the model has explicit shell dialect context at the start of every session

## Technical Changes
- Migrates the A2A server from the deprecated `adka2a` compatibility shim to `adka2a/v2`, adapting artifact event normalization to the v2 iterator-based executor contract
- Delegates `shellBaseName` resolution to `shellpath.ShellBaseName` in the shell tools layer
### Pull Requests

- [#4041](https://github.com/docker/docker-agent/pull/4041) - chore(a2a): migrate from adka2a to adka2a/v2
- [#4044](https://github.com/docker/docker-agent/pull/4044) - feat(mcp): support protocol revision 2026-07-28
- [#4071](https://github.com/docker/docker-agent/pull/4071) - docs: update CHANGELOG.md for v1.128.0
- [#4072](https://github.com/docker/docker-agent/pull/4072) - hooks/builtins: name the resolved shell in the env block


## [v1.128.0] - 2026-08-28

This release adds a new file toolset, a configurable startup banner toggle, and several bug fixes including a GitHub MCP restart loop prevention and improved Code Mode partial startup handling. It also includes rendering performance improvements for long streamed responses.

## What's New

- Adds a `show_banner` setting to toggle the ASCII-art startup banner on or off, accessible via the Appearance tab in `/settings`
- Adds a `file` toolset exposing `read_file`, `write_file`, and `edit_file` with support for `allow_list`, `deny_list`, and `post_edit` configuration

## Improvements

- Optimizes rendering of long streamed responses by caching more aggressively and avoiding full re-renders on each new chunk
- Allows `/new [dir]` in the TUI to accept an optional working directory, resolving relative paths and validating directories before spawning a session
- Reuses an explicit `--working-dir` value when opening new sessions via `/new`, Ctrl+T, or new-tab buttons

## Bug Fixes

- Fixes Code Mode partial startup: preserves successfully started toolsets, omits failed ones, and retries failures on later turns
- Fixes terminal tool fade cache invalidation
- Fixes compaction state persistence to be atomic, so compacted sessions restore correctly on reload
- Fixes GitHub remote MCP server entering an endless reconnect loop after rejecting `subscriptions/listen`
- Replaces removed `deepseek-chat` model with `deepseek-v4-pro` as the default DeepSeek model

## Technical Changes

- Upgrades to Go 1.27.0 and applies Go 1.27 modernizations
- Migrates to OpenTelemetry SDK 1.45
- Replaces `sort.Slice` calls with `slices.SortFunc` across several packages
- Upgrades testify to v1.12.1
- Refreshes embedded models.dev catalog snapshot
### Pull Requests

- [#4008](https://github.com/docker/docker-agent/pull/4008) - fix(codemode): preserve tools after partial startup
- [#4013](https://github.com/docker/docker-agent/pull/4013) - docs: update CHANGELOG.md for v1.127.0
- [#4014](https://github.com/docker/docker-agent/pull/4014) - feat(tui): add a show/hide banner setting
- [#4015](https://github.com/docker/docker-agent/pull/4015) - chore: bump direct Go dependencies
- [#4034](https://github.com/docker/docker-agent/pull/4034) - chore: replace sort.Slice with slices.SortFunc
- [#4036](https://github.com/docker/docker-agent/pull/4036) - chore: upgrade to Go 1.27.0 and apply 1.27 modernizations
- [#4037](https://github.com/docker/docker-agent/pull/4037) - TUI - Optimize rendering of long streaming responses
- [#4038](https://github.com/docker/docker-agent/pull/4038) - docs: auto-update for merged PRs (2026-08-23)
- [#4040](https://github.com/docker/docker-agent/pull/4040) - chore: refresh embedded models.dev snapshot
- [#4042](https://github.com/docker/docker-agent/pull/4042) - fix(tui): reuse explicit working directory for new sessions
- [#4043](https://github.com/docker/docker-agent/pull/4043) - chore(test): upgrade testify to v1.12.1
- [#4045](https://github.com/docker/docker-agent/pull/4045) - chore: migrate to OpenTelemetry SDK 1.45
- [#4049](https://github.com/docker/docker-agent/pull/4049) - test(a2a): apply invocation context deltas in fake
- [#4050](https://github.com/docker/docker-agent/pull/4050) - fix(tui): allow overriding new session directory
- [#4051](https://github.com/docker/docker-agent/pull/4051) - docs(telemetry): document semconv v1.43 schema URL compatibility
- [#4056](https://github.com/docker/docker-agent/pull/4056) - docs: auto-update for merged PRs (2026-08-25)
- [#4057](https://github.com/docker/docker-agent/pull/4057) - chore: update docker-agent-action to v2.0.5
- [#4058](https://github.com/docker/docker-agent/pull/4058) - fix: replace removed deepseek-chat with deepseek-v4-pro
- [#4059](https://github.com/docker/docker-agent/pull/4059) - docs: auto-update for merged PRs (2026-08-26)
- [#4063](https://github.com/docker/docker-agent/pull/4063) - Fix terminal tool fade cache invalidation
- [#4064](https://github.com/docker/docker-agent/pull/4064) - Persist compaction atomically
- [#4069](https://github.com/docker/docker-agent/pull/4069) - fix(mcp): prevent GitHub restart loop
- [#4070](https://github.com/docker/docker-agent/pull/4070) - feat: add file toolset


## [v1.127.0] - 2026-08-21

This release delivers Desktop PAC-aware egress with SSRF protections, several runtime and toolset fixes, and documentation updates for served-agent safety controls.

## What's New

- Adds Desktop PAC-aware egress for configured HTTP clients while preserving standalone proxy behavior and SSRF protections, covering agent/source fetches, sessions, tools, MCP HTTP transports, and MCP OAuth flows

## Bug Fixes

- Fixes slow toolset startup from blocking conversation turns; keeps turns responsive when a toolset start is already in progress or exceeds the start budget
- Fixes `on_user_input` notifications firing incorrectly for sub-sessions, background agents, non-interactive runs, and canceled max-iteration waits — now only fires when an interactive root session is genuinely waiting for the next prompt
- Fixes Desktop PAC transport detection, routing, and state retention across multiple egress and transport handling regressions
- Fixes server to distinguish unavailable agent sources

## Technical Changes

- Extends Windows streaming TUI test timeouts to 30 seconds for simulated-stream scenarios
- Updates CLI reference documentation for `serve a2a` safety flags (`--auth-token`, `--cors-origin`, `--insecure-no-auth`, `--safety`)
- Adds documentation describing Desktop PAC egress controls and clarifying coverage for MCP OAuth and direct egress
- Makes Desktop transport tests hermetic
### Pull Requests

- [#3999](https://github.com/docker/docker-agent/pull/3999) - fix: add Desktop PAC-aware egress with SSRF protections
- [#4000](https://github.com/docker/docker-agent/pull/4000) - feat: harden served-agent safety controls
- [#4002](https://github.com/docker/docker-agent/pull/4002) - docs: update CHANGELOG.md for v1.126.0
- [#4003](https://github.com/docker/docker-agent/pull/4003) - docs: complete CLI reference for serve a2a safety flags
- [#4005](https://github.com/docker/docker-agent/pull/4005) - test(e2e): extend Windows streaming TUI timeouts
- [#4009](https://github.com/docker/docker-agent/pull/4009) - fix(tools): prevent slow startup from blocking turns
- [#4010](https://github.com/docker/docker-agent/pull/4010) - fix(runtime): avoid false on_user_input notifications
- [#4012](https://github.com/docker/docker-agent/pull/4012) - fix(runtime): scope harness prompt-selection to fresh vs resume session


## [v1.126.0] - 2026-08-18

This release adds evaluation regression gating, session comparison for replay, and significant hardening of served-agent safety controls across A2A, MCP HTTP, and chat surfaces.

## What's New

- Adds `--baseline` and `--regression-tolerance` flags to `docker agent eval`, enabling CI-style regression detection by comparing a run against a previously saved baseline and failing on quality regression
- Adds `docker agent sessions diff` command to compare the behavior of two recorded sessions, reporting the first point of divergence between runs
- Adds unattended tool execution restrictions for A2A, requiring explicit security configuration for network listeners
- Adds centralized unattended safety resolution for served agents, with ordered concrete safety policies and hardened HTTP serving for MCP and chat surfaces
- Adds session-origin isolation for A2A session resumes

## Bug Fixes

- Fixes the baseline gate to be grounded on the file that eval writes, and fails closed on error
- Fixes replay comparison to handle sub-agent turns, compare arguments semantically, and sanitize output
- Fixes A2A session resumes to be isolated by origin

## Technical Changes

- Refactors `sessions diff` CLI command to resolve session references
- Refactors safety flag validation to be shared across CLI surfaces
- Refactors HTTP auth and origin matchers into a shared `httpsec` package
- Refactors A2A server assembly, extracting it from `Run`
- Replaces `CAGENT_MODELS_GATEWAY` with `DOCKER_AGENT_MODELS_GATEWAY` in docs and samples
- Documents the evaluation regression gate and its two flags, the `docker agent sessions diff` command, and served-agent safety controls
### Pull Requests

- [#3946](https://github.com/docker/docker-agent/pull/3946) - feat(eval): compare a run against a saved baseline and fail on regression
- [#3948](https://github.com/docker/docker-agent/pull/3948) - feat(replay): compare the behaviour of two recorded sessions
- [#3995](https://github.com/docker/docker-agent/pull/3995) - docs: update CHANGELOG.md for v1.125.0
- [#3997](https://github.com/docker/docker-agent/pull/3997) - docs: replace CAGENT_MODELS_GATEWAY with DOCKER_AGENT_MODELS_GATEWAY in docs and samples
- [#4000](https://github.com/docker/docker-agent/pull/4000) - feat: harden served-agent safety controls


## [v1.125.0] - 2026-08-17

This release adds several new features including Docker token minting, structured output mode, restricted safety mode, and harness session resumption, alongside multiple bug fixes for file editing, caching, attachment handling, and OAuth flows.

## What's New

- Adds the ability to mint Docker tokens from the stored access token, enabling authentication without Docker Desktop running (`feat(auth): mint Docker tokens from the stored access token`)
- Adds a tool-based structured output mode as an opt-in alternative to native structured output (`feat: add tool-based structured output mode`)
- Adds a restricted safety mode for unattended and headless runs, allowing classifier-safe calls while denying unmatched destructive or unknown calls without prompting (`feat(safety): add restricted mode for unattended runs`)
- Adds the ability to resume external harness sessions on later turns instead of starting a new session each time (`feat(runtime): resume external harness sessions`)
- Includes session cost in session summaries (`feat: include cost in session summaries`)

## Bug Fixes

- Fixes a path containment bug in VCS ignore logic where a repository root like `/work/repo` incorrectly matched sibling paths like `/work/repo-sibling` (`fix(pkg/fsx/vcs.go)`)
- Fixes `edit_file` silently prepending content when `oldText` is empty; empty `oldText` is now refused (`fix(acp): refuse edit_file edits with an empty oldText`)
- Fixes a file backend cache bug where entries written by a sibling process remained invisible to `Lookup` indefinitely (`fix(pkg/cache/cache.go)`)
- Fixes attachment content being able to close its own envelope delimiter, and labels the region as untrusted to prevent content injection (`fix(attachment): stop attachment content from closing its own envelope`)
- Fixes a self-closing envelope delimiter bypass in attachment handling (`fix(attachment): defuse the self-closing envelope delimiter too`)
- Fixes malformed tool call names (e.g. attribute-style syntax hallucinated by a model) being persisted to session, which caused non-retriable errors on replay (`fix(runtime): sanitize malformed tool call names before persisting to session`)
- Fixes standalone OAuth login discovery to correctly forward remote metadata, match names/URLs exactly, and use authoritative challenge metadata (`fix(mcp): repair standalone OAuth login discovery`)
- Fixes standalone OAuth login to honor `CallbackPort` and `CallbackRedirectURL` configuration, matching the behavior of the managed OAuth flow (`fix(mcp): honor callback configuration in standalone OAuth login`)
- Fixes the TUI not retaining the interrupt confirmation setting across restarts and page rebuilds (`fix(tui): retain interrupt confirmation setting`)

## Technical Changes

- Refactors MCP protected resource metadata discovery into a shared helper to eliminate duplication between managed and unmanaged OAuth flows (`refactor(mcp): share protected resource metadata discovery`)
- Propagates OAuth scopes through dynamic registration in MCP (`fix(mcp): propagate OAuth scopes through dynamic registration`)
- Isolates `pkg/runtime` tests from the real user config directory to prevent local settings from affecting test outcomes (`test(runtime): isolate pkg/runtime tests from the real user config`)
- Refreshes the embedded models.dev catalog snapshot (`chore: refresh embedded models.dev snapshot`)
### Pull Requests

- [#3923](https://github.com/docker/docker-agent/pull/3923) - fix(fsx): test repository containment on a path boundary, not a string prefix
- [#3926](https://github.com/docker/docker-agent/pull/3926) - fix(filesystem): refuse edit_file edits with an empty oldText
- [#3928](https://github.com/docker/docker-agent/pull/3928) - fix(cache): adopt the on-disk state read during `Store`, not just its mtime
- [#3935](https://github.com/docker/docker-agent/pull/3935) - feat(auth): mint Docker tokens from the stored access token
- [#3942](https://github.com/docker/docker-agent/pull/3942) - fix(attachment): stop attachment content from closing its own envelope, and label the region untrusted
- [#3955](https://github.com/docker/docker-agent/pull/3955) - refactor(mcp): share protected resource metadata discovery
- [#3959](https://github.com/docker/docker-agent/pull/3959) - fix(mcp): repair standalone OAuth login discovery
- [#3964](https://github.com/docker/docker-agent/pull/3964) - docs: update CHANGELOG.md for v1.124.0
- [#3966](https://github.com/docker/docker-agent/pull/3966) - feat: add tool-based structured output mode
- [#3969](https://github.com/docker/docker-agent/pull/3969) - docs: auto-update for merged PRs (2026-08-13)
- [#3970](https://github.com/docker/docker-agent/pull/3970) - feat(safety): add restricted mode for unattended runs
- [#3972](https://github.com/docker/docker-agent/pull/3972) - docs: remove internal issue/PR references from plan tool page
- [#3973](https://github.com/docker/docker-agent/pull/3973) - docs: add missing built-in tools to concepts overview
- [#3974](https://github.com/docker/docker-agent/pull/3974) - fix(runtime): sanitize malformed tool call names before persisting to session
- [#3979](https://github.com/docker/docker-agent/pull/3979) - test(mcp): make OAuth browser launch injectable across platforms
- [#3980](https://github.com/docker/docker-agent/pull/3980) - chore(deps): update reviewed Go dependencies
- [#3981](https://github.com/docker/docker-agent/pull/3981) - test(runtime): isolate user config in tests
- [#3987](https://github.com/docker/docker-agent/pull/3987) - fix(mcp): honor callback configuration in standalone OAuth login
- [#3989](https://github.com/docker/docker-agent/pull/3989) - feat(runtime): resume external harness sessions
- [#3990](https://github.com/docker/docker-agent/pull/3990) - docs: auto-update for merged PRs (2026-08-16)
- [#3991](https://github.com/docker/docker-agent/pull/3991) - feat: include cost in session summaries
- [#3992](https://github.com/docker/docker-agent/pull/3992) - chore: refresh embedded models.dev snapshot
- [#3994](https://github.com/docker/docker-agent/pull/3994) - fix(tui): retain interrupt confirmation setting


## [v1.124.0] - 2026-08-10

This release adds LaTeX rendering and a startup banner to the TUI, introduces a configurable request size limit for the API server, and includes security fixes for session working directory path traversal.

## What's New

- Adds LaTeX-to-Unicode rendering for inline and display math in TUI markdown
- Adds a startup banner to the normal TUI, shown as a centered empty state when no welcome message is configured
- Adds a configurable `--max-request-size` flag to `serve api`, allowing the HTTP request size limit to be adjusted (default remains 1 MiB; requests exceeding the limit return HTTP 413)
- Adds concurrency-safe, namespaced string attributes to sessions, persisted in SQLite and preserved across JSON round trips, metadata updates, clones, branches, and derived sessions

## Bug Fixes

- Fixes path traversal vulnerability in API session working directories by rejecting traversal, sibling-directory, and symlink escapes when a `--session-workingdir-root` boundary is configured
- Fixes startup banner display in small viewports by hiding it when the viewport is too small
- Fixes startup banner ordering to appear before startup info
- Fixes TUI markdown rendering to preserve content after unclosed math expressions
- Fixes TUI matrix rendering to display columns without separators
- Updates gopher example files to reference `gemini-3.1-pro-preview` after `gemini-3-pro-preview` was removed from the model catalog

## Technical Changes

- Migrates Docker Hub push jobs in CI from PAT-based login to short-lived OIDC tokens
- Uses TypeScript types for codemode
### Pull Requests

- [#3916](https://github.com/docker/docker-agent/pull/3916) - fix(server): contain API session working directories
- [#3931](https://github.com/docker/docker-agent/pull/3931) - docs: update CHANGELOG.md for v1.123.0
- [#3932](https://github.com/docker/docker-agent/pull/3932) - ci: migrate Hub logins to OIDC
- [#3938](https://github.com/docker/docker-agent/pull/3938) - feat(api): add configurable --max-request-size flag to serve api
- [#3949](https://github.com/docker/docker-agent/pull/3949) - feat: add startup banner to normal TUI
- [#3950](https://github.com/docker/docker-agent/pull/3950) - feat(tui): render LaTeX in markdown
- [#3953](https://github.com/docker/docker-agent/pull/3953) - docs: auto-update for merged PRs (2026-08-07)
- [#3954](https://github.com/docker/docker-agent/pull/3954) - chore(deps): bump google.golang.org/grpc from 1.81.1 to 1.82.1 in the go_modules group across 1 directory
- [#3956](https://github.com/docker/docker-agent/pull/3956) - Use typescript types for codemode
- [#3958](https://github.com/docker/docker-agent/pull/3958) - feat: persist generic session attributes
- [#3961](https://github.com/docker/docker-agent/pull/3961) - fix: update gopher examples to gemini-3.1-pro-preview (model removed from catalog)
- [#3963](https://github.com/docker/docker-agent/pull/3963) - docs: clarify request-size limits and large input strategies


## [v1.123.0] - 2026-08-06

This release adds Alt+Enter follow-up messaging in the TUI and session recovery error exports, along with several bug fixes for Windows reliability and context overflow messaging.

## What's New

- Adds Alt+Enter keyboard shortcut to submit follow-up messages in both the full TUI and lean TUI, with attachment preservation and pending follow-up display
- Includes recorded errors in the session recovery export

## Bug Fixes

- Fixes a status race condition and subprocess pipe hang in background jobs
- Fixes `promote()` retry on Windows when an `ACCESS_DENIED` error occurs during kit rename operations
- Makes the context overflow error message frontend-agnostic, removing references to `/compact` that are not applicable to all consumers

## Technical Changes

- Updates test for torn-file concurrency to tolerate Windows file sharing violations
- Clarifies sandbox documentation to reflect `sbx` integration and removes references to the retired `docker sandbox` CLI path
### Pull Requests

- [#3833](https://github.com/docker/docker-agent/pull/3833) - fix(backgroundjobs): resolve status race condition and subprocess pipe hang
- [#3911](https://github.com/docker/docker-agent/pull/3911) - feat(shell): name the resolved interpreter in the shell tool description
- [#3912](https://github.com/docker/docker-agent/pull/3912) - feat(filesystem): say when list_directory finds an empty directory
- [#3915](https://github.com/docker/docker-agent/pull/3915) - docs: update CHANGELOG.md for v1.122.0
- [#3917](https://github.com/docker/docker-agent/pull/3917) - fix(kit): retry promote() retire-rename on Windows ACCESS_DENIED
- [#3918](https://github.com/docker/docker-agent/pull/3918) - feat(tui): add Alt+Enter follow-up messages
- [#3919](https://github.com/docker/docker-agent/pull/3919) - docs: auto-update for merged PRs (2026-08-06)
- [#3920](https://github.com/docker/docker-agent/pull/3920) - fix: frontend-agnostic context overflow message, export recorded errors for recovery
- [#3921](https://github.com/docker/docker-agent/pull/3921) - test(cache): fix Windows flake in the torn-file concurrency test
- [#3924](https://github.com/docker/docker-agent/pull/3924) - docs: clarify sbx sandbox integration


## [v1.122.0] - 2026-08-05

This release delivers a set of bug fixes and improvements across filesystem handling, the TUI, shell tooling, and cross-platform compatibility.

## What's New
- Adds the resolved interpreter name to the shell tool description so the model knows which shell will execute commands
- Adds an explicit message when `list_directory` finds an empty directory, distinguishing an empty result from a tool failure
- Adds configurable interrupt confirmation for the Esc key, supporting `always` (confirmation dialog), `double-tap` (press twice), or `none` (immediate interruption) modes

## Bug Fixes
- Fixes cross-platform root directory detection and fallback paths in TUI file and directory pickers, ensuring correct behavior on Windows
- Fixes support for path-scoped glob patterns (e.g. `pkg/*.go`) in post-edit hooks by matching against full relative paths instead of just the base filename
- Fixes a deadlock in the RAG file watcher that could occur when `Start` fails and `Stop` is subsequently called
- Fixes malformed inner JSON in double-serialized `edit_file` payloads, handling the case where both double-serialization and brace-counting errors occur together
- Fixes stream cancellation state being lost after automatic compaction completes mid-run in the TUI
- Fixes agent security and linting issues including goroutine leak prevention in RAG toolset and environment handling improvements
### Pull Requests

- [#3792](https://github.com/docker/docker-agent/pull/3792) - fix: resolve POSIX path handling and test failures on Windows
- [#3795](https://github.com/docker/docker-agent/pull/3795) - fix(tui): resolve cross-platform root detection and fallback paths in pickers
- [#3831](https://github.com/docker/docker-agent/pull/3831) - fix: agent security and linting improvements
- [#3899](https://github.com/docker/docker-agent/pull/3899) - feat(tui): configurable interrupt confirmation for Esc key
- [#3908](https://github.com/docker/docker-agent/pull/3908) - feat(filesystem): fail fast on foreign-OS paths and explain path resolution
- [#3909](https://github.com/docker/docker-agent/pull/3909) - docs: auto-update for merged PRs (2026-08-05)
- [#3910](https://github.com/docker/docker-agent/pull/3910) - docs: update CHANGELOG.md for v1.121.0
- [#3911](https://github.com/docker/docker-agent/pull/3911) - feat(shell): name the resolved interpreter in the shell tool description
- [#3912](https://github.com/docker/docker-agent/pull/3912) - feat(filesystem): say when list_directory finds an empty directory
- [#3913](https://github.com/docker/docker-agent/pull/3913) - fix(filesystem): repair malformed inner JSON in double-serialized edits
- [#3914](https://github.com/docker/docker-agent/pull/3914) - fix(tui): preserve stream cancellation after compaction


## [v1.121.0] - 2026-08-05

This release brings several bug fixes and new features including configurable interrupt confirmation for the Esc key, ranged file reads, and improvements to safety classification and filesystem path handling.

## What's New

- Adds configurable interrupt confirmation for the Esc key: choose `always` (default, shows a dialog) or `double-tap` (requires pressing Esc twice) to interrupt a running stream
- Adds optional `line` and `limit` arguments to `read_file` for ranged file reads, enabling partial reads of large files
- Adds `--container-runtime` flag to evaluations, allowing an alternative Docker-compatible CLI (e.g. Podman) to be used for image builds and container runs
- Broadens the destructive-command taxonomy in the shell safety classifier to cover additional command shapes (e.g. bare `docker rm <id>`)
- Adds fail-fast detection of foreign-OS paths (e.g. WSL-style paths on Windows) in filesystem tools, with an explanation of path resolution
- Adds signed-commit checking (Rules 4 and 5) to the `triage-prs` skill, flagging unsigned or invalid commits and managing the `status/needs-signed-commits` label

## Bug Fixes

- Fixes SSE stream truncation when tool results exceed 64 KiB, which previously caused runs to silently stop
- Fixes the `--models-gateway` flag being ignored when creating the DMR provider client, causing failures in environments where the gateway is the only reachable path
- Fixes cache entries not expiring when the current time exactly equals their expiry deadline, preventing stale reuse on coarse-resolution clocks (e.g. Windows)
- Fixes self-update failure by reading and validating the GitHub release asset SHA-256 digest before downloading, instead of looking for a missing `checksums.txt`

## Technical Changes

- Replaces `arduino/setup-task` with the official `go-task/setup-task` action in CI workflows
- Grants `actions: write` permission to the PR review workflow, restoring PR review runs that were failing during workflow validation
- Refreshes the embedded models.dev catalog snapshot
### Pull Requests

- [#3875](https://github.com/docker/docker-agent/pull/3875) - fix(dmr): honor the models gateway when creating the client
- [#3878](https://github.com/docker/docker-agent/pull/3878) - feat(tui): make current session plans editable
- [#3883](https://github.com/docker/docker-agent/pull/3883) - fix(runtime): don't truncate the SSE stream on tool results >64 KiB
- [#3888](https://github.com/docker/docker-agent/pull/3888) - chore: refresh embedded models.dev snapshot
- [#3891](https://github.com/docker/docker-agent/pull/3891) - docs: update CHANGELOG.md for v1.120.0
- [#3892](https://github.com/docker/docker-agent/pull/3892) - chore: replace arduino/setup-task with go-task/setup-task
- [#3894](https://github.com/docker/docker-agent/pull/3894) - feat(eval): support configurable container runtime
- [#3895](https://github.com/docker/docker-agent/pull/3895) - fix(filesystem): support ranged file reads
- [#3896](https://github.com/docker/docker-agent/pull/3896) - fix(skills): expire cache entries at deadline
- [#3897](https://github.com/docker/docker-agent/pull/3897) - fix(selfupdate): verify GitHub release asset digests
- [#3898](https://github.com/docker/docker-agent/pull/3898) - fix(ci): grant PR reviewer actions write permission
- [#3899](https://github.com/docker/docker-agent/pull/3899) - feat(tui): configurable interrupt confirmation for Esc key
- [#3902](https://github.com/docker/docker-agent/pull/3902) - docs: auto-update for merged PRs (2026-08-04)
- [#3903](https://github.com/docker/docker-agent/pull/3903) - feat: flag unsigned commits in triage-prs skill
- [#3905](https://github.com/docker/docker-agent/pull/3905) - fix(runtime): guard nested agent delegation
- [#3907](https://github.com/docker/docker-agent/pull/3907) - feat(safety): broaden destructive-command taxonomy
- [#3908](https://github.com/docker/docker-agent/pull/3908) - feat(filesystem): fail fast on foreign-OS paths and explain path resolution


## [v1.120.0] - 2026-08-03

This release improves Windows compatibility across the full test suite, adds new TUI features for context compaction and session plan editing, and fixes several platform-specific and sandbox issues.

## What's New

- Adds compaction summary display to the `/context` dialog, showing the verbatim summary text when a session has been compacted
- Makes the current session plan editable from the `/plans` browser and detail views, labeling it as `current session` and distinguishing it from shared workspace-global plans

## Bug Fixes

- Fixes external editors (e.g., Vim) not attaching to the real terminal when editing a plan in sandbox mode
- Fixes sandbox plan editor to use the available `C.UTF-8` locale, preserving non-ASCII (e.g., German) input
- Fixes `HOME` environment variable handling to be honored correctly across platforms
- Fixes Windows executable support in tool installation
- Fixes handling of Windows file URIs in the LSP implementation
- Fixes Windows home directory path normalization
- Logs and recovers from empty or failed Docker Desktop token fetches, rather than silently discarding the error

## Technical Changes

- Runs the full Go test suite natively on Windows as a blocking CI gate
- Consolidates Windows test jobs and uses the Task-based test entry point consistently across platforms
- Adds portable filesystem expectations and Windows-specific shell behavior tests
### Pull Requests

- [#3866](https://github.com/docker/docker-agent/pull/3866) - ci: run full test suite on Windows
- [#3868](https://github.com/docker/docker-agent/pull/3868) - docs: update CHANGELOG.md for v1.119.0
- [#3876](https://github.com/docker/docker-agent/pull/3876) - fix: preserve terminal and UTF-8 in sandbox plan editor
- [#3877](https://github.com/docker/docker-agent/pull/3877) - feat(tui): show compaction summary in context dialog
- [#3878](https://github.com/docker/docker-agent/pull/3878) - feat(tui): make current session plans editable
- [#3880](https://github.com/docker/docker-agent/pull/3880) - docs: auto-update for merged PRs (2026-08-01)
- [#3890](https://github.com/docker/docker-agent/pull/3890) - desktop: log and recover empty or failed token fetches


## [v1.119.0] - 2026-07-30

This release introduces first-class plan management with a new CLI command group and TUI browser, adds YAML safety mode defaults, and includes several bug fixes for runtime stability and structured output handling.

## What's New

- Adds `docker agent plans` CLI command group and a host-facing plan service package for managing plans from outside the agent runtime
- Adds a `/plans` browser, detail view, and action dialogs to the TUI for interactive plan management
- Adds YAML safety mode defaults to team runtime, individual agents, user settings, and aliases, with declarative precedence rules
- Adds an `Active agents only` option in TUI settings to filter the sidebar to agents participating in the current session
- Logs a warning when Docker Desktop serves an expired token to the models gateway

## Bug Fixes

- Fixes runtime re-entry loop when a content-only turn ends with a bare EOF and no `finish_reason` from the provider
- Fixes structured output handling for Claude models served through OpenAI-compatible endpoints by reinforcing schema constraints in system instructions
- Fixes evaluation budget termination outcomes so `budget_exceeded` results are preserved correctly across transcripts, SQLite, and session JSON
- Hardens host plan management and stabilizes asynchronous TUI workflows for plans
- Fixes atomic file replacement on Windows to allow plan storage reads during open file operations

## Technical Changes

- Exports `ValidateName`, `CorruptPlanError`, `SharedStorage`, and `ChangeNotifier` from the plan package
- Adds `PlanChangedEvent` emission on shared plan mutations in the runtime
- Centralizes plan editor handling in the TUI
- Adds plan storage testing on Windows as a CI gate
- Adds documentation for the Provider Credentials section in eval containers, clarifying `GITHUB_TOKEN` forwarding behavior
### Pull Requests

- [#3669](https://github.com/docker/docker-agent/pull/3669) - fix(runtime): stop content-only turns that end with a bare EOF (no `finish_reason`)
- [#3844](https://github.com/docker/docker-agent/pull/3844) - Merge pull request #3853 from docker/feat/host-plan-management-3844
- [#3853](https://github.com/docker/docker-agent/pull/3853) - feat: add first-class host UX for plan management (#3844)
- [#3857](https://github.com/docker/docker-agent/pull/3857) - docs: explain GITHUB_TOKEN forwarding for eval containers
- [#3860](https://github.com/docker/docker-agent/pull/3860) - feat(config): add YAML safety mode defaults
- [#3861](https://github.com/docker/docker-agent/pull/3861) - docs: update CHANGELOG.md for v1.118.0
- [#3862](https://github.com/docker/docker-agent/pull/3862) - fix(eval): preserve budget termination outcomes
- [#3863](https://github.com/docker/docker-agent/pull/3863) - fix(openai): reinforce structured output for Claude proxies
- [#3864](https://github.com/docker/docker-agent/pull/3864) - feat(tui): filter sidebar to active agents
- [#3865](https://github.com/docker/docker-agent/pull/3865) - fix(plans): address review follow-ups from #3853
- [#3867](https://github.com/docker/docker-agent/pull/3867) - feat(desktop): log when Docker Desktop serves an expired token


## [v1.118.0] - 2026-07-28

This release brings TUI animation infrastructure improvements, several bug fixes for session isolation, credential security, and model discovery, plus a new desktop token staleness logging feature.

## What's New

- Adds a program-scoped animation runtime to the TUI, centralizing spinners, durations, and transitions for more consistent and robust animations
- Adds token staleness logging when Docker Desktop refresh recovery fails, promoting failure paths to Warn/Info level for better observability

## Improvements

- Bounds progressive Markdown rendering in the TUI, enabling segmented output that avoids repeatedly re-processing completed blocks
- Adopts the program-scoped animation runtime across TUI animation consumers, migrating to elapsed-time updates and dirty-tick-driven root-view caching
- Compacts detailed sidebar metrics in the TUI to adapt to available width, using short forms (`Eff`, `Ctx`, `Cost`) at constrained widths and restoring full labels and gauges when space allows

## Bug Fixes

- Fixes concurrent `LoadWithConfig` calls from sharing a working directory, preventing sessions from observing each other's working directory under concurrent load
- Fixes duplicated text in GitHub Copilot responses by deduplicating streamed content tracked by both item ID and `output_index`
- Unifies gateway model discovery between `docker agent models` and the interactive `/model` picker so that a non-empty `/v1/models` response is the source of truth
- Fixes safety modes (autonomous, legacy approval, YOLO state) not being preserved across session flows and `/new` transitions
- Fixes credential leaks in remote tool transports (MCP and A2A) by restricting bearer tokens and custom headers to requests whose origin matches the transport's configured origin

## Technical Changes

- Removes unused dead TUI code including an unused lean TUI transcript reset method, package-level animation registration shim, and user-theme existence helper
### Pull Requests

- [#3836](https://github.com/docker/docker-agent/pull/3836) - chore: remove dead TUI code
- [#3838](https://github.com/docker/docker-agent/pull/3838) - docs: update CHANGELOG.md for v1.117.0
- [#3842](https://github.com/docker/docker-agent/pull/3842) - fix: prevent concurrent LoadWithConfig calls from sharing working dir
- [#3843](https://github.com/docker/docker-agent/pull/3843) - TUI - Program-scoped animation runtime
- [#3846](https://github.com/docker/docker-agent/pull/3846) - fix(openai): deduplicate Copilot response text
- [#3847](https://github.com/docker/docker-agent/pull/3847) - fix(models): unify gateway model discovery
- [#3848](https://github.com/docker/docker-agent/pull/3848) - fix: preserve safety modes across session flows
- [#3850](https://github.com/docker/docker-agent/pull/3850) - fix: prevent credential leaks in remote tool transports
- [#3851](https://github.com/docker/docker-agent/pull/3851) - TUI - enable segmented markdown rendering
- [#3852](https://github.com/docker/docker-agent/pull/3852) - chore: update docker-agent-action to v2.0.3
- [#3854](https://github.com/docker/docker-agent/pull/3854) - chore: bump direct go dependencies
- [#3855](https://github.com/docker/docker-agent/pull/3855) - Adopt program-scoped animation runtime
- [#3858](https://github.com/docker/docker-agent/pull/3858) - fix(tui): compact detailed sidebar metrics
- [#3859](https://github.com/docker/docker-agent/pull/3859) - feat(desktop): log token staleness when refresh recovery fails


## [v1.117.0] - 2026-07-27

This release adds support for Claude Opus 5 and introduces a new three-mode safety policy system for tool approval control.

## What's New
- Adds support for Claude Opus 5 (released 2026-07-24, 1M context window, 128k output)
- Adds a three-mode safety policy (strict / balanced / autonomous) with native shell classification, providing a middle ground between per-call approval and blanket session-wide approval

## Technical Changes
- Refreshes the embedded models.dev catalog snapshot to 2026-07-24
### Pull Requests

- [#3828](https://github.com/docker/docker-agent/pull/3828) - docs: update CHANGELOG.md for v1.116.0
- [#3830](https://github.com/docker/docker-agent/pull/3830) - feat: support Claude Opus 5
- [#3834](https://github.com/docker/docker-agent/pull/3834) - chore: refresh embedded models.dev snapshot
- [#3835](https://github.com/docker/docker-agent/pull/3835) - feat: three-mode safety policy (strict / balanced / autonomous) with native shell classification


## [v1.116.0] - 2026-07-24

This release adds sandbox authentication improvements, compaction-model context visibility in the TUI, MCP lifecycle enforcement, and a range of bug fixes across the TUI, CLI, and OpenAI integration.

## What's New

- Adds `sbx-login` injection for gateway authentication in sandbox environments, replacing the previous file-based token-forwarding mechanism
- Defaults sandbox creation to the `docker/docker-agent-sbx-templates:latest` template
- Creates sandboxes under the canonical `docker-agent` name
- Makes `oauth clientId` optional for remote MCP toolsets, supporting Dynamic Client Registration and interactive credential flows
- Surfaces the compaction-model context-limit cap explicitly in the `/context` dialog and sidebar, so users can see when a dedicated compaction model is imposing a smaller context window than the primary model
- Adds segment-aware click detection on the sidebar Token Usage reading: clicking the token count/percentage opens `/context`, clicking the cost/`⚠ capped` area opens `/cost`; the "Token Usage" title is no longer clickable
- Enforces `lifecycle.call_timeout` for MCP tool calls, which was previously parsed but never acted on
- Exposes spawned TUI tabs (opened with ctrl+t) on the `--listen` control plane so control-plane clients can observe all active sessions
- Adds GitHub Copilot to `docker agent setup` and `doctor`, recognizing both `GITHUB_TOKEN` and `GH_TOKEN`

## Bug Fixes

- Fixes copy buttons rendering in contexts where they were never wired up for hit-testing (reasoning blocks, elicitation dialogs, lean TUI, shell output, welcome messages)
- Fixes the "copied" flash background on user-message copy labels, which previously rendered with a transparent background
- Fixes mouse hit-testing falling out of sync when layout shifts without a terminal resize (e.g., after loading a past session with `/session`)
- Fixes an infinite loop in `backgroundAt` when encountering invalid UTF-8 bytes
- Fixes capability handlers (OAuth elicitation, etc.) not being forwarded to inner toolsets when `code_mode_tools: true` is set
- Fixes data races in deferred tools and the BM25 RAG strategy, and prevents a TUI editor panic
- Fixes wrapped URLs losing their clickability in tool output
- Fixes the `⚠ capped` marker on the sidebar opening `/cost` instead of `/context`
- Fixes `docker agent debug` not appearing in the root help output
- Fixes `docker agent setup` provider path labels to clarify built-in cloud providers vs. custom OpenAI-compatible endpoints
- Fixes OpenAI Responses API function arguments not being recovered when providers omit `response.function_call_arguments.delta`

## Technical Changes

- Refactors sandbox integration to assume the modern CLI surface shared by both backends
- Removes all references to the discontinued `agentcatalog` Docker Hub namespace, replacing examples with neutral `myorg/agent` placeholders
- Freezes config schema v14 and advances `latest` to v15
- Refactors board internals: deduplicates column lookup with a `columnIndexLocked` helper, deduplicates stored-project access with a `projectsLocked` helper, and consolidates per-card controller state into a single `cardState` map
### Pull Requests

- [#3767](https://github.com/docker/docker-agent/pull/3767) - fix(permissions): keep colons in argument values from truncating patterns
- [#3782](https://github.com/docker/docker-agent/pull/3782) - feat(server): resolve agent-switch slash commands in RunSession
- [#3789](https://github.com/docker/docker-agent/pull/3789) - fix(tui): never render dead code-block copy buttons
- [#3790](https://github.com/docker/docker-agent/pull/3790) - docs: update CHANGELOG.md for v1.115.0
- [#3791](https://github.com/docker/docker-agent/pull/3791) - sandbox: rely on sbx-login injection for gateway auth, modern sandbox CLI surface
- [#3793](https://github.com/docker/docker-agent/pull/3793) - fix(cli): add GitHub Copilot to setup and doctor
- [#3794](https://github.com/docker/docker-agent/pull/3794) - docs: update slash command and permission pattern docs for recent changes
- [#3796](https://github.com/docker/docker-agent/pull/3796) - feat(config): make oauth clientId optional for remote MCP toolsets
- [#3797](https://github.com/docker/docker-agent/pull/3797) - fix(tui): keep copy label background under "copied" flash
- [#3798](https://github.com/docker/docker-agent/pull/3798) - fix(tui): keep mouse hit-testing in sync when the layout shifts without a resize
- [#3799](https://github.com/docker/docker-agent/pull/3799) - fix(tui): guard backgroundAt against infinite loop on invalid UTF-8
- [#3801](https://github.com/docker/docker-agent/pull/3801) - chore: bump direct Go dependencies
- [#3804](https://github.com/docker/docker-agent/pull/3804) - chore: remove every trace of the discontinued agent catalog
- [#3807](https://github.com/docker/docker-agent/pull/3807) - feat(config): freeze config v14 and start v15 as latest
- [#3809](https://github.com/docker/docker-agent/pull/3809) - fix(codemode): forward capability handlers to inner toolsets
- [#3810](https://github.com/docker/docker-agent/pull/3810) - docs: improve Ollama and local models discoverability
- [#3811](https://github.com/docker/docker-agent/pull/3811) - feat(tui): surface compaction-model context-limit cap in the TUI
- [#3812](https://github.com/docker/docker-agent/pull/3812) - docs: auto-update for merged PRs (2026-07-23)
- [#3813](https://github.com/docker/docker-agent/pull/3813) - feat(tui): open /context or /cost from the sidebar token-usage reading
- [#3814](https://github.com/docker/docker-agent/pull/3814) - feat: enforce lifecycle.call_timeout for MCP tool calls
- [#3815](https://github.com/docker/docker-agent/pull/3815) - docs: auto-update for merged PRs (2026-07-24)
- [#3816](https://github.com/docker/docker-agent/pull/3816) - chore: bump direct Go dependencies
- [#3817](https://github.com/docker/docker-agent/pull/3817) - refactor(board): simplify app and controller internals
- [#3819](https://github.com/docker/docker-agent/pull/3819) - feat(run): expose spawned TUI tabs on the --listen control plane
- [#3822](https://github.com/docker/docker-agent/pull/3822) - fix: resolve data races in deferred tools and BM25 strategy, prevent TUI editor panic
- [#3823](https://github.com/docker/docker-agent/pull/3823) - fix(tui): keep wrapped URLs clickable
- [#3824](https://github.com/docker/docker-agent/pull/3824) - fix(setup): clarify model provider paths
- [#3825](https://github.com/docker/docker-agent/pull/3825) - fix(openai): recover final response tool arguments
- [#3826](https://github.com/docker/docker-agent/pull/3826) - fix(tui): open /context (not /cost) when clicking the ⚠ capped marker
- [#3827](https://github.com/docker/docker-agent/pull/3827) - fix(cli): show debug command in help


## [Unreleased]

- Harden served-agent safety and network controls:
  - A2A, MCP HTTP, and chat now default to restricted tool safety; autonomous execution requires `--safety autonomous`, and `safety: autonomous` in YAML fails startup with guidance to use that flag.
  - Non-loopback listeners require authentication or `--insecure-no-auth`; Unix sockets remain exempt. A2A and MCP HTTP use `--auth-token`, while chat continues to use `--api-key`; A2A and chat can explicitly allow browser origins with `--cors-origin`.
  - A2A context IDs cannot access sessions created by another serve surface. The session-schema migration records session origins; older binaries reject upgraded databases with a newer-database error.
  - `mcp.CreateToolHandler` now requires an explicit safety policy.

## What's New

- Splits the sidebar's Token Usage click target in two: clicking the token/context part (glyph, token count, context `%`, the "compacting…" marker, or the `⚠ capped` marker) opens the `/context` dialog, while clicking the cost part (`$` figure, sub-session count) keeps opening `/cost`; the "Token Usage" section title is no longer clickable


## [v1.115.0] - 2026-07-22

This release fixes permission pattern parsing for colon-containing values, adds provider-level compaction model defaults, resolves agent-switch slash commands over HTTP, and includes several bug fixes and refactors.

## What's New

- Adds `X-Cagent-Compacting: 1` HTTP header on session-compaction LLM calls to allow gateway-side policies to distinguish compaction calls from regular chat completions
- Adds support for provider-level `compaction_model` default, so agents sharing a provider no longer need to repeat the setting individually
- Adds an optional `description` field to model config entries for human-readable annotations
- Resolves agent-switch slash commands in `RunSession` for HTTP/REST clients, enabling mid-session agent switches without requiring the two-segment route

## Bug Fixes

- Fixes permission pattern parsing where colons in argument values (e.g. URLs or Windows drive paths) caused patterns to be silently truncated, resulting in `deny` rules never firing
- Fixes A2A tool silently succeeding when a sub-agent stream returns empty; also resolves cross-platform test instability on Windows
- Fixes `compaction_model` references not being resolved during `first_available` reachability checks and environment preflight
- Fixes model description not being preserved across `first_available` resolution and shorthand marshalling
- Fixes agent-switch pre-switch command resolution and rolls back partial switches on failure
- Fixes TUI history-search input not being restyled when a live theme change occurs, leaving stale styling after switching themes
- Fixes `GatewayHTTPOptions` panicking when model options are nil
- Reverts a `WorkingDir` containment check that broke callers running docker-agent as a long-lived daemon pointing sessions at arbitrary paths

## Technical Changes

- Fixes log-injection (CodeQL `go/log-injection`) in `pkg/telemetry/client.go` by replacing string concatenation with structured key-value logging
- Sanitizes string arguments to close remaining log-injection taint paths and closes unbarriered passthrough in `sanitizeLogArgs`
- Refactors permission pattern parsing to use `strings.Cut` and then a regexp-based approach replacing the hand-rolled colon scanner
- Moves Desktop proxy HTTP transport to a new leaf package `pkg/desktop/transport`
- Moves Vertex AI support to `anthropic/vertex` subpackage to reduce transitive dependencies for library consumers
### Pull Requests

- [#94](https://github.com/docker/docker-agent/pull/94) - fix(codeql): sanitize string args to break remaining go/log-injection taint paths
- [#3745](https://github.com/docker/docker-agent/pull/3745) - fix: A2A response error handling and cross-platform test stability
- [#3755](https://github.com/docker/docker-agent/pull/3755) - fix(codeql): go/log-injection in pkg/telemetry/client.go:24
- [#3758](https://github.com/docker/docker-agent/pull/3758) - fix(codeql): go/path-injection in pkg/server/session_manager.go:542
- [#3764](https://github.com/docker/docker-agent/pull/3764) - feat: support Mermaid state diagram directions
- [#3767](https://github.com/docker/docker-agent/pull/3767) - fix(permissions): keep colons in argument values from truncating patterns
- [#3774](https://github.com/docker/docker-agent/pull/3774) - chore: freeze config v13 and start v14 as latest
- [#3775](https://github.com/docker/docker-agent/pull/3775) - docs: update CHANGELOG.md for v1.114.0
- [#3776](https://github.com/docker/docker-agent/pull/3776) - chore: bump direct Go dependencies
- [#3777](https://github.com/docker/docker-agent/pull/3777) - feat: add X-Cagent-Compacting header for session-compaction LLM calls
- [#3778](https://github.com/docker/docker-agent/pull/3778) - refactor: trim transitive dependencies for library consumers
- [#3779](https://github.com/docker/docker-agent/pull/3779) - docs: update docs for config v14 and Mermaid state diagram directions
- [#3781](https://github.com/docker/docker-agent/pull/3781) - chore: bump github.com/anthropics/anthropic-sdk-go from v1.58.0 to v1.58.1
- [#3782](https://github.com/docker/docker-agent/pull/3782) - feat(server): resolve agent-switch slash commands in RunSession
- [#3783](https://github.com/docker/docker-agent/pull/3783) - feat(config): add description attribute to models
- [#3785](https://github.com/docker/docker-agent/pull/3785) - feat: support provider-level compaction_model default
- [#3786](https://github.com/docker/docker-agent/pull/3786) - fix(tui): restyle history-search input on live theme change
- [#3788](https://github.com/docker/docker-agent/pull/3788) - Revert "fix(codeql): go/path-injection in pkg/server/session_manager.go:542" (#3758)


## [v1.114.0] - 2026-07-21

This release adds config flavors, Mermaid state diagram direction support, and Anthropic adaptive-thinking validation, along with several bug fixes for security, token refresh, and session handling.

## Breaking Changes
- Moves the file-backed SQLite session store to `session/sqlitestore` (`refactor(session)!:`)

## What's New
- Adds config flavors — named YAML patches declared in an agent config and applied at load time via the `--flavor` flag
- Adds support for Mermaid state diagram directions
- Adds fast-fail validation when `thinking_display: display` is set on Anthropic adaptive-thinking models (Claude Opus/Sonnet 4.6+), surfacing the error at startup rather than at inference time
- Makes standalone SSE usage in MCP tools configurable (defaults to false)

## Bug Fixes
- Fixes path injection risk in `CreateSession` by validating `WorkingDir` against permitted roots before use
- Fixes incorrect integer conversion in DMR provider by adding bounds check when narrowing int64 context size to int32
- Fixes token refresh when Docker Desktop returns an expired JWT, and prevents the refresh nudge from starving the token polling budget
- Fixes Anthropic `thinking_display` validation to also apply against fallback models
- Fixes decoding of remote MCP prompts instead of type-asserting
- Fixes session store recovery to not overwrite an existing backup
- Hardens error paths in the OAuth flow

## Technical Changes
- Splits model discovery into an OpenAI-free `dmrmodels` package
- Drops full `go-git` dependency from gitignore matching
- Decouples `pkg/runtime` and `pkg/agent` from the MCP toolset package
- Makes the JS command evaluator pluggable to drop the `goja` dependency
- Removes unreachable helpers left behind by earlier refactors (including `Printer.PrintError`, `NewSourceLoader`, `ToolsetMetadata`, `workingdir.Default`, and `ExtractCoords`)
- Freezes config schema v13 and opens v14 as the new latest
- Replaces `context.Background()` with `t.Context()` in tests
### Pull Requests

- [#3754](https://github.com/docker/docker-agent/pull/3754) - feat(tui): open the /cost dialog when clicking the sidebar cost reading
- [#3756](https://github.com/docker/docker-agent/pull/3756) - fix(codeql): go/incorrect-integer-conversion in pkg/model/provider/dmr/configure.go:158
- [#3758](https://github.com/docker/docker-agent/pull/3758) - fix(codeql): go/path-injection in pkg/server/session_manager.go:542
- [#3761](https://github.com/docker/docker-agent/pull/3761) - Enhance the agents API
- [#3763](https://github.com/docker/docker-agent/pull/3763) - docs: update CHANGELOG.md for v1.113.0
- [#3764](https://github.com/docker/docker-agent/pull/3764) - feat: support Mermaid state diagram directions
- [#3765](https://github.com/docker/docker-agent/pull/3765) - docs: update API and TUI documentation for recent feature additions
- [#3768](https://github.com/docker/docker-agent/pull/3768) - feat: config flavors — named YAML patches enabled at run time via --flavor
- [#3769](https://github.com/docker/docker-agent/pull/3769) - chore: remove unreachable helpers
- [#3770](https://github.com/docker/docker-agent/pull/3770) - Make standalone SSE usage in mcp tools configurable
- [#3771](https://github.com/docker/docker-agent/pull/3771) - refactor: cut heavy transitive deps (goja, expr, openai-go, go-git, sqlite) from the code-built embedder surface
- [#3772](https://github.com/docker/docker-agent/pull/3772) - feat(anthropic): fail fast when thinking_display: display is set on adaptive-thinking models
- [#3773](https://github.com/docker/docker-agent/pull/3773) - fix(desktop): force token refresh when Docker Desktop returns an expired JWT
- [#3774](https://github.com/docker/docker-agent/pull/3774) - chore: freeze config v13 and start v14 as latest


## [v1.113.0] - 2026-07-20

This release fixes compaction cost attribution by model, exposes agent command names in the API, and includes internal cleanup of unused code.

## What's New
- Exposes root-agent command names in the `/api/agents` endpoint

## Bug Fixes
- Fixes compaction summary costs being attributed to the wrong model — token spend from `compaction_model` is now correctly tracked per model in the cost breakdown
- Fixes `FirstKeptEntry` not being preserved when branching summary items during compaction
- Fixes missing `defer` for mutex unlock in the webhook `setRuntime` function

## Technical Changes
- Removes unused TUI code, including the unreferenced `cmdbatch` and `subscription` packages and an orphaned attachment preview dialog
### Pull Requests

- [#3757](https://github.com/docker/docker-agent/pull/3757) - docs: update CHANGELOG.md for v1.112.0
- [#3759](https://github.com/docker/docker-agent/pull/3759) - chore: bump direct Go dependencies
- [#3760](https://github.com/docker/docker-agent/pull/3760) - fix: attribute compaction summary costs to the model that generated them
- [#3761](https://github.com/docker/docker-agent/pull/3761) - Enhance the agents API
- [#3762](https://github.com/docker/docker-agent/pull/3762) - chore: remove unused TUI code


## [v1.112.0] - 2026-07-20

This release adds several new built-in toolsets (git, webhook), budget limits, `.agentsignore` support, expanded Mermaid rendering, image rendering in the TUI, and numerous TUI improvements including per-agent usage details, session browser enhancements, and argument auto-completion for slash commands.

## What's New

- Adds a read-only `git` toolset (`git_status`, `git_log`, `git_branches`, `git_show`, `git_blame`) giving agents structured access to the working repository without requiring a `git` binary
- Adds a `webhook` toolset with a `send_webhook` tool that lets agents send outbound notifications to a configured chat service without exposing the URL or secret to the model
- Adds budget configuration (`budget` / `budgets`) to cap what an agent may spend in cost, tokens, or working time, with live tracking in the TUI sidebar
- Adds `.agentsignore` support — a `.gitignore`-syntax file that prevents the agent from listing, reading, or writing matched files
- Adds image rendering in the TUI for tool result images and markdown images in agent responses (using the Kitty graphics protocol, with a setting to disable)
- Adds an image rendering preference to settings
- Adds Mermaid flowchart direction support and subgraph rendering
- Adds argument auto-completion for `/toolset-restart`, `/drop`, and `/effort` slash commands
- Adds per-agent usage details to the TUI sidebar, with a new sidebar info mode selector in `/settings`
- Adds fuzzy search matching for tool discovery via `search_tool` in the deferred toolset
- Adds Claude Code harness setup and diagnostics as a new `docker agent setup` path
- Adds explicit prompt cache breakpoint support for OpenAI (GPT-5.6+)
- Extends session browser search to match session IDs in addition to titles
- Groups the session browser by git repository root (worktree-aware)
- Allows configuring `compaction_model` directly on an agent as a sibling to `compaction_threshold`
- Opens the `/cost` dialog when clicking the sidebar cost/token usage reading
- Adds a self-maintaining `llms.txt` generated from `nav.yml` at Hugo build time

## Improvements

- Fixes severe scrolling performance on very large sessions by caching rendered lines in the cost dialog and stopping message-list render cache thrashing
- Keeps the `/cost` dialog cache fresh on live updates and theme changes
- Shows usage and team roster in the collapsed sidebar band from startup
- Adds sidebar agent info modes

## Bug Fixes

- Fixes RAG query embedding usage tracking so tokens are correctly attributed and emitted to the active session
- Fixes telemetry model dimension pollution and captures partial usage in RAG
- Fixes Anthropic system cache breakpoints being exceeded by capping them so requests never exceed the limit
- Fixes transcripts carrying cache checkpoint marks after compaction
- Fixes slash command inline completion to match on command value, not just label (e.g. typing `/settings` now surfaces the Settings command)
- Fixes TUI panic when the terminal reports a degenerate (0×0 or 1×1) size
- Fixes the `/cost` dialog cache not refreshing on live updates and theme changes
- Fixes the sidebar scrollbar clicks registering in content click zones
- Fixes the `settings` command label to display consistently as `Settings`
- Fixes right-to-left Mermaid connector rendering
- Fixes HTTP error statuses (4xx/5xx) being swallowed and treated as success in the API tool
- Fixes webhook tool to sanitize `*url.Error` to prevent secret URL leakage
- Fixes MCP OAuth clients with `allow-private-ips` to use a private connection pool instead of sharing `http.DefaultTransport`
- Fixes flaky OAuth tests by not sharing `http.DefaultTransport` across parallel tests
- Fixes the template Docker build stage to use `COPY --from` instead of an unauthenticated GitHub API call that hit rate limits
- Removes macOS Keychain and `pass` secret providers from `DefaultSources`

## Technical Changes

- Freezes config schema v12 and opens v13 as the new latest
- Refactors Anthropic prompt-cache checkpoint handling into consolidated owners, making known failure modes structurally impossible
- Refreshes the embedded models.dev snapshot
- Drops the unused `benchmarks/` folder
- Exposes the current agent's supported thinking levels from the runtime
### Pull Requests

- [#3603](https://github.com/docker/docker-agent/pull/3603) - fix(rag): correctly attribute and track query embedding usage for active sessions
- [#3637](https://github.com/docker/docker-agent/pull/3637) - feat(tools): add read-only "git" toolset for structured repository inspection
- [#3641](https://github.com/docker/docker-agent/pull/3641) - feat(tools): add "webhook" toolset for outbound notifications
- [#3694](https://github.com/docker/docker-agent/pull/3694) - docs: add Sessions, Code Mode, headless/CI guide, and expand the CLI reference
- [#3695](https://github.com/docker/docker-agent/pull/3695) - feat(docs): self-maintaining llms.txt generated from nav.yml
- [#3696](https://github.com/docker/docker-agent/pull/3696) - fix(docs): constrain content images and shrink demo GIF
- [#3698](https://github.com/docker/docker-agent/pull/3698) - docs: add tour pointer, prompt-files subsection, and product-naming consistency
- [#3699](https://github.com/docker/docker-agent/pull/3699) - Render images
- [#3700](https://github.com/docker/docker-agent/pull/3700) - docs: sync documentation with recent main merges
- [#3702](https://github.com/docker/docker-agent/pull/3702) - feat(budget): cap what an agent may spend in money, tokens, or working time
- [#3703](https://github.com/docker/docker-agent/pull/3703) - docs: update CHANGELOG.md for v1.111.0
- [#3704](https://github.com/docker/docker-agent/pull/3704) - test(mcp): fix flaky OAuth tests by not sharing http.DefaultTransport
- [#3706](https://github.com/docker/docker-agent/pull/3706) - chore: bump direct Go dependencies
- [#3707](https://github.com/docker/docker-agent/pull/3707) - fix(mcp): give allow-private-ips OAuth clients a private connection pool
- [#3708](https://github.com/docker/docker-agent/pull/3708) - feat(tui): extend session browser search to match session IDs
- [#3709](https://github.com/docker/docker-agent/pull/3709) - chore: drop benchmarks folder
- [#3710](https://github.com/docker/docker-agent/pull/3710) - perf(tui): fix horrendous scrolling on very large sessions
- [#3712](https://github.com/docker/docker-agent/pull/3712) - refactor: consolidate and harden Anthropic prompt-cache checkpoint handling
- [#3713](https://github.com/docker/docker-agent/pull/3713) - feat(env): remove macOS keychain and pass secret providers
- [#3714](https://github.com/docker/docker-agent/pull/3714) - feat(tui): show usage details per agent
- [#3715](https://github.com/docker/docker-agent/pull/3715) - Mermaid flowchart directions
- [#3716](https://github.com/docker/docker-agent/pull/3716) - Mermaid flowchart subgraphs
- [#3717](https://github.com/docker/docker-agent/pull/3717) - fix: address Mermaid subgraph review findings
- [#3718](https://github.com/docker/docker-agent/pull/3718) - Use golden files for Mermaid renders
- [#3719](https://github.com/docker/docker-agent/pull/3719) - feat(openai): support explicit prompt cache breakpoints
- [#3720](https://github.com/docker/docker-agent/pull/3720) - Render markdown images in agent responses
- [#3721](https://github.com/docker/docker-agent/pull/3721) - fix(tui): address PR #3720 review feedback on markdown image rendering
- [#3722](https://github.com/docker/docker-agent/pull/3722) - feat: add Claude Code harness setup and diagnostics
- [#3723](https://github.com/docker/docker-agent/pull/3723) - fix(tui): match slash command value, not just label, in inline completion
- [#3724](https://github.com/docker/docker-agent/pull/3724) - fix(tui): hide no-op slash commands (/settings) in lean mode
- [#3726](https://github.com/docker/docker-agent/pull/3726) - fix(tui): label settings command consistently
- [#3727](https://github.com/docker/docker-agent/pull/3727) - fix(tui): show usage and team roster in the collapsed sidebar band from startup
- [#3728](https://github.com/docker/docker-agent/pull/3728) - feat(tui): argument auto-completion for /toolset-restart
- [#3729](https://github.com/docker/docker-agent/pull/3729) - revert: pkg/tui lean-mode machinery from #3724
- [#3731](https://github.com/docker/docker-agent/pull/3731) - feat(runtime): expose current agent's supported thinking levels
- [#3733](https://github.com/docker/docker-agent/pull/3733) - feat(tui): argument auto-completion for /drop
- [#3734](https://github.com/docker/docker-agent/pull/3734) - feat(tui): argument auto-completion for /effort
- [#3735](https://github.com/docker/docker-agent/pull/3735) - docs: update documentation for recent merged PRs
- [#3736](https://github.com/docker/docker-agent/pull/3736) - fix(tui): don't panic when the terminal reports a degenerate size
- [#3737](https://github.com/docker/docker-agent/pull/3737) - feat: group session browser by git repo root (worktree-aware)
- [#3738](https://github.com/docker/docker-agent/pull/3738) - feat(deferred): add fuzzy search matching for tool discovery
- [#3739](https://github.com/docker/docker-agent/pull/3739) - fix: propagate HTTP error statuses in API tool
- [#3740](https://github.com/docker/docker-agent/pull/3740) - chore(deps): bump mcp from 1.23.0 to 1.28.1 in /examples/dhi/dhi_mcp_server in the pip group across 1 directory
- [#3741](https://github.com/docker/docker-agent/pull/3741) - docs: sync documentation with recent code changes
- [#3743](https://github.com/docker/docker-agent/pull/3743) - feat(filesystem): add `.agentsignore` to keep files out of the agent's reach
- [#3744](https://github.com/docker/docker-agent/pull/3744) - fix: use COPY --from for mcp-gateway in template stage
- [#3747](https://github.com/docker/docker-agent/pull/3747) - chore: refresh embedded models.dev snapshot
- [#3752](https://github.com/docker/docker-agent/pull/3752) - feat: allow configuring compaction_model on agents
- [#3753](https://github.com/docker/docker-agent/pull/3753) - chore: freeze config v12 and open v13 as latest
- [#3754](https://github.com/docker/docker-agent/pull/3754) - feat(tui): open the /cost dialog when clicking the sidebar cost reading


## [v1.111.0] - 2026-07-17

This release adds a new scheduler toolset, inline Mermaid diagram rendering, model switching in the lean TUI, project config autodiscovery, and a range of bug fixes and performance improvements across the agent, TUI, and server.

## What's New

- Adds a built-in `scheduler` toolset with `create_schedule`, `list_schedules`, and `cancel_schedule` tools, enabling agents to schedule instructions to run once at a time, after a delay, or on a recurring interval
- Adds prompt cache miss warnings via an opt-in `warn_on_cache_miss` user setting that emits notifications when cached input tokens are absent after the first session response
- Adds inline Mermaid diagram rendering in the TUI
- Adds model switching (`/model`) to the lean TUI and shares fuzzy model search between the lean and full TUIs
- Adds autodiscovery of `docker-agent.yaml`, `docker-agent.yml`, and `docker-agent.hcl` project config files for no-argument local `docker agent run`
- Surfaces background-job elicitation (user-input) requests in the TUI, ensuring each request opens exactly one dialog regardless of which runtime delivers it
- Makes a custom `base_url` on a model automatically imply `bypass_models_gateway: true`, removing the need to set it explicitly

## Improvements

- Improves session cost details in the TUI: aligns layout, color-codes cost percentages per message, groups averages together, and puts "Total" on its own line
- Speeds up model switcher credential discovery by deduplicating credential names and resolving lookups concurrently, reducing model-picker latency
- Parallelizes toolset startup and prefetches the MCP catalog off the load critical path, reducing agent startup time

## Bug Fixes

- Fixes glob wildcard matching in permissions so `*` and `?` span path separators (`/`) in argument values such as file paths and URLs
- Fixes a bug where setting `defer_all: true` on a toolset caused the toolset's custom `Instructions` to be permanently dropped from the agent's context
- Fixes `SafetyPolicy` not persisting across turns, causing users to be re-prompted for tool approvals they had already opted into
- Fixes background elicitations over the API so requests from concurrent background jobs are replayable and answerable instead of being auto-declined
- Fixes Anthropic cache breakpoints exceeding the hard limit of 4 when deferred tools are present, which caused API errors at runtime
- Fixes the TUI editor not regaining focus after external editing (`Ctrl+G`), which caused Enter to route to the transcript instead of sending the composed message
- Fixes the scheduler schema so `type: scheduler` is accepted in agent config files (was previously rejected by JSON schema validation)
- Fixes foreground elicitations being delivered twice into the app event stream
- Fixes a mutex unlock in the scheduler's `setRuntime` method to use `defer` for safer lock release
- Fixes VCR cassette path normalization for portable prompt-file matching
- Fixes CI workflow YAML indentation that caused all CI runs to fail before any job could start

## Technical Changes

- Adds `MapSlice` fan-out helper in the concurrent utilities package and uses it for parallel toolset operations
- Serializes interactive OAuth flows across toolsets to prevent concurrent conflicts
- Brings the documentation portal to WCAG 2.1 AA conformance across light and dark themes and adds a pa11y-ci CI gate to maintain it
- Adds new documentation pages for the scheduler toolset, sandbox templates, custom commands, user settings, context and compaction guide, and fixes stale command syntax in the Named Commands docs
### Pull Requests

- [#3584](https://github.com/docker/docker-agent/pull/3584) - feat(tui,app): surface and correlate background-job elicitations in the TUI (#3584)
- [#3605](https://github.com/docker/docker-agent/pull/3605) - fix(permissions): match glob wildcards across path separators
- [#3624](https://github.com/docker/docker-agent/pull/3624) - feat(tui,app): surface & correlate background-job elicitations (#3584)
- [#3625](https://github.com/docker/docker-agent/pull/3625) - feat(server): session-scoped elicitation sink for API/server runtimes (#3584)
- [#3632](https://github.com/docker/docker-agent/pull/3632) - feat(tools): add "scheduler" toolset to run instructions on a time or recurring interval
- [#3665](https://github.com/docker/docker-agent/pull/3665) - docs: update CHANGELOG.md for v1.110.0
- [#3666](https://github.com/docker/docker-agent/pull/3666) - fix: repair CI workflow YAML and failing AgentsMd e2e test on main
- [#3667](https://github.com/docker/docker-agent/pull/3667) - feat: custom base_url implies bypass_models_gateway
- [#3670](https://github.com/docker/docker-agent/pull/3670) - fix(config): add scheduler toolset to agent-schema.json type enum
- [#3671](https://github.com/docker/docker-agent/pull/3671) - feat: add prompt cache miss warnings
- [#3672](https://github.com/docker/docker-agent/pull/3672) - Improve session cost details
- [#3673](https://github.com/docker/docker-agent/pull/3673) - perf: speed up model switcher credential discovery
- [#3674](https://github.com/docker/docker-agent/pull/3674) - Add model switching to the lean TUI
- [#3675](https://github.com/docker/docker-agent/pull/3675) - chore: bump go-isatty, openai-go, and libopenapi
- [#3676](https://github.com/docker/docker-agent/pull/3676) - ci: bump golangci-lint-action to v9.3.0 and fix DeferMutexUnlock lint offense
- [#3677](https://github.com/docker/docker-agent/pull/3677) - ci: bump pinned actions to latest same-major versions
- [#3678](https://github.com/docker/docker-agent/pull/3678) - fix(server): surface background elicitations over API
- [#3679](https://github.com/docker/docker-agent/pull/3679) - Render Mermaid diagrams inline
- [#3680](https://github.com/docker/docker-agent/pull/3680) - fix(teamloader): preserve deferred toolset instructions
- [#3681](https://github.com/docker/docker-agent/pull/3681) - feat(run): autodiscover project agent config
- [#3682](https://github.com/docker/docker-agent/pull/3682) - docs(sandbox): document Docker Sandboxes integration and published sbx templates
- [#3683](https://github.com/docker/docker-agent/pull/3683) - docs: surface orphan pages and add compaction, commands, and user-settings docs
- [#3684](https://github.com/docker/docker-agent/pull/3684) - docs(agents): fix stale command syntax and sub_agents claim in Named Commands
- [#3685](https://github.com/docker/docker-agent/pull/3685) - fix(session): persist SafetyPolicy across turns
- [#3687](https://github.com/docker/docker-agent/pull/3687) - fix(docs): WCAG 2.1 AA accessibility remediation for the docs portal
- [#3688](https://github.com/docker/docker-agent/pull/3688) - perf: parallelize toolset startup and prefetch MCP catalog
- [#3690](https://github.com/docker/docker-agent/pull/3690) - fix(tui): refocus the editor after external editing so Enter sends the content
- [#3691](https://github.com/docker/docker-agent/pull/3691) - Implements the path-aware, two-tier documentation accessibility CI gate
- [#3692](https://github.com/docker/docker-agent/pull/3692) - fix(anthropic): keep cache breakpoints within Anthropic's limit of 4 with deferred tools
- [#3693](https://github.com/docker/docker-agent/pull/3693) - fix(docs): render --link-hover on light-mode callout-link hover
- [#3697](https://github.com/docker/docker-agent/pull/3697) - build(deps): bump the pip group across 1 directory with 2 updates
- [#566581](https://github.com/docker/docker-agent/pull/566581) - fix(docs): rebalance how-it-works.svg colors for both themes (a11y PR 8/9)


## [v1.110.0] - 2026-07-15

This release adds dynamic MCP HTTP headers, new shell safety policies, per-model custom pricing, and cache-stable dynamic prompts, along with fixes for elicitation delivery and session cost tracking.

## What's New

- Adds dynamic MCP HTTP headers via a header factory, enabling context-aware HTTP header resolution instead of static headers fixed at startup
- Adds a `safe-auto` safety policy for shell operations, providing a middle ground between prompting for every tool call and `--yolo` mode; safe calls beyond shell are auto-approved under this policy, with an opt-in `safer` mode available via `approve-safer` resume
- Adds an optional `cost` block to model configuration, allowing explicit per-model token pricing for custom, locally-hosted, or uncatalogued models
- Adds opt-in cache-stable dynamic prompts (`cache_stable_prompts` user setting), persisting frozen instruction snapshots and appending chronological updates when trusted context changes

## Bug Fixes

- Fixes elicitation requests from concurrent background jobs being silently dropped and blocking the requesting handler indefinitely
- Fixes session cost dropping after compaction (e.g., from $49 to $12) by keeping cost monotonic across compaction and preserving cost accounting across reload
### Pull Requests

- [#3583](https://github.com/docker/docker-agent/pull/3583) - feat: implement dynamic MCP HTTP headers via header factory
- [#3584](https://github.com/docker/docker-agent/pull/3584) - fix(runtime): reliable, correlation-safe, non-blocking elicitation delivery (#3584)
- [#3587](https://github.com/docker/docker-agent/pull/3587) - fix(runtime): reliable, correlation-safe, non-blocking elicitation delivery (#3584)
- [#3647](https://github.com/docker/docker-agent/pull/3647) - feat(safer_shell): add safe-auto safety policy
- [#3661](https://github.com/docker/docker-agent/pull/3661) - docs: update CHANGELOG.md for v1.109.0
- [#3662](https://github.com/docker/docker-agent/pull/3662) - Add opt-in cache-stable dynamic prompts
- [#3663](https://github.com/docker/docker-agent/pull/3663) - fix(session): keep cost monotonic across compaction
- [#3664](https://github.com/docker/docker-agent/pull/3664) - feat(config): declare explicit per-model token pricing with cost


## [v1.109.0] - 2026-07-15

This release fixes permission scoping bugs in sub-sessions, adds deferred tool loading, and includes several improvements to session reliability and the settings window.

## What's New

- Adds cache-safe deferred tool loading, tracking deferred tool load points in the shared runtime and translating them into native OpenAI tool-search and Anthropic tool-reference messages
- Adds embedder seams for code-built teams in `embeddedchat`, allowing callers to assemble agents in code without requiring a YAML `AgentSource` or pulling the full toolset and provider registries at link time
- Adds more settings in the settings window

## Improvements

- Refactors the TUI confirmation dialog to accept a narrow `ConfirmationSessionState` interface, allowing embedders to supply session state without depending on a concrete `*service.SessionState`

## Bug Fixes

- Fixes permission scoping between parent and child sessions, preventing sub-sessions from back-propagating `ToolsApproved` and `Permissions` to the parent (scope escalation bug)
- Fixes tool-approval chain precedence in the permission override and dispatch pipeline
- Fixes `teamloader` to propagate the session working directory to toolsets, resolving a silent drop of `WithWorkingDir` for tools such as `shell` and `filesystem`
- Fixes `teamloader` to restore `runConfig.WorkingDir` after `Load`
- Fixes a race condition by locking access to session title, token, and cost fields through `Session.mu`
- Fixes the `runForwarding` invariant

## Technical Changes

- Fixes formatting for `gofumpt` and `gci`
- Updates stale YOLO tests and restores branch cloning
- Adds eval test coverage for container interruption on cancellation
- Fixes `TestForceAskOverridesYoloMode` hanging on CI
### Pull Requests

- [#3542](https://github.com/docker/docker-agent/pull/3542) - fix: correct Decide precedence and remove sub-session scope escalation
- [#3649](https://github.com/docker/docker-agent/pull/3649) - test(eval): cover container interruption on cancellation
- [#3652](https://github.com/docker/docker-agent/pull/3652) - docs: update CHANGELOG.md for v1.107.0
- [#3653](https://github.com/docker/docker-agent/pull/3653) - docs: update CHANGELOG.md for v1.108.0
- [#3654](https://github.com/docker/docker-agent/pull/3654) - refactor(tui): let embedders supply the confirmation dialog's session state
- [#3655](https://github.com/docker/docker-agent/pull/3655) - feat(embeddedchat): add embedder seams for code-built teams
- [#3656](https://github.com/docker/docker-agent/pull/3656) - Add more settings in the settings window
- [#3657](https://github.com/docker/docker-agent/pull/3657) - fix(teamloader): propagate session working dir to toolsets
- [#3658](https://github.com/docker/docker-agent/pull/3658) - Add cache-safe deferred tool loading
- [#3659](https://github.com/docker/docker-agent/pull/3659) - fix(session): lock title and usage scalar access


## [v1.108.0] - 2026-07-15

Maintenance release with dependency updates.


## [v1.107.0] - 2026-07-15

Maintenance release with dependency updates.


## [v1.103.0] - 2026-07-09

This release polishes the agent picker UI, adds context-usage gauge warning states, improves config handling, and expands sandbox template tooling.

## What's New
- Adds warning and compacting states to the context-usage gauge: color escalates (orange ≥75%, red ≥95%) as usage approaches the auto-compaction threshold, and displays "compacting…" while a compaction runs (applies to both the main TUI sidebar and lean TUI status line)
- Installs the latest `docker-mcp` plugin in the sandbox template image so agents running in that environment have MCP tooling available out of the box
- Adds a hint when a config key requires a newer schema version, guiding users to bump the top-level `version` field instead of seeing a generic "unknown key" error
- Adds `WithModelOptions` passthrough in `teamloader` for provider-agnostic HTTP transport wrapping

## Bug Fixes
- Fixes config parsing failure when a hook event list is written as a single mapping instead of a sequence, which previously caused aliases and settings to be silently dropped

## Technical Changes
- Refactors agent picker status bars to use `dialog.RenderHelpKeys`, removing duplicated key-rendering logic
- Extracts `fitHelpPairs` and adds regression tests for details help wrapping
- Polishes agent picker visuals: more compact cards (height 7 → 5) and tightened layout
- Simplifies the Dockerfile
### Pull Requests

- [#3089](https://github.com/docker/docker-agent/pull/3089) - feat(teamloader): add WithModelOptions passthrough for provider-agnostic HTTP transport wrapping
- [#3537](https://github.com/docker/docker-agent/pull/3537) - feat(tui): add warning/compacting states to the context-usage gauge
- [#3541](https://github.com/docker/docker-agent/pull/3541) - docs: update CHANGELOG.md for v1.102.0
- [#3543](https://github.com/docker/docker-agent/pull/3543) - style(tui): polish agent picker layout, cards, and status bars
- [#3544](https://github.com/docker/docker-agent/pull/3544) - docs: sync documentation with recent code changes
- [#3545](https://github.com/docker/docker-agent/pull/3545) - feat: install latest docker-mcp plugin in sbx template
- [#3546](https://github.com/docker/docker-agent/pull/3546) - fix(config): accept a single mapping for hook event lists
- [#3549](https://github.com/docker/docker-agent/pull/3549) - feat(teamloader): add WithModelOptions passthrough for provider-agnostic HTTP transport wrapping
- [#3550](https://github.com/docker/docker-agent/pull/3550) - feat(config): hint when a config key requires a newer schema version


## [v1.102.0] - 2026-07-08

This release brings significant enhancements to the Kanban board (drag & drop, card management, shell access, sandbox fixes), a new ChatGPT provider, TUI layout customization, and numerous stability and usability fixes across the board, session management, and copy/paste experience.

## What's New

- Adds a `chatgpt` provider enabling sign-in with a ChatGPT Plus/Pro/Business account via `docker agent setup`, without requiring an `OPENAI_API_KEY`
- Adds `/custom` slash command to open a layout customization dialog for sidebar position and section visibility, with live preview and persistent settings
- Adds a **Section spacing** selector to the `/custom` layout dialog (Compact / Normal / Relaxed)
- Adds warning and compacting states to the context-usage gauge, escalating color as usage approaches the compaction threshold and showing "compacting..." during compaction
- Adds `s` shortcut on the board to open an interactive shell in the selected card's worktree
- Adds digit keys 1–9 to move a board card directly to a numbered column, and adds mouse drag & drop to reposition cards
- Adds drag ghost preview showing where a dragged card will be inserted in the drop-target column
- Adds intermediate startup statuses (`starting` → `loading` → `attaching`) on board cards to show boot progress
- Adds project editing and reordering on the board: press `e` or Enter on a project to rename it, with confirm-delete for destructive removals
- Adds desktop notifications with hooks tip to the documentation, covering macOS and Linux examples for `on_user_input` and `stop` events

## Improvements

- Aligns TUI board card colors with the web board's status palette; `starting`/`loading`/`attaching` render in blue, `running` in green, and `paused` in a neutral color
- Fades the dragged card immediately on the first mouse motion during a drag, providing instant visual feedback
- Clarifies the dirty-worktree removal prompt by listing the consequences of `y` and `N` on separate lines before asking the question
- Improves command categories in the help output
- Documents env vars needed for `notify-send` hooks in detached sessions (SSH, tmux, containers)

## Bug Fixes

- Fixes board agent startup failures being silently discarded, leaving cards stuck in "starting" forever; failures are now surfaced on the card
- Fixes board control-plane sockets being placed inside the data dir, which prevented cards from starting in Docker sandboxes; sockets are now placed in the system temp dir
- Fixes board storing absolute paths that broke shared state in sandboxes; paths are now stored home-relative
- Fixes board not forwarding `--config-dir`, `--data-dir`, and `--cache-dir` overrides to spawned agents
- Fixes board path expansion, state load, and git repo check edge cases
- Fixes stale drag state and ignores wheel events mid-drag on the board
- Fixes a race condition where `RunSession`/`recallSession` clobbered the attached runtime's cancel, causing `DeleteSession` to abort in-flight streams incorrectly
- Fixes session DB being reset on transient open errors (e.g. Ctrl-C, `SQLITE_BUSY`), which could silently wipe access to all past sessions
- Fixes SQLite memory database opening before acquiring the advisory file lock, causing `SQLITE_BUSY` races under concurrent access
- Fixes TUI selection copy being unreliable (random one-word copies, trailing padding, UI glyphs in clipboard) and improves copy button affordances
- Fixes redundant copy toast appearing alongside the inline "copied" flash when clicking a copy button
- Fixes emphasized text (e.g. "Esc to interrupt") being invisible on light themes due to incorrect color mapping
- Fixes global config file management: resolves a TUI panic on malformed config and several silent data-loss paths in the load/save cycle
- Fixes DNS resolution happening at construction time in `NewSSRFSafeTransport`, which could slow agent startup or fail silently when DNS is unavailable
- Fixes board reporting why a relaunch failed when attaching to an errored card, and drops per-card controller state without racing in-flight relaunches
- Fixes docs table of contents sidebar overlapping the footer on long pages by switching from `position:fixed` to `position:sticky`

## Technical Changes

- Renames `$BOARD_EDITOR` environment variable to `$DOCKER_AGENT_BOARD_EDITOR`; the old name is kept as a fallback for one release
- Folds the ChatGPT sign-in flow into `docker agent setup` rather than a separate command
- Removes the agent catalog example from documentation
- Adds a lint rule flagging DNS resolution (`net.Lookup*` / `Resolver.Lookup*`) in constructors
### Pull Requests

- [#3503](https://github.com/docker/docker-agent/pull/3503) - fix(cli): resolve session DB default against the data dir
- [#3506](https://github.com/docker/docker-agent/pull/3506) - docs: update CHANGELOG.md for v1.101.0
- [#3507](https://github.com/docker/docker-agent/pull/3507) - chore: bump direct Go dependencies
- [#3508](https://github.com/docker/docker-agent/pull/3508) - fix(board): surface agent startup failures instead of silently doing nothing
- [#3509](https://github.com/docker/docker-agent/pull/3509) - feat(tui): add /custom command to customize layout
- [#3510](https://github.com/docker/docker-agent/pull/3510) - fix(board): store paths home-relative so shared state works in sandboxes
- [#3512](https://github.com/docker/docker-agent/pull/3512) - feat(provider): add chatgpt provider with ChatGPT account sign-in
- [#3513](https://github.com/docker/docker-agent/pull/3513) - feat(board): edit, reorder, and confirm-delete projects
- [#3514](https://github.com/docker/docker-agent/pull/3514) - chore(board): rename $BOARD_EDITOR to $DOCKER_AGENT_BOARD_EDITOR
- [#3515](https://github.com/docker/docker-agent/pull/3515) - fix(board): run agent control-plane sockets outside the data dir so cards start in docker sandboxes
- [#3516](https://github.com/docker/docker-agent/pull/3516) - feat(board): show intermediate startup statuses on cards
- [#3517](https://github.com/docker/docker-agent/pull/3517) - feat(board): add `s` shortcut to open a shell in the card's worktree
- [#3518](https://github.com/docker/docker-agent/pull/3518) - fix(board): forward directory overrides to spawned agents
- [#3519](https://github.com/docker/docker-agent/pull/3519) - docs: sync documentation with recent main merges
- [#3520](https://github.com/docker/docker-agent/pull/3520) - fix(board): clarify dirty-worktree removal prompt with explicit consequences
- [#3521](https://github.com/docker/docker-agent/pull/3521) - feat(board): align TUI card colors with web board status palette
- [#3522](https://github.com/docker/docker-agent/pull/3522) - feat(board): move cards to any column with digit keys and drag & drop
- [#3523](https://github.com/docker/docker-agent/pull/3523) - Improve the command categories
- [#3524](https://github.com/docker/docker-agent/pull/3524) - feat(board): fade dragged card immediately and fix stale drag state
- [#3525](https://github.com/docker/docker-agent/pull/3525) - fix: don't clobber attached runtime's cancel in RunSession/recallSession
- [#3526](https://github.com/docker/docker-agent/pull/3526) - docs: add desktop notifications with hooks tip
- [#3527](https://github.com/docker/docker-agent/pull/3527) - fix(docs): switch .toc-aside from position:fixed to sticky in flex .main row
- [#3529](https://github.com/docker/docker-agent/pull/3529) - fix(userconfig): harden global config file management
- [#3530](https://github.com/docker/docker-agent/pull/3530) - fix(tui): unreadable emphasized text on light themes
- [#3531](https://github.com/docker/docker-agent/pull/3531) - docs: document env vars for notify-send hooks in detached sessions
- [#3532](https://github.com/docker/docker-agent/pull/3532) - feat(board): preview the dragged card at its insertion point
- [#3533](https://github.com/docker/docker-agent/pull/3533) - feat(tui): add section spacing setting to /custom layout dialog
- [#3534](https://github.com/docker/docker-agent/pull/3534) - fix(session): don't reset the session DB on transient open errors
- [#3535](https://github.com/docker/docker-agent/pull/3535) - fix(tui): make selection copy reliable and improve copy affordances
- [#3537](https://github.com/docker/docker-agent/pull/3537) - feat(tui): add warning/compacting states to the context-usage gauge
- [#3538](https://github.com/docker/docker-agent/pull/3538) - fix(memory): open sqlite db under file lock to avoid SQLITE_BUSY races
- [#3539](https://github.com/docker/docker-agent/pull/3539) - fix(tui): drop the redundant copy toast when the inline "copied" flash shows
- [#3540](https://github.com/docker/docker-agent/pull/3540) - fix(ssrf): avoid DNS resolution at construction time in NewSSRFSafeTransport


## [v1.101.0] - 2026-07-07

This release adds a setup wizard for first-time model configuration, an opt-in auto theme that follows the terminal's light/dark background, and several usability and bug fixes.

## What's New
- Adds an `Open Board` button (and `b` keybinding) to the agent picker, allowing users to launch the Kanban board directly without first running an agent
- Adds a `docker agent setup` wizard, offered when no usable model is configured, guiding users through setting up a cloud API key or pulling a local model
- Adds secret stores and a default config environment file source for environment configuration
- Adds an opt-in `auto` theme that follows the terminal's light/dark background at startup and live (via `settings.theme: auto`, `--theme auto`, or the `/theme` menu)
- Exports `Pull` for pre-confirmed model pulls in the Docker Model Runner integration

## Bug Fixes
- Fixes the agent picker's board button hit-zone math and improves layout on narrow terminals
- Fixes `--session-db` default so it correctly resolves relative to `--data-dir`, making sessions stored under a custom data directory visible
- Fixes the theme file watcher that was lost in the tab-view rewrite, restoring live hot-reload of `~/.cagent/themes/*.yaml` while the TUI is running

## Technical Changes
- Adds a "Set Up a Model" getting-started tutorial covering both API key and local model setup paths
- Adds session DB wiring tests and documentation follow-ups for the setup wizard
### Pull Requests

- [#3497](https://github.com/docker/docker-agent/pull/3497) - docs: update CHANGELOG.md for v1.100.0
- [#3498](https://github.com/docker/docker-agent/pull/3498) - feat(picker): add Open Board button to the agent picker
- [#3499](https://github.com/docker/docker-agent/pull/3499) - feat(cli): add docker agent setup wizard, offered when no model is usable (phase 3 of #3442)
- [#3502](https://github.com/docker/docker-agent/pull/3502) - docs(getting-started): add Set Up a Model tutorial for API key and local paths
- [#3503](https://github.com/docker/docker-agent/pull/3503) - fix(cli): resolve session DB default against the data dir
- [#3504](https://github.com/docker/docker-agent/pull/3504) - feat(tui): opt-in "auto" theme that follows the terminal light/dark background
- [#3505](https://github.com/docker/docker-agent/pull/3505) - fix(tui): rewire theme watcher lost in tab-view rewrite


## [v1.100.0] - 2026-07-07

This release adds new diagnostic and configuration capabilities, hardens the board communication protocol, and improves error messaging for missing models and credentials.

## What's New

- Adds `docker agent doctor` command for diagnosing model provider credentials and agent readiness
- Adds actionable errors when models or credentials are missing, with guidance on next steps
- Adds `hooks.d` drop-in directory (`<config-dir>/hooks.d/*.yaml`) and `DOCKER_AGENT_CONFIG_DIR` environment variable override for config directory
- Adds heartbeat idle watchdog to abort hung event streams in `docker agent board`
- Adds session aggregate cost reporting to `GET /snapshot`
- Adds machine-readable error codes to 404 responses for unknown session snapshots
- Adds heartbeat keepalives to idle `/events` SSE streams

## Bug Fixes

- Fixes turn-boundary events being silently dropped when a subscriber's buffer overflows

## Technical Changes

- Extracts lean TUI engine into a separate package and reorganizes UI components (status models, inline images, tool views, transcript, screen model) into a dedicated UI layer
- Adds documentation for `docker agent board` CLI reference and actionable model/credential errors in troubleshooting guide
- Adds tmux usage guidance for running `docker agent board` in a sandbox environment
### Pull Requests

- [#3452](https://github.com/docker/docker-agent/pull/3452) - feat(cli): actionable errors for missing models and credentials (phase 1 of #3442)
- [#3487](https://github.com/docker/docker-agent/pull/3487) - docs: update CHANGELOG.md for v1.99.0
- [#3489](https://github.com/docker/docker-agent/pull/3489) - feat(cli): add docker agent doctor for model and credential diagnosis
- [#3491](https://github.com/docker/docker-agent/pull/3491) - feat: harden control-plane protocol for reliable board communication
- [#3492](https://github.com/docker/docker-agent/pull/3492) - Lean tui UI split
- [#3494](https://github.com/docker/docker-agent/pull/3494) - docs: update CLI reference and troubleshooting for board and actionable errors
- [#3495](https://github.com/docker/docker-agent/pull/3495) - Add tmux or running docker agent board in sbx
- [#3496](https://github.com/docker/docker-agent/pull/3496) - feat: hooks.d drop-in directory and config-dir env override


## [v1.99.0] - 2026-07-06

This release adds significant new capabilities including a Kanban board TUI, NVIDIA provider support, parallel tool dispatch, and numerous compaction and context-window improvements, along with several important bug fixes.

## What's New

- Adds `docker agent board`, a full-screen Kanban TUI for orchestrating multiple agents across pipeline stages (Dev → Review → Push → Done), each on an isolated git worktree
- Adds NVIDIA (NIM / build.nvidia.com) as a supported model provider via a new `nvidia` alias
- Adds `/context` slash command with a categorized context-window breakdown dialog, including a stacked usage bar and copy-to-clipboard action
- Adds the ability to list and drop attached files directly from the `/context` dialog
- Adds `wait_background_job` tool to the shell toolset, blocking until a background job finishes instead of requiring polling
- Adds shell background job recall, routing completed job output back to active or idle sessions
- Splits background jobs into a separate `background_jobs` toolset, leaving the shell toolset with only synchronous shell tools
- Adds `unix://` URL support in the remote MCP client for connecting over Unix domain sockets
- Adds a Lean Mode checkbox to the agent picker (`--agent-picker`), toggled with `l` or mouse click
- Adds `compaction_threshold` as a configurable key per agent (and per model), replacing the previously hardcoded 0.9 constant
- Adds per-sub-agent context accounting in the TUI sidebar and agent inspector
- Runs tool dispatcher calls in parallel, serializing only interactive confirmations
- Extends the HCL `file()` function with an optional variables argument to render the file as a template
- Groups the `/sessions` browser by current workspace instead of showing a flat global list

## Improvements

- Reconciles the compaction token estimator with provider-reported usage, using exact counts where available and a session-calibrated correction for unreported content
- Wraps lean TUI tool calls in a padded themed box for improved rendering
- Supports steering (sending messages while the agent is running) in the lean TUI, with pending messages displayed in muted styling

## Bug Fixes

- Fixes compaction replacing session history with a stale reply when the summarization model returns an empty response
- Fixes compaction outcome reporting to accurately reflect applied/skipped/failed status on the completed event
- Fixes whitespace-only compaction summaries being applied instead of treated as a no-op
- Fixes `--yolo` flag not being applied correctly on session resume, causing `safer_shell` to prompt despite the flag
- Fixes Gemini models failing with MCP tools that declare non-string enum values in their JSON schemas
- Fixes session `Message.AgentName` silently dropping on load when reading files using the legacy `agentName` JSON key
- Fixes database migration rollback errors being silently swallowed
- Removes Anthropic Files API usage
- Updates stale Anthropic model IDs in examples to current IDs

## Technical Changes

- Standardizes `agent_name` JSON tag on `Message.AgentName`, replacing the previous `agentName` camelCase tag
- Shares git-branch detection logic between the lean and full TUIs via a new `pkg/gitbranch` package
- Refactors lean TUI model into cohesive subsystems (usage/tool trackers, transcript type) with no functional change
- Replaces context-smuggled emitters with an explicit `tools.Runtime` handle in the tool dispatcher
### Pull Requests

- [#3421](https://github.com/docker/docker-agent/pull/3421) - feat: add NVIDIA provider as supported model provider
- [#3443](https://github.com/docker/docker-agent/pull/3443) - feat(picker): add Lean Mode checkbox to agent picker
- [#3445](https://github.com/docker/docker-agent/pull/3445) - docs: update CHANGELOG.md for v1.98.0
- [#3446](https://github.com/docker/docker-agent/pull/3446) - feat(tui): group /sessions browser by current workspace
- [#3447](https://github.com/docker/docker-agent/pull/3447) - docs: point rel=canonical at the docs.docker.com mirrored pages
- [#3448](https://github.com/docker/docker-agent/pull/3448) - feat(config): make the auto-compaction threshold configurable (compaction_threshold)
- [#3449](https://github.com/docker/docker-agent/pull/3449) - feat(compaction): reconcile token estimator with provider-reported usage
- [#3451](https://github.com/docker/docker-agent/pull/3451) - feat: add docker agent board, a Kanban TUI for orchestrating agents
- [#3453](https://github.com/docker/docker-agent/pull/3453) - feat(mcp/remote): support unix:// URLs in remote MCP client
- [#3454](https://github.com/docker/docker-agent/pull/3454) - ci: build and publish docker-agent sandbox templates
- [#3455](https://github.com/docker/docker-agent/pull/3455) - refactor(leantui): decompose the model into cohesive subsystems
- [#3457](https://github.com/docker/docker-agent/pull/3457) - refactor: share git-branch detection between the lean and full TUIs
- [#3458](https://github.com/docker/docker-agent/pull/3458) - feat(tui): add /context command with a categorized context-window breakdown
- [#3459](https://github.com/docker/docker-agent/pull/3459) - docs: switch github.io site from Jekyll to Hugo
- [#3460](https://github.com/docker/docker-agent/pull/3460) - fix: box lean TUI tool calls
- [#3461](https://github.com/docker/docker-agent/pull/3461) - feat: add shell background job recall
- [#3463](https://github.com/docker/docker-agent/pull/3463) - feat(shell): add wait_background_job tool
- [#3464](https://github.com/docker/docker-agent/pull/3464) - feat(hcl): render file() as a template when given variables
- [#3465](https://github.com/docker/docker-agent/pull/3465) - feat(tui): list and drop attached files from the /context dialog
- [#3466](https://github.com/docker/docker-agent/pull/3466) - fix: remove Anthropic Files API usage
- [#3467](https://github.com/docker/docker-agent/pull/3467) - feat: run tool dispatcher calls in parallel
- [#3468](https://github.com/docker/docker-agent/pull/3468) - docs: sync documentation with recent changes
- [#3470](https://github.com/docker/docker-agent/pull/3470) - fix: compaction data loss on empty summary + honest compaction outcome reporting
- [#3471](https://github.com/docker/docker-agent/pull/3471) - chore: standardize agent_name JSON tag in Message struct
- [#3472](https://github.com/docker/docker-agent/pull/3472) - Tweak the golang dev
- [#3473](https://github.com/docker/docker-agent/pull/3473) - Split background jobs into separate toolset
- [#3474](https://github.com/docker/docker-agent/pull/3474) - fix: support steering in lean TUI
- [#3475](https://github.com/docker/docker-agent/pull/3475) - docs: document lean TUI steering support
- [#3476](https://github.com/docker/docker-agent/pull/3476) - fix: handle tx.Rollback error in database migrations
- [#3480](https://github.com/docker/docker-agent/pull/3480) - fix: update stale Anthropic model IDs in examples
- [#3481](https://github.com/docker/docker-agent/pull/3481) - chore: bump direct Go dependencies
- [#3482](https://github.com/docker/docker-agent/pull/3482) - fix: backfill SafetyPolicy on session resume with --yolo
- [#3483](https://github.com/docker/docker-agent/pull/3483) - fix(session): accept legacy agentName JSON key when unmarshaling Message
- [#3485](https://github.com/docker/docker-agent/pull/3485) - fix(gemini): stringify non-string enum values in tool schemas
- [#3486](https://github.com/docker/docker-agent/pull/3486) - feat(tui): per-sub-agent context accounting in the TUI


## [v1.98.0] - 2026-07-03

This release adds several new TUI features including an interactive getting-started tour, an effort picker dialog, and Lean Mode support in the agent picker, along with stability fixes for startup, shutdown, and proxy recovery.

## What's New

- Adds an interactive getting-started tour offered on first run and replayable on demand, implemented as a floating card that observes the real UI's message stream
- Opens an effort picker dialog when `/effort` is used with no argument, instead of printing a usage hint
- Adds a Lean Mode checkbox to the agent picker panel, toggleable with the `l` key or mouse click
- Agent picker now discovers `~/.agents` config files (`.yaml`, `.yml`, `.hcl`) when no explicit list is given, in addition to the built-in `default` and `coder` agents
- Adds cross-process locking and atomic writes for SQLite memory storage

## Bug Fixes

- Fixes toolset `Start` during startup so the sidebar tools spinner can no longer animate forever when Docker is wedged
- Fixes TUI exit being blocked by a wedged resource cleanup
- Fixes `--record` proxy bypassing the configured models gateway, which caused HTTP 401 errors when gateway-managed credentials were expected
- Hardens gateway forwarding in record mode against credential leakage
- Fixes proxy recovery after cooldown — previously a socket error would permanently latch the transport to direct connections for the lifetime of the process
- Fixes `/tools` dialog showing Go type names (e.g. `*skills.ToolSet`) instead of human-readable names for loader-created toolsets
- Fixes telemetry incorrectly recording an error on a chat span after a successful LLM completion
- Fixes agent picker hardening: windowing, escapes, FIFO skip, sentinel, and description guard
- Keeps agent picker panel geometry stable and windowing math in sync

## Technical Changes

- Fixes flaky frame synchronization in TUI test driver `sendSync`
- Fixes file descriptor double-close corrupting parallel tests in `TestListen_FD`
- Guards `fdOwnershipPin` with a mutex to fix a data race in server tests
- Trims comments in the fallback transport
### Pull Requests

- [#3114](https://github.com/docker/docker-agent/pull/3114) - feat(memory): add cross-process locking and atomic writes for sqlite
- [#3281](https://github.com/docker/docker-agent/pull/3281) - telemetry: don't record error on chat span after successful LLM completion
- [#3412](https://github.com/docker/docker-agent/pull/3412) - feat(tui): generate a TUI e2e test from a `--record` session
- [#3420](https://github.com/docker/docker-agent/pull/3420) - test: fix flaky tuitest frame sync and TestListen_FD fd double-close
- [#3423](https://github.com/docker/docker-agent/pull/3423) - fix: bound toolset startup and never block the TUI exit when Docker is wedged
- [#3424](https://github.com/docker/docker-agent/pull/3424) - docs: update CHANGELOG.md for v1.97.0
- [#3425](https://github.com/docker/docker-agent/pull/3425) - feat(tui): open effort picker when /effort has no argument
- [#3427](https://github.com/docker/docker-agent/pull/3427) - feat(tui): interactive getting-started tour on first run, replayable on demand
- [#3428](https://github.com/docker/docker-agent/pull/3428) - fix: route --record proxy through the configured models gateway
- [#3430](https://github.com/docker/docker-agent/pull/3430) - docs: sync documentation with recent merges
- [#3431](https://github.com/docker/docker-agent/pull/3431) - fix(remote): recover proxy after cooldown instead of latching to direct
- [#3441](https://github.com/docker/docker-agent/pull/3441) - fix: show proper toolset names in /tools dialog for loader-created toolsets
- [#3443](https://github.com/docker/docker-agent/pull/3443) - feat(picker): add Lean Mode checkbox to agent picker
- [#3444](https://github.com/docker/docker-agent/pull/3444) - feat: agent picker discovers ~/.agents configs when no list is given


## [v1.97.0] - 2026-07-02

This release adds global hook support in user config, expands environment variable references in hook and script-shell fields, and fixes hook field merging.

## What's New
- Adds support for global hooks in user config (`~/.config/cagent/config.yaml`), with hooks merged in order: agent config → global → CLI
- Adds `${env.X}` expansion in hook and script-shell `working_dir` and `env` fields, giving them the same treatment as other `working_dir` fields

## Bug Fixes
- Fixes hook field merging so all `HooksConfig` fields are combined correctly when merging config and CLI hooks
- Fixes unset `${env.X}` references to log at debug level instead of silently failing; config env now takes precedence over host env

## Technical Changes
- Fixes flaky `TestAttachedServer_DeleteEmitsSessionExited` test caused by a race between session deletion and event log subscription
### Pull Requests

- [#2615](https://github.com/docker/docker-agent/pull/2615) - feat(config): expand ${env.X} in hook and script-shell working_dir/env (#2615)
- [#3416](https://github.com/docker/docker-agent/pull/3416) - feat(config): expand ${env.X} in hook and script-shell working_dir/env
- [#3417](https://github.com/docker/docker-agent/pull/3417) - docs: update CHANGELOG.md for v1.96.0
- [#3418](https://github.com/docker/docker-agent/pull/3418) - test: fix flaky TestAttachedServer_DeleteEmitsSessionExited
- [#3419](https://github.com/docker/docker-agent/pull/3419) - fix: merge all hook fields
- [#3422](https://github.com/docker/docker-agent/pull/3422) - feat: support global hooks in user config


## [v1.96.0] - 2026-07-02

This release adds session resumption across agent URL changes, TUI e2e test generation from recorded sessions, and fixes for duplicate tool names and Anthropic adaptive thinking display.

## What's New

- Adds ability to resume sessions across agent URL query changes when using `docker-agent serve api` (e.g. when relaunching with a different agent version tag)
- Adds TUI e2e test generation from `--record` sessions, producing a ready-to-edit `*_test.go` file alongside the cassette with synchronization points derived from the recorded session
- Adds a Docker Wiki example agent with `/init`, `/update`, `/status`, and `/help` commands

## Bug Fixes

- Fixes duplicate tool names being sent to providers by deduplicating in `collectTools()` — the first toolset wins and a warning is shown once per streak naming the conflicting toolsets (fixes Anthropic HTTP 400 "Tool names must be unique" errors)
- Fixes missing reasoning display in the TUI when using `/effort` or Shift+Tab thinking cycle on newer Claude models (Opus 4.7+) — the adaptive `display` field is now sent by default even when `provider_opts.thinking_display` is not explicitly configured
### Pull Requests

- [#3406](https://github.com/docker/docker-agent/pull/3406) - docs: update CHANGELOG.md for v1.94.0
- [#3407](https://github.com/docker/docker-agent/pull/3407) - docs: update CHANGELOG.md for v1.95.0
- [#3408](https://github.com/docker/docker-agent/pull/3408) - docs: add docker wiki example agent
- [#3409](https://github.com/docker/docker-agent/pull/3409) - fix(agent): dedupe duplicate tool names with once-per-streak warning
- [#3410](https://github.com/docker/docker-agent/pull/3410) - feat(server): resume sessions across agent URL query changes
- [#3412](https://github.com/docker/docker-agent/pull/3412) - feat(tui): generate a TUI e2e test from a `--record` session
- [#3413](https://github.com/docker/docker-agent/pull/3413) - docs: single-source documentation for the docs.docker.com Hugo module mount
- [#3414](https://github.com/docker/docker-agent/pull/3414) - docs: prepare pages for the docs.docker.com module mount
- [#3415](https://github.com/docker/docker-agent/pull/3415) - fix(anthropic): default adaptive thinking display to summarized


## [v1.95.0] - 2026-07-02

This release focuses on TUI rendering performance improvements for long conversations, along with a bug fix for test reliability and a configuration version update.

## Improvements

- Memoizes scrollbar rendering across frames to reduce redundant computation during TUI redraws
- Memoizes content line widths in the scroll view to avoid recalculating unchanged values each frame
- Replaces `lipgloss.JoinHorizontal` with direct column zipping for scrollbar rendering, reducing allocations per frame

## Bug Fixes

- Fixes restyled lines incorrectly using cached widths instead of re-measuring after style changes
- Fixes flaky renderer-registry tests that were racing on a shared global registry

## Technical Changes

- Freezes config v11 and promotes v12 as the latest configuration version
### Pull Requests

- [#3401](https://github.com/docker/docker-agent/pull/3401) - freeze config v11 and start v12 as latest
- [#3404](https://github.com/docker/docker-agent/pull/3404) - perf(tui): memoize rendering hot paths for long conversations
- [#3405](https://github.com/docker/docker-agent/pull/3405) - chore: bump direct Go dependencies


## [v1.94.0] - 2026-07-02

This release significantly expands model provider support with 12 new built-in providers, adds mouse support and new commands to the TUI, introduces a SafetyPolicy primitive, and includes numerous bug fixes and performance improvements.

## What's New

- Adds Baseten as a built-in model provider (`provider: baseten`)
- Adds OVHcloud AI Endpoints as a built-in model provider (`provider: ovhcloud`)
- Adds Groq as a built-in model provider (`provider: groq`)
- Adds DeepSeek as a built-in model provider (`provider: deepseek`)
- Adds Cerebras as a built-in model provider (`provider: cerebras`)
- Adds Fireworks AI as a built-in model provider (`provider: fireworks`)
- Adds Together AI as a built-in model provider (`provider: together`)
- Adds Hugging Face Inference Providers as a built-in model provider (`provider: huggingface`)
- Adds Moonshot AI (Kimi) as a built-in model provider (`provider: moonshot`)
- Adds Vercel AI Gateway as a built-in model provider (`provider: vercel`)
- Adds Cloudflare Workers AI and Cloudflare AI Gateway as built-in model providers
- Adds mouse support to the agent picker: hover highlights a card, single click selects it, double-click immediately starts the session, and scroll wheel navigates the YAML details panel
- Adds metadata `tags` field to agent config and surfaces tags as coloured chips in the agent picker
- Adds `/effort` slash command to select the model's reasoning level directly (available in both full and lean TUI)
- Adds `SafetyPolicy` primitive (`unsafe`/`safer`/`strict`) to sessions, forwarded to hooks via `hooks.Input.SafetyPolicy`
- Enforces `lifecycle.startup_timeout` for MCP/LSP toolset startup, which was previously parsed but never acted on
- Adapts `safer_shell` hook classification to the session `SafetyPolicy`
- Collapses file picker keyboard shortcuts to a single line on wide dialogs
- Strengthens default memory toolset instructions

## Improvements

- Memoizes successful OCI config reads per process, halving warm startup latency for OCI agent refs
- Suppresses spurious empty-response warning for benign post-tool stops in forked-skill sub-sessions
- Agent picker dialog is larger and truncates long lines instead of wrapping; cards are 70 columns wide

## Bug Fixes

- Fixes coalescing of system messages for self-hosted and OpenAI-compatible endpoints that reject multiple system messages (e.g. vLLM with Qwen)
- Fixes OVHcloud default model to `Qwen3.5-397B-A17B`
- Fixes macOS Option-key characters not triggering file picker `alt+h`/`alt+i` visibility toggles
- Removes duplicate "Initializing MCP servers…" spinner from the sidebar that fired on every turn even for agents with no MCP servers
- Adds 5-second timeout to graceful-shutdown calls that previously used `WithoutCancel` without a deadline, preventing indefinite blocking
- Fixes concurrent `Connect` races and goroutine leak on startup timeout for MCP/LSP toolsets
- Fixes auto-deny of tool asks in non-interactive sessions instead of blocking indefinitely
- Fixes tool-call confirmations being dropped without a Resume under `--yolo` in JSON mode
- Fixes Anthropic provider falling back to token thinking for effort levels on models without adaptive thinking support (e.g. Haiku 4.5)
- Fixes tool call render briefly disappearing or shrinking while JSON arguments are still streaming in the lean TUI
- Clamps `max_tokens` to the context window for OpenAI-compatible providers to prevent "context window exceeded" errors on self-hosted vLLM
- Fixes cost and context limit display in the lean TUI

## Technical Changes

- Derives provider API-key env vars forwarded to eval containers from the provider registry instead of a hard-coded list
- Refactors provider client boilerplate into shared helpers across openai, anthropic, gemini, bedrock, and dmr clients
- Consolidates OpenAI-compatible alias provider tests into a single shared test
- Extracts shared `calleeObject` helper in lint cops to remove duplication
- Adds `OTelTracerName` lint cop to enforce scoped OpenTelemetry tracer names
- Replaces 44 `time.Sleep` calls in the test suite with deterministic synchronization primitives
### Pull Requests

- [#3305](https://github.com/docker/docker-agent/pull/3305) - feat(session_plan): per-session markdown plan toolset alongside plan
- [#3333](https://github.com/docker/docker-agent/pull/3333) - fix(tui): accept macOS Option-key chars for file picker toggles
- [#3335](https://github.com/docker/docker-agent/pull/3335) - feat(compaction): allow a dedicated model for session summary generation
- [#3338](https://github.com/docker/docker-agent/pull/3338) - feat: add per-model bypass_models_gateway option
- [#3339](https://github.com/docker/docker-agent/pull/3339) - docs: update CHANGELOG.md for v1.93.0
- [#3340](https://github.com/docker/docker-agent/pull/3340) - docs: sync documentation with recent main merges
- [#3341](https://github.com/docker/docker-agent/pull/3341) - feat: add Baseten provider support
- [#3343](https://github.com/docker/docker-agent/pull/3343) - feat: add OVHcloud AI Endpoints provider support
- [#3345](https://github.com/docker/docker-agent/pull/3345) - chore: bump github.com/anthropics/anthropic-sdk-go to v1.55.0
- [#3357](https://github.com/docker/docker-agent/pull/3357) - fix(openai): coalesce system messages for self-hosted and open-model endpoints
- [#3358](https://github.com/docker/docker-agent/pull/3358) - feat: add Groq as a supported model provider
- [#3359](https://github.com/docker/docker-agent/pull/3359) - docs: group and collapse left navigation sections (#3359)
- [#3360](https://github.com/docker/docker-agent/pull/3360) - docs: group and collapse left navigation sections
- [#3361](https://github.com/docker/docker-agent/pull/3361) - feat: add DeepSeek as a supported model provider
- [#3364](https://github.com/docker/docker-agent/pull/3364) - docs: list providers alphabetically by name in nav
- [#3365](https://github.com/docker/docker-agent/pull/3365) - fix(docs): restore inline code contrast in light mode
- [#3366](https://github.com/docker/docker-agent/pull/3366) - feat: collapse file picker shortcuts to one line on wide dialogs
- [#3367](https://github.com/docker/docker-agent/pull/3367) - fix(tui): remove duplicate MCP-init spinner from sidebar
- [#3368](https://github.com/docker/docker-agent/pull/3368) - feat: add Cerebras as a supported model provider
- [#3369](https://github.com/docker/docker-agent/pull/3369) - feat: add Fireworks AI as a supported model provider
- [#3370](https://github.com/docker/docker-agent/pull/3370) - fix: add 5s timeout to graceful-shutdown calls that used WithoutCancel
- [#3373](https://github.com/docker/docker-agent/pull/3373) - feat: enforce lifecycle.startup_timeout for MCP/LSP toolset startup
- [#3374](https://github.com/docker/docker-agent/pull/3374) - test: consolidate OpenAI-compatible alias provider tests
- [#3375](https://github.com/docker/docker-agent/pull/3375) - refactor(config): derive provider API-key env vars from config
- [#3376](https://github.com/docker/docker-agent/pull/3376) - feat: add Together AI as a supported model provider
- [#3377](https://github.com/docker/docker-agent/pull/3377) - fix: unblock headless tool-Ask paths (dispatcher + JSON runner)
- [#3378](https://github.com/docker/docker-agent/pull/3378) - feat(session): add SafetyPolicy primitive and hook pass-through
- [#3379](https://github.com/docker/docker-agent/pull/3379) - feat: add Hugging Face Inference Providers as a supported model provider
- [#3380](https://github.com/docker/docker-agent/pull/3380) - docs: tighten comment guidance in AGENTS.md
- [#3381](https://github.com/docker/docker-agent/pull/3381) - fix(anthropic): use token thinking for effort levels on models without adaptive support
- [#3382](https://github.com/docker/docker-agent/pull/3382) - fix(tui): keep tool call render stable while args stream
- [#3383](https://github.com/docker/docker-agent/pull/3383) - feat(hooks/safer_shell): adapt classification to session SafetyPolicy
- [#3384](https://github.com/docker/docker-agent/pull/3384) - feat: add Moonshot AI (Kimi) as a supported model provider
- [#3385](https://github.com/docker/docker-agent/pull/3385) - feat: add Vercel AI Gateway as a supported model provider
- [#3386](https://github.com/docker/docker-agent/pull/3386) - feat(lint): add OTelTracerName cop to enforce scoped tracer names
- [#3388](https://github.com/docker/docker-agent/pull/3388) - test: make models-list tests hermetic and parallelizable
- [#3389](https://github.com/docker/docker-agent/pull/3389) - feat: add Cloudflare Workers AI and AI Gateway as model providers
- [#3390](https://github.com/docker/docker-agent/pull/3390) - feat: add tags field to agent config metadata
- [#3391](https://github.com/docker/docker-agent/pull/3391) - feat: add mouse support to the agent picker (hover, double-click, wheel)
- [#3392](https://github.com/docker/docker-agent/pull/3392) - fix(runtime): suppress spurious empty-response warning for benign post-tool stops
- [#3393](https://github.com/docker/docker-agent/pull/3393) - fix: clamp max_tokens to the context window for OpenAI-compatible providers
- [#3394](https://github.com/docker/docker-agent/pull/3394) - feat: show metadata tags as coloured chips in the agent picker
- [#3395](https://github.com/docker/docker-agent/pull/3395) - feat(memory): strengthen default toolset instructions
- [#3396](https://github.com/docker/docker-agent/pull/3396) - refactor: extract shared calleeObject helper in lint cops
- [#3397](https://github.com/docker/docker-agent/pull/3397) - perf(config): memoize successful OCI reads to halve warm startup latency
- [#3398](https://github.com/docker/docker-agent/pull/3398) - refactor(provider): deduplicate provider client boilerplate
- [#3399](https://github.com/docker/docker-agent/pull/3399) - test: make the test suite faster and sleep-free
- [#3400](https://github.com/docker/docker-agent/pull/3400) - fix: show lean tui cost and context limit
- [#3403](https://github.com/docker/docker-agent/pull/3403) - feat(tui): add /effort command to select the model's reasoning level


## [v1.93.0] - 2026-06-30

This release adds OpenRouter as a built-in provider, introduces per-model gateway bypass support, and allows a dedicated model for session compaction, alongside several internal refactoring improvements.

## What's New
- Adds OpenRouter as a first-class built-in provider; when `OPENROUTER_API_KEY` is set, the provider is auto-detected and its base URL resolved automatically
- Adds a `compaction_model` field to allow a dedicated model for session summary generation, separate from the primary agent model
- Adds a `bypass_models_gateway` boolean field on a per-model basis, allowing specific models to connect directly to their provider instead of routing through the configured models gateway

## Technical Changes
- Replaces mutex usage with atomic types (`atomic.Bool`, `atomic.Pointer`) for single mutable fields in several structs
- Replaces package-level global variables with explicit parameters or struct fields to enable parallel-safe testing across several packages (`toolinstall`, `runtime`, `mcp`, `notification`, `tui`, `cmd/root`)
- Adds a concurrency group to the PR review trigger CI workflow to prevent duplicate reviews for the same PR
### Pull Requests

- [#3330](https://github.com/docker/docker-agent/pull/3330) - refactor: replace single-variable mutexes with atomic types
- [#3331](https://github.com/docker/docker-agent/pull/3331) - docs: update CHANGELOG.md for v1.92.0
- [#3332](https://github.com/docker/docker-agent/pull/3332) - refactor: replace test-overridden globals with parallel-safe injection
- [#3334](https://github.com/docker/docker-agent/pull/3334) - ci: add concurrency group to pr-review-trigger to prevent duplicate reviews
- [#3335](https://github.com/docker/docker-agent/pull/3335) - feat(compaction): allow a dedicated model for session summary generation
- [#3337](https://github.com/docker/docker-agent/pull/3337) - feat: add OpenRouter provider
- [#3338](https://github.com/docker/docker-agent/pull/3338) - feat: add per-model bypass_models_gateway option


## [v1.92.0] - 2026-06-30

This release adds session context referencing and 1Password secret caching, fixes silent failures on empty/reasoning-only agent turns, and resolves environment variable substitution in model configuration fields.

## What's New

- Adds a `session_context` toolset with `list_sessions` and `read_session` tools, allowing agents to reference previous sessions as context
- Adds `WithRoot` option to worktree creation to decouple from the global data directory
- Caches `op://` secret resolutions and coalesces concurrent lookups to avoid redundant `op` CLI invocations

## Bug Fixes

- Fixes silent failure when the runtime receives empty or reasoning-only turns; these are now surfaced instead of dropped
- Fixes whitespace-only turns being treated as valid output, which could cause re-entry loops
- Fixes `${env.X}` references in `model` and `base_url` config fields not being substituted before being sent to providers
- Fixes `${env.X}` placeholders not being accepted in the `base_url` schema validation
- Fixes empty agent responses on OpenAI-compatible providers caused by multiple consecutive system messages; consecutive system messages are now merged on the `openai_chatcompletions` path (scoped to `openai_chatcompletions` endpoints)
- Fixes `os.Chmod` in `Registry.Write` breaking non-owner callers by making the permission tightening best-effort
- Fixes a data race on the `defaultRegistry` pointer by switching to `atomic.Pointer`
- Fixes `${env.VAR}` not being normalized before `os.ExpandEnv` in filesystem path expansion
- Fixes a transient failure when promoting a worktree directory under concurrency

## Technical Changes

- Extracts `themeRegistry` struct to eliminate global state and enable parallel-safe tests
- Introduces `Registry` struct in `runregistry` to replace process-global directory state
- Removes process-global clock and ID variables from `pkg/session`, moving them into per-session fields
- Introduces `Resolver` type in `userid` and injects cagent ID source in `httpclient` for parallel-safe tests
- Replaces package-level globals with dependency injection across multiple packages to enable parallel-safe tests
- Enables `t.Parallel()` across ~337 test functions in the test suite
- Makes `${env.X}` the canonical variable-expansion syntax in documentation and example YAML files
### Pull Requests

- [#3145](https://github.com/docker/docker-agent/pull/3145) - Merge pull request #3327 from docker/fix/3145-surface-empty-reasoning-only-turns
- [#3304](https://github.com/docker/docker-agent/pull/3304) - fix(config): substitute ${env.X} in model and base_url fields
- [#3314](https://github.com/docker/docker-agent/pull/3314) - docs: update CHANGELOG.md for v1.91.0
- [#3315](https://github.com/docker/docker-agent/pull/3315) - chore: bump direct Go dependencies
- [#3316](https://github.com/docker/docker-agent/pull/3316) - refactor: extract themeRegistry struct for parallel-safe tests
- [#3317](https://github.com/docker/docker-agent/pull/3317) - refactor(runregistry): introduce Registry struct and tighten dir permissions
- [#3318](https://github.com/docker/docker-agent/pull/3318) - feat(worktree): add WithRoot option to decouple from global data dir
- [#3319](https://github.com/docker/docker-agent/pull/3319) - refactor: remove process-global clock/ID vars from pkg/session
- [#3320](https://github.com/docker/docker-agent/pull/3320) - feat(session_context): reference previous sessions as context
- [#3321](https://github.com/docker/docker-agent/pull/3321) - refactor: introduce Resolver type in userid and inject cagent ID source in httpclient for parallel-safe tests
- [#3322](https://github.com/docker/docker-agent/pull/3322) - feat(1password): cache op:// resolutions and coalesce concurrent lookups
- [#3323](https://github.com/docker/docker-agent/pull/3323) - fix: make chmod in Registry.Write best-effort to avoid breaking non-owner callers
- [#3324](https://github.com/docker/docker-agent/pull/3324) - fix: eliminate themeRegistry data race and TOCTOU window
- [#3325](https://github.com/docker/docker-agent/pull/3325) - docs: make ${env.X} the canonical variable-expansion syntax (+ fixes)
- [#3326](https://github.com/docker/docker-agent/pull/3326) - refactor: replace test-mutated globals with dependency injection
- [#3327](https://github.com/docker/docker-agent/pull/3327) - fix(#3145): empty agent response from multiple system messages on OpenAI-compatible providers
- [#3328](https://github.com/docker/docker-agent/pull/3328) - test: enable t.Parallel() across the test suite
- [#3329](https://github.com/docker/docker-agent/pull/3329) - test: enable t.Parallel() in environment, config, and sessioncontext tests


## [v1.91.0] - 2026-06-30

This release adds per-session markdown plan toolset support, extends `instruction_file` to accept multiple files, and includes several bug fixes and documentation updates.

## What's New

- Adds a `session_plan` toolset alongside the existing `plan` toolset, providing per-session markdown plan storage
- Extends `instruction_file` to accept either a single string or a list of file paths, with contents concatenated when multiple paths are provided
- Adds support for a `title` field in `POST /api/sessions` to skip LLM title generation when a title is supplied

## Bug Fixes

- Fixes a data race in `stalledStream.Close` by replacing an unguarded `closed bool` field with `sync.Once`
- Fixes `instruction_file` to omit empty values and drop empty-string list entries

## Technical Changes

- Redesigns the TUI sidebar agents panel to use uniform two-line entries for all agents via a single `renderAgentLine` function
- Computes badge column width once in `agentInfo` in the sidebar
- Extracts a `readInstructionFiles` helper with deferred `root.Close`
- Adds `t.Parallel()` to isolated unit tests across multiple packages
- Corrects a stale doc comment and restores alignment assertion in `effort_gauge_test`
- Updates documentation for `limit_large_tool_results` always-on builtin, the `title` field in `POST /api/sessions`, and model hook `working_dir` and `env` behaviour
### Pull Requests

- [#3290](https://github.com/docker/docker-agent/pull/3290) - feat(hooks): cap oversized tool result payloads
- [#3301](https://github.com/docker/docker-agent/pull/3301) - fix(hooks): cap oversized mcp and a2a tool results
- [#3305](https://github.com/docker/docker-agent/pull/3305) - feat(session_plan): per-session markdown plan toolset alongside plan
- [#3306](https://github.com/docker/docker-agent/pull/3306) - feat: allow instruction_file to accept a list of files
- [#3307](https://github.com/docker/docker-agent/pull/3307) - refactor(sidebar): redesign agents panel to uniform two-line entries
- [#3308](https://github.com/docker/docker-agent/pull/3308) - docs: update CHANGELOG.md for v1.90.0
- [#3309](https://github.com/docker/docker-agent/pull/3309) - chore: bump direct Go dependencies
- [#3310](https://github.com/docker/docker-agent/pull/3310) - feat(server): accept title in POST /api/sessions to skip LLM title generation
- [#3311](https://github.com/docker/docker-agent/pull/3311) - test: enable t.Parallel() on isolated unit tests
- [#3312](https://github.com/docker/docker-agent/pull/3312) - fix: data race in stalledStream.Close using sync.Once
- [#3313](https://github.com/docker/docker-agent/pull/3313) - docs: sync /docs with recent merged PRs


## [Unreleased]

## What's New

- Extends the agent `instruction_file` field to accept a list of files in addition to a single path; when several files are listed, their contents are concatenated in order (separated by a blank line)


## [v1.90.0] - 2026-06-29

This release adds support for OpenCode Go and OpenCode Zen providers and improves error handling for stream truncation during model inference.

## What's New
- Adds OpenCode Go (`opencode-go`) and OpenCode Zen (`opencode-zen`) as built-in provider aliases, including automatic API key detection via `OPENCODE_API_KEY`

## Bug Fixes
- Fixes handling of stream truncation errors: retries when a stream is unexpectedly cut mid-response and clarifies the error message shown to users
- Fixes error handling for mid-stream connection drops in truncation error reporting
### Pull Requests

- [#3211](https://github.com/docker/docker-agent/pull/3211) - feat: add OpenCode Go and OpenCode Zen provider support
- [#3298](https://github.com/docker/docker-agent/pull/3298) - Merge pull request #3302 from docker/fix/3298-retry-stream-truncation
- [#3302](https://github.com/docker/docker-agent/pull/3302) - fix(modelerrors): retry stream truncation and clarify the error (#3298)
- [#3303](https://github.com/docker/docker-agent/pull/3303) - docs: update CHANGELOG.md for v1.89.0


## [v1.89.0] - 2026-06-29

This release brings significant new capabilities including a safety-check hook system, TUI improvements with retry support and new slash commands, expanded hook and config features, and a large number of internal quality improvements around context threading, linting, and test performance.

## What's New

- Adds `usage` and `cost` fields to the `after_llm_call` hook payload, exposing per-turn token usage and computed USD cost
- Adds a `triage-prs` skill for triaging open pull requests
- Adds a TUI e2e test harness (`tuitest`) with VCR cassette support, plus live/frame-dump debugging, mouse, and clipboard helpers
- Adds a retry button to TUI error messages, allowing one-click recovery after agent turn failures
- Adds key/value `metadata` field to tool-call confirmation events, rendered in the TUI confirmation dialog
- Adds `${env.X}` expansion support in toolset `env` values (in addition to the existing `${X}` syntax)
- Adds `triage-prs` skill for automated PR classification and triage
- Adds fork suffix deduplication across sibling forks so parallel forks of the same parent get unique `(fork N)` suffixes
- Adds tool-scoping for fork-mode skills via `allowed_tools` and `toolsets` frontmatter fields
- Adds `url` field support in agent `/commands` config, opening a URL in the user's default browser instead of sending a prompt
- Adds `{{session_id}}` expansion in URL commands
- Persists agent failures as first-class `Error` session items so errors survive session reload and appear in the TUI
- Adds `instruction_file` field to agent config for referencing external instruction files
- Adds `open_url` built-in toolset for agents to open a configured URL in the user's default browser
- Adds `preempt_yolo` flag on `pre_tool_use` hook entries and a `safer_shell` builtin that classifies shell commands and forces confirmation for destructive operations
- Adds file-based plan revisions, free-form status field, and optimistic locking to the plan toolset, including new `export_plan_to_file` and `update_plan_from_file` tools
- Embeds a models.dev catalog snapshot as a binary fallback for offline/air-gapped environments
- Adds timing instrumentation to the model picker pipeline
- Adds `/feedback` and `/bug` slash commands to the TUI
- Adds `WrapErrors` lint cop to catch `fmt.Errorf` calls that discard error chains
- Adds constructor side-effect lint cops preventing goroutines, command execution, and network I/O in constructors
- Adds deferred mutex unlock lint cop and converts existing terminal unlocks to deferred form
- Adds `ContextConnectivity` whole-program lint cop and threads context throughout the codebase
- Builtin hooks now honor `working_dir` and `env` fields

## Improvements

- Returns 1,000,000-token context window for Claude Opus 4.6/4.7/4.8 families instead of the 200k fallback
- Reuses a single warmed models.dev store across runtime, server, and embedded-chat paths instead of warming independently per session
- Caps oversized tool result payloads (filesystem, shell, MCP, and A2A) at 2,000 lines / 50 KiB, saving the full output to a temp file
- Removes redundant agent-switch and thinking-level toast notifications whose results are already visible in the UI
- Speeds up Go test suite by ~37% with shared shims and offline fixtures

## Bug Fixes

- Fixes per-model attachment capability override so custom/aliased OpenAI-compatible providers (Ollama, xai, mistral, etc.) can declare image/PDF support when absent from models.dev
- Fixes cycling thinking level in the lean TUI via Shift+Tab
- Fixes `ctrl+1`–`ctrl+9` agent quick-switch shortcuts broken under the Kitty keyboard protocol
- Fixes lock-state modifiers being incorrectly applied to `ctrl+N` agent switch
- Fixes MCP OAuth token persistence in sandboxes by falling back to a file-backed keyring when the OS keyring is unavailable, using a per-install random passphrase
- Fixes data races in scroll state and session store updates
- Fixes suppression of re-emitted `UserMessageEvent` before `StreamStarted` on retry
- Fixes `~` expansion to respect the `HOME` environment variable before falling back to `os.UserHomeDir()`
- Fixes DMR model selection to prefer locally pulled models and surface actionable pull errors
- Fixes recovery from corrupted partial model downloads (HTTP 416)
- Fixes URL validation before handing URLs to the OS opener
- Fixes context cancellation being passed to the browser opener (strips it before launch)
- Fixes `Tool.Metadata` serialization to avoid duplicate/stale wire fields
- Fixes session working directory usage in TUI so `/shell` opens in the worktree directory rather than the process CWD
- Fixes context-cancelled errors being cached in the model picker
- Fixes branching and cloning sessions that contain error items

## Technical Changes

- Freezes config schema v10 and starts v11 as latest
- Parallelizes `build-image` CI job across native runners
- Switches CI Task installation from source compilation to prebuilt binary (~51s → 1s)
- Adds `t.Parallel()` to 1,216 eligible top-level tests across 165 files
- Refactors `Coordinator` methods to be receiver-based, keeping package-level shims for compatibility
- Extracts `buildDefaultStore` for testability and adds fallback-ordering tests
- Extracts `isClaudeOpus46To48` helper to deduplicate Opus matching logic
- Threads context through `Runtime` interface methods, RAG helpers, DB setup, memory initialization, sound playback, and other call paths
- Uses `context.WithoutCancel` for shutdown and flush paths
- Resolves proxy allowlist at dial time and caches it at construction
- Speeds up custom linters using new rubocop-go helpers
### Pull Requests

- [#2615](https://github.com/docker/docker-agent/pull/2615) - feat(config): accept ${env.X} in toolset env values (#2615)
- [#2741](https://github.com/docker/docker-agent/pull/2741) - Merge branch 'main' into fix/2741-attachment-caps-override
- [#2994](https://github.com/docker/docker-agent/pull/2994) - feat(runtime): expose per-turn usage and cost in the after_llm_call hook payload
- [#3037](https://github.com/docker/docker-agent/pull/3037) - fix: fall back to file-backed keyring when OS keyring is unavailable (fixes #3037)
- [#3074](https://github.com/docker/docker-agent/pull/3074) - Merge pull request #3275 from docker/docs/3074-streamstopped-ordering
- [#3088](https://github.com/docker/docker-agent/pull/3088) - fix: respect HOME env var when expanding ~ in paths
- [#3205](https://github.com/docker/docker-agent/pull/3205) - fix(providers): add per-model attachment capability override (#2741)
- [#3246](https://github.com/docker/docker-agent/pull/3246) - fix: cycle thinking level in lean tui
- [#3248](https://github.com/docker/docker-agent/pull/3248) - freeze config v10 and start v11 as latest
- [#3249](https://github.com/docker/docker-agent/pull/3249) - feat(skills): add triage-prs skill
- [#3251](https://github.com/docker/docker-agent/pull/3251) - docs: update CHANGELOG.md for v1.88.1
- [#3252](https://github.com/docker/docker-agent/pull/3252) - feat: add TUI e2e test harness
- [#3253](https://github.com/docker/docker-agent/pull/3253) - feat: add retry button to TUI error messages
- [#3254](https://github.com/docker/docker-agent/pull/3254) - feat(server): bump fork suffix across sibling forks
- [#3255](https://github.com/docker/docker-agent/pull/3255) - fix: persist MCP OAuth tokens in sandboxes via file-backed keyring fallback (#3037)
- [#3256](https://github.com/docker/docker-agent/pull/3256) - feat: add key/value metadata to tool-call confirmation events
- [#3257](https://github.com/docker/docker-agent/pull/3257) - feat(config): accept ${env.X} in toolset env values (#2615)
- [#3258](https://github.com/docker/docker-agent/pull/3258) - ci: parallelize build-image across native runners
- [#3259](https://github.com/docker/docker-agent/pull/3259) - feat: persist agent failures in the session
- [#3260](https://github.com/docker/docker-agent/pull/3260) - feat: add tool-scoping for fork-mode skills
- [#3261](https://github.com/docker/docker-agent/pull/3261) - feat: support URL-opening /commands in agent config
- [#3265](https://github.com/docker/docker-agent/pull/3265) - fix(tui): restore ctrl+1..ctrl+9 agent quick-switch shortcuts
- [#3266](https://github.com/docker/docker-agent/pull/3266) - refactor(tui): remove redundant agent-switch and thinking-level toasts
- [#3267](https://github.com/docker/docker-agent/pull/3267) - feat: return 1M context for Claude Opus 4.6/4.7/4.8 families
- [#3268](https://github.com/docker/docker-agent/pull/3268) - fix(dmr): prefer local models and surface actionable pull errors
- [#3269](https://github.com/docker/docker-agent/pull/3269) - ci: install Task from prebuilt binary instead of compiling
- [#3270](https://github.com/docker/docker-agent/pull/3270) - docs: document URL-opening /commands and clean up /feedback and /bug
- [#3272](https://github.com/docker/docker-agent/pull/3272) - feat(config): support external instruction files via instruction_file
- [#3273](https://github.com/docker/docker-agent/pull/3273) - feat: safety_check hook + safer_shell builtin
- [#3274](https://github.com/docker/docker-agent/pull/3274) - feat(plan): file-based revisions, free-form status, and optimistic locking
- [#3275](https://github.com/docker/docker-agent/pull/3275) - docs(runtime): document StreamStopped ordering and teardown trade-offs (#3074)
- [#3276](https://github.com/docker/docker-agent/pull/3276) - feat: add open_url built-in toolset
- [#3277](https://github.com/docker/docker-agent/pull/3277) - feat(modelsdev): embed models.dev catalog snapshot as binary fallback
- [#3279](https://github.com/docker/docker-agent/pull/3279) - refactor: thread context throughout and enforce ContextConnectivity lint rule
- [#3280](https://github.com/docker/docker-agent/pull/3280) - Remove thinking cycle notice
- [#3283](https://github.com/docker/docker-agent/pull/3283) - docs: document capabilities override and TUI error recovery
- [#3285](https://github.com/docker/docker-agent/pull/3285) - feat: reuse warmed model store, add picker timing, and fix discovery error caching
- [#3286](https://github.com/docker/docker-agent/pull/3286) - fix: open /shell in the session working directory (e.g. --worktree)
- [#3287](https://github.com/docker/docker-agent/pull/3287) - lint: add WrapErrors cop
- [#3288](https://github.com/docker/docker-agent/pull/3288) - lint: enforce deferred mutex unlocks
- [#3289](https://github.com/docker/docker-agent/pull/3289) - Add constructor side-effect lint cops
- [#3290](https://github.com/docker/docker-agent/pull/3290) - feat(hooks): cap oversized tool result payloads
- [#3293](https://github.com/docker/docker-agent/pull/3293) - Faster lint
- [#3294](https://github.com/docker/docker-agent/pull/3294) - test: speed up Go test suite by ~37% with shared shims and offline fixtures
- [#3295](https://github.com/docker/docker-agent/pull/3295) - feat: builtin hooks now honor working_dir and env
- [#3296](https://github.com/docker/docker-agent/pull/3296) - test: add t.Parallel() to eligible tests
- [#3297](https://github.com/docker/docker-agent/pull/3297) - docs: replace stale safety_check references with preempt_yolo pre_tool_use
- [#3299](https://github.com/docker/docker-agent/pull/3299) - refactor: receiver-based Coordinator and parallel provider tests
- [#3300](https://github.com/docker/docker-agent/pull/3300) - chore: bump direct Go dependencies
- [#3301](https://github.com/docker/docker-agent/pull/3301) - fix(hooks): cap oversized mcp and a2a tool results


## [v1.88.1] - 2026-06-26

This release adds session forking by user-message ordinal and includes documentation updates for recently merged features.

## What's New
- Adds the ability to fork a session by user-message ordinal, allowing clients to target "the Nth user message" directly without translating to a flat message-stream index

## Technical Changes
- Bumps `github.com/dgageot/rubocop-go` to pull in a new whole-program, inter-procedural dataflow analysis engine and the `Lint/ContextConnectivity` cop
- Updates documentation for the `plan` builtin toolset, the `readonly` attribute for toolsets and agents, and top-level shared toolsets with `use_toolsets`
- Fixes tool ordering and `list_plans` description in plan docs; adds `updatedAt` to `read_plan` description
### Pull Requests

- [#3226](https://github.com/docker/docker-agent/pull/3226) - feat: add readonly attribute for toolsets and agents
- [#3227](https://github.com/docker/docker-agent/pull/3227) - feat: add plan builtin toolset for shared multi-agent collaboration
- [#3232](https://github.com/docker/docker-agent/pull/3232) - feat: add top-level shared toolsets with use_toolsets agent field
- [#3244](https://github.com/docker/docker-agent/pull/3244) - docs: update docs for features merged 2026-06-25 (plan toolset, readonly, shared toolsets)
- [#3245](https://github.com/docker/docker-agent/pull/3245) - docs: update CHANGELOG.md for v1.88.0
- [#3247](https://github.com/docker/docker-agent/pull/3247) - chore: bump rubocop-go for whole-program context cop
- [#3250](https://github.com/docker/docker-agent/pull/3250) - feat(server): fork session by user-message ordinal


## [v1.88.0] - 2026-06-26

This release overhauls the TUI with a redesigned Agents panel, Agent Inspector, configurable keybindings, and image rendering in the lean TUI, plus fixes for provider thinking-budget leaks and OTLP trace export compatibility.

## What's New

- Adds clearer thinking-state vocabulary in the TUI: effort gauge (6-cell), updated labels (`adaptive→auto`), and token budget display
- Redesigns the TUI sidebar Agents panel with a focus card and compact roster layout
- Adds a right-click Agent Inspector showing live and configured agent details
- Labels the delegation spinner with `parent → child` for at-a-glance readability
- Adds configurable keybindings via `~/.config/cagent/config.yaml`, including remappable send/newline keys (resolves `Ctrl+J` conflict in VS Code and tmux)
- Allows embedders to register custom tool renderers keyed by tool name or category, with built-in renderers as fallback
- Adds a pluggable `Storage` interface to the `plan` toolset (parity with the `todo` toolset), with a default filesystem backend and per-instance construction
- Appends OTLP signal path so trace export works with generic base-path backends such as Langfuse and LangSmith
- Renders images in the lean TUI using the Kitty protocol and reuses existing tool call renderers

## Bug Fixes

- Fixes `CloneWithOptions(..., WithNoThinking())` leaking the provider-level `thinking_budget`, which caused short-budget callers (e.g., session-title generation, summaries) to fail
### Pull Requests

- [#3101](https://github.com/docker/docker-agent/pull/3101) - Merge pull request #3115 from docker/feat/tui-delegation-spinner-readability
- [#3108](https://github.com/docker/docker-agent/pull/3108) - feat(tui): readable thinking state, redesigned Agents panel, and Agent Inspector
- [#3115](https://github.com/docker/docker-agent/pull/3115) - feat(tui): live status + labeled spinner for delegation (#3101)
- [#3202](https://github.com/docker/docker-agent/pull/3202) - Let embedders register custom tool renderers
- [#3204](https://github.com/docker/docker-agent/pull/3204) - feat(tui): configurable keybindings (Shift+Enter / Ctrl+J newline alternative)
- [#3236](https://github.com/docker/docker-agent/pull/3236) - docs: update CHANGELOG.md for v1.87.0
- [#3238](https://github.com/docker/docker-agent/pull/3238) - fix(provider): WithNoThinking clone no longer leaks provider-level thinking_budget
- [#3239](https://github.com/docker/docker-agent/pull/3239) - feat(plan): add pluggable Storage interface (parity with todo toolset)
- [#3240](https://github.com/docker/docker-agent/pull/3240) - feat(otel): append OTLP signal path so Langfuse and LangSmith work
- [#3242](https://github.com/docker/docker-agent/pull/3242) - test(teamloader): wire test provider registry in agent config retention test
- [#3243](https://github.com/docker/docker-agent/pull/3243) - Lean TUI tool renderers


## [v1.87.0] - 2026-06-25

This release adds shared toolsets, a new `plan` builtin toolset for multi-agent collaboration, and a `readonly` attribute for toolsets and agents, alongside several MCP OAuth reliability fixes and improvements to attachment forwarding and deterministic prompt ordering.

## What's New

- Adds a top-level `toolsets` map to the config schema, allowing toolset definitions to be shared and referenced by name from any agent via a new `use_toolsets` field
- Adds a `plan` builtin toolset that provides agents a shared, persistent scratchpad (`write_plan`, `read_plan`, and related tools) for multi-agent collaboration across turns
- Adds a `readonly` boolean attribute to both `Toolset` and `AgentConfig`, restricting agents or toolsets to read-only tools when set
- Adds `styles.RegisterBuiltinThemes(fsys fs.FS)` for Go SDK embedders to contribute additional built-in themes from a filesystem
- Adds `SessionID` to `ErrorEvent` and session-aware constructors so `isRootEvent` correctly filters child-session errors

## Bug Fixes

- Fixes image and PDF attachments being silently dropped for DMR-hosted models that are absent from the models.dev catalog
- Fixes MCP OAuth auto-recovery: a server-side `401 invalid_token` rejection now evicts and refreshes the token instead of burning all reconnect attempts and entering `StateFailed`
- Fixes a retry storm on permanent OAuth reconnect errors in MCP
- Fixes non-interactive sessions stalling silently when an OAuth-protected MCP server has no cached token; now fails fast with an error
- Fixes `BuildAuthorizationURL` incorrectly appending a second `?` when the OAuth authorization endpoint already contains a query string
- Fixes eval runs failing with `unknown provider type "anthropic"` by building the judge model from the populated provider registry
- Fixes a TUI dialog being silently dropped when a nested sub-agent stream started in the same session, leaving the run blocked on user input
- Fixes non-deterministic prompt ordering in `ScriptToolSet` by sorting `shellTools` and `tool.Args` keys before iteration, preventing Anthropic prompt-cache misses
- Fixes provider registry being empty for RAG toolsets and other code paths after an earlier refactor emptied the default registry
- Fixes a compile error caused by a call site using the old unexported name `interactivePromptsAllowed` after it was renamed to `InteractivePromptsAllowed`

## Technical Changes

- Converts bug and feature GitHub issue templates from markdown to issue forms (`.yml`)
- Makes registered theme precedence last-wins, using `slices.Backward` for iteration
- Surfaces re-auth notices and ensures background MCP OAuth reconnects are non-interactive
### Pull Requests

- [#3134](https://github.com/docker/docker-agent/pull/3134) - chore: convert bug/feature issue templates to issue forms
- [#3182](https://github.com/docker/docker-agent/pull/3182) - Let embedders register built-in themes via RegisterBuiltinThemes
- [#3196](https://github.com/docker/docker-agent/pull/3196) - fix: restore provider registry after cf5a430d2 emptied the default
- [#3197](https://github.com/docker/docker-agent/pull/3197) - fix: forward image and PDF attachments for DMR models
- [#3199](https://github.com/docker/docker-agent/pull/3199) - feat(server): expose session forking over HTTP
- [#3201](https://github.com/docker/docker-agent/pull/3201) - feat(serve): add live pprof HTTP server to serve api command
- [#3206](https://github.com/docker/docker-agent/pull/3206) - fix(dmr): detect and use locally-installed Docker Model Runner models
- [#3207](https://github.com/docker/docker-agent/pull/3207) - fix(mcp): auto-recover remote MCP OAuth on server-side invalid_token
- [#3212](https://github.com/docker/docker-agent/pull/3212) - docs: update CHANGELOG.md for v1.86.0
- [#3213](https://github.com/docker/docker-agent/pull/3213) - fix: fail fast on OAuth MCP auth in non-interactive sessions
- [#3214](https://github.com/docker/docker-agent/pull/3214) - chore: bump docker-agent-action to v2.0.1
- [#3215](https://github.com/docker/docker-agent/pull/3215) - docs: update API server, CLI, DMR provider, and Go SDK for PRs #3199 #3201 #3206 #3182
- [#3218](https://github.com/docker/docker-agent/pull/3218) - docs: add Snapshots feature page
- [#3221](https://github.com/docker/docker-agent/pull/3221) - fix(tui): keep pending dialog when a nested sub-agent stream starts
- [#3222](https://github.com/docker/docker-agent/pull/3222) - fix(eval): build judge model from the populated provider registry
- [#3224](https://github.com/docker/docker-agent/pull/3224) - Add SessionID to ErrorEvent so isRootEvent correctly filters child errors
- [#3225](https://github.com/docker/docker-agent/pull/3225) - fix: correct exported name InteractivePromptsAllowed in OAuth MCP handler
- [#3226](https://github.com/docker/docker-agent/pull/3226) - feat: add readonly attribute for toolsets and agents
- [#3227](https://github.com/docker/docker-agent/pull/3227) - feat: add plan builtin toolset for shared multi-agent collaboration
- [#3228](https://github.com/docker/docker-agent/pull/3228) - ci: don't cancel in-progress runs on main
- [#3229](https://github.com/docker/docker-agent/pull/3229) - fix(mcp/oauth): merge query params when building authorize URL (#3229)
- [#3230](https://github.com/docker/docker-agent/pull/3230) - fix(mcp/oauth): merge query params when building authorize URL (#3229)
- [#3232](https://github.com/docker/docker-agent/pull/3232) - feat: add top-level shared toolsets with use_toolsets agent field
- [#3235](https://github.com/docker/docker-agent/pull/3235) - fix: sort script toolset keys for deterministic prompt ordering


## [v1.86.0] - 2026-06-23

This release adds comprehensive OpenTelemetry instrumentation following GenAI semantic conventions, exposes session forking over HTTP, and includes several bug fixes for model streaming, local model detection, and OAuth registration.

## What's New

- Adds end-to-end OpenTelemetry instrumentation across the runtime, including provider chat/embed/rerank spans, session and stream spans, MCP client/server and OAuth flows, A2A server, memory, RAG, evaluation, hook executor, and built-in tool internals — following GenAI semantic conventions
- Adds structured status code classification for GenAI errors in telemetry
- Exposes session forking over HTTP, allowing clients to branch a conversation from a specific point in history
- Adds a hidden `--pprof-addr` flag (and `CAGENT_PPROF_ADDR` env var) to `serve api` that starts a Go pprof HTTP server at `/debug/pprof/` when explicitly configured

## Bug Fixes

- Fixes OAuth Dynamic Client Registration to advertise both `authorization_code` and `refresh_token` grant types, resolving rejections from strict authorization servers
- Fixes detection and use of locally-installed Docker Model Runner models, resolving "No model providers available" and "No models available" symptoms when local models are already pulled
- Fixes permanently stalled `docker-agent run` sessions caused by blocking SSE stream reads with no idle timeout or context cancellation
- Fixes fork validation and stops classifying fork errors by string matching; serializes fork read-modify-write and preserves safety-rail limits
- Fixes `toolset.start` span kind attribute by correctly unwrapping the toolset wrapper

## Technical Changes

- Adds tool count attributes to session and MCP spans
- Adds W3C traceparent injection for remote MCP requests
- Migrates CI/CD references from `docker/cagent-action` to `docker/docker-agent-action` (v2.0.0)
### Pull Requests

- [#2620](https://github.com/docker/docker-agent/pull/2620) - feat(otel): instrument runtime with GenAI semantic conventions
- [#3184](https://github.com/docker/docker-agent/pull/3184) - refactor: make toolsets and providers explicit
- [#3189](https://github.com/docker/docker-agent/pull/3189) - refactor: decouple embedder deps and register keyring store explicitly
- [#3192](https://github.com/docker/docker-agent/pull/3192) - fix: advertise refresh_token grant in OAuth DCR + add Miro MCP example
- [#3194](https://github.com/docker/docker-agent/pull/3194) - docs: update CHANGELOG.md for v1.85.0
- [#3195](https://github.com/docker/docker-agent/pull/3195) - chore: bump go.yaml.in/yaml/v4 and modernc.org/sqlite
- [#3199](https://github.com/docker/docker-agent/pull/3199) - feat(server): expose session forking over HTTP
- [#3201](https://github.com/docker/docker-agent/pull/3201) - feat(serve): add live pprof HTTP server to serve api command
- [#3203](https://github.com/docker/docker-agent/pull/3203) - chore: migrate cagent-action to docker-agent-action (v2.0.0)
- [#3206](https://github.com/docker/docker-agent/pull/3206) - fix(dmr): detect and use locally-installed Docker Model Runner models
- [#3208](https://github.com/docker/docker-agent/pull/3208) - docs: update /docs for PRs merged 2026-06-22–23
- [#3210](https://github.com/docker/docker-agent/pull/3210) - fix: add idle timeout and context cancellation to model stream reads


## [v1.85.0] - 2026-06-22

This release contains only a changelog documentation update for v1.84.0 with no user-facing changes.

## Technical Changes
- Updates CHANGELOG.md with release notes for v1.84.0
### Pull Requests

- [#3190](https://github.com/docker/docker-agent/pull/3190) - docs: update CHANGELOG.md for v1.84.0


## [v1.84.0] - 2026-06-20

This release adds a lean TUI user setting, hardens MCP OAuth token storage, and includes several refactoring changes to make toolsets, providers, and embedder dependencies more explicit.

## What's New

- Adds a `settings.lean` global user config option to make the lean TUI the default for interactive runs, while preserving explicit CLI overrides including `--lean=false`
- Adds a headless chat session API (`pkg/embeddedchat`) for embedding docker-agent runtime conversations in non-docker-agent UIs
- Makes OpenAI, Anthropic, Google, and Amazon Bedrock providers optional via build tags, allowing embedders to drop unneeded providers and shrink binary size
- Makes the RAG toolset opt-in to remove the cgo dependency on go-tree-sitter from embedders that don't need it

## Bug Fixes

- Fixes the Shift+Tab thinking-level cycle to include the `max` effort tier for Claude models that support it (Opus 4.7+, Fable 5, Mythos 5)
- Fixes potential token loss and repeated keyring access in the OAuth token store
- Hardens MCP OAuth token file storage with cross-process locking, reload-before-write merge semantics, Windows-safe atomic file replacement, and migration of legacy keyring entries

## Technical Changes

- Replaces the single keyring OAuth token bundle with a keyring-sealed AES-256/AES-GCM encrypted file, storing only a fixed-size key in the OS keyring
- Refactors toolset and provider registries to be explicit rather than relying on blank imports and `init()` functions
- Decouples embedder dependencies so that `pkg/runtime`, `pkg/model/provider`, and `pkg/tools/mcp` no longer transitively pull in `openai-go` and `99designs/keyring`; moves the OS-keyring-backed MCP OAuth store to its own `pkg/tools/mcp/keyringstore` sub-package
- Removes unused agent in the wasm runtime
### Pull Requests

- [#3171](https://github.com/docker/docker-agent/pull/3171) - feat(embeddedchat): add headless chat session API
- [#3174](https://github.com/docker/docker-agent/pull/3174) - refactor(rag): make the rag toolset opt-in to drop cgo from embedders
- [#3176](https://github.com/docker/docker-agent/pull/3176) - feat(provider): make openai, anthropic, google, and amazon-bedrock optional
- [#3178](https://github.com/docker/docker-agent/pull/3178) - fix(modelinfo): offer the max effort tier in the Shift+Tab thinking cycle
- [#3179](https://github.com/docker/docker-agent/pull/3179) - docs: update CHANGELOG.md for v1.83.0
- [#3181](https://github.com/docker/docker-agent/pull/3181) - Add lean TUI user setting
- [#3183](https://github.com/docker/docker-agent/pull/3183) - docs: update /docs for PRs merged 2026-06-18–20
- [#3184](https://github.com/docker/docker-agent/pull/3184) - refactor: make toolsets and providers explicit
- [#3185](https://github.com/docker/docker-agent/pull/3185) - fix: seal MCP OAuth tokens with keyring-backed file
- [#3187](https://github.com/docker/docker-agent/pull/3187) - Remove unused agent in wasm runtime
- [#3189](https://github.com/docker/docker-agent/pull/3189) - refactor: decouple embedder deps and register keyring store explicitly


## [Unreleased]

## What's New

- Adds `settings.lean: true` user config option (`~/.config/cagent/config.yaml`) to make the lean TUI the default interface for all interactive runs, without needing to pass `--lean` each time

### Pull Requests

- [#3181](https://github.com/docker/docker-agent/pull/3181) - feat(tui): add lean user config setting

## [v1.83.0] - 2026-06-19

This release adds an opt-in sudo askpass flow for shell commands, a headless embedded chat session API, and several bug fixes for cost accounting, session handling, and custom provider model resolution.

## What's New

- Adds opt-in `sudo_askpass: true` flag to the `shell` toolset, bridging `sudo` password prompts to the agent's elicitation flow instead of hanging until timeout
- Adds `pkg/embeddedchat`, a headless chat session API for embedding docker-agent runtime conversations in non-docker-agent UIs, with support for streaming events, tool call confirmation, conversation restart, and cancellation
- Makes OpenAI, Anthropic, Google, and Amazon Bedrock providers optional via build tags, allowing embedders to drop unneeded providers and reduce binary size

## Improvements

- Replaces the bleve full-text search library with a lightweight pure-Go BM25 matcher for model routing, removing a large transitive dependency tree and enabling WebAssembly cross-compilation

## Bug Fixes

- Fixes duplicate `tool_result` blocks for the same `tool_call_id` being passed to strict providers such as AWS Bedrock
- Fixes custom providers (defined with `base_url` + `token_key`) triggering a blocking fetch of the full models.dev catalog (~3.4 MB) on every turn in internet-restricted environments
- Fixes reasoning tokens from streaming usage not being recorded for Anthropic extended-thinking models
- Fixes `run_background_agent` sub-sessions not being persisted to the store
- Adds a warning when an uncatalogued model bills $0 with token usage
- Fixes the Shift+Tab thinking-level cycle in the TUI not offering the `max` effort tier on Claude models that support it (Opus 4.7/4.8, Sonnet 4.6, Fable 5)

## Technical Changes

- Replaces external `go-memoize` and `go-cache` libraries with a new internal `pkg/memoize` package built on `golang.org/x/sync/singleflight`
- Makes the RAG toolset opt-in to remove the cgo dependency on go-tree-sitter from the default build
- Documents YAML anchors, aliases, and merge keys support in the configuration overview
- Documents the 10-second per-toolset tool-listing timeout for wedged MCP servers in the troubleshooting guide
### Pull Requests

- [#1551](https://github.com/docker/docker-agent/pull/1551) - feat(shell): add opt-in sudo askpass flow (#1551)
- [#3154](https://github.com/docker/docker-agent/pull/3154) - fix(runtime): bound per-toolset tool listing during startup (#3137)
- [#3161](https://github.com/docker/docker-agent/pull/3161) - docs: update CHANGELOG.md for v1.82.0
- [#3162](https://github.com/docker/docker-agent/pull/3162) - fix(session): drop duplicate tool results in sanitizeToolCalls
- [#3163](https://github.com/docker/docker-agent/pull/3163) - feat(shell): opt-in sudo askpass flow (#1551)
- [#3165](https://github.com/docker/docker-agent/pull/3165) - fix(modelsdev): skip models.dev fetch for custom providers (#3165)
- [#3166](https://github.com/docker/docker-agent/pull/3166) - docs: document startup tool-listing timeout for wedged MCP servers
- [#3169](https://github.com/docker/docker-agent/pull/3169) - fix(modelsdev): skip models.dev fetch for custom providers (#3165)
- [#3170](https://github.com/docker/docker-agent/pull/3170) - chore: bump direct Go dependencies
- [#3171](https://github.com/docker/docker-agent/pull/3171) - feat(embeddedchat): add headless chat session API
- [#3172](https://github.com/docker/docker-agent/pull/3172) - refactor: replace go-memoize and go-cache with internal memoize package
- [#3173](https://github.com/docker/docker-agent/pull/3173) - fix(runtime): close cost-accounting blind spots (reasoning tokens, $0 spend leaks)
- [#3174](https://github.com/docker/docker-agent/pull/3174) - refactor(rag): make the rag toolset opt-in to drop cgo from embedders
- [#3175](https://github.com/docker/docker-agent/pull/3175) - docs: document YAML anchors, aliases and merge keys
- [#3176](https://github.com/docker/docker-agent/pull/3176) - feat(provider): make openai, anthropic, google, and amazon-bedrock optional
- [#3177](https://github.com/docker/docker-agent/pull/3177) - refactor: replace bleve with lightweight BM25 matcher for model routing
- [#3178](https://github.com/docker/docker-agent/pull/3178) - fix(modelinfo): offer the max effort tier in the Shift+Tab thinking cycle


## [v1.82.0] - 2026-06-18

This release adds visual pause state indicators to the TUI, expands MCP catalog and OAuth support, and fixes several runtime, provider, and memory issues.

## What's New

- Adds a banner to the lean TUI on startup
- Adds Grafana Cloud as a remote streamable-http MCP server to the catalog (monitoring category, OAuth 2.1 authentication)
- Adds pausing/paused visual state indicators to the TUI when the `/pause` command is active

## Bug Fixes

- Fixes reserved character sanitization in the memory toolset's default-path config segment, preventing initialization failures on Windows when agents are loaded from OCI references containing `:` in the image tag
- Fixes sub-session transcript not being persisted when the run loop exits via an error path in `runForwarding`
- Fixes sub-session transcript not being persisted on error path in `runCollecting` (background agent path)
- Fixes startup tool listing hanging indefinitely when a toolset's `Tools()` call blocks; adds a per-toolset timeout so the sidebar no longer gets stuck on "Loading tools..."
- Exempts `list_background_agents` from the runtime loop-killer, which previously flagged it as a repeated identical call
- Fixes `delta.reasoning` field being dropped in the OpenAI-compatible chat-completions stream adapter, resolving silent/empty responses with Qwen3 thinking mode
- Fixes configured headers not being forwarded to OAuth discovery requests for remote MCP servers, resolving repeated auth prompts for servers like Grafana Cloud that require instance-scoping headers
- Fixes OAuth default port normalization in MCP header host scoping
### Pull Requests

- [#3137](https://github.com/docker/docker-agent/pull/3137) - fix(runtime): bound per-toolset tool listing during startup (#3137)
- [#3139](https://github.com/docker/docker-agent/pull/3139) - feat(mcpcatalog): add Grafana Cloud remote MCP server
- [#3143](https://github.com/docker/docker-agent/pull/3143) - docs: update CHANGELOG.md for v1.81.2
- [#3146](https://github.com/docker/docker-agent/pull/3146) - fix(memory): sanitise reserved characters in default-path config segment
- [#3147](https://github.com/docker/docker-agent/pull/3147) - Add a banner in the lean tui
- [#3149](https://github.com/docker/docker-agent/pull/3149) - chore: bump Go dependencies
- [#3151](https://github.com/docker/docker-agent/pull/3151) - fix(runtime): persist sub-session transcript on error path
- [#3152](https://github.com/docker/docker-agent/pull/3152) - fix(runtime): persist sub-session transcript on error path in runCollecting
- [#3153](https://github.com/docker/docker-agent/pull/3153) - docs: sync /docs with main — Grafana Cloud catalog, lean TUI banner, memory path sanitization
- [#3154](https://github.com/docker/docker-agent/pull/3154) - fix(runtime): bound per-toolset tool listing during startup (#3137)
- [#3155](https://github.com/docker/docker-agent/pull/3155) - chore: bump github.com/alecthomas/chroma/v2 to v2.27.0
- [#3156](https://github.com/docker/docker-agent/pull/3156) - feat(tui): show pausing/paused state for /pause
- [#3157](https://github.com/docker/docker-agent/pull/3157) - fix(runtime): exempt list_background_agents from the loop-killer
- [#3158](https://github.com/docker/docker-agent/pull/3158) - fix(providers): consume delta.reasoning in chat-completions stream adapter
- [#3159](https://github.com/docker/docker-agent/pull/3159) - fix(mcp): forward configured headers to OAuth discovery on the server host
- [#3160](https://github.com/docker/docker-agent/pull/3160) - docs: update documentation for recent merged PRs


## [v1.81.2] - 2026-06-16

This release adds Grafana Cloud to the MCP server catalog.

## What's New
- Adds Grafana Cloud as a remote MCP server to the catalog, accessible via `https://mcp.grafana.com/mcp` using streamable-http transport and browser-based OAuth 2.1 authentication
### Pull Requests

- [#3139](https://github.com/docker/docker-agent/pull/3139) - feat(mcpcatalog): add Grafana Cloud remote MCP server


## [v1.79.0] - 2026-06-12

This release adds TUI embedding capabilities, gateway model discovery, and HTTP transport middleware support, along with various fixes and improvements.

## What's New

- Adds embeddable transcript component for TUI integration
- Adds gateway model discovery to automatically populate the model picker with models served by configured gateways
- Adds HTTP transport wrapper support to inject middleware into provider clients
- Adds Shift+Tab keyboard shortcut to cycle through model thinking levels in the TUI
- Adds support for pulling agent from localhost HTTP URLs for local development
- Adds automatic Docker Desktop JWT authentication when pulling from .docker.com URLs

## Improvements

- Makes theme application self-contained with ApplyThemeRef and change hooks
- Exposes read access to transcript messages for embedders
- Adds SetRoot function to re-home all agent state in one call
- Adds NewAtDir function for embedders with custom state layouts
- Centralizes tool-confirmation decision dispatch in toolconfirm

## Bug Fixes

- Fixes remote MCP toolset reconnection after clean idle SSE close
- Fixes gateway discovery implementation issues
- Fixes SSE fallback when transport wrapper is set and transport=websocket
- Fixes Semgrep MCP server authentication configuration to use OAuth

## Technical Changes

- Wires TransportWrapper into Bedrock provider
- Updates lint findings in TUI embedding helpers
- Adds double-check for gateway cache inside singleflight closure
- Rewrites Gemini client if-else chain as switch statement for better code quality

### Pull Requests

- [#3064](https://github.com/docker/docker-agent/pull/3064) - fix: reconnect remote MCP toolsets after clean idle SSE close
- [#3067](https://github.com/docker/docker-agent/pull/3067) - Cycle model thinking level with shift+tab
- [#3075](https://github.com/docker/docker-agent/pull/3075) - Allow pulling agent from localhost http URL for local dev
- [#3077](https://github.com/docker/docker-agent/pull/3077) - Add Docker Desktop JWT when pulling agent from a .docker.com URL
- [#3079](https://github.com/docker/docker-agent/pull/3079) - docs: update CHANGELOG.md for v1.78.0
- [#3080](https://github.com/docker/docker-agent/pull/3080) - Board/tui embedding helpers
- [#3081](https://github.com/docker/docker-agent/pull/3081) - feat(tui): expose read access to transcript messages
- [#3084](https://github.com/docker/docker-agent/pull/3084) - docs: update remote MCP reconnect, thinking runtime cycling, distribution, and Go SDK docs
- [#3085](https://github.com/docker/docker-agent/pull/3085) - fix(mcpcatalog): mark semgrep server as oauth
- [#3086](https://github.com/docker/docker-agent/pull/3086) - feat(runtime): discover gateway-served models for the model picker
- [#3087](https://github.com/docker/docker-agent/pull/3087) - docs: require GPG/SSH commit signing in Git Practices
- [#3090](https://github.com/docker/docker-agent/pull/3090) - feat: add options.WithHTTPTransportWrapper to inject HTTP middleware in provider clients


## [v1.78.0] - 2026-06-11

This release improves MCP server connectivity, adds model thinking level controls, and enhances tool installation safety with checksum verification.

## What's New
- Adds ability to cycle model thinking level with Shift+Tab in the TUI
- Adds `title_model` configuration field for delegating session title generation to a different model
- Adds checksum verification for tool auto-install downloads to ensure binary integrity
- Adds support for `version_overrides` in tool auto-install for better package configuration

## Improvements
- Updates remote MCP examples to prefer Streamable HTTP transport over SSE
- Exposes embeddable TUI components (toolconfirm, StaticSessionState, Stopper) for downstream integration
- Allows loading agent from localhost HTTP URLs for local development
- Adds Docker Desktop JWT authentication when pulling agent from .docker.com URLs

## Bug Fixes
- Fixes reconnection of remote MCP toolsets after clean idle SSE connection closes
- Fixes crash during elicitation channel close by guarding against in-flight sends
- Fixes panic in ScriptToolSet.Instructions() when tool argument descriptions are missing
- Fixes GitHub transport change that was causing test assertion failures

## Technical Changes
- Always allowlists models.dev in sandbox proxy for model catalog resolution
- Restricts localhost HTTP redirects to localhost-only targets for security
- Removes non-working Supabase and Tally entries from MCP catalog documentation

### Pull Requests

- [#3041](https://github.com/docker/docker-agent/pull/3041) - Allow models.dev in sandbox proxy for model catalog resolution
- [#3046](https://github.com/docker/docker-agent/pull/3046) - toolinstall: verify asset checksums and support aqua version_overrides
- [#3048](https://github.com/docker/docker-agent/pull/3048) - Remove MCP non-working servers 
- [#3051](https://github.com/docker/docker-agent/pull/3051) - feat: add title_model for delegating session-title generation
- [#3059](https://github.com/docker/docker-agent/pull/3059) - expose embeddable tui components
- [#3061](https://github.com/docker/docker-agent/pull/3061) - docs: update CHANGELOG.md for v1.76.0
- [#3062](https://github.com/docker/docker-agent/pull/3062) - docs: update CHANGELOG.md for v1.77.0
- [#3064](https://github.com/docker/docker-agent/pull/3064) - fix: reconnect remote MCP toolsets after clean idle SSE close
- [#3065](https://github.com/docker/docker-agent/pull/3065) - docs: update remote MCP examples to prefer Streamable HTTP over SSE
- [#3067](https://github.com/docker/docker-agent/pull/3067) - Cycle model thinking level with shift+tab
- [#3068](https://github.com/docker/docker-agent/pull/3068) - docs: update configuration, sandbox, tools, Go SDK, and MCP catalog docs
- [#3070](https://github.com/docker/docker-agent/pull/3070) - fix: guard elicitation channel close against in-flight sends
- [#3072](https://github.com/docker/docker-agent/pull/3072) - fix: guard type assertions in ScriptToolSet.Instructions() against missing description
- [#3075](https://github.com/docker/docker-agent/pull/3075) - Allow pulling agent from localhost http URL for local dev
- [#3076](https://github.com/docker/docker-agent/pull/3076) - Bump Go dependencies
- [#3077](https://github.com/docker/docker-agent/pull/3077) - Add Docker Desktop JWT when pulling agent from a .docker.com URL


## [v1.77.0] - 2026-06-10

This release is identical to v1.76.0. It was tagged from the same commit to complete a release pipeline run and contains no code changes.

## [v1.76.0] - 2026-06-10

This release adds Claude Fable 5 support, a dedicated model for session-title generation, and checksum verification for tool installs, along with session compaction and TUI fixes.

## What's New

- Adds `title_model` field for delegating session-title generation to a dedicated model
- Adds Claude Fable 5 support with refusal handling and server-side fallbacks via `provider_opts`
- Surfaces model refusals as a distinct finish reason
- Adds asset checksum verification to tool installation and supports aqua `version_overrides`

## Improvements

- Allows models.dev in the sandbox proxy for model catalog metadata resolution
- Makes the TUI editor component embeddable by other modules, with a new `editor.WithPlaceholder` option
- Shows a toast error when opening a URL fails
- Removes MCP catalog entries with broken OAuth

## Bug Fixes

- Fixes agent losing context and halting after the first session compaction by scaling compaction budgets to the context window
- Fixes sub-session tokens being counted in the compaction trigger
- Fixes Anthropic parallel tool calls by routing input_json deltas by content-block index
- Adds a max_tokens floor for Anthropic when thinking is disabled
- Fixes sidebar token usage panel flickering during sub-agent transfers
- Surfaces useful errors when session title generation fails and honors the agent `title_model` in the debug title command
- Fixes fork-mode skill commands looping in the TUI
- Fixes cell alignment when the suggestion overlay cuts a wide rune
- Fixes the configured placeholder not being restored when voice recording stops

## Technical Changes

- Disables git commit signing in test helpers
- Bumps github.com/anthropics/anthropic-sdk-go to v1.49.0

### Pull Requests

- [#3009](https://github.com/docker/docker-agent/pull/3009) - fix(anthropic): route input_json deltas by content-block index
- [#3038](https://github.com/docker/docker-agent/pull/3038) - docs: update CHANGELOG.md for v1.74.0
- [#3039](https://github.com/docker/docker-agent/pull/3039) - bump github.com/anthropics/anthropic-sdk-go to v1.49.0
- [#3040](https://github.com/docker/docker-agent/pull/3040) - Show toast error when opening URL fails
- [#3041](https://github.com/docker/docker-agent/pull/3041) - Allow models.dev in sandbox proxy for model catalog resolution
- [#3042](https://github.com/docker/docker-agent/pull/3042) - fix: agent loses context and halts after first session compaction
- [#3043](https://github.com/docker/docker-agent/pull/3043) - docs: fix stale defaults, wrong tool names, and missing CLI flags
- [#3044](https://github.com/docker/docker-agent/pull/3044) - docs: update evaluation and compaction documentation
- [#3045](https://github.com/docker/docker-agent/pull/3045) - Reusable editor
- [#3046](https://github.com/docker/docker-agent/pull/3046) - toolinstall: verify asset checksums and support aqua version_overrides
- [#3047](https://github.com/docker/docker-agent/pull/3047) - Reusable editor (More)
- [#3048](https://github.com/docker/docker-agent/pull/3048) - Remove MCP non-working servers
- [#3049](https://github.com/docker/docker-agent/pull/3049) - fix: stop sidebar token usage panel flickering during sub-agent transfers
- [#3050](https://github.com/docker/docker-agent/pull/3050) - fix: add max_tokens floor for Anthropic when thinking is disabled
- [#3051](https://github.com/docker/docker-agent/pull/3051) - feat: add title_model for delegating session-title generation
- [#3052](https://github.com/docker/docker-agent/pull/3052) - fix: surface useful errors when session title generation fails
- [#3053](https://github.com/docker/docker-agent/pull/3053) - feat: add Claude Fable 5 support with refusal handling and server-side fallbacks
- [#3057](https://github.com/docker/docker-agent/pull/3057) - fix: prevent fork-mode skill commands from looping in TUI
- [#3059](https://github.com/docker/docker-agent/pull/3059) - expose embeddable tui components
- [#3060](https://github.com/docker/docker-agent/pull/3060) - test: disable git commit signing in test helpers


## [v1.74.0] - 2026-06-09

This release introduces self-update functionality, session read-only mode, and 1Password CLI integration, along with model selection improvements and various bug fixes.

## What's New

- Adds opt-in self-update functionality via `DOCKER_AGENT_AUTO_UPDATE` environment variable with interactive confirmation
- Adds `--session-read-only` flag to view sessions without sending messages in TUI mode
- Adds 1Password CLI integration for secret resolution using `op://` references
- Adds `first_available` model selection for automatic fallback across multiple model candidates
- Adds `user_steering_messages_submit` and `user_followup_submit` hooks for queued user messages

## Improvements

- Updates default agent to use `first_available` model selection with multi-provider fallbacks
- Updates default model versions: OpenAI from `gpt-5-mini` to `gpt-5`, Google from `gemini-2.5-flash` to `gemini-3.5-flash`
- Updates coder agent to use `first_available` model selection instead of hardcoded Anthropic models

## Bug Fixes

- Fixes tool call being dropped when finish_reason shares the same chunk in streaming responses
- Fixes orphaned tool results on session resume that caused validation errors on AWS Bedrock
- Fixes agent field not being preserved during command expansion, causing incorrect routing to root agent
- Fixes binary files being processed in content search operations
- Fixes self-update validation to prevent arbitrary file deletion and detect help flags properly
- Fixes IPv6 6to4, NAT64, site-local and CGNAT ranges not being blocked in SSRF protection

## Technical Changes

- Hardens self-update download and re-exec process against tampering with digest and checksum verification
- Uses SSRF-safe HTTP client for MCP OAuth metadata fetches
- Hardens 1Password provider against silent pass-through and PATH hijacking
- Fixes custom-base-image evaluation template to include docker-agent binary and entrypoint
- Removes broken MCP servers from configuration

### Pull Requests

- [#2990](https://github.com/docker/docker-agent/pull/2990) - docs: update CHANGELOG.md for v1.73.0
- [#2991](https://github.com/docker/docker-agent/pull/2991) - feat: add first_available model selection
- [#2992](https://github.com/docker/docker-agent/pull/2992) - fix: don't drop tool call when finish_reason shares the chunk
- [#2993](https://github.com/docker/docker-agent/pull/2993) - feat: add opt-in self-update
- [#2995](https://github.com/docker/docker-agent/pull/2995) - chore: bump go dependencies (acp-go-sdk, goja)
- [#2996](https://github.com/docker/docker-agent/pull/2996) - refactor(coder): use first_available model selection with multi-provider fallbacks
- [#2997](https://github.com/docker/docker-agent/pull/2997) - feat: update default agent to use first_available model selection
- [#2999](https://github.com/docker/docker-agent/pull/2999) - docs: update agent config reference, custom provider api_type, and slash command behavior
- [#3000](https://github.com/docker/docker-agent/pull/3000) - feat: add user_steering_messages_submit and user_followup_submit hooks
- [#3001](https://github.com/docker/docker-agent/pull/3001) - fix: drop orphaned tool results on session resume
- [#3003](https://github.com/docker/docker-agent/pull/3003) - docs: update default model examples to gpt-5 and gemini-3.5-flash
- [#3004](https://github.com/docker/docker-agent/pull/3004) - docs: add thinking/reasoning guide and expand provider thinking docs
- [#3005](https://github.com/docker/docker-agent/pull/3005) - chore: bump go dependencies
- [#3006](https://github.com/docker/docker-agent/pull/3006) - fix: skip binary files in content search
- [#3007](https://github.com/docker/docker-agent/pull/3007) - fix: preserve agent field during command expansion
- [#3012](https://github.com/docker/docker-agent/pull/3012) - docs: sync config examples with updated default models (gpt-5, gemini-3.5-flash)
- [#3025](https://github.com/docker/docker-agent/pull/3025) - docs: update remaining gpt-5-mini → gpt-5 examples across docs
- [#3026](https://github.com/docker/docker-agent/pull/3026) - feat: add --session-read-only flag to view sessions without sending messages
- [#3028](https://github.com/docker/docker-agent/pull/3028) - docs: document --session-read-only flag for TUI read-only mode
- [#3029](https://github.com/docker/docker-agent/pull/3029) - fix(evals): copy docker-agent binary + entrypoint in custom-base-image template
- [#3031](https://github.com/docker/docker-agent/pull/3031) - fix: block IPv6 6to4, NAT64, site-local and CGNAT ranges in IsPublicIP
- [#3032](https://github.com/docker/docker-agent/pull/3032) - Remove broken MCP servers
- [#3033](https://github.com/docker/docker-agent/pull/3033) - chore: bump go dependencies
- [#3035](https://github.com/docker/docker-agent/pull/3035) - fix: use SSRF-safe HTTP client for MCP OAuth authorization server metadata fetch
- [#3036](https://github.com/docker/docker-agent/pull/3036) - feat: add 1Password CLI integration for secret resolution


## [v1.73.0] - 2026-06-03

This release improves MCP catalog server management, fixes streaming issues with AI providers, and adds memory protection for file search operations.

## What's New

- Adds `--json` flag to `alias list` command for structured output
- Adds ContextLimit helper to modelinfo for centralized context window handling
- Blocks `enable_remote_mcp_server` until the server is actually connected, eliminating the need to re-ask questions

## Improvements

- Removes command queueing - commands are now sent immediately
- Removes empty query truncation from MCP server search, showing all matching servers
- Restricts MCP catalog to OAuth and anonymous-access servers only, removing API key complexity

## Bug Fixes

- Fixes Gemini parallel tool responses by coalescing them into a single Content
- Fixes custom OpenAI provider routing for Responses-only models (gpt-4.1, o-series, gpt-5, Codex)
- Fixes memory explosion in `search_files_content` by capping output at 1 MiB and skipping large files
- Fixes MCP catalog retry logic for existing unstarted entries
- Fixes rollback behavior when MCP server Start is cancelled during OAuth or Tools operations
- Fixes conversation caching to exclude failed chat continuations

## Technical Changes

- Refactors registry operations to reuse single session across digest and pull operations
- Updates OpenAI handler to support newer Responses stream event shapes
- Uses `cmd.Context()` instead of `context.Background()` for proper cancellation support
- Uses `strings.Builder` for message merging to reduce memory allocations
- Improves search_files_content memory handling for symlinks and device files

### Pull Requests

- [#2947](https://github.com/docker/docker-agent/pull/2947) - fix: keep failed chat continuations out of conversation cache
- [#2959](https://github.com/docker/docker-agent/pull/2959) - fix(gemini): coalesce parallel tool responses into a single Content
- [#2966](https://github.com/docker/docker-agent/pull/2966) - feat(cli): support `alias list --json` output
- [#2973](https://github.com/docker/docker-agent/pull/2973) - feat(mcp_catalog): block enable_remote_mcp_server until the server is connected
- [#2974](https://github.com/docker/docker-agent/pull/2974) - docs: update CHANGELOG.md for v1.72.0
- [#2975](https://github.com/docker/docker-agent/pull/2975) - refactor: reuse registry session for OCI pulls
- [#2976](https://github.com/docker/docker-agent/pull/2976) - openai: handle newer Responses stream event shapes
- [#2977](https://github.com/docker/docker-agent/pull/2977) - docs: document alias list --json flag and failure-safe conversation caching
- [#2979](https://github.com/docker/docker-agent/pull/2979) - Don't queue commands
- [#2980](https://github.com/docker/docker-agent/pull/2980) - chore: bump direct Go dependencies
- [#2981](https://github.com/docker/docker-agent/pull/2981) - fix: use cmd.Context() instead of context.Background()
- [#2982](https://github.com/docker/docker-agent/pull/2982) - feat: add ContextLimit helper to modelinfo
- [#2983](https://github.com/docker/docker-agent/pull/2983) - fix: prevent memory explosion in search_files_content
- [#2984](https://github.com/docker/docker-agent/pull/2984) - refactor: remove empty query truncation from MCP server search
- [#2985](https://github.com/docker/docker-agent/pull/2985) - fix(providers): route Responses-only models on custom OpenAI providers
- [#2986](https://github.com/docker/docker-agent/pull/2986) - refactor: use strings.Builder for message merging in oaistream
- [#2988](https://github.com/docker/docker-agent/pull/2988) - refactor: restrict mcp_catalog to oauth and none auth only
- [#2989](https://github.com/docker/docker-agent/pull/2989) - test(mcp): fix staticcheck SA5011 nil-pointer errors in oauth_test


## [v1.72.0] - 2026-06-02

This release adds support for JSON output in alias commands, top-level shared configuration, and includes documentation updates and bug fixes.

## What's New
- Adds Atlassian expert agent example for specialized assistance
- Adds JSON output support for `alias list` command with `--json` flag
- Adds support for top-level shared skills and commands in configuration files

## Bug Fixes
- Fixes HTTP client panic when default transport is wrapped by other libraries

## Technical Changes
- Documents `--agent-picker` flag for interactive agent selection
- Documents MCP embedded resource forwarding to model providers
- Documents OAuth authorization cancel behavior for remote MCP servers
- Refactors configuration handling to support shared skills and commands in latest package

### Pull Requests

- [#2957](https://github.com/docker/docker-agent/pull/2957) - docs: update documentation for agent-picker, MCP embedded resources, and remote MCP OAuth cancel
- [#2962](https://github.com/docker/docker-agent/pull/2962) - docs: update CHANGELOG.md for v1.71.0
- [#2963](https://github.com/docker/docker-agent/pull/2963) - feat(examples): add Atlassian expert agent example
- [#2966](https://github.com/docker/docker-agent/pull/2966) - feat(cli): support `alias list --json` output
- [#2968](https://github.com/docker/docker-agent/pull/2968) - chore: bump Go dependencies
- [#2970](https://github.com/docker/docker-agent/pull/2970) - fix(httpclient): fall back when http.DefaultTransport is not *http.Transport
- [#2971](https://github.com/docker/docker-agent/pull/2971) - feat(config): support top-level shared skills and commands


## [v1.71.0] - 2026-06-02

This release improves GitHub Copilot integration with better API routing and error handling, along with enhanced conversation state management and expanded documentation.

## Bug Fixes
- Fixes GitHub Copilot Responses API auto-selection and error preservation to properly route models to correct endpoints
- Prevents X-Conversation-Id from mutating cached session on retry by making continuations transactional
- Preserves item value fields and Ask permission in Session.Clone operations
- Implements deep-copy for Evals, EvalResult, and ToolDefinitions in session clones
- Updates github-copilot model from gpt-4o to gpt-4.1 to match available models

## Technical Changes
- Freezes configuration schema v9 and starts v10 as latest version
- Adds comprehensive documentation for coding harnesses, caching, lifecycle, defer, and fetch filtering
- Adds end-to-end tests for conversation state handling across failed turns

### Pull Requests

- [#2885](https://github.com/docker/docker-agent/pull/2885) - fix: github-copilot Responses API auto-selection and error preservation (#2885)
- [#2942](https://github.com/docker/docker-agent/pull/2942) - fix: github-copilot Responses API auto-selection and error preservation
- [#2947](https://github.com/docker/docker-agent/pull/2947) - fix: keep failed chat continuations out of conversation cache
- [#2950](https://github.com/docker/docker-agent/pull/2950) - docs: document coding harnesses and fill P0/P1/P2 documentation gaps
- [#2951](https://github.com/docker/docker-agent/pull/2951) - docs: update CHANGELOG.md for v1.70.2
- [#2960](https://github.com/docker/docker-agent/pull/2960) - chore(config): freeze v9 and bump latest to v10
- [#2961](https://github.com/docker/docker-agent/pull/2961) - fix: update github-copilot model from gpt-4o to gpt-4.1


## [v1.70.2] - 2026-06-01

This release adds support for inline skills in agent configuration and improves environment variable handling in path fields, along with several bug fixes.

## What's New
- Adds support for inline skills in agent YAML config, allowing skills to be defined directly without separate files
- Adds support for `${env.VAR}` syntax in path fields as an alias for `${VAR}`

## Improvements
- Streams tool outputs for better real-time feedback

## Bug Fixes
- Fixes duplicate persistent toolset-failure notifications that were stacking in the TUI
- Fixes MCP OAuth dialog re-appearing after user declines authentication
- Surfaces inline-skill decode errors and rejects file reads for inline skills

## Technical Changes
- Removes obsolete expansion-mismatch warnings for path fields
- Extracts failureStreak helper in StartableToolSet
- Removes notification-layer deduplication
- Removes MCP server on OAuth decline and stops providing incorrect information to the model

### Pull Requests

- [#2884](https://github.com/docker/docker-agent/pull/2884) - fix: dedupe persistent toolset-failure notifications (#2884)
- [#2940](https://github.com/docker/docker-agent/pull/2940) - docs: update CHANGELOG.md for v1.70.1
- [#2941](https://github.com/docker/docker-agent/pull/2941) - chore: bump direct Go dependencies
- [#2943](https://github.com/docker/docker-agent/pull/2943) - fix: dedupe persistent toolset-failure notifications
- [#2944](https://github.com/docker/docker-agent/pull/2944) - feat(config): accept ${env.X} in path fields (steps 2-4 of #2615)
- [#2945](https://github.com/docker/docker-agent/pull/2945) - Stream tool outputs
- [#2946](https://github.com/docker/docker-agent/pull/2946) - feat: support inline skills in agent YAML config
- [#2949](https://github.com/docker/docker-agent/pull/2949) - fix(mcp): stop the OAuth Authentication Request loop after the user clicks Cancel


## [v1.70.1] - 2026-06-01

This release introduces agent selection UI, git worktree isolation, theme preselection, and notification improvements for enhanced workflow management.

## What's New

- Adds `--agent-picker` flag for full-screen agent selection dialog with YAML syntax highlighting and scrollable interface
- Adds `--worktree` flag to run agents in isolated git worktrees on dedicated branches
- Adds `--worktree-pr` flag to run agents on GitHub pull requests in separate worktrees
- Adds `--theme` flag to preselect TUI theme at launch, overriding user config settings

## Improvements

- Improves TUI notifications with hover protection, click-to-copy content, and visual enhancements
- Adds worktree cleanup when interactive runs end to maintain clean workspace
- Adds worktree_create hook to prepare fresh git worktrees for agent execution

## Bug Fixes

- Fixes agent config display sanitization and enables YAML soft-wrap in picker dialog

## Technical Changes

- Forwards MCP embedded resources (images, PDFs, text) to model providers as native content blocks
- Adds theme flag validation and completion tests for better user experience

### Pull Requests

- [#2921](https://github.com/docker/docker-agent/pull/2921) - Address review feedback on #2896
- [#2930](https://github.com/docker/docker-agent/pull/2930) - docs: update CHANGELOG.md for v1.70.0
- [#2931](https://github.com/docker/docker-agent/pull/2931) - TUI - Improve notifications
- [#2932](https://github.com/docker/docker-agent/pull/2932) - docs: document --auth-token flag, OAuth callback security note, and TUI notification UX
- [#2933](https://github.com/docker/docker-agent/pull/2933) - feat: add --theme flag to preselect TUI theme
- [#2935](https://github.com/docker/docker-agent/pull/2935) - feat(mcp): forward embedded resources to model providers
- [#2936](https://github.com/docker/docker-agent/pull/2936) - docs: document --theme flag for docker agent run
- [#2937](https://github.com/docker/docker-agent/pull/2937) - feat: add --agent-picker flag for agent selection UI
- [#2938](https://github.com/docker/docker-agent/pull/2938) - feat: run agents in isolated git worktrees
- [#2939](https://github.com/docker/docker-agent/pull/2939) - docs: add --theme launch example to TUI quickstart


## [v1.70.0] - 2026-05-29

This release focuses on text handling improvements, OAuth flow enhancements for MCP catalog servers, and server filtering capabilities.

## What's New

- Adds `--app-name` flag to override the default "docker agent" label in the TUI status bar and window title
- Adds allow-list and block-list filtering for MCP catalog servers via `allowed_servers` and `blocked_servers` configuration options

## Improvements

- Tells the model to proceed automatically after enabling an OAuth server in MCP catalog instead of requiring user to repeat their request
- Restores dynamic progress bar width in evaluation mode (was previously fixed at width 10)

## Bug Fixes

- Fixes rune-safe truncation across multiple UI components: file names in file picker, session titles in session browser, directory names in working-dir picker, tab titles, search query preview, and tool output preview
- Fixes rune-safe truncation of operation descriptions in OpenAPI handling
- Fixes rune-safe search-result preview in filesystem operations
- Prevents sending split UTF-8 runes to embedding models in RAG operations
- Populates ModelID field correctly in after_llm_call hook payload

## Technical Changes

- Removes dead code in WASM agent loop selection
- Adds validation for allowed_servers and blocked_servers in MCP catalog configuration
- Adds warning for unknown server IDs in MCP catalog allow/block lists
- Updates documentation for CLI flags, hook payloads, and OAuth endpoints

### Pull Requests

- [#2896](https://github.com/docker/docker-agent/pull/2896) - Extend unmanaged OAuth flow to drive code exchange in-process
- [#2911](https://github.com/docker/docker-agent/pull/2911) - fix(runtime): populate ModelID in after_llm_call hook payload
- [#2914](https://github.com/docker/docker-agent/pull/2914) - feat: add --app-name flag and fix macOS test symlink issue
- [#2918](https://github.com/docker/docker-agent/pull/2918) - chore: bump direct Go dependencies
- [#2919](https://github.com/docker/docker-agent/pull/2919) - docs: update CHANGELOG.md for v1.69.0
- [#2920](https://github.com/docker/docker-agent/pull/2920) - fix: rune-safe truncation and dead-code cleanup
- [#2921](https://github.com/docker/docker-agent/pull/2921) - Address review feedback on #2896
- [#2925](https://github.com/docker/docker-agent/pull/2925) - fix(mcpcatalog): tell the model to proceed after enabling an OAuth server
- [#2926](https://github.com/docker/docker-agent/pull/2926) - chore: bump direct Go dependencies
- [#2927](https://github.com/docker/docker-agent/pull/2927) - docs: sync CLI flags and hook payload docs with recent changes
- [#2928](https://github.com/docker/docker-agent/pull/2928) - feat: add allow/block-list of servers to the mcp_catalog tool
- [#2929](https://github.com/docker/docker-agent/pull/2929) - docs: sync /docs with changes merged 2026-05-28 – 2026-05-29


## [v1.69.0] - 2026-05-28

This release adds new TUI customization options and improves OAuth authentication handling.

## What's New
- Adds `--app-name` flag to override TUI title display
- Adds `--disable-commands` flag to hide and disable slash commands in TUI
- Adds `--sidebar` flag to control sidebar visibility
- Adds out-of-band callback route for unmanaged OAuth drive-flow

## Improvements
- Extends unmanaged OAuth flow to drive code exchange in-process
- Propagates user-initiated cancellation across the WithoutCancel boundary

## Technical Changes
- Renames OAuth elicitation meta keys from cagent/ to docker-agent/
- Trims aijson re-tests while keeping docker-agent integration tests
- Fixes lint issues in OAuth tests and helpers
- Canonicalizes bootstrapRepo temp dir for macOS in snapshot tests
- Simplifies AllBindings by removing redundant leanMode guard

### Pull Requests

- [#2896](https://github.com/docker/docker-agent/pull/2896) - Extend unmanaged OAuth flow to drive code exchange in-process
- [#2905](https://github.com/docker/docker-agent/pull/2905) - test(tools): trim aijson re-tests, keep docker-agent integration
- [#2909](https://github.com/docker/docker-agent/pull/2909) - docs: update CHANGELOG.md for v1.68.0
- [#2910](https://github.com/docker/docker-agent/pull/2910) - docs: update CHANGELOG.md for v1.68.0 and document cancelled v1.66/v1.67
- [#2913](https://github.com/docker/docker-agent/pull/2913) - feat: add --disable-commands flag to hide and disable slash commands in TUI
- [#2914](https://github.com/docker/docker-agent/pull/2914) - feat: add --app-name flag and fix macOS test symlink issue
- [#2915](https://github.com/docker/docker-agent/pull/2915) - Rename OAuth elicitation meta keys from cagent/ to docker-agent/
- [#2917](https://github.com/docker/docker-agent/pull/2917) - feat: add --sidebar flag to control sidebar visibility


## [v1.68.0] - 2026-05-27

This release adds new features for skills visibility, MCP improvements, sandbox enhancements, TUI improvements, and includes numerous bug fixes and dependency updates.

## What's New

- Adds `docker agent debug skills` command to inspect loaded skills and their sources
- Adds word-level highlighting in the `edit_file` diff view in TUI
- Adds 7 remote streamable-HTTP servers to the MCP catalog toolset
- Enables `redact_secrets` by default for improved security
- Adds sandbox alias/runtime defaults and persistent network allowlist support
- Shows the file path from which each skill is loaded

## Improvements

- Smarter search across sessions
- Persists cookies in remote MCP client for sticky sessions
- Lazy header evaluation in tools for better performance
- Refactors tool argument shape repair to use `github.com/docker/aijson`
- Redacts secrets in command history
- Skips image push in forked repositories in CI
- Documents `--sandbox auto-kit`, `--no-kit` flag, `reset_remote_mcp_server_auth` meta-tool, `mcp_catalog` toolset, and all toolset config options for `api`, `fetch`, and `openapi`
- Reorganizes RAG reference and adds dedicated MCP tool reference page

## Bug Fixes

- Fixes Anthropic SSE in-band errors to return correct HTTP status codes
- Fixes per-message render caches being retained after streaming completes
- Fixes shared session store being closed prematurely in `runtime.Close`
- Fixes MCP OAuth discovery to support RFC 8414 §3.1 path-aware metadata URLs
- Reduces retained tool output memory
- Fixes git operations in snapshot to be scoped from worktree root
- Reverts large MCP media spooling to disk (caused regressions)
- Honours `timeout` and `allow_private_ips` config in A2A with SSRF protection

## Technical Changes

- Bumps `github.com/pb33f/libopenapi` to v0.36.5
- Bumps direct Go dependencies (multiple rounds)

### Pull Requests

- [#2869](https://github.com/docker/docker-agent/pull/2869) - Show the path from where the skill is loaded
- [#2862](https://github.com/docker/docker-agent/pull/2862) - chore: bump github.com/pb33f/libopenapi to v0.36.5
- [#2867](https://github.com/docker/docker-agent/pull/2867) - docs: document --sandbox auto-kit and --no-kit flag
- [#2874](https://github.com/docker/docker-agent/pull/2874) - docs: document reset_remote_mcp_server_auth meta-tool
- [#2880](https://github.com/docker/docker-agent/pull/2880) - fix(anthropic): handle SSE in-band errors with correct HTTP status codes
- [#2881](https://github.com/docker/docker-agent/pull/2881) - feat: add 'docker agent debug skills' command
- [#2876](https://github.com/docker/docker-agent/pull/2876) - docs: document mcp_catalog toolset and reorganize RAG reference
- [#2883](https://github.com/docker/docker-agent/pull/2883) - chore(deps): bump direct Go dependencies
- [#2882](https://github.com/docker/docker-agent/pull/2882) - a2a: honour `timeout` and `allow_private_ips` config (with SSRF protection)
- [#2875](https://github.com/docker/docker-agent/pull/2875) - docs: add dedicated MCP tool reference page
- [#2889](https://github.com/docker/docker-agent/pull/2889) - feat(config): enable redact_secrets by default
- [#2888](https://github.com/docker/docker-agent/pull/2888) - feat(sandbox): alias/runtime sandbox defaults and persistent network allowlist
- [#2866](https://github.com/docker/docker-agent/pull/2866) - fix(#2861): release per-message render caches when streaming completes
- [#2879](https://github.com/docker/docker-agent/pull/2879) - fix: don't close shared session store in runtime.Close
- [#2878](https://github.com/docker/docker-agent/pull/2878) - Polish --sandbox auto-kit output and tool auto-install logging
- [#2877](https://github.com/docker/docker-agent/pull/2877) - fix(mcp/oauth): discover RFC 8414 §3.1 path-aware metadata URLs
- [#2854](https://github.com/docker/docker-agent/pull/2854) - fix: reduce retained tool output memory
- [#2893](https://github.com/docker/docker-agent/pull/2893) - Revert "fix: spool large mcp media to disk"
- [#2894](https://github.com/docker/docker-agent/pull/2894) - feat(mcp_catalog): add 7 remote streamable-http servers
- [#2895](https://github.com/docker/docker-agent/pull/2895) - docs: document all toolset config options for api, fetch, openapi
- [#2898](https://github.com/docker/docker-agent/pull/2898) - Bump go dependencies
- [#2892](https://github.com/docker/docker-agent/pull/2892) - feat(pkg/history): redact secrets in command history
- [#2805](https://github.com/docker/docker-agent/pull/2805) - ci: skip image push in forked repositories
- [#2899](https://github.com/docker/docker-agent/pull/2899) - refactor(tools): use github.com/docker/aijson for tool-arg shape repair
- [#2902](https://github.com/docker/docker-agent/pull/2902) - persist cookies in remote MCP client for sticky sessions
- [#2901](https://github.com/docker/docker-agent/pull/2901) - Smarter search
- [#2900](https://github.com/docker/docker-agent/pull/2900) - feat(tui): word-level highlighting in edit_file diff view
- [#2907](https://github.com/docker/docker-agent/pull/2907) - Lazy headers in tools
- [#2904](https://github.com/docker/docker-agent/pull/2904) - fix(snapshot): scope git operations from worktree root
- [#2908](https://github.com/docker/docker-agent/pull/2908) - chore: bump direct go dependencies


## [v1.67.0] - 2026-05-27

This release was cancelled.


## [v1.66.0] - 2026-05-27

This release was cancelled.


## [v1.65.0] - 2026-05-21

This release adds a skills dialog to the TUI and improves HTTP configuration options for API tools, along with proxy handling fixes.

## What's New
- Adds `/skills` slash command to TUI that displays all available skills with their names, sources, and descriptions

## Improvements
- Adds timeout and allow_private_ips configuration support to api and openapi tools for consistency with fetch tool

## Bug Fixes
- Fixes HTTP proxy support for private IPs in SSRF transport to allow configured proxies on private addresses

## Technical Changes
- Updates configuration documentation and applies minor cleanups

### Pull Requests

- [#2860](https://github.com/docker/docker-agent/pull/2860) - docs: update CHANGELOG.md for v1.64.0
- [#2863](https://github.com/docker/docker-agent/pull/2863) - feat: add skills dialog to TUI
- [#2864](https://github.com/docker/docker-agent/pull/2864) - fix: allow configured HTTP proxy on private IPs in SSRF transport
- [#2865](https://github.com/docker/docker-agent/pull/2865) - feat: add timeout and allow_private_ips support to api and openapi tools


## [v1.64.0] - 2026-05-21

This is a maintenance release with dependency updates and internal improvements.

## Technical Changes
- Maintenance release with dependency updates



## [v1.62.0] - 2026-05-21

This release improves error handling for model context overflow, adds external coding harness support, and includes numerous TUI fixes and performance optimizations.

## What's New

- Adds external coding harness agents that delegate coding tasks to external coding CLIs
- Adds support for running `context: fork` slash commands as sub-sessions instead of inlining them
- Adds docker-agent kit staging in sandbox with skills and prompt files

## Improvements

- Classifies overflow errors by kind to provide more specific error messages for different types of context window issues
- Optimizes session browser rendering to only render visible window rows for better performance with large session histories
- Improves shutdown safety by racing Wait() against deadline and calling ReleaseTerminal on timeout
- Updates Gemini adapter to forward stream chunks that carry only UsageMetadata for accurate token counting

## Bug Fixes

- Fixes URL clicks in TUI by properly handling mouse events
- Fixes crash prevention by not notifying on click if the agent didn't change
- Fixes deadlock in TUI exit safety net and race conditions in shutdown handling
- Fixes auto-scroll blocking user scroll in long elicitation dialogs
- Fixes MCP tool name prefix stripping in callTool functionality
- Fixes OpenAI strict mode support for Notion and Jira MCP tools with gpt-5
- Fixes user_prompt dialog to open scrolled to top and respect user scrolling
- Fixes keychain prompts in tests by using in-memory token store
- Fixes MCP OAuth handler to drop stray callbacks and respond with proper HTTP status codes

## Technical Changes

- Bounds three previously-unbounded caches to prevent memory growth on long sessions
- Uses SSRF-safe HTTP client for remote skills registry
- Honors Cache-Control headers properly in skills caching
- Extracts lrucache package and bounds unbounded caches
- Refactors model override into runAgent request body for atomic model selection
- Updates Grok example to use grok-4.3 model
- Treats wezterm as a terminal that handles shift+enter properly
- Adds clean task to remove generated binary
- Updates various dependencies including Anthropic SDK, AWS Bedrock runtime, and Docker CLI

### Pull Requests

- [#2615](https://github.com/docker/docker-agent/pull/2615) - Merge pull request #2851 from dgageot/docs/2615-variable-expansion
- [#2710](https://github.com/docker/docker-agent/pull/2710) - fix: centralize environment variable expansion at config boundary
- [#2818](https://github.com/docker/docker-agent/pull/2818) - modelerrors: make overflow errors more specific
- [#2820](https://github.com/docker/docker-agent/pull/2820) - Misc Security fixes
- [#2822](https://github.com/docker/docker-agent/pull/2822) - docs: update CHANGELOG.md for v1.61.0
- [#2823](https://github.com/docker/docker-agent/pull/2823) - tui: Fix URL clicks
- [#2824](https://github.com/docker/docker-agent/pull/2824) - Don't notify on click if the agent didn't change
- [#2825](https://github.com/docker/docker-agent/pull/2825) - Treat wezterm as a terminal that knows how to handle shift+enter
- [#2826](https://github.com/docker/docker-agent/pull/2826) - feat: add external coding harness agents
- [#2827](https://github.com/docker/docker-agent/pull/2827) - Add .cache to .gitignore
- [#2830](https://github.com/docker/docker-agent/pull/2830) - perf(tui): only render visible session rows in /sessions dialog
- [#2831](https://github.com/docker/docker-agent/pull/2831) - fix(tui): bound previously-unbounded caches to prevent OOM on long sessions
- [#2833](https://github.com/docker/docker-agent/pull/2833) - docs: document allow_private_ips option and SSRF protection in fetch tool
- [#2835](https://github.com/docker/docker-agent/pull/2835) - docs(memory): fix incorrect default database path placeholder
- [#2836](https://github.com/docker/docker-agent/pull/2836) - fix: use in-memory token store in tests to avoid OS keychain prompt
- [#2837](https://github.com/docker/docker-agent/pull/2837) - fix MCP tool name prefix stripping in callTool
- [#2838](https://github.com/docker/docker-agent/pull/2838) - chore(examples): remove shebang lines and executable bits
- [#2839](https://github.com/docker/docker-agent/pull/2839) - fix(openai): support Notion and Jira MCP tools with gpt-5 strict mode
- [#2840](https://github.com/docker/docker-agent/pull/2840) - feat(mcpcatalog): hide disable / reset_auth tools when no server is enabled
- [#2842](https://github.com/docker/docker-agent/pull/2842) - fix(tui): restore terminal on Ctrl-C when bubbletea shutdown stalls
- [#2843](https://github.com/docker/docker-agent/pull/2843) - fix(tui): user_prompt dialog opens scrolled to top and respects user scrolling
- [#2844](https://github.com/docker/docker-agent/pull/2844) - feat(sandbox): docker-agent kit, gateway allowlist, and assorted --sandbox fixes
- [#2845](https://github.com/docker/docker-agent/pull/2845) - test(server): make TestAttachedServer_DeleteSessionStopsEventStream more robust
- [#2846](https://github.com/docker/docker-agent/pull/2846) - fix(examples): update grok example to use grok-4.3
- [#2847](https://github.com/docker/docker-agent/pull/2847) - chore: add clean task to remove generated binary
- [#2848](https://github.com/docker/docker-agent/pull/2848) - fix(gemini): forward stream chunks that carry only UsageMetadata
- [#2849](https://github.com/docker/docker-agent/pull/2849) - chore: bump direct Go dependencies
- [#2850](https://github.com/docker/docker-agent/pull/2850) - feat(skills): run `context: fork` slash commands as sub-sessions
- [#2851](https://github.com/docker/docker-agent/pull/2851) - docs+config: surface the two env-variable expansion syntaxes (#2615)
- [#2852](https://github.com/docker/docker-agent/pull/2852) - refactor(api): fold model override into runAgent request body


## [v1.61.0] - 2026-05-19

This is a maintenance release that updates documentation for the previous version.

## Technical Changes
- Updates CHANGELOG.md with release notes for v1.60.0

### Pull Requests

- [#2817](https://github.com/docker/docker-agent/pull/2817) - docs: update CHANGELOG.md for v1.60.0


## [v1.60.0] - 2026-05-18

This release adds agent switching commands, MCP server discovery capabilities, and runtime model switching, along with UI improvements and stability fixes.

## What's New
- Adds slash commands for agent switching (e.g., `/plan` to hand off to planner agent)
- Adds MCP catalog toolset for on-demand discovery and activation of remote MCP servers
- Adds runtime model switching with GET/PATCH/POST endpoints for changing models during sessions
- Adds sampling/createMessage support for MCP servers to use the host's LLM
- Adds identity headers (X-Docker-Agent-Version, X-Docker-Desktop-Version) to built-in tool requests

## Improvements
- Renders user pasted content in TUI and collapses large pasted file contents (over 30 lines) into toggleable view
- Routes mouse-wheel events to background dialogs instead of falling through to chat area
- Uses Claude Sonnet 4.6 as default model in Anthropic provider
- Switches to non-preview Gemini model
- Adds configurable thinking expansion in user config

## Bug Fixes
- Fixes evaluation builds with legacy Docker builder by using printf instead of heredoc for /run.sh
- Fixes crash prevention by explicitly sending tool_choice=auto in OpenAI requests with tools
- Fixes Desktop version lookup to be TTL-based and context-independent
- Fixes command resolution before agent switching to prevent lookup failures
- Fixes concurrent access issues by using thread-safe methods and improving snapshot isolation

## Technical Changes
- Refactors toolset creation into individual packages with standardized naming
- Improves concurrent package with thread-safe methods and uses it across multiple components
- Centralizes context-limit resolution in runtime
- Moves concurrency deduplication from trigger to review workflow in CI
- Updates example configuration to use xai/grok-2-latest model

### Pull Requests

- [#2779](https://github.com/docker/docker-agent/pull/2779) - fix(evals): build /run.sh with printf so legacy builder works
- [#2782](https://github.com/docker/docker-agent/pull/2782) - bump github.com/coder/acp-go-sdk from v0.12.2 to v0.13.0
- [#2783](https://github.com/docker/docker-agent/pull/2783) - docs: update CHANGELOG.md for v1.59.0
- [#2784](https://github.com/docker/docker-agent/pull/2784) - feat(tui): show user pasted content
- [#2785](https://github.com/docker/docker-agent/pull/2785) - Use a non preview gemini model
- [#2786](https://github.com/docker/docker-agent/pull/2786) - Use sonnet 4.6 as default in anthropic
- [#2787](https://github.com/docker/docker-agent/pull/2787) - route mouse-wheel events to background dialogs
- [#2789](https://github.com/docker/docker-agent/pull/2789) - ci: move concurrency dedup from trigger to review workflow
- [#2790](https://github.com/docker/docker-agent/pull/2790) - feat: add slash commands for agent switching
- [#2791](https://github.com/docker/docker-agent/pull/2791) - feat(api): accept model overrides on session creation and add runtime model switching endpoints
- [#2793](https://github.com/docker/docker-agent/pull/2793) - docs(site): make the docs site feel like part of Docker, and explain what Docker Agent is
- [#2794](https://github.com/docker/docker-agent/pull/2794) - feat: add mcp_catalog toolset for on-demand MCP server discovery
- [#2795](https://github.com/docker/docker-agent/pull/2795) - feat: add X-Docker-Agent-Version and X-Docker-Desktop-Version headers to built-in tools
- [#2802](https://github.com/docker/docker-agent/pull/2802) - Expand thinking configuration
- [#2803](https://github.com/docker/docker-agent/pull/2803) - bump direct go dependencies
- [#2806](https://github.com/docker/docker-agent/pull/2806) - fix(examples): use xai/grok-2-latest in grok.yaml
- [#2807](https://github.com/docker/docker-agent/pull/2807) - Better tool registry
- [#2810](https://github.com/docker/docker-agent/pull/2810) - Improve concurrent package
- [#2811](https://github.com/docker/docker-agent/pull/2811) - bump direct go dependencies
- [#2813](https://github.com/docker/docker-agent/pull/2813) - fix(openai): explicitly send tool_choice=auto when tools are provided
- [#2814](https://github.com/docker/docker-agent/pull/2814) - fix(runtime): use provider_opts.context_size for compaction
- [#2815](https://github.com/docker/docker-agent/pull/2815) - feat(mcp): add sampling/createMessage support


## [v1.59.0] - 2026-05-13

This release adds XML tool call parsing for better model compatibility, performance improvements for TUI rendering, and enhanced remote runtime capabilities.

## What's New

- Adds XML tool call fallback parsing for models that return `<tool_call>...</tool_call>` text instead of using OpenAI function-calling API
- Adds fd:// scheme support to server.Listen for parent process socket passing
- Adds per-code-block copy affordance with clickable copy glyphs in TUI
- Adds session persistence and resumption for A2A (agent-to-agent) interactions using SQLite
- Adds comprehensive remote runtime API with SSE event streaming, session management, and graceful degradation

## Improvements

- Improves TUI rendering performance with cached output, targeted invalidation, and incremental markdown rendering
- Improves ACP support with session management, event handling, and structured error codes
- Preserves user input across tab switches in TUI dialogs

## Bug Fixes

- Fixes crash during tool auto-install by adding panic recovery
- Fixes SSE stream cancellation and IPv6 address binding issues
- Fixes Vertex AI Model Garden provider capability lookups by rewriting provider to publisher mapping

## Technical Changes

- Replaces internal secretsscan with github.com/docker/portcullis library
- Centralizes modelsdev.Store creation via RuntimeConfig with lazy initialization
- Merges modelcaps into modelinfo and introduces strongly-typed modelsdev.ID
- Refactors event handling to use EventSink interface instead of channel threading
- Removes experimental send, watch, and proto subcommands

### Pull Requests

- [#2732](https://github.com/docker/docker-agent/pull/2732) - xml fallback for llama.cpp models
- [#2744](https://github.com/docker/docker-agent/pull/2744) - feat: add fd:// scheme support to server.Listen
- [#2745](https://github.com/docker/docker-agent/pull/2745) - docs: update CHANGELOG.md for v1.58.0
- [#2746](https://github.com/docker/docker-agent/pull/2746) - refactor: centralize modelsdev.Store creation and inject via RuntimeConfig
- [#2747](https://github.com/docker/docker-agent/pull/2747) - refactor: replace internal secretsscan with github.com/docker/portcullis
- [#2748](https://github.com/docker/docker-agent/pull/2748) - fix: avoid sub-agent terminology in skill instructions to prevent transfer_task confusion
- [#2749](https://github.com/docker/docker-agent/pull/2749) - feat(runtime): remote runtime with full TUI parity and production readiness
- [#2750](https://github.com/docker/docker-agent/pull/2750) - docs: Docker-branded redesign with dark-mode-first theme and improved homepage
- [#2751](https://github.com/docker/docker-agent/pull/2751) - feat: wire TUI/CLI to emit Document parts and render attachments
- [#2752](https://github.com/docker/docker-agent/pull/2752) - feat: add docs preview workflow for PRs
- [#2753](https://github.com/docker/docker-agent/pull/2753) - feat(modelsdev): add WithCache option to override cache file path
- [#2754](https://github.com/docker/docker-agent/pull/2754) - refactor: simplify RuntimeConfig by removing dead field and caching env provider
- [#2755](https://github.com/docker/docker-agent/pull/2755) - refactor: merge modelcaps into modelinfo and simplify
- [#2756](https://github.com/docker/docker-agent/pull/2756) - perf: TUI rendering performance improvements
- [#2757](https://github.com/docker/docker-agent/pull/2757) - feat: improve TUI control plane API for external consumers
- [#2758](https://github.com/docker/docker-agent/pull/2758) - Improve ACP support: session management, event handling, and code simplification
- [#2759](https://github.com/docker/docker-agent/pull/2759) - refactor: extract loopState struct to bundle runTurn parameters
- [#2760](https://github.com/docker/docker-agent/pull/2760) - refactor: replace chan Event threading with EventSink interface
- [#2762](https://github.com/docker/docker-agent/pull/2762) - feat(a2a): allow session to be resumed interactively
- [#2763](https://github.com/docker/docker-agent/pull/2763) - drop send, watch and proto subcommands
- [#2766](https://github.com/docker/docker-agent/pull/2766) - refactor: introduce modelsdev.ID for provider-qualified model identity
- [#2767](https://github.com/docker/docker-agent/pull/2767) - fix: rewrite Vertex AI Model Garden provider to publisher for capability lookups
- [#2768](https://github.com/docker/docker-agent/pull/2768) - fix(toolinstall): recover from panics during auto-install
- [#2771](https://github.com/docker/docker-agent/pull/2771) - bump direct go dependencies
- [#2772](https://github.com/docker/docker-agent/pull/2772) - Fix linter
- [#2773](https://github.com/docker/docker-agent/pull/2773) - perf(tui): make streaming chunk rendering linear
- [#2774](https://github.com/docker/docker-agent/pull/2774) - fix(tui): preserve user_prompt input across tab switches
- [#2775](https://github.com/docker/docker-agent/pull/2775) - fix: two TUI control-plane bugs (SSE cancel, IPv6 listen)
- [#2778](https://github.com/docker/docker-agent/pull/2778) - feat(tui): add per-code-block copy affordance


## [v1.58.0] - 2026-05-11

This release adds external TUI control capabilities, HTTP POST hooks, and several security hardening improvements.

## What's New
- Adds `http_post` builtin hook for making HTTP POST requests from agent workflows
- Adds `--listen` flag to `run` command to expose the running TUI for external control
- Adds `send` subcommand to drive a live TUI session from external processes
- Adds `watch` subcommand to stream events from a running TUI
- Adds `--on-event` hooks to observe arbitrary events during runs
- Adds `--attach` flag to `serve mcp` command to expose running TUI via MCP
- Adds newline-delimited JSON protocol over stdio for external communication
- Adds discovery files for live runs in run registry
- Adds `bump-config-version` skill for configuration management

## Bug Fixes
- Fixes filesystem tool path expansion for `~` (home directory) in file paths
- Fixes model ID handling to use fully-qualified provider/model identifiers for capability lookups
- Fixes Nebius example to use available Kimi-K2.5 model instead of deprecated Kimi-K2-Instruct
- Fixes dry-run mode to work properly before contacting remote servers
- Fixes request context propagation in echo logging
- Fixes run registry permissions and session lifecycle cleanup

## Improvements
- Makes `max_iterations` builtin stateless by using runtime's existing iteration counter
- Hardens `http_post` hook with SSRF-safe client, scheme validation, and request logging
- Consolidates home directory path expansion across the codebase
- Shows current git branch when working in a repository
- Unifies local and remote run dispatch through shared backend interface

## Technical Changes
- Refactors snapshot handling into dedicated `SnapshotController` separate from runtime
- Refactors unload builtin to be pure and runtime-agnostic
- Promotes model switching and tools change subscription onto Runtime interface
- Adds security hardening for secrets provider, archive extraction, OAuth HTTP client, and shell tool
- Enables gosec linter for file permission validation
- Updates Go to version 1.26.3
- Adds migration content pinning to enforce append-only database schema changes

### Pull Requests

- [#2698](https://github.com/docker/docker-agent/pull/2698) - Merge pull request #2708 from dgageot/fix/2698-max-iterations-stateless
- [#2703](https://github.com/docker/docker-agent/pull/2703) - docs: update CHANGELOG.md for v1.57.0
- [#2704](https://github.com/docker/docker-agent/pull/2704) - fix: expand ~ in filesystem tool paths
- [#2705](https://github.com/docker/docker-agent/pull/2705) - feat(hooks): add http_post builtin
- [#2706](https://github.com/docker/docker-agent/pull/2706) - refactor(hooks): make the unload on_agent_switch builtin pure
- [#2707](https://github.com/docker/docker-agent/pull/2707) - refactor: extract SnapshotController so the runtime no longer brokers /undo
- [#2708](https://github.com/docker/docker-agent/pull/2708) - fix: make max_iterations builtin stateless (#2698)
- [#2709](https://github.com/docker/docker-agent/pull/2709) - bump direct go dependencies
- [#2711](https://github.com/docker/docker-agent/pull/2711) - fix: use available Kimi-K2.5 model in nebius example
- [#2712](https://github.com/docker/docker-agent/pull/2712) - bump go to 1.26.3
- [#2713](https://github.com/docker/docker-agent/pull/2713) - security: five defense-in-depth fixes (secrets, archives, oauth, shell tool, request logs)
- [#2714](https://github.com/docker/docker-agent/pull/2714) - feat: let external processes drive a running TUI
- [#2715](https://github.com/docker/docker-agent/pull/2715) - refactor(run): unify local/remote dispatch via Backend (10 baby steps)
- [#2717](https://github.com/docker/docker-agent/pull/2717) - update PR reviewer to 1.5.1
- [#2718](https://github.com/docker/docker-agent/pull/2718) - Change the default models for the golang dev
- [#2719](https://github.com/docker/docker-agent/pull/2719) - Change the app name in otel to docker-agent
- [#2720](https://github.com/docker/docker-agent/pull/2720) - Consolidate home directory path expansion
- [#2721](https://github.com/docker/docker-agent/pull/2721) - Show the current git branch when in a repo
- [#2723](https://github.com/docker/docker-agent/pull/2723) - remote-runtime: close silent gaps, consolidate Runtime, scaffold wire (10 baby steps)
- [#2725](https://github.com/docker/docker-agent/pull/2725) - ci: lint workflow invariants actionlint misses (concurrency, SHA pinning, payload deny-list)
- [#2726](https://github.com/docker/docker-agent/pull/2726) - fix(toolinstall): route the registry client through httpclient.NewSafeClient
- [#2727](https://github.com/docker/docker-agent/pull/2727) - test(session): pin migration catalogue content (append-only enforcement)
- [#2729](https://github.com/docker/docker-agent/pull/2729) - add bump-config-version skill
- [#2730](https://github.com/docker/docker-agent/pull/2730) - ci: enable gosec linter
- [#2731](https://github.com/docker/docker-agent/pull/2731) - refactor(run-control): unify target resolution and SSE handling
- [#2735](https://github.com/docker/docker-agent/pull/2735) - Fix broken test on main
- [#2736](https://github.com/docker/docker-agent/pull/2736) - Add alias
- [#2738](https://github.com/docker/docker-agent/pull/2738) - fix: pass fully-qualified provider/model ID to modelcaps.Load
- [#2742](https://github.com/docker/docker-agent/pull/2742) - chore: bump direct Go dependencies


## [v1.57.0] - 2026-05-07

This release improves markdown rendering performance, adds agent switching capabilities, and enhances secret redaction with better error handling.

## What's New
- Adds unload on_agent_switch builtin hook for releasing model resources when switching between agents

## Improvements
- Speeds up and simplifies markdown fast renderer for better performance
- Trims builtin tool schemas to save tokens in LLM requests
- Tightens Docker PAT redaction and adds organization access tokens support
- Adds more vendor-prefixed secret patterns for improved security scanning

## Bug Fixes
- Fixes retry handling for Vertex AI 'function response parts' 400 errors that occur intermittently
- Restores styles on continuation lines of broken words in markdown rendering
- Fixes H1 prefix and ANSI style handling in wrapText functionality
- Defensively lowercases transient patterns in model error handling
- Caps quantifiers on new secret rules to prevent adjacent text being incorrectly redacted

## Technical Changes
- Adopts new rubocop-go DSL across all linting cops for better code organization
- Uses slog.WarnContext where context is available for improved logging
- Drains unload response body and documents single-tenant assumption

### Pull Requests

- [#2684](https://github.com/docker/docker-agent/pull/2684) - feat: add unload on_agent_switch builtin hook
- [#2686](https://github.com/docker/docker-agent/pull/2686) - Make the FastMarkdown renderer simpler and faster
- [#2687](https://github.com/docker/docker-agent/pull/2687) - refactor(lint): adopt new rubocop-go DSL across all cops
- [#2691](https://github.com/docker/docker-agent/pull/2691) - fix: retry transient Vertex AI 'function response parts' 400 errors
- [#2694](https://github.com/docker/docker-agent/pull/2694) - shrink builtin tool schemas to save tokens
- [#2695](https://github.com/docker/docker-agent/pull/2695) - docs: update CHANGELOG.md for v1.56.0
- [#2697](https://github.com/docker/docker-agent/pull/2697) - secretsscan: tighten Docker PAT, add new vendor patterns, cap quantifiers


## [v1.56.0] - 2026-05-07

This release adds snapshot management capabilities and expands secret detection with 20 new patterns.

## What's New
- Adds `/snapshots` command to list and restore captured snapshots from the current session
- Adds 20 new secret detection patterns including Discord bot tokens, Telegram bot tokens, Fly.io macaroons, Groq API keys, Perplexity API keys, and xAI/Grok API keys

## Technical Changes
- Freezes config v8 and starts v9 as the latest configuration schema version
- Moves non-migration config tests to pkg/config for better organization
- Updates logging to use slog.WarnContext when a context is in scope
- Simplifies snapshot plumbing implementation

### Pull Requests

- [#2688](https://github.com/docker/docker-agent/pull/2688) - freeze config v8 and start v9 as latest
- [#2689](https://github.com/docker/docker-agent/pull/2689) - docs: update CHANGELOG.md for v1.55.0
- [#2690](https://github.com/docker/docker-agent/pull/2690) - feat(tui): add /snapshots command to list and restore captured snapshots
- [#2692](https://github.com/docker/docker-agent/pull/2692) - feat(secretsscan): add 20 more secret patterns
- [#2693](https://github.com/docker/docker-agent/pull/2693) - move non-migration config tests to pkg/config


## [v1.55.0] - 2026-05-07

This release introduces significant security hardening, attachment system foundations, and enhanced configuration capabilities.

## What's New

- Adds HCL configuration format support as an alternative to YAML for agent configurations
- Adds `/pause` command to toggle the runtime loop at iteration boundaries
- Adds `turn_end` hook that fires once per turn regardless of how the turn ended
- Adds shadow snapshots and `/undo` command for restoring file changes without modifying session transcript
- Adds Anthropic Workload Identity Federation support for OIDC-derived authentication
- Adds attachment system foundations with `chat.Document` and per-provider document conversion
- Adds JavaScript/WebAssembly browser build with OpenRouter PKCE support
- Adds custom request headers support for the fetch toolset with environment variable expansion
- Adds allow/deny lists for filesystem toolset to sandbox file access
- Adds wildcard and CIDR pattern support in fetch toolset domain filtering
- Adds input-shape repair layer for tool calls to handle common model mistakes
- Adds MCP embedded resource content type support
- Adds `--hook-stop` CLI flag for the existing stop event
- Adds `--tool-name` flag to override MCP tool identifier
- Adds `--mcp-keepalive` flag for MCP server connections

## Improvements

- Expands secret detection with additional patterns for OpenAI, Anthropic, Google, Stripe, Notion, GitLab, Vault, and Slack tokens
- Speeds up secret redaction with aho-corasick keyword pre-filter
- Improves markdown rendering performance with single-pass URL scanner optimizations
- Enhances session ID and install UUID forwarding on gateway-bound requests for better tracing
- Pauses animation ticks while terminal is blurred to reduce CPU usage
- Propagates non-interactive mode to child sessions and declines elicitation automatically

## Bug Fixes

- Fixes crash on startup when configuration file is empty
- Fixes environment variable race in script shell tool execution
- Fixes data races on session token and message writes
- Fixes lifecycle supervisor state race condition
- Fixes infinite loop on hash-prefixed paragraphs in markdown renderer
- Fixes tab switching and chat scroll functionality while prompts are open
- Fixes compaction kept-tail mapping after prior summaries
- Fixes IPv4-mapped IPv6 SSRF bypass in fetch domain matcher
- Fixes finish_reason stop when tracking usage in OpenAI streams
- Fixes comment-only SSE events that crash openai-go client

## Technical Changes

- Replaces mise with go-task as the project task runner
- Splits builtin tools into individual sub-packages for better organization
- Centralizes model-specific behavior in pkg/modelinfo package
- Tightens file and directory permissions for per-user data to 0o700/0o600
- Adds contextual logging throughout codebase for better trace correlation
- Adds 7 new architectural-sync linting cops that caught 10 real bugs
- Hardens OAuth with constant-time state comparison and SSRF protection
- Blocks non-public IPs in API and OpenAPI tools by default
- Updates jose2go to v1.7.0 to address security vulnerabilities
- Bumps various Go dependencies including Anthropic SDK, Docker CLI, and OpenTelemetry packages

### Pull Requests

- [#2505](https://github.com/docker/docker-agent/pull/2505) - fix(runtime): add OpenTelemetry tracer to runtime initialization
- [#2506](https://github.com/docker/docker-agent/pull/2506) - feat(otel): configure W3C trace propagation for distributed tracing
- [#2586](https://github.com/docker/docker-agent/pull/2586) - Bump direct Go dependencies
- [#2587](https://github.com/docker/docker-agent/pull/2587) - docs: document toon and per-toolset model routing
- [#2588](https://github.com/docker/docker-agent/pull/2588) - docs: update CHANGELOG.md for v1.54.0
- [#2589](https://github.com/docker/docker-agent/pull/2589) - Finish secret redaction
- [#2591](https://github.com/docker/docker-agent/pull/2591) - simplify pkg/hooks: drop unused EventSpec abstraction
- [#2592](https://github.com/docker/docker-agent/pull/2592) - Add turn_end hook
- [#2593](https://github.com/docker/docker-agent/pull/2593) - lint: add 7 architectural-sync cops (catches 10 real bugs)
- [#2594](https://github.com/docker/docker-agent/pull/2594) - Use the latest rubocop-go
- [#2596](https://github.com/docker/docker-agent/pull/2596) - update PR review workflow with fork-supporting trigger
- [#2597](https://github.com/docker/docker-agent/pull/2597) - Bump direct Go dependencies
- [#2598](https://github.com/docker/docker-agent/pull/2598) - Support HCL as an alternative agent config format
- [#2599](https://github.com/docker/docker-agent/pull/2599) - Bump direct Go dependencies
- [#2600](https://github.com/docker/docker-agent/pull/2600) - docs: fix outdated content and document missing commands
- [#2601](https://github.com/docker/docker-agent/pull/2601) - feat(filesystem): add allow_list / deny_list to sandbox the toolset
- [#2602](https://github.com/docker/docker-agent/pull/2602) - fetch: support wildcard and CIDR patterns in domain allow/deny lists
- [#2603](https://github.com/docker/docker-agent/pull/2603) - Add detection rules for more secret formats
- [#2604](https://github.com/docker/docker-agent/pull/2604) - harden docker agent serve api: warn on non-loopback, fix runtime race, block SSRF
- [#2605](https://github.com/docker/docker-agent/pull/2605) - Add /pause command to toggle the runtime loop
- [#2606](https://github.com/docker/docker-agent/pull/2606) - Handle case when session started with Docker Desktop proxy available, and the Desktop is stopped
- [#2609](https://github.com/docker/docker-agent/pull/2609) - deps: bump direct Go dependencies
- [#2610](https://github.com/docker/docker-agent/pull/2610) - docs: refresh outdated examples, missing env vars, and CLI options
- [#2612](https://github.com/docker/docker-agent/pull/2612) - feat(mcp): add support for embedded resource content type
- [#2614](https://github.com/docker/docker-agent/pull/2614) - expand js placeholders in agent and toolset instructions (#2614)
- [#2616](https://github.com/docker/docker-agent/pull/2616) - fix(tools): prevent environment variable race in script shell tool
- [#2618](https://github.com/docker/docker-agent/pull/2618) - docs: fix outdated and incorrect references
- [#2619](https://github.com/docker/docker-agent/pull/2619) - fix(security): bump jose2go to v1.7.0 (GO-2025-4123, GO-2023-2409)
- [#2621](https://github.com/docker/docker-agent/pull/2621) - fix(lifecycle): order state transition before waking restart waiters
- [#2622](https://github.com/docker/docker-agent/pull/2622) - fix(session): close data races on session token and message writes
- [#2623](https://github.com/docker/docker-agent/pull/2623) - feat(runtime): propagate non-interactive mode to child sessions and decline elicitation
- [#2624](https://github.com/docker/docker-agent/pull/2624) - feat(mcp-server): add keep-alive support
- [#2625](https://github.com/docker/docker-agent/pull/2625) - feat(mcp-server): add `--tool-name` flag to override the MCP tool identifier
- [#2627](https://github.com/docker/docker-agent/pull/2627) - feat(hooks): expose `stop` hook via CLI
- [#2631](https://github.com/docker/docker-agent/pull/2631) - feat(gateway): add `X-Cagent-Session-Id` header to models gateway requests
- [#2633](https://github.com/docker/docker-agent/pull/2633) - docs: fill in missing CLI flags and fix outdated content
- [#2635](https://github.com/docker/docker-agent/pull/2635) - feat(tools): generic input-shape repair for tool calls (validate-then-repair)
- [#2637](https://github.com/docker/docker-agent/pull/2637) - bump direct Go dependencies
- [#2638](https://github.com/docker/docker-agent/pull/2638) - Fix perf regression urls
- [#2639](https://github.com/docker/docker-agent/pull/2639) - feat: Phase 1 attachment system – chat.Document, pkg/attachment, per-provider convertDocument
- [#2641](https://github.com/docker/docker-agent/pull/2641) - Fix finish_reason stop when tracking usage
- [#2642](https://github.com/docker/docker-agent/pull/2642) - HCL: add a file() function
- [#2643](https://github.com/docker/docker-agent/pull/2643) - docs: add HCL configuration documentation
- [#2644](https://github.com/docker/docker-agent/pull/2644) - docs(agents): expand AGENTS.md with guidelines and standards
- [#2645](https://github.com/docker/docker-agent/pull/2645) - docs(github): update issue templates and triage workflow
- [#2646](https://github.com/docker/docker-agent/pull/2646) - fix compaction kept-tail mapping after prior summaries
- [#2647](https://github.com/docker/docker-agent/pull/2647) - avoid duplicate compaction system prompt
- [#2648](https://github.com/docker/docker-agent/pull/2648) - Update pr-review.yml
- [#2650](https://github.com/docker/docker-agent/pull/2650) - docs: fix broken links and outdated/incorrect snippets
- [#2651](https://github.com/docker/docker-agent/pull/2651) - fetch: support custom request headers
- [#2652](https://github.com/docker/docker-agent/pull/2652) - Add JS placeholders support in instructions
- [#2653](https://github.com/docker/docker-agent/pull/2653) - feat(httpclient): forward cagent install UUID on gateway-bound requests
- [#2654](https://github.com/docker/docker-agent/pull/2654) - fix: keep tab switching and chat scroll working while a prompt is open
- [#2655](https://github.com/docker/docker-agent/pull/2655) - bump direct go dependencies
- [#2656](https://github.com/docker/docker-agent/pull/2656) - docs: refresh outdated model examples and add Chat Server page
- [#2658](https://github.com/docker/docker-agent/pull/2658) - feat: Anthropic Workload Identity Federation
- [#2659](https://github.com/docker/docker-agent/pull/2659) - chore: replace mise with go-task
- [#2661](https://github.com/docker/docker-agent/pull/2661) - split builtin tools into individual sub-packages
- [#2662](https://github.com/docker/docker-agent/pull/2662) - fix(httpclient): drop comment-only SSE events that crash openai-go
- [#2663](https://github.com/docker/docker-agent/pull/2663) - chore: tighten file/directory permissions for per-user data
- [#2664](https://github.com/docker/docker-agent/pull/2664) - redact_secrets: catch more token shapes and bare unquoted values
- [#2665](https://github.com/docker/docker-agent/pull/2665) - docs: refresh examples README
- [#2666](https://github.com/docker/docker-agent/pull/2666) - refactor: centralize model-specific behavior in pkg/modelinfo
- [#2667](https://github.com/docker/docker-agent/pull/2667) - perf(secretsscan): speed up secret redaction with an aho-corasick pre-filter
- [#2668](https://github.com/docker/docker-agent/pull/2668) - tui: pause animation ticks while the terminal is blurred
- [#2669](https://github.com/docker/docker-agent/pull/2669) - refactor(logging): pass context to all slog calls for correlation
- [#2670](https://github.com/docker/docker-agent/pull/2670) - security: SSRF / TOCTOU / OAuth state hardening
- [#2671](https://github.com/docker/docker-agent/pull/2671) - fix(shell): do not enforce "assisted-by" by default.
- [#2672](https://github.com/docker/docker-agent/pull/2672) - add js/wasm browser build with OpenRouter PKCE, agentic loop, and demo page
- [#2673](https://github.com/docker/docker-agent/pull/2673) - fix: stop matching category in command palette filter
- [#2674](https://github.com/docker/docker-agent/pull/2674) - lint: add SlogContextual cop and fix remaining bare slog calls
- [#2675](https://github.com/docker/docker-agent/pull/2675) - fix(markdown): avoid infinite loop on hash-prefixed paragraphs; simplify renderer
- [#2676](https://github.com/docker/docker-agent/pull/2676) - chore(deps): bump github.com/anthropics/anthropic-sdk-go from v1.40.0 to v1.41.0
- [#2677](https://github.com/docker/docker-agent/pull/2677) - feat: add shadow snapshots and undo
- [#2678](https://github.com/docker/docker-agent/pull/2678) - Lint
- [#2679](https://github.com/docker/docker-agent/pull/2679) - chore(deps): bump python-multipart from 0.0.22 to 0.0.27 in /examples/dhi/dhi_mcp_server in the pip group across 1 directory
- [#2680](https://github.com/docker/docker-agent/pull/2680) - update PR reviewer
- [#2681](https://github.com/docker/docker-agent/pull/2681) - bump github.com/docker/cli from v29.4.2 to v29.4.3
- [#2682](https://github.com/docker/docker-agent/pull/2682) - use slices.Backward in CompactionInput
- [#2685](https://github.com/docker/docker-agent/pull/2685) - feat: attach-time processing – transcode/resize images and resolve URLs at message add time


## [v1.54.0] - 2026-04-29

This release introduces clickable terminal links, domain filtering for fetch operations, and enhanced toolset lifecycle management with configurable supervision profiles.

## What's New

- Makes markdown links and URLs clickable in the terminal using OSC 8 hyperlink escape sequences
- Adds `allowed_domains` and `blocked_domains` filters to the fetch toolset for restricting network access
- Adds `/toolsets` command and supervisor-aware status surface in the TUI
- Introduces `redact_secrets` agent flag that scrubs credential patterns from tool calls and LLM messages
- Adds per-toolset lifecycle configuration with profile presets for MCP and LSP servers
- Introduces `/toolset-restart` slash command for hot-reload functionality

## Improvements

- Defers OAuth elicitation outside interactive context to prevent premature prompts
- Reduces macOS keychain prompts by storing all MCP OAuth tokens in a single keychain item
- Makes every dialog close on ctrl+c, with twice exiting the application
- Filters LSP tools by server-advertised capabilities
- Detects secrets embedded inside larger tokens, not just word-bounded patterns

## Bug Fixes

- Fixes MCP catalog reference in mcp-definitions.yaml from `docker:github` to `docker:github-official`
- Fixes Slack token responses and surfaces server errors in MCP OAuth handling
- Fixes config package names for v6 and v7 versions
- Fixes strip transform reading wrong model in alloy/per-tool override mode
- Suppresses spurious 'is now available' MCP toolset notice after OAuth completion

## Technical Changes

- Separates toolset notices from warnings in agent handling
- Simplifies history package by replacing manual parsing with standard library functions
- Refactors skills package into focused files without changing behavior
- Extracts image-stripping into registered MessageTransform mechanism
- Unifies MCP/LSP toolset supervision with typed errors and state-machine architecture
- Isolates example loading in temporary directories for tests

### Pull Requests

- [#2465](https://github.com/docker/docker-agent/pull/2465) - fix(examples): correct MCP catalog ref in mcp-definitions.yaml
- [#2498](https://github.com/docker/docker-agent/pull/2498) - feat(tui): make markdown links and URLs clickable in the terminal
- [#2512](https://github.com/docker/docker-agent/pull/2512) - Make the slack remote MCP server work
- [#2564](https://github.com/docker/docker-agent/pull/2564) - test: stop example tests from writing SQLite files into examples/
- [#2565](https://github.com/docker/docker-agent/pull/2565) - docs: update CHANGELOG.md for v1.53.0
- [#2566](https://github.com/docker/docker-agent/pull/2566) - Use the slices package to simplify slice operations
- [#2567](https://github.com/docker/docker-agent/pull/2567) - Simplify the history package
- [#2568](https://github.com/docker/docker-agent/pull/2568) - lint: add config-versioning robustness cops + fix v6/v7 package names
- [#2569](https://github.com/docker/docker-agent/pull/2569) - docs: bring hooks reference up to date with new events
- [#2570](https://github.com/docker/docker-agent/pull/2570) - Fix misleading UpdateMessage doc comment
- [#2571](https://github.com/docker/docker-agent/pull/2571) - refactor(skills): split package into focused files
- [#2572](https://github.com/docker/docker-agent/pull/2572) - feat(fetch): add allowed_domains and blocked_domains filters
- [#2573](https://github.com/docker/docker-agent/pull/2573) - runtime: extract image-stripping into a registered MessageTransform
- [#2574](https://github.com/docker/docker-agent/pull/2574) - defer oauth when elicitation bridge isn't wired up yet
- [#2575](https://github.com/docker/docker-agent/pull/2575) - refactor(sessiontitle): simplify Generator without changing behavior
- [#2576](https://github.com/docker/docker-agent/pull/2576) - stop hard-coding "root" as the default agent name
- [#2577](https://github.com/docker/docker-agent/pull/2577) - Add redact_secrets builtin hook + before_llm_call transform
- [#2578](https://github.com/docker/docker-agent/pull/2578) - Suppress spurious 'is now available' MCP toolset notice
- [#2579](https://github.com/docker/docker-agent/pull/2579) - feat(lifecycle): unify MCP/LSP toolset supervision with configurable profiles + /toolsets UX
- [#2580](https://github.com/docker/docker-agent/pull/2580) - reduce macOS keychain prompts for OAuth MCP servers
- [#2581](https://github.com/docker/docker-agent/pull/2581) - docs: document redact_secrets agent flag
- [#2582](https://github.com/docker/docker-agent/pull/2582) - detect secrets embedded inside larger tokens
- [#2583](https://github.com/docker/docker-agent/pull/2583) - make every dialog close on ctrl+c, twice exits
- [#2584](https://github.com/docker/docker-agent/pull/2584) - test(mcp): test buildRemoteDescription directly to skip keychain
- [#2585](https://github.com/docker/docker-agent/pull/2585) - Disable test that prompts for a password


## [v1.53.0] - 2026-04-28

This release adds OpenAI-compatible API server functionality, skill model overrides, and response caching, along with extensive refactoring to improve code organization and testability.

## What's New

- Adds `docker agent serve chat` command that exposes agents through an OpenAI-compatible HTTP server
- Adds configurable response cache for agents to skip model calls for repeated questions
- Adds skill model override capability allowing fork skills to specify different models via `model:` field in SKILL.md frontmatter
- Adds g/G keybindings to scroll messages view (jump to top/bottom)
- Adds 10 new builtin hook events including lifecycle events, compaction events, and observability events
- Adds `type: model` hook handler for LLM-as-judge functionality

## Improvements

- Switches Anthropic Opus 4.6/4.7 to adaptive thinking when token-based budgets are configured
- Improves file path handling for sub-agent sessions by propagating user-attached files and encouraging absolute paths
- Improves error messages for HTTP 400 failures with structured provider error details

## Bug Fixes

- Fixes Copilot integration by adding required `Copilot-Integration-Id` header for github-copilot provider
- Fixes crash when opening sessions with empty configuration files
- Fixes session_start hook output appearing as user messages in transcript
- Fixes TUI bottom slack clearing after thinking text fades out
- Fixes race conditions in skill model overrides and response cache handling

## Technical Changes

- Extracts hooks builtins from runtime into separate package
- Extracts tool execution, compaction, and delegation logic into focused sub-packages
- Consolidates hook orchestration and simplifies executor caching
- Improves testability across runtime, session, provider, and TUI packages
- Replaces PersistentRuntime decorator with EventObserver pattern
- Updates multiple dependencies including Anthropic SDK, AWS Smithy, and various UI libraries

### Pull Requests

- [#2475](https://github.com/docker/docker-agent/pull/2475) - fix(openai): send Copilot-Integration-Id header for github-copilot
- [#2510](https://github.com/docker/docker-agent/pull/2510) - feat: add `docker agent serve chat` command (OpenAI-compatible API)
- [#2520](https://github.com/docker/docker-agent/pull/2520) - docs: update CHANGELOG.md for v1.52.0
- [#2521](https://github.com/docker/docker-agent/pull/2521) - refactor(hooks): extract builtins from pkg/runtime into pkg/hooks/builtins
- [#2522](https://github.com/docker/docker-agent/pull/2522) - refactor(hooks): simplify package while preserving features
- [#2523](https://github.com/docker/docker-agent/pull/2523) - refactor(runtime): consolidate hook orchestration and cache executors
- [#2524](https://github.com/docker/docker-agent/pull/2524) - refactor(skills): move fork-skill validation into SkillsToolset
- [#2525](https://github.com/docker/docker-agent/pull/2525) - Skills: allow fork skills to override the model
- [#2526](https://github.com/docker/docker-agent/pull/2526) - refactor(hooks/builtins): one file per builtin + simplify registration
- [#2527](https://github.com/docker/docker-agent/pull/2527) - fix(skills): unbreak main after fork-skill refactor merge
- [#2528](https://github.com/docker/docker-agent/pull/2528) - feat(tui): add g/G keybindings to scroll messages view
- [#2529](https://github.com/docker/docker-agent/pull/2529) - refactor(hooks/builtins): inline GetEnvironmentInfo + simplify package
- [#2530](https://github.com/docker/docker-agent/pull/2530) - refactor(hooks/builtins): inline & simplify add_prompt_files
- [#2531](https://github.com/docker/docker-agent/pull/2531) - refactor(hooks): simplify caching, dispatch flow, and notification helpers
- [#2532](https://github.com/docker/docker-agent/pull/2532) - Inherit user-attached files in sub-agent sessions
- [#2533](https://github.com/docker/docker-agent/pull/2533) - fix(runtime): don't persist session_start hook output as a session message
- [#2534](https://github.com/docker/docker-agent/pull/2534) - refactor(hooks): drop runtime shadow types and tighten the executor
- [#2535](https://github.com/docker/docker-agent/pull/2535) - refactor(runtime): extract sub-session orchestration
- [#2536](https://github.com/docker/docker-agent/pull/2536) - feat(agent): add a configurable response cache
- [#2537](https://github.com/docker/docker-agent/pull/2537) - feat(hooks): add before_compaction and after_compaction events
- [#2538](https://github.com/docker/docker-agent/pull/2538) - feat(hooks): add 6 builtin hooks + widen post_tool_use / before_llm_call contract
- [#2539](https://github.com/docker/docker-agent/pull/2539) - refactor(runtime): drop unused receiver from handleStream
- [#2540](https://github.com/docker/docker-agent/pull/2540) - feat(hooks): lifecycle events, per-hook options, and event-spec refactor
- [#2541](https://github.com/docker/docker-agent/pull/2541) - refactor(runtime): extract model-fallback chain into fallbackExecutor
- [#2542](https://github.com/docker/docker-agent/pull/2542) - feat(hooks): add three observability events around runtime transitions
- [#2543](https://github.com/docker/docker-agent/pull/2543) - fix(tui): clear bottom slack after thinking text fades out
- [#2544](https://github.com/docker/docker-agent/pull/2544) - refactor(tui): simplify components, drop dead code, consolidate helpers
- [#2545](https://github.com/docker/docker-agent/pull/2545) - refactor(runtime): extract tool execution into pkg/runtime/toolexec
- [#2546](https://github.com/docker/docker-agent/pull/2546) - feat(hooks): add 'type: model' hook and integrate pre_tool_use into approval flow
- [#2547](https://github.com/docker/docker-agent/pull/2547) - refactor(provider): improve testability and split provider.go
- [#2548](https://github.com/docker/docker-agent/pull/2548) - feat(hooks): add 4 new hook events to match Claude Code / OpenCode / pi
- [#2549](https://github.com/docker/docker-agent/pull/2549) - feat(modelerrors): surface structured provider error details on non-2xx responses
- [#2550](https://github.com/docker/docker-agent/pull/2550) - refactor(session): improve testability and simplify the session package
- [#2551](https://github.com/docker/docker-agent/pull/2551) - tui: improve testability and simplify code
- [#2552](https://github.com/docker/docker-agent/pull/2552) - refactor(runtime): replace PersistentRuntime decorator with EventObserver
- [#2553](https://github.com/docker/docker-agent/pull/2553) - speed up PR image builds
- [#2554](https://github.com/docker/docker-agent/pull/2554) - refactor(runtime): improve testability and simplify package structure
- [#2555](https://github.com/docker/docker-agent/pull/2555) - docs: document all builtin hooks in schema and hooks page
- [#2556](https://github.com/docker/docker-agent/pull/2556) - refactor(tui): reduce duplication across picker dialogs
- [#2560](https://github.com/docker/docker-agent/pull/2560) - Add context to todo storage methods
- [#2561](https://github.com/docker/docker-agent/pull/2561) - log history init failure via slog instead of stderr
- [#2562](https://github.com/docker/docker-agent/pull/2562) - Bump direct Go dependencies
- [#2563](https://github.com/docker/docker-agent/pull/2563) - anthropic: switch opus 4.6/4.7 token thinking budgets to adaptive


## [v1.52.0] - 2026-04-27

This release adds file picker hotkeys, improves message handling consistency, and introduces an extensible hooks system with new lifecycle events.

## What's New

- Adds Alt+H and Alt+I hotkeys in file picker to toggle hidden and ignored file visibility
- Adds extensible hooks system with 5 new lifecycle events and 3 builtin hooks

## Improvements

- Makes user prompt elicitation dialog scrollable to prevent content overflow in terminal

## Bug Fixes

- Fixes message trimming behavior to be consistent across all model providers
- Fixes steer message handling by appending newlines between queued messages to prevent word fragments from being concatenated

## Technical Changes

- Refactors hooks architecture for better extensibility with pluggable registry system
- Centralizes whitespace-only message filtering in session.GetMessages

### Pull Requests

- [#2501](https://github.com/docker/docker-agent/pull/2501) - hotkeys to toggle filepicker hidden/ignored files
- [#2509](https://github.com/docker/docker-agent/pull/2509) - fix(tui): make user_prompt elicitation dialog scrollable
- [#2514](https://github.com/docker/docker-agent/pull/2514) - docs: update CHANGELOG.md for v1.51.0
- [#2516](https://github.com/docker/docker-agent/pull/2516) - fix: normalize message trimming behavior across all model providers
- [#2518](https://github.com/docker/docker-agent/pull/2518) - runtime: append newline to non-last steer messages on multi-drain
- [#2519](https://github.com/docker/docker-agent/pull/2519) - feat(hooks): refactor for extensibility, add 5 events and 3 builtins


## [v1.51.0] - 2026-04-27

This release improves Anthropic model support on Vertex AI, enhances the model picker interface, and includes several bug fixes.

## What's New
- Adds pricing and capabilities information to the /model picker interface with a detailed comparison table

## Improvements
- Routes Anthropic models on Vertex AI through the native endpoint instead of OpenAI-compatible endpoint to fix compatibility issues

## Bug Fixes
- Fixes race condition in session cleanup that could cause spurious "session busy" errors
- Fixes OTLP endpoint URL handling to properly support http/https schemes

## Technical Changes
- Enables noctx linter and adds context threading through HTTP, SQL, exec and net APIs

### Pull Requests

- [#2476](https://github.com/docker/docker-agent/pull/2476) - Route Anthropic models on Vertex AI through the native endpoint
- [#2489](https://github.com/docker/docker-agent/pull/2489) - ci: bump golangci-lint from v2.9 to v2.11
- [#2499](https://github.com/docker/docker-agent/pull/2499) - docs: update CHANGELOG.md for v1.50.0
- [#2503](https://github.com/docker/docker-agent/pull/2503) - fix(session): prevent race condition in session cleanup
- [#2504](https://github.com/docker/docker-agent/pull/2504) - fix(otel): support http/https scheme in OTLP endpoint URL
- [#2508](https://github.com/docker/docker-agent/pull/2508) - lint: enable noctx and deduplicate touched code
- [#2511](https://github.com/docker/docker-agent/pull/2511) - feat(tui): show pricing & capabilities in /model picker


## [v1.50.0] - 2026-04-23

This release fixes several runtime issues with message steering and sandbox argument handling, along with TUI improvements for user prompts and speech commands.

## What's New

- Adds support for custom OAuth callback redirect URLs for remote MCP toolsets, allowing public-facing proxies for authentication

## Improvements

- Adds custom component for user_prompt tool calls in TUI that shows only status and name without exposing internal details

## Bug Fixes

- Fixes sandbox mode incorrectly interpreting agent file path as first chat message due to duplicate argument handling
- Fixes runtime race conditions where steer messages could be silently dropped during idle windows or first turns
- Fixes /speak slash command not dispatching immediately in TUI

## Technical Changes

- Updates Go to version 1.26.2
- Refactors runtime steer message injection to remove system-reminder envelope

### Pull Requests

- [#2486](https://github.com/docker/docker-agent/pull/2486) - docs: update CHANGELOG.md for v1.49.2
- [#2487](https://github.com/docker/docker-agent/pull/2487) - fix(sandbox): don't duplicate agent file and --config-dir args
- [#2488](https://github.com/docker/docker-agent/pull/2488) - chore: bump Go to 1.26.2
- [#2492](https://github.com/docker/docker-agent/pull/2492) - fix(runtime): drain steerQueue at top of RunStream loop to close idle-window race
- [#2494](https://github.com/docker/docker-agent/pull/2494) - feat(mcp): support custom OAuth callbackRedirectURL for remote toolsets
- [#2496](https://github.com/docker/docker-agent/pull/2496) - fix(tui): make /speak slash command dispatch immediately
- [#2497](https://github.com/docker/docker-agent/pull/2497) - tui: add custom component for user_prompt tool calls


## [v1.49.2] - 2026-04-21

This release fixes an issue with the --pull-interval flag when using URL gordon references.

## Bug Fixes
- Fixes blocking of --pull-interval flag when using URL gordon reference

## Technical Changes
- Updates CHANGELOG.md for v1.49.1

### Pull Requests

- [#2484](https://github.com/docker/docker-agent/pull/2484) - docs: update CHANGELOG.md for v1.49.1
- [#2485](https://github.com/docker/docker-agent/pull/2485) - Do not block --pull-interval flag when using URL gordon ref


## [v1.49.1] - 2026-04-21

This release improves the shell tool's command handling and fixes documentation inconsistencies.

## Improvements
- Accepts "command" as an alias for "cmd" in shell tool calls to improve compatibility with different AI models
- Improves error messaging when shell commands are empty or blank

## Bug Fixes
- Fixes documentation and code divergences reported in issue #2464 with 36 targeted corrections
- Prevents blank "cmd" parameters from interfering with "command" alias functionality

## Technical Changes
- Updates configuration schema version to 8 in documentation
- Updates CHANGELOG.md for v1.49.0 release

### Pull Requests

- [#2464](https://github.com/docker/docker-agent/pull/2464) - docs: fix doc-code divergences reported in issue #2464
- [#2479](https://github.com/docker/docker-agent/pull/2479) - docs: fix doc-code divergences reported in #2464
- [#2481](https://github.com/docker/docker-agent/pull/2481) - shell: accept `command` as alias for `cmd` and improve empty-arg error
- [#2483](https://github.com/docker/docker-agent/pull/2483) - docs: update CHANGELOG.md for v1.49.0


## [v1.49.0] - 2026-04-21

This release improves DMR support, adds skill filtering capabilities, and includes several bug fixes for OpenTelemetry and security hardening.

## What's New
- Adds support for filtering skills by name in agent YAML configuration
- Improves DMR support with better context size handling and structured configuration

## Bug Fixes
- Fixes OpenTelemetry service resource schema alignment
- Fixes path traversal vulnerability and other security issues in artifact store, skills loader, hooks, shell and agent warnings
- Fixes OpenTelemetry import ordering in tests

## Technical Changes
- Encodes agent source URL when using it as agent name and key for proper conversation handling in `serve api`
- Moves localhost helper comment in OpenTelemetry code

### Pull Requests

- [#2351](https://github.com/docker/docker-agent/pull/2351) - Improve DMR support
- [#2404](https://github.com/docker/docker-agent/pull/2404) - Merge pull request #2474 from dgageot/board/support-boolean-or-array-skills-in-yaml-f97b09f6
- [#2442](https://github.com/docker/docker-agent/pull/2442) - fix(otel): align service resource schema
- [#2470](https://github.com/docker/docker-agent/pull/2470) - docs: update CHANGELOG.md for v1.48.0
- [#2472](https://github.com/docker/docker-agent/pull/2472) - bump github.com/docker/cli from v29.4.0+incompatible to v29.4.1+incompatible
- [#2473](https://github.com/docker/docker-agent/pull/2473) - Encode agent source URL when using it as agent name and key, so that it can be used properly in conversations when using `serve api`
- [#2474](https://github.com/docker/docker-agent/pull/2474) - Support filtering skills by name in agent YAML (#2404)
- [#2480](https://github.com/docker/docker-agent/pull/2480) - fix: harden artifact store, skills loader, hooks, shell and agent warnings


## [v1.48.0] - 2026-04-20

This release adds working directory configuration for MCP and LSP toolsets and improves toolset reliability with better retry handling.

## What's New
- Adds optional `working_dir` field to MCP and LSP toolset configurations to launch processes from a specific directory

## Bug Fixes
- Fixes retry behavior for MCP toolsets after tool calls within the same turn
- Stops retrying SQLITE_CANTOPEN (14) errors that cannot be resolved
- Fixes filepath handling to satisfy gocritic filepathJoin lint rule
- Returns explicit error when ref-based MCP resolves to remote server with working_dir

## Technical Changes
- Documents working_dir field for MCP and LSP toolsets in configuration

### Pull Requests

- [#2457](https://github.com/docker/docker-agent/pull/2457) - fix(#2457): retry MCP toolsets after tool calls within the same turn
- [#2458](https://github.com/docker/docker-agent/pull/2458) - fix: retry LSP/MCP toolsets after tool calls, covering env-wrapped commands (fixes #2457)
- [#2460](https://github.com/docker/docker-agent/pull/2460) - feat: add optional working_dir to MCP and LSP toolset configs
- [#2466](https://github.com/docker/docker-agent/pull/2466) - Don't retry SQLITE_CANTOPEN (14) errors
- [#2468](https://github.com/docker/docker-agent/pull/2468) - docs: update CHANGELOG.md for v1.47.0


## [v1.47.0] - 2026-04-20

This release fixes several issues with AI model interactions, including title generation failures with reasoning models and shell command hangs.

## Bug Fixes
- Fixes title generation failures with OpenAI reasoning models by using low reasoning effort instead of omitting it
- Fixes shell command hangs when a tool command backgrounds a child process
- Repairs malformed JSON in edit_file tool call arguments that was causing parsing failures
- Moves reasoning token budget floor to OpenAI provider for better token management

## Improvements
- Increases title generation token budget for reasoning models to ensure adequate output space
- Adds thinking_display provider option for Anthropic models to control visibility of thinking blocks

## Technical Changes
- Adds test assertion for non-empty title in end-to-end title generation tests

### Pull Requests

- [#2412](https://github.com/docker/docker-agent/pull/2412) - fix: title generation fails with OpenAI reasoning models
- [#2451](https://github.com/docker/docker-agent/pull/2451) - Add thinking_display provider_opt for Anthropic models
- [#2452](https://github.com/docker/docker-agent/pull/2452) - fix: repair malformed JSON in edit_file tool call arguments
- [#2455](https://github.com/docker/docker-agent/pull/2455) - docs: update CHANGELOG.md for v1.46.0
- [#2462](https://github.com/docker/docker-agent/pull/2462) - shell: fix hang when a tool command backgrounds a child process
- [#2463](https://github.com/docker/docker-agent/pull/2463) - bump direct Go dependencies


## [v1.46.0] - 2026-04-16

This release adds OAuth credential configuration for MCP servers, evaluation testing improvements, and numerous stability fixes.

## What's New
- Adds support for explicit OAuth credentials configuration for remote MCP servers that don't support Dynamic Client Registration
- Adds `--repeat` flag to eval command for running evaluations multiple times
- Adds support for `xhigh` effort level in Anthropic adaptive thinking (Claude Opus 4.7+)
- Adds `task_budget` configuration field for Claude Opus 4.7 to cap total tokens across multi-step tasks
- Adds markdown rendering support in user_prompt dialog messages

## Improvements
- Improves image attachment handling by inlining as base64 data URLs for cross-provider compatibility
- Improves robots.txt caching to store parsed data per host instead of boolean results
- Improves session database version detection with clear upgrade messages for newer databases

## Bug Fixes
- Fixes `--attach` flag being silently ignored when used without a message argument
- Fixes data race in AddMessageUsageRecord by adding mutex lock
- Fixes data race in rule-based router by protecting lastSelectedID with mutex
- Fixes panic in extractSystemBlocks when system message is empty with CacheControl
- Fixes empty messages slice handling in SendUserMessage path
- Fixes symlink-based path traversal vulnerability in ACP filesystem toolset
- Fixes OAuth callback CSRF vulnerability by rejecting when expected state is not set
- Fixes MCP tryRestart to use context-aware select instead of time.Sleep
- Fixes assistant text being discarded when tool calls are present in Responses API conversion
- Fixes MCP OAuth token refresh by remembering the discovered auth server

## Technical Changes
- Updates mutex handling for MCP Toolset.Instructions() method
- Updates Go dependencies including Anthropic SDK and various UI libraries

### Pull Requests

- [#2394](https://github.com/docker/docker-agent/pull/2394) - Support explicit OAuth credentials for remote MCP servers
- [#2427](https://github.com/docker/docker-agent/pull/2427) - docs: update CHANGELOG.md for v1.45.0
- [#2428](https://github.com/docker/docker-agent/pull/2428) - fix: add mutex lock to AddMessageUsageRecord to prevent data race
- [#2429](https://github.com/docker/docker-agent/pull/2429) - fix: add mutex to protect lastSelectedID in rule-based router
- [#2430](https://github.com/docker/docker-agent/pull/2430) - fix: hold mutex for instructions read in MCP Toolset.Instructions()
- [#2431](https://github.com/docker/docker-agent/pull/2431) - fix: prevent panic in extractSystemBlocks on empty system message wit…
- [#2432](https://github.com/docker/docker-agent/pull/2432) - fix: guard against empty messages slice in SendUserMessage path
- [#2433](https://github.com/docker/docker-agent/pull/2433) - fix: prevent symlink-based path traversal in ACP filesystem toolset
- [#2434](https://github.com/docker/docker-agent/pull/2434) - fix: reject OAuth callback when expected state has not been set (CSRF)
- [#2436](https://github.com/docker/docker-agent/pull/2436) - fix: replace time.Sleep with context-aware select in MCP tryRestart
- [#2437](https://github.com/docker/docker-agent/pull/2437) - fix: cache parsed robots.txt per host instead of boolean result
- [#2438](https://github.com/docker/docker-agent/pull/2438) - fix: preserve assistant text when tool calls present in Responses API conversion
- [#2440](https://github.com/docker/docker-agent/pull/2440) - Add --repeat flag to eval command for running evaluations multiple times
- [#2441](https://github.com/docker/docker-agent/pull/2441) - fix: detect newer session database and show clear upgrade message
- [#2444](https://github.com/docker/docker-agent/pull/2444) - bump direct Go dependencies
- [#2445](https://github.com/docker/docker-agent/pull/2445) - Add a pokemon example
- [#2446](https://github.com/docker/docker-agent/pull/2446) - Render markdown in user_prompt dialog messages
- [#2447](https://github.com/docker/docker-agent/pull/2447) - Add an advanced coder example
- [#2448](https://github.com/docker/docker-agent/pull/2448) - fix(mcp): reuse discovered auth server for token refresh
- [#2449](https://github.com/docker/docker-agent/pull/2449) - Fix --attach flag
- [#2450](https://github.com/docker/docker-agent/pull/2450) - Support xhigh effort for Anthropic adaptive thinking (Opus 4.7+)
- [#2453](https://github.com/docker/docker-agent/pull/2453) - feat(anthropic): add task_budget for Claude Opus 4.7
- [#2454](https://github.com/docker/docker-agent/pull/2454) - chore: update cagent-action to v1.4.1


## [v1.45.0] - 2026-04-15

This release improves template expression handling, adds circular navigation to completions, and fixes issues with skills and MCP toolset loading.

## Bug Fixes
- Fixes evaluation of JavaScript template expressions to handle failures independently - when one expression fails, other valid expressions in the same template are still expanded
- Fixes skills loading functionality
- Fixes retry behavior for MCP toolset startup when server is unavailable
- Fixes MCP toolset creation to proceed even when command binary is unavailable

## Improvements
- Adds circular navigation wrapping to completion component, allowing users to cycle through completion options

### Pull Requests

- [#2400](https://github.com/docker/docker-agent/pull/2400) - fix: evaluate JS template expressions independently on failure
- [#2403](https://github.com/docker/docker-agent/pull/2403) - docs: update CHANGELOG.md for v1.44.0
- [#2407](https://github.com/docker/docker-agent/pull/2407) - add circular navigation wrapping to completion component
- [#2413](https://github.com/docker/docker-agent/pull/2413) - fix: retry stdio MCP toolset when binary is unavailable at startup
- [#2414](https://github.com/docker/docker-agent/pull/2414) - Fix skills loading


## [v1.44.0] - 2026-04-13

This release introduces TUI customization capabilities, session management improvements, and OAuth security enhancements, along with numerous bug fixes and stability improvements.

## What's New

- Adds support for extending and customizing TUI with additional commands through new `Immediate` flag and `Parser` struct
- Adds session delete functionality to session browser
- Adds click-to-select support for agents in the sidebar
- Adds `/fork` slash command to duplicate current session into a new tab
- Adds mid-turn message steering for running agent sessions with new `/steer` and `/followup` API endpoints
- Adds OAuth token storage in OS keychain with silent refresh token support
- Adds debug OAuth commands: list, remove, and login
- Adds support for shell expansions (~, env vars) in config paths
- Adds total session count display in session browser dialog title

## Improvements

- Improves TUI rendering to match sandbox template
- Makes Ctrl+W context-aware to preserve word deletion in editor when focused
- Makes `/exit` close only the current tab when multiple tabs are open

## Bug Fixes

- Fixes crash when opening empty websocket frames in OpenAI provider
- Fixes Gemini thinking tokens not included in output token count for cost calculation
- Fixes tool calls getting stuck as running when moved out of active reasoning block
- Fixes missing type in schema and orphaned function calls in Responses API
- Fixes spurious blank line appearing in every assistant message
- Fixes layout shift when hovering over assistant messages to reveal copy button
- Fixes concurrent RunSession calls causing tool_use/tool_result mismatch
- Fixes panic in code mode when tool handler is nil
- Fixes suggestion ghost text remaining when completion dialog closes on backspace
- Fixes skill frontmatter parsing when description contains a colon
- Fixes sidebar agent click zones mapping all lines to first agent
- Fixes OAuth token security vulnerabilities and infinite recursion issues
- Fixes auto-detect tool install failures being treated as fatal
- Fixes background agent context being cancelled with parent message lifecycle

## Technical Changes

- Stores OAuth tokens in OS keychain with graceful fallback to in-memory storage
- Serializes concurrent RunSession calls to prevent race conditions
- Sanitizes message history to ensure all tool calls have results
- Adds regression tests for SSE comment lines from OpenRouter
- Uses in-memory store in keyring tests to avoid macOS keychain permission dialog
- Separates steer and follow-up into distinct queues with lock/confirm semantics
- Adds documentation for OpenAPI toolset
- Optimizes PR CI build process

### Pull Requests

- [#2346](https://github.com/docker/docker-agent/pull/2346) - Allow to extend and customize TUI with additional commands
- [#2347](https://github.com/docker/docker-agent/pull/2347) - docs: update CHANGELOG.md for v1.43.0
- [#2348](https://github.com/docker/docker-agent/pull/2348) - Better sandbox
- [#2349](https://github.com/docker/docker-agent/pull/2349) - Add regression tests for SSE comment lines from OpenRouter (#2349)
- [#2350](https://github.com/docker/docker-agent/pull/2350) - fix(openai): ignore empty websocket frames
- [#2352](https://github.com/docker/docker-agent/pull/2352) - support session delete to session browser
- [#2355](https://github.com/docker/docker-agent/pull/2355) - Store OAuth tokens in OS keychain and add silent refresh token support
- [#2356](https://github.com/docker/docker-agent/pull/2356) - feat: click on agent in sidebar to switch to it
- [#2358](https://github.com/docker/docker-agent/pull/2358) - bump direct Go dependencies
- [#2359](https://github.com/docker/docker-agent/pull/2359) - Add regression tests for SSE comment lines from OpenRouter
- [#2360](https://github.com/docker/docker-agent/pull/2360) - Fix tool call stuck as running when moved out of active reasoning block
- [#2362](https://github.com/docker/docker-agent/pull/2362) - fix: handle missing type in schema and orphaned function calls in Responses API
- [#2363](https://github.com/docker/docker-agent/pull/2363) - Add mid-turn message steering for running agent sessions
- [#2365](https://github.com/docker/docker-agent/pull/2365) - Debug oauth
- [#2366](https://github.com/docker/docker-agent/pull/2366) - optional title and app name
- [#2367](https://github.com/docker/docker-agent/pull/2367) - fix: use in-memory store in keyring tests to avoid macOS keychain permission dialog
- [#2369](https://github.com/docker/docker-agent/pull/2369) - fix(tui): remove spurious blank line from every assistant message
- [#2371](https://github.com/docker/docker-agent/pull/2371) - docs: add documentation for OpenAPI toolset
- [#2374](https://github.com/docker/docker-agent/pull/2374) - fix(tui): reserve stable top row for copy icon to prevent layout shift
- [#2375](https://github.com/docker/docker-agent/pull/2375) - fix: serialize concurrent RunSession calls to prevent tool_use/tool_result mismatch
- [#2377](https://github.com/docker/docker-agent/pull/2377) - Sanitize message history
- [#2378](https://github.com/docker/docker-agent/pull/2378) - Faster PR CI
- [#2385](https://github.com/docker/docker-agent/pull/2385) - Add /fork slash command to duplicate current session into a new tab
- [#2386](https://github.com/docker/docker-agent/pull/2386) - fix(toolinstall): soft-fail auto-detect installs
- [#2387](https://github.com/docker/docker-agent/pull/2387) - fix: /exit closes only the current tab when multiple tabs are open
- [#2388](https://github.com/docker/docker-agent/pull/2388) - fix: prevent panic in code mode when tool handler is nil
- [#2389](https://github.com/docker/docker-agent/pull/2389) - Add support for shell expansions (~, env vars) in config paths
- [#2390](https://github.com/docker/docker-agent/pull/2390) - fix: make Ctrl+W context-aware to preserve word deletion in editor
- [#2391](https://github.com/docker/docker-agent/pull/2391) - Show total session count in session browser dialog title
- [#2392](https://github.com/docker/docker-agent/pull/2392) - fix: decouple background agent context from parent message lifecycle
- [#2395](https://github.com/docker/docker-agent/pull/2395) - fix: OAuth token security and bug fixes
- [#2398](https://github.com/docker/docker-agent/pull/2398) - Bump direct Go dependencies
- [#2399](https://github.com/docker/docker-agent/pull/2399) - fix: clear suggestion ghost text when completion dialog closes on backspace
- [#2401](https://github.com/docker/docker-agent/pull/2401) - Fix skill frontmatter parsing when description contains a colon
- [#2402](https://github.com/docker/docker-agent/pull/2402) - Fix sidebar agent click zones mapping all lines to first agent


## [v1.43.0] - 2026-04-08

This release adds non-interactive mode capabilities, improves TUI interactions with mouse support, and includes several bug fixes for RAG tools and streaming responses.

## What's New

- Adds auto-stop for max iterations in non-interactive mode to prevent hanging when tools are approved
- Adds non-interactive mode flag to distinguish from tools approval scenarios
- Adds mouse drag-to-move support for TUI dialogs, allowing repositioning by clicking and dragging the title area
- Adds custom session ID support through WithID option instead of relying on UUID generation
- Adds support for custom providers in RAG embedding and reranking models
- Adds underline styling for URLs on mouse hover

## Improvements

- Evolves providers config to support any provider type with shared model defaults
- Improves mise build output to show go build command and resulting binary
- Exempts background-agent polling from loop-termination detection to prevent false positives

## Bug Fixes

- Fixes agent accent color application for working spinners in sidebar
- Fixes duplicate RAG tool names and nil pointer panic in file watcher
- Fixes toolset startup triggering from emitToolsChanged callback to avoid spurious timeout warnings
- Fixes missing Models map in RAG ManagersBuildConfig for model alias resolution
- Fixes nil pointer dereference in BM25Strategy.watchLoop during session teardown
- Fixes extraction of reasoning_content from DMR streaming responses
- Fixes scrollbar rendering in web terminals by replacing problematic characters

## Technical Changes

- Adds nocgo build support for rag/treesitter
- Updates error message display when only one model is available

### Pull Requests

- [#2208](https://github.com/docker/docker-agent/pull/2208) - feat(runtime): add auto-stop for max iterations in non-interactive mode
- [#2315](https://github.com/docker/docker-agent/pull/2315) - fix: use agent accent color for working spinners in sidebar
- [#2316](https://github.com/docker/docker-agent/pull/2316) - Underline URLs on mouse hover
- [#2317](https://github.com/docker/docker-agent/pull/2317) - docs: update CHANGELOG.md for v1.42.0
- [#2319](https://github.com/docker/docker-agent/pull/2319) - Exempt background-agent polling from loop-termination detection
- [#2322](https://github.com/docker/docker-agent/pull/2322) - fix: resolve duplicate RAG tool names and nil pointer panic in file watcher
- [#2323](https://github.com/docker/docker-agent/pull/2323) - fix: avoid triggering toolset startup from emitToolsChanged callback
- [#2324](https://github.com/docker/docker-agent/pull/2324) - fix: pass Models map to RAG ManagersBuildConfig for model alias resolution
- [#2331](https://github.com/docker/docker-agent/pull/2331) - session: add WithID option for custom session IDs
- [#2334](https://github.com/docker/docker-agent/pull/2334) - Fix nil pointer dereference in BM25Strategy.watchLoop during session teardown
- [#2335](https://github.com/docker/docker-agent/pull/2335) - fix: extract reasoning_content from DMR streaming responses
- [#2338](https://github.com/docker/docker-agent/pull/2338) - Improve mise build output to show go build command and resulting binary
- [#2339](https://github.com/docker/docker-agent/pull/2339) - feat: add mouse drag-to-move support for TUI dialogs
- [#2340](https://github.com/docker/docker-agent/pull/2340) - Fix scrollbar rendering in web terminals
- [#2343](https://github.com/docker/docker-agent/pull/2343) - Evolve providers to support any provider type with shared model defaults
- [#2344](https://github.com/docker/docker-agent/pull/2344) - feat: support custom providers in RAG embedding and reranking models
- [#2345](https://github.com/docker/docker-agent/pull/2345) - Nicer message


## [v1.42.0] - 2026-04-03

This release improves evaluation output with structured JSON results and fixes several Windows compatibility issues.

## What's New
- Adds URL click detection for terminals with mouse tracking support
- Includes structured results, run configuration, and summary in evaluation JSON output
- Includes judge reasons for passed relevance criteria in evaluation results

## Bug Fixes
- Fixes Windows OS detection typo in session environment (corrects "window" to "windows")
- Replaces removed claude-3-7-sonnet-latest alias with explicit model ID in examples
- Uses platform-aware shell detection for Windows compatibility in skill expansion, script_shell, post-edit hooks, and bang commands

## Technical Changes
- Pre-populates criterion names in CheckRelevance results
- Fixes lint issues including gci formatting and testifylint float comparisons

### Pull Requests

- [#2307](https://github.com/docker/docker-agent/pull/2307) - docs: update CHANGELOG.md for v1.41.0
- [#2308](https://github.com/docker/docker-agent/pull/2308) - tui/messages: Add URL click detection for terminals with mouse tracking
- [#2309](https://github.com/docker/docker-agent/pull/2309) - eval: include structured results, run config, and summary in JSON output
- [#2312](https://github.com/docker/docker-agent/pull/2312) - fix: correct Windows OS detection typo in session environment
- [#2313](https://github.com/docker/docker-agent/pull/2313) - fix: replace removed claude-3-7-sonnet-latest alias in examples
- [#2314](https://github.com/docker/docker-agent/pull/2314) - fix: use platform-aware shell for skill expansion, script_shell, post-edit hooks, and bang command


## [v1.41.0] - 2026-04-01

This release introduces a new models discovery command, contextual help system, and several TUI improvements including persistent warnings and simplified lean mode.

## What's New
- Adds `docker agent models` command to list available models for the `--model` flag
- Adds contextual help dialog accessible via Ctrl+H (or F1/Ctrl+?) showing all keyboard shortcuts
- Adds `--lean` flag for simplified TUI mode with minimal interface (just message stream and editor)
- Adds copy button on hover for assistant messages to copy content to clipboard
- Adds Vertex AI Model Garden support for non-Gemini models (Claude, Llama) hosted on Google Cloud

## Improvements
- Makes TUI warnings persist until manually dismissed instead of auto-dismissing after 3 seconds
- Preserves recent messages during session compaction to maintain conversational context
- Shows elapsed time and warning for long-running tool calls in the TUI
- Adds desktop_uuid in telemetry alongside user_uuid for better tracking

## Bug Fixes
- Fixes markdown rendering in callout notes by adding markdown="1" attribute
- Fixes panic on closed channel by making chanSend non-blocking
- Fixes recursive run_skill loop in context:fork skill sub-sessions
- Fixes docker run --sandbox functionality
- Fixes eval tool_call_response to use correct event field names
- Fixes guard against nil tool_definition in buildTranscript

## Technical Changes
- Replaces kin-openapi with pb33f/libopenapi for OpenAPI parsing
- Removes trailing headers handling for rate limit headers
- Tracks command errors with success=false and error details in telemetry
- Ports build system to mise
- Updates Go module dependencies

### Pull Requests

- [#2252](https://github.com/docker/docker-agent/pull/2252) - Make TUI warnings persist until manually dismissed
- [#2253](https://github.com/docker/docker-agent/pull/2253) - Add --lean flag for simplified TUI mode
- [#2259](https://github.com/docker/docker-agent/pull/2259) - Preserve recent messages during session compaction
- [#2279](https://github.com/docker/docker-agent/pull/2279) - Add desktop_uuid in telemetry (next to user_uuid)
- [#2281](https://github.com/docker/docker-agent/pull/2281) - docs: update CHANGELOG.md for v1.40.0
- [#2283](https://github.com/docker/docker-agent/pull/2283) - Track command errors with success=false and error details
- [#2284](https://github.com/docker/docker-agent/pull/2284) - Bump direct Go module dependencies
- [#2285](https://github.com/docker/docker-agent/pull/2285) - Fix markdown rendering in documentation callout notes
- [#2286](https://github.com/docker/docker-agent/pull/2286) - fix: make chanSend non-blocking to prevent panic on closed channel
- [#2287](https://github.com/docker/docker-agent/pull/2287) - Add Vertex AI Model Garden support for non-Gemini models
- [#2288](https://github.com/docker/docker-agent/pull/2288) - Add copy button on hover for assistant messages
- [#2289](https://github.com/docker/docker-agent/pull/2289) - fix: prevent recursive run_skill loop in context:fork skill sub-sessions
- [#2290](https://github.com/docker/docker-agent/pull/2290) - docs: add Vertex AI Model Garden section to Google provider docs
- [#2291](https://github.com/docker/docker-agent/pull/2291) - tui: show elapsed time and warning for long-running tool calls
- [#2292](https://github.com/docker/docker-agent/pull/2292) - go mod tidy
- [#2293](https://github.com/docker/docker-agent/pull/2293) - Port to mise
- [#2294](https://github.com/docker/docker-agent/pull/2294) - Fix TUI stuck in Working state after failed sub-agent transfer_task
- [#2298](https://github.com/docker/docker-agent/pull/2298) - Remove trailing headers handling for rate limit headers
- [#2299](https://github.com/docker/docker-agent/pull/2299) - Replace kin-openapi with pb33f/libopenapi for OpenAPI parsing
- [#2301](https://github.com/docker/docker-agent/pull/2301) - Fix `docker run --sandbox`
- [#2302](https://github.com/docker/docker-agent/pull/2302) - fix: eval tool_call_response uses correct event field names
- [#2304](https://github.com/docker/docker-agent/pull/2304) - feat: add `docker agent models` command
- [#2305](https://github.com/docker/docker-agent/pull/2305) - Add contextual help dialog (Ctrl+H)
- [#2306](https://github.com/docker/docker-agent/pull/2306) - use DD proxy when available, also from WSL


## [v1.40.0] - 2026-03-30

This release improves AI assistant capabilities with better response tracking and Google integration, plus fixes a critical exit hang issue.

## What's New
- Adds Google Search, Google Maps, and code execution capabilities for Gemini models
- Surfaces finish_reason information on assistant messages and token usage events to track why the AI stopped generating responses

## Bug Fixes
- Fixes process hang when using `/exit` command due to bubbletea renderer deadlock

## Technical Changes
- Adds tests reproducing bubbletea renderer deadlock on exit
- Adds safety-net exit mechanism for bubbletea renderer deadlock prevention

### Pull Requests

- [#2254](https://github.com/docker/docker-agent/pull/2254) - Surface finish_reason on assistant messages and token usage events
- [#2265](https://github.com/docker/docker-agent/pull/2265) - docs: update CHANGELOG.md for v1.39.0
- [#2269](https://github.com/docker/docker-agent/pull/2269) - Fix process hang on /exit due to bubbletea renderer deadlock
- [#2276](https://github.com/docker/docker-agent/pull/2276) - Google grounding
- [#2277](https://github.com/docker/docker-agent/pull/2277) - Fix url


## [v1.39.0] - 2026-03-27

This release adds new color themes for the terminal interface and includes internal version management updates.

## What's New
- Adds Calm Roots theme with warm white accents, sage green info messages, and charcoal background
- Adds Neon Pink theme with vibrant pink tones and high-contrast white accents for readability

## Technical Changes
- Freezes v7 version
- Updates CHANGELOG.md for v1.38.0

### Pull Requests

- [#2256](https://github.com/docker/docker-agent/pull/2256) - docs: update CHANGELOG.md for v1.38.0
- [#2260](https://github.com/docker/docker-agent/pull/2260) - Add Calm Roots and Neon Pink themes
- [#2264](https://github.com/docker/docker-agent/pull/2264) - Freeze v7


## [v1.38.0] - 2026-03-26

This release improves OAuth configuration and fixes tool caching issues with remote MCP server reconnections.

## Improvements

- Changes OAuth client name to "docker-agent" for better identification
- Reworks compaction logic to prevent infinite loops when context overflow errors occur repeatedly

## Bug Fixes

- Fixes tool cache not refreshing after remote MCP server reconnects, ensuring updated tools are available after server restarts

## Technical Changes

- Updates CHANGELOG.md for v1.37.0 release documentation

### Pull Requests

- [#2242](https://github.com/docker/docker-agent/pull/2242) - Refactor compaction
- [#2243](https://github.com/docker/docker-agent/pull/2243) - docs: update CHANGELOG.md for v1.37.0
- [#2245](https://github.com/docker/docker-agent/pull/2245) - Change the oauth client name to docker-agent
- [#2246](https://github.com/docker/docker-agent/pull/2246) - fix: refresh tool and prompt caches after remote MCP server reconnect


## [v1.37.0] - 2026-03-25

This release adds support for forwarding sampling parameters to provider APIs, introduces global user-level permissions, and includes several bug fixes and improvements.

## What's New

- Adds support for forwarding sampling provider options (top_k, repetition_penalty, etc.) to provider APIs
- Adds global-level permissions from user config that apply across all sessions and agents
- Adds a welcome message to the interface
- Adds custom linter to enforce config version import chain

## Improvements

- Refactors RAG from agent-level config to standard toolset type for consistency with other toolsets
- Restores RAG indexing event forwarding to TUI after toolset refactor
- Simplifies RAG event forwarding and cleans up RAGTool

## Bug Fixes

- Fixes Bedrock interleaved_thinking defaults to true and adds logging for provider_opts mismatches
- Fixes issue where CacheControl markers were preserved during message compaction, exceeding Anthropic's limit
- Fixes tool loop detector by resetting it after degenerate loop error
- Fixes desktop proxy socket name on WSL where http-proxy socket is not allowed for users

## Technical Changes

- Documents max_old_tool_call_tokens and max_consecutive_tool_calls in agent config reference
- Documents global permissions from user config in permissions reference and guides
- Pins GitHub actions for improved security
- Updates cagent-action to latest version with better permissions

### Pull Requests

- [#2210](https://github.com/docker/docker-agent/pull/2210) - Refactor RAG from agent-level config to standard toolset type
- [#2225](https://github.com/docker/docker-agent/pull/2225) - Add custom linter to enforce config version import chain
- [#2226](https://github.com/docker/docker-agent/pull/2226) - feat: forward sampling provider_opts (top_k, repetition_penalty) to provider APIs
- [#2227](https://github.com/docker/docker-agent/pull/2227) - docs: update CHANGELOG.md for v1.36.1
- [#2229](https://github.com/docker/docker-agent/pull/2229) - docs: add max_old_tool_call_tokens and max_consecutive_tool_calls to agent config reference
- [#2230](https://github.com/docker/docker-agent/pull/2230) - Add global-level permissions from user config
- [#2231](https://github.com/docker/docker-agent/pull/2231) - Pin GitHub actions
- [#2233](https://github.com/docker/docker-agent/pull/2233) - update cagent-action to latest (with better permissions)
- [#2236](https://github.com/docker/docker-agent/pull/2236) - fix: strip CacheControl from messages during compaction
- [#2237](https://github.com/docker/docker-agent/pull/2237) - Reset tool loop detector after degenerate loop error
- [#2238](https://github.com/docker/docker-agent/pull/2238) - Bump direct Go module dependencies
- [#2240](https://github.com/docker/docker-agent/pull/2240) - Fix desktop proxy socket name on WSL
- [#2241](https://github.com/docker/docker-agent/pull/2241) - docs: document global permissions from user config


## [v1.36.1] - 2026-03-23

This release improves OCI reference handling, adds a tools command, and enhances MCP server reliability with better error recovery.

## What's New
- Adds `/tools` command to show available tools in a TUI dialog
- Adds support for serving digest-pinned OCI references directly from cache

## Improvements
- Uses Docker Desktop proxy for all HTTP operations when Docker Desktop is running
- Improves MCP server reconnection by retrying tool calls on any connection error, not just session errors
- Normalizes OCI reference handling in store lookups to match Pull() key format

## Bug Fixes
- Fixes `/clear` command to properly re-initialize the TUI
- Fixes tools/permissions dialog height instability when scrolling
- Fixes empty lines in tools dialog from multiline descriptions
- Fixes relative path resolution when parentDir is empty by falling back to current working directory

## Technical Changes
- Extracts RAG code for better organization
- Removes model alias resolution for inline agent model references
- Sets missing category on MCP and script shell tools
- Removes dead code and unused agent event handling
- Enables additional linters (bodyclose, makezero, sqlclosecheck) with corresponding fixes
- Adds comprehensive Managing Secrets documentation guide

### Pull Requests

- [#2201](https://github.com/docker/docker-agent/pull/2201) - docs: update CHANGELOG.md for v1.36.0
- [#2204](https://github.com/docker/docker-agent/pull/2204) - Better oci refs
- [#2205](https://github.com/docker/docker-agent/pull/2205) - Simplify the runtime related RAG code a bit
- [#2206](https://github.com/docker/docker-agent/pull/2206) - Remove model alias resolution for inline agent model references
- [#2207](https://github.com/docker/docker-agent/pull/2207) - Fix /clear
- [#2209](https://github.com/docker/docker-agent/pull/2209) - Add /tools command to show the available tools
- [#2212](https://github.com/docker/docker-agent/pull/2212) - fix: recover from ErrSessionMissing when remote MCP server restarts
- [#2213](https://github.com/docker/docker-agent/pull/2213) - docs: clarify :agent and :name parameters in API server endpoints
- [#2215](https://github.com/docker/docker-agent/pull/2215) - fix: retry MCP callTool on any connection error, not just ErrSessionMissing
- [#2217](https://github.com/docker/docker-agent/pull/2217) - docs: add Managing Secrets guide
- [#2218](https://github.com/docker/docker-agent/pull/2218) - Bump Go dependencies
- [#2219](https://github.com/docker/docker-agent/pull/2219) - Enable bodyclose, makezero, and sqlclosecheck linters
- [#2221](https://github.com/docker/docker-agent/pull/2221) - fix: resolve relative paths against CWD when parentDir is empty
- [#2222](https://github.com/docker/docker-agent/pull/2222) - Use Docker Desktop proxy when available
- [#2224](https://github.com/docker/docker-agent/pull/2224) - Make run.go easier to read


## [v1.36.0] - 2026-03-20

This release adds WebSocket transport support for OpenAI streaming, introduces configurable tool call token limits, and improves the command-line interface with new session management capabilities.

## What's New

- Adds WebSocket transport option for OpenAI Responses API streaming as an alternative to SSE
- Adds `/clear` command to reset current tab with a new session
- Adds configurable `max_old_tool_call_tokens` setting in agent YAML to control historical tool call content retention

## Improvements

- Hides agent name header when stdout is not a TTY for cleaner piped output
- Sorts all slash commands by label and hides `/q` alias from dialogs, showing only `/exit` and `/quit`
- Injects `lastResponseID` as `previous_response_id` in WebSocket requests for better continuity

## Bug Fixes

- Fixes data race on WebSocket pool lazy initialization
- Fixes panic in WebSocket handling

## Technical Changes

- Removes legacy `syncMessagesColumn` and messages JSON column from database schema
- Simplifies WebSocket pool code structure
- Documents external OCI registry agents usage as sub-agents

### Pull Requests

- [#2186](https://github.com/docker/docker-agent/pull/2186) - Add WebSocket transport for OpenAI Responses API streaming
- [#2192](https://github.com/docker/docker-agent/pull/2192) - feat: make maxOldToolCallTokens configurable in agent YAML
- [#2195](https://github.com/docker/docker-agent/pull/2195) - docs: document external OCI registry agents as sub-agents
- [#2196](https://github.com/docker/docker-agent/pull/2196) - Remove syncMessagesColumn and legacy messages JSON column
- [#2197](https://github.com/docker/docker-agent/pull/2197) - Support `echo "hello" | docker agent | cat`
- [#2199](https://github.com/docker/docker-agent/pull/2199) - Add /clear command to reset current tab with a new session
- [#2200](https://github.com/docker/docker-agent/pull/2200) - Hide /q from dialogs and sort all commands by label


## [v1.34.0] - 2026-03-19

This release improves tool call handling and evaluation functionality with several technical fixes and optimizations.

## Improvements

- Optimizes partial tool call streaming by sending only delta arguments instead of accumulated arguments
- Reduces evaluation summary display width for better terminal formatting
- Includes tool definition only on the first partial tool call to reduce redundancy

## Bug Fixes

- Fixes schema conversion for OpenAI Responses API strict mode, resolving issues with gpt-4.1-nano
- Removes duplicate tool call data from tool call response events to reduce payload size

## Technical Changes

- Updates evaluation system to not provide all API keys when using models gateway
- Removes redundant tool call information from response events while preserving tool call IDs for client reference

### Pull Requests

- [#2105](https://github.com/docker/docker-agent/pull/2105) - Only send the delta on the partial tool call
- [#2159](https://github.com/docker/docker-agent/pull/2159) - docs: update CHANGELOG.md for v1.33.0
- [#2160](https://github.com/docker/docker-agent/pull/2160) - Fix (reduce) evals summary width
- [#2162](https://github.com/docker/docker-agent/pull/2162) - Evals: don't provide all API keys when using models gateway
- [#2163](https://github.com/docker/docker-agent/pull/2163) - Remove the tool call from the tool call response event
- [#2164](https://github.com/docker/docker-agent/pull/2164) - build(deps): bump google.golang.org/grpc from 1.79.2 to 1.79.3 in the go_modules group across 1 directory
- [#2168](https://github.com/docker/docker-agent/pull/2168) - Fix schema conversion for OpenAI Responses API strict mode - Fixes tool calls with gpt-4.1-nano


## [v1.33.0] - 2026-03-18

This release improves file editing reliability, adds session exit keywords, and fixes several issues with sub-sessions and evaluation handling.

## What's New
- Adds support for "exit", "quit", and ":q" keywords to quit sessions immediately
- Adds per-eval Docker image override via evals.image property in evaluation configurations
- Adds run instructions to creator agent prompt for proper agent execution guidance

## Bug Fixes
- Fixes handling of double-serialized edits argument in edit_file tool when LLMs send JSON strings instead of arrays
- Fixes sub-session thinking state being incorrectly derived from parent session instead of child agent
- Fixes --sandbox flag when running in CLI plugin mode
- Fixes cross-model Gemini function calls by using dummy thought_signature
- Fixes event timestamps for user messages in SessionFromEvents to prevent duration calculation issues

## Improvements
- Displays breakdown of failure types in evaluation summary for better debugging
- Declines elicitations in run --exec --json mode
- Validates path field consistently in edit file operations

## Technical Changes
- Removes unused fileWriteTracker from creator package
- Simplifies UnmarshalJSON implementation for better path validation
- Updates evaluation image build cache to handle different images per working directory

### Pull Requests

- [#2144](https://github.com/docker/docker-agent/pull/2144) - fix: handle double-serialized edits argument in edit_file tool
- [#2146](https://github.com/docker/docker-agent/pull/2146) - Better rendering in tmux and ghostty
- [#2147](https://github.com/docker/docker-agent/pull/2147) - docs: update CHANGELOG.md for v1.32.5
- [#2149](https://github.com/docker/docker-agent/pull/2149) - fix: sub-session thinking state derived from child agent, not parent session
- [#2150](https://github.com/docker/docker-agent/pull/2150) - Display breakdown of types of failures in eval summary
- [#2151](https://github.com/docker/docker-agent/pull/2151) - Fix --sandbox when running cli plugin mode
- [#2152](https://github.com/docker/docker-agent/pull/2152) - feat: support "exit" as a keyword to quit the session
- [#2153](https://github.com/docker/docker-agent/pull/2153) - Add per-eval Docker image override via evals.image property
- [#2154](https://github.com/docker/docker-agent/pull/2154) - Add run instructions to creator agent prompt
- [#2155](https://github.com/docker/docker-agent/pull/2155) - fix: use dummy thought_signature for cross-model Gemini function calls
- [#2156](https://github.com/docker/docker-agent/pull/2156) - Decline elicitations in run --exec --json mode
- [#2157](https://github.com/docker/docker-agent/pull/2157) - Remove unused fileWriteTracker from creator package
- [#2158](https://github.com/docker/docker-agent/pull/2158) - fix: use event timestamps for user messages in SessionFromEvents


## [v1.32.5] - 2026-03-17

This release improves agent reliability and performance with better tool loop detection, enhanced MCP handling, and various bug fixes.

## What's New

- Adds framework-level tool loop detection to prevent degenerate agent loops when the same tool is called repeatedly
- Adds support for dynamic command expansion in skills using `!\`command\`` syntax
- Adds support for running skills as isolated sub-agents via `context: fork` frontmatter
- Adds CLI flags (`--hook-pre-tool-use`, `--hook-post-tool-use`, etc.) to override agent hooks from command line
- Adds stop and notification hooks with session lifecycle integration

## Improvements

- Reworks thinking budget system to be opt-in by default with adaptive thinking and effort levels
- Caches syntax highlighting results for code blocks to improve markdown rendering performance
- Optimizes MCP catalog loading with single fetch per run and ETag caching
- Derives meaningful names for external sub-agents instead of using generic 'root' name
- Optimizes filesystem tool performance by avoiding duplicate string allocations
- Speeds up history loading with ReadFile and strconv.Unquote optimizations

## Bug Fixes

- Fixes context cancelling during RAG initialization and query operations
- Fixes frozen spinner during MCP tool loading
- Fixes model name display in TUI sidebar for all model types
- Fixes two data races in shell tool execution
- Fixes character handling issues in tmux integration
- Fixes binary download URLs in documentation to match release artifact naming
- Validates thinking_budget effort levels at parse time and rejects unknown values

## Technical Changes

- Removes unused methods from codebase
- Hardens and simplifies MCP gateway code
- Adds logging for selected model in Agent.Model() for better observability
- Fixes pool_size reporting to reflect actual selection pool
- Reverts timeout changes for remote MCP initialization and tool calls

### Pull Requests

- [#2112](https://github.com/docker/docker-agent/pull/2112) - docs: update CHANGELOG.md for v1.32.4
- [#2113](https://github.com/docker/docker-agent/pull/2113) - Bump dependencies
- [#2114](https://github.com/docker/docker-agent/pull/2114) - Fix rag init context cancel
- [#2115](https://github.com/docker/docker-agent/pull/2115) - Fix frozen spinner during MCP tool loading
- [#2116](https://github.com/docker/docker-agent/pull/2116) - Support dynamic command expansion in skills (\!`command` syntax)
- [#2118](https://github.com/docker/docker-agent/pull/2118) - Fix model name display in TUI sidebar for all model types
- [#2119](https://github.com/docker/docker-agent/pull/2119) - perf(markdown): cache syntax highlighting results for code blocks
- [#2121](https://github.com/docker/docker-agent/pull/2121) - Rework thinking budget: opt-in by default, adaptive thinking, effort levels
- [#2123](https://github.com/docker/docker-agent/pull/2123) - feat: framework-level tool loop detection
- [#2124](https://github.com/docker/docker-agent/pull/2124) - Simplify MCP catalog loading: single fetch per run with ETag caching
- [#2125](https://github.com/docker/docker-agent/pull/2125) - Fix issues on builtin filesystem tools
- [#2127](https://github.com/docker/docker-agent/pull/2127) - Fix two data races in shell tool
- [#2128](https://github.com/docker/docker-agent/pull/2128) - Fix a few characters for tmux
- [#2129](https://github.com/docker/docker-agent/pull/2129) - docs: fix binary download URLs to match release artifact naming
- [#2130](https://github.com/docker/docker-agent/pull/2130) - More doc fixing with "agent serve mcp"
- [#2131](https://github.com/docker/docker-agent/pull/2131) - Add timeouts to remote MCP initialization and tool calls
- [#2132](https://github.com/docker/docker-agent/pull/2132) - Derive meaningful names for external sub-agents instead of using 'root'
- [#2133](https://github.com/docker/docker-agent/pull/2133) - gateway: harden and simplify MCP gateway code
- [#2134](https://github.com/docker/docker-agent/pull/2134) - Log selected model in Agent.Model() for alloy observability
- [#2135](https://github.com/docker/docker-agent/pull/2135) - Add --hook-* CLI flags to override agent hooks from the command line
- [#2136](https://github.com/docker/docker-agent/pull/2136) - Add stop and notification hooks, wire up session lifecycle hooks
- [#2137](https://github.com/docker/docker-agent/pull/2137) - feat: support running skills as isolated sub-agents via context: fork
- [#2138](https://github.com/docker/docker-agent/pull/2138) - Optimize start time
- [#2141](https://github.com/docker/docker-agent/pull/2141) - Revert "Add timeouts to remote MCP initialization and tool calls"
- [#2142](https://github.com/docker/docker-agent/pull/2142) - Reject unknown thinking_budget effort levels at parse time


## [v1.32.4] - 2026-03-16

This release optimizes tool instructions, removes unused session metadata, and includes several bug fixes and improvements.

## Improvements

- Optimizes builtin tool instructions for conciseness by applying Claude 4 prompt engineering best practices
- Removes unused branch metadata and split_diff_view from sessions to clean up data storage

## Bug Fixes

- Fixes emoji rendering issues in iTerm2
- Reverts keyboard enhancement changes that caused incorrect behavior in VSCode with AZERTY layout

## Technical Changes

- Extracts compaction logic into dedicated pkg/compaction package for better code organization
- Updates skill configuration
- Improves evaluation system by validating LLM judge, disabling thinking for LLM as judge, and removing handoffs scoring
- Disallows unknown fields in configuration validation

### Pull Requests

- [#2078](https://github.com/docker/docker-agent/pull/2078) - Remove unused branch metadata and split_diff_view from sessions
- [#2091](https://github.com/docker/docker-agent/pull/2091) - Optimize builtin tool instructions for conciseness
- [#2094](https://github.com/docker/docker-agent/pull/2094) - Bump dependencies
- [#2097](https://github.com/docker/docker-agent/pull/2097) - docs: update CHANGELOG.md for v1.32.3
- [#2098](https://github.com/docker/docker-agent/pull/2098) - Revert "tui: improve tmux experience and simplify keyboard enhancements"
- [#2099](https://github.com/docker/docker-agent/pull/2099) - Fix 2089 - emoji rendering in iTerm2
- [#2100](https://github.com/docker/docker-agent/pull/2100) - Improve evals
- [#2101](https://github.com/docker/docker-agent/pull/2101) - Extract compaction into a dedicated pkg/compaction package


## [v1.32.3] - 2026-03-13

This release removes an experimental feature and improves error handling for rate-limited API requests.

## Improvements
- Makes HTTP 429 (Too Many Requests) errors retryable when no fallback model is available, respecting the Retry-After header

## Bug Fixes
- Gates 429 retry behavior behind WithRetryOnRateLimit() opt-in option to prevent unexpected retry behavior

## Technical Changes
- Removes experimental feature from the codebase
- Adds optional gateway usage for LLM evaluation as a judge
- Refactors to use typed StatusError for retry metadata, with providers wrapping errors at Recv()

### Pull Requests

- [#2087](https://github.com/docker/docker-agent/pull/2087) - Remove experimental feature
- [#2090](https://github.com/docker/docker-agent/pull/2090) - docs: update CHANGELOG.md for v1.32.2
- [#2092](https://github.com/docker/docker-agent/pull/2092) - [eval] Optionnally use the gateway for the llm as a judge
- [#2093](https://github.com/docker/docker-agent/pull/2093) - This can be retried
- [#2096](https://github.com/docker/docker-agent/pull/2096) - fix: make HTTP 429 retryable when no fallback model, respect Retry-After header


## [v1.32.2] - 2026-03-12

This release focuses on security improvements and bug fixes, including prevention of PATH hijacking vulnerabilities and fixes to environment file support.

## Bug Fixes
- Fixes prevention of PATH hijacking and TOCTOU (Time-of-Check-Time-of-Use) vulnerabilities in shell/binary resolution (CWE-426)
- Fixes --env-file support for the gateway

## Technical Changes
- Removes debug code from codebase
- Reverts user prompt options feature that was previously added

### Pull Requests

- [#2071](https://github.com/docker/docker-agent/pull/2071) - Add options-based selection to user_prompt tool
- [#2083](https://github.com/docker/docker-agent/pull/2083) - fix: prevent PATH hijacking and TOCTOU in shell/binary resolution
- [#2084](https://github.com/docker/docker-agent/pull/2084) - docs: update CHANGELOG.md for v1.32.1
- [#2085](https://github.com/docker/docker-agent/pull/2085) - Fix --env-file support for the gateway
- [#2086](https://github.com/docker/docker-agent/pull/2086) - Remove debug code
- [#2088](https://github.com/docker/docker-agent/pull/2088) - Revert "Add options-based selection to user_prompt tool"


## [v1.32.1] - 2026-03-12

This release fixes several issues with session handling, tool elicitation, and MCP environment variable validation.

## Bug Fixes
- Fixes corrupted session history by filtering sub-agent streaming events from parent session persistence
- Fixes elicitation requests failing in sessions with ToolsApproved=true by decoupling elicitation channel from ToolsApproved flag
- Fixes MCP environment variable validation being skipped when any gateway preflight errors occur

## Improvements
- Prevents sidebar from scrolling to top when clicking navigation links in documentation

## Technical Changes
- Adds end-to-end test for tool result block validation
- Updates CHANGELOG.md for v1.32.0 release

### Pull Requests

- [#2053](https://github.com/docker/docker-agent/pull/2053) - fix(#2053): filter sub-agent streaming events from parent session persistence
- [#2072](https://github.com/docker/docker-agent/pull/2072) - docs: update CHANGELOG.md for v1.32.0
- [#2076](https://github.com/docker/docker-agent/pull/2076) - Don't scroll sidebar to the top
- [#2077](https://github.com/docker/docker-agent/pull/2077) - Fix corrupted session history
- [#2080](https://github.com/docker/docker-agent/pull/2080) - fix: decouple elicitation channel from ToolsApproved flag
- [#2081](https://github.com/docker/docker-agent/pull/2081) - Fix MCP env var check skipped when any gateway preflight errors


## [v1.32.0] - 2026-03-12

This release adds support for newer Gemini models, improves toolset documentation, and enhances user interaction capabilities.

## What's New

- Adds options-based selection to user_prompt tool, allowing the agent to present users with labeled choices instead of free-form input
- Documents {ORIGINAL_INSTRUCTIONS} placeholder for enriching toolset instructions rather than replacing them

## Bug Fixes

- Fixes support for Gemini 3.x versioned models (e.g., gemini-3.1-pro-preview) to ensure proper model recognition and thinking configuration
- Fixes gateway handling when using docker agent without a command
- Fixes broken links in documentation

## Technical Changes

- Adds check for broken links in CI
- Updates .gitignore to exclude cagent-* binaries from being committed

### Pull Requests

- [#2054](https://github.com/docker/docker-agent/pull/2054) - fix: support Gemini 3.x versioned models (e.g., gemini-3.1-pro-preview)
- [#2062](https://github.com/docker/docker-agent/pull/2062) - doc: document {ORIGINAL_INSTRUCTIONS} placeholder for toolset instructions
- [#2063](https://github.com/docker/docker-agent/pull/2063) - docs: update CHANGELOG.md for v1.31.0
- [#2064](https://github.com/docker/docker-agent/pull/2064) - Fix gateway handling with docker agent without command
- [#2067](https://github.com/docker/docker-agent/pull/2067) - Fix broken links
- [#2068](https://github.com/docker/docker-agent/pull/2068) - Check for broken links
- [#2069](https://github.com/docker/docker-agent/pull/2069) - gitignore cagent-* binaries
- [#2071](https://github.com/docker/docker-agent/pull/2071) - Add options-based selection to user_prompt tool


## [v1.31.0] - 2026-03-11

This release enhances the cost dialog with detailed session statistics and improves todo tool reliability for better task completion tracking.

## What's New
- Adds total token count, session duration, and message count to cost dialog
- Adds reasoning tokens display for supported models (e.g. o1)
- Adds average cost per 1K tokens and per message metrics to cost analysis
- Adds cost percentage breakdown per model and per message
- Adds cache hit rate and per-entry cached token count display

## Improvements
- Improves todo tool reliability by reminding LLM of incomplete items and including full state in all responses

## Bug Fixes
- Fixes Sonnet model name
- Fixes various edge-case bugs in cost dialog formatting

## Technical Changes
- Adds cache to building hub image in CI
- Optimizes CI by building and testing Go on the same runner to avoid duplicate compilation
- Freezes config to v6
- Deduplicates tool documentation into individual pages
- Adds docs-serve task for local Jekyll preview via Docker

### Pull Requests

- [#2037](https://github.com/docker/docker-agent/pull/2037) - Add cache to building hub image in CI
- [#2046](https://github.com/docker/docker-agent/pull/2046) - cost dialog: enrich with session stats, per-model percentages, and formatting fixes
- [#2048](https://github.com/docker/docker-agent/pull/2048) - fix: improve todo completion reliability
- [#2050](https://github.com/docker/docker-agent/pull/2050) - docs: update CHANGELOG.md for v1.30.1
- [#2052](https://github.com/docker/docker-agent/pull/2052) - Fix sonnet model name
- [#2056](https://github.com/docker/docker-agent/pull/2056) - Improve the toolsets documentation
- [#2059](https://github.com/docker/docker-agent/pull/2059) - Freeze config v6


## [v1.30.1] - 2026-03-11

This release improves command history handling, adds sound notifications, and includes various bug fixes and performance optimizations.

## What's New

- Adds sound notifications for long-running tasks and errors (opt-in feature, disabled by default)
- Adds LSP multiplexer to support multiple LSP toolsets simultaneously
- Adds per-toolset model routing via model field on toolsets configuration
- Adds click-to-copy functionality for working directory in TUI sidebar
- Makes background_agents a standalone toolset that can be enabled independently

## Improvements

- Improves tmux experience with better keyboard enhancements and focus handling
- Optimizes BM25 scoring strategy for better performance
- Reduces redundant work during evaluation runs
- Fixes animated spinners inside terminal multiplexers
- Repaints terminal on focus to fix broken display after tab switch in Docker Desktop

## Bug Fixes

- Fixes loading very long lines in command history that previously caused crashes
- Fixes LSP server being killed by context cancellation and restart failures
- Fixes session-pinned agent usage in RunStream instead of shared currentAgent
- Fixes sidebar context percentage flickering during sub-agent transfers
- Fixes concurrent map writes by moving registerDefaultTools to constructor
- Returns clear error when OPENAI_API_KEY is missing for speech-to-text

## Technical Changes

- Splits monolithic runtime.go into focused files by concern
- Refactors code to use slices and maps stdlib functions instead of manual implementations
- Enables modernize and perfsprint linters with all findings resolved
- Migrates tool output to structured JSON schemas for todo tools
- Replaces json.MarshalIndent with json.Marshal in builtin tools
- Uses errors.AsType consistently instead of errors.As with pre-declared variables

### Pull Requests

- [#1870](https://github.com/docker/docker-agent/pull/1870) - feat: add sound notifications for task completion and errors
- [#1940](https://github.com/docker/docker-agent/pull/1940) - history: Fix loading very long lines
- [#1970](https://github.com/docker/docker-agent/pull/1970) - Add LSP multiplexer to support multiple LSP toolsets
- [#2002](https://github.com/docker/docker-agent/pull/2002) - Don't ignore GITHUB_TOKEN
- [#2003](https://github.com/docker/docker-agent/pull/2003) - docs: update CHANGELOG.md for v1.30.0
- [#2005](https://github.com/docker/docker-agent/pull/2005) - Fix broken links to pages subsections
- [#2007](https://github.com/docker/docker-agent/pull/2007) - codemode: fix Start() fail-fast and use tools.As for wrapper unwrapping
- [#2008](https://github.com/docker/docker-agent/pull/2008) - Fix LSP server killed by context cancellation and restart failures
- [#2009](https://github.com/docker/docker-agent/pull/2009) - fix: use session-pinned agent in RunStream instead of shared currentAgent
- [#2010](https://github.com/docker/docker-agent/pull/2010) - refactor: split runtime.go and extract pkg/modelerrors
- [#2011](https://github.com/docker/docker-agent/pull/2011) - Bump direct Go dependencies
- [#2012](https://github.com/docker/docker-agent/pull/2012) - fix(#2012): Return clear error when OPENAI_API_KEY is missing for speech-to-text
- [#2013](https://github.com/docker/docker-agent/pull/2013) - fix(#2012): Return clear error when OPENAI_API_KEY is missing for speech-to-text
- [#2014](https://github.com/docker/docker-agent/pull/2014) - Replace duplicated mockEnvProvider test types with shared environment providers
- [#2015](https://github.com/docker/docker-agent/pull/2015) - feat: add per-toolset model routing via model field on toolsets
- [#2016](https://github.com/docker/docker-agent/pull/2016) - Simplify rulebased router: remove redundant types and score aggregation
- [#2017](https://github.com/docker/docker-agent/pull/2017) - tui: improve tmux experience and simplify keyboard enhancements
- [#2018](https://github.com/docker/docker-agent/pull/2018) - Unify streamAdapter/betaStreamAdapter retry logic into generic retryableStream
- [#2019](https://github.com/docker/docker-agent/pull/2019) - refactor(anthropic): deduplicate sequencing, media-type, and test helpers
- [#2020](https://github.com/docker/docker-agent/pull/2020) - docs: fix hallucinated CLI flags, commands, and config formats
- [#2021](https://github.com/docker/docker-agent/pull/2021) - refactor: use slices and maps stdlib functions instead of manual implementations
- [#2024](https://github.com/docker/docker-agent/pull/2024) - Fix task deploy-local
- [#2025](https://github.com/docker/docker-agent/pull/2025) - fix: default sound notifications to off (opt-in)
- [#2026](https://github.com/docker/docker-agent/pull/2026) - tui: repaint terminal on focus to fix broken display after tab switch
- [#2027](https://github.com/docker/docker-agent/pull/2027) - Enable modernize and perfsprint linters, fix all findings
- [#2028](https://github.com/docker/docker-agent/pull/2028) - refactor: use errors.AsType consistently instead of errors.As with pre-declared variables
- [#2029](https://github.com/docker/docker-agent/pull/2029) - refactor(dmr): split client.go into focused files by concern
- [#2030](https://github.com/docker/docker-agent/pull/2030) - refactor(runtime): split monolithic runtime.go into focused files
- [#2031](https://github.com/docker/docker-agent/pull/2031) - Replace json.MarshalIndent with json.Marshal in builtin tools
- [#2032](https://github.com/docker/docker-agent/pull/2032) - update Slack link in readme
- [#2033](https://github.com/docker/docker-agent/pull/2033) - feat: make background_agents a standalone toolset
- [#2034](https://github.com/docker/docker-agent/pull/2034) - Fix last brew install cagent mention
- [#2035](https://github.com/docker/docker-agent/pull/2035) - tui: fix animated spinners inside terminal multiplexers
- [#2036](https://github.com/docker/docker-agent/pull/2036) - feat: click to copy working directory in TUI sidebar
- [#2038](https://github.com/docker/docker-agent/pull/2038) - refactor: remove duplication in model resolution, thinking budget, and message construction
- [#2040](https://github.com/docker/docker-agent/pull/2040) - Use ResultSuccess/ResultError helpers in tasks and user_prompt tools
- [#2041](https://github.com/docker/docker-agent/pull/2041) - fix: move registerDefaultTools to constructor to prevent concurrent map writes
- [#2042](https://github.com/docker/docker-agent/pull/2042) - Fix sidebar context % flickering during sub-agent transfers
- [#2043](https://github.com/docker/docker-agent/pull/2043) - perf: optimize BM25 scoring strategy
- [#2045](https://github.com/docker/docker-agent/pull/2045) - todo: migrate tool output to structured JSON schemas
- [#2047](https://github.com/docker/docker-agent/pull/2047) - eval: reduce redundant work during evaluation runs


## [v1.30.0] - 2026-03-09

This release introduces file drag-and-drop support, background agent tasks, and completes the transition from "cagent" to "docker-agent" branding throughout the codebase.

## What's New

- Adds file drag-and-drop support for images and PDFs with visual file type indicators and 5MB size limit per file
- Adds background agent task tools (`run_background_agent`, `list_background_agents`, `view_background_agent`, `stop_background_agent`) for concurrent sub-agent dispatch
- Adds `--sandbox` flag to run command for Docker sandbox isolation
- Adds model_picker toolset for dynamic model switching between LLM models mid-conversation
- Adds search, update, categories, and default path functionality to memory tool
- Adds MiniMax as a built-in provider alias with `MINIMAX_API_KEY` support
- Adds top-level `mcps` section for reusable MCP server definitions in agent configs
- Adds support for OCI/catalog and URL references as sub-agents and handoffs

## Improvements

- Auto-continues max iterations in `--yolo` mode instead of prompting
- Improves toolset error reporting to show specific toolset information
- Improves user_prompt TUI dialog with title, free-form input, and navigation
- Auto-pulls DMR models in non-interactive mode
- Animates window title while working for tmux activity detection
- Supports comma-separated string format for allowed-tools in skills

## Bug Fixes

- Fixes thread blocking when attachment file is deleted
- Fixes max iterations handling in JSON output mode
- Fixes text to speech on macOS
- Fixes context window overflow with auto-recovery and proactive compaction
- Fixes data races in Session Messages slice and test functions
- Fixes SSE streaming by disabling automatic gzip compression
- Applies ModifiedInput from pre-tool hooks to tool call arguments

## Technical Changes

- Completes rename from "cagent" to "docker-agent" throughout codebase, documentation, and repository URLs
- Supports both `DOCKER_AGENT_*` and legacy `CAGENT_*` environment variables
- Removes `--exit-on-stdin-eof` flag and ConnectRPC code
- Adds timeouts to shutdown contexts to prevent goroutine leaks
- Extracts TodoStorage interface with in-memory implementation
- Refactors listener lifecycle to return cleanup functions
- Updates Dockerfile to use docker-agent binary with cagent as compatible symlink

### Pull Requests

- [#863](https://github.com/docker/docker-agent/pull/863) - Add background agent task tools for concurrent sub-agent dispatch (#863)
- [#1658](https://github.com/docker/docker-agent/pull/1658) - feat: add file drag-and-drop support for images and PDFs
- [#1736](https://github.com/docker/docker-agent/pull/1736) - fix(editor): prevent thread block when attachment file is deleted
- [#1737](https://github.com/docker/docker-agent/pull/1737) - fix(cli): auto-continue max iterations in --yolo mode
- [#1904](https://github.com/docker/docker-agent/pull/1904) - cagent run --sandbox
- [#1908](https://github.com/docker/docker-agent/pull/1908) - Add background agent task tools for concurrent sub-agent dispatch (#863)
- [#1909](https://github.com/docker/docker-agent/pull/1909) - docs: update CHANGELOG.md for v1.29.0
- [#1911](https://github.com/docker/docker-agent/pull/1911) - Fix #1911
- [#1913](https://github.com/docker/docker-agent/pull/1913) - Bump Go dependencies
- [#1914](https://github.com/docker/docker-agent/pull/1914) - agent: Improve toolset error reporting
- [#1915](https://github.com/docker/docker-agent/pull/1915) - Update docs and samples to rename docker-agent, change usage samples to `docker agent`
- [#1916](https://github.com/docker/docker-agent/pull/1916) - update taskfile to build both images docker/cagent and docker/docker-agent
- [#1917](https://github.com/docker/docker-agent/pull/1917) - Rename env vars CAGENT_ to DOCKER_AGENT_ (keep support for old env vars) 
- [#1918](https://github.com/docker/docker-agent/pull/1918) - Remove --exit-on-stdin-eof
- [#1921](https://github.com/docker/docker-agent/pull/1921) - Nightly scanner should be less nit-picky about docs
- [#1922](https://github.com/docker/docker-agent/pull/1922) - Fix speech to text on macOS
- [#1923](https://github.com/docker/docker-agent/pull/1923) - Simplify the AGENTS.md a LOT
- [#1924](https://github.com/docker/docker-agent/pull/1924) - Fix a few issues in the docs
- [#1925](https://github.com/docker/docker-agent/pull/1925) - Support auto-downloading tools
- [#1926](https://github.com/docker/docker-agent/pull/1926) - Rename CAGENT_HIDE_TELEMETRY & CAGENT_EXP_DEBUG_LAYOUT. Still support old env vars
- [#1927](https://github.com/docker/docker-agent/pull/1927) - docs: remove generated pages/ from git tracking
- [#1928](https://github.com/docker/docker-agent/pull/1928) - More docs rename (in / docs), fix remaining `docker agent serve a2a/acp/mcp` 
- [#1929](https://github.com/docker/docker-agent/pull/1929) - Fix test
- [#1930](https://github.com/docker/docker-agent/pull/1930) - Fix a few race conditions seen in tests
- [#1931](https://github.com/docker/docker-agent/pull/1931) - Fix #1911
- [#1932](https://github.com/docker/docker-agent/pull/1932) - Validate yaml in doc
- [#1933](https://github.com/docker/docker-agent/pull/1933) - Improve pkg/js
- [#1936](https://github.com/docker/docker-agent/pull/1936) - Improve README
- [#1937](https://github.com/docker/docker-agent/pull/1937) - Add model_picker toolset for dynamic model switching
- [#1938](https://github.com/docker/docker-agent/pull/1938) - Teach the agent to work with our config versions
- [#1939](https://github.com/docker/docker-agent/pull/1939) - Fix broken links in docs pages, were not using relative urls
- [#1941](https://github.com/docker/docker-agent/pull/1941) - Improve sub-sessions usage
- [#1942](https://github.com/docker/docker-agent/pull/1942) - Show the new TUI
- [#1943](https://github.com/docker/docker-agent/pull/1943) - Improve user_prompt TUI dialog: title, free-form input, and navigation
- [#1944](https://github.com/docker/docker-agent/pull/1944) - Auto-pull DMR models in non-interactive mode
- [#1945](https://github.com/docker/docker-agent/pull/1945) - Fix listener resource leaks in serve commands
- [#1946](https://github.com/docker/docker-agent/pull/1946) - Support OCI/catalog and URL references as sub-agents and handoffs
- [#1947](https://github.com/docker/docker-agent/pull/1947) - Add top-level mcps section for reusable MCP server definitions
- [#1948](https://github.com/docker/docker-agent/pull/1948) - Add MiniMax as a built-in provider alias
- [#1949](https://github.com/docker/docker-agent/pull/1949) - Animate window title while working for tmux activity detection
- [#1950](https://github.com/docker/docker-agent/pull/1950) - fix(hooks): apply ModifiedInput from pre-tool hooks to tool call arguments
- [#1953](https://github.com/docker/docker-agent/pull/1953) - Bump go dependencies
- [#1954](https://github.com/docker/docker-agent/pull/1954) - bump google.golang.org/adk from v0.4.0 to v0.5.0
- [#1955](https://github.com/docker/docker-agent/pull/1955) - Leverage latest MCP spec features from go-sdk v1.4.0
- [#1957](https://github.com/docker/docker-agent/pull/1957) - Rename repo URL and pages URL
- [#1958](https://github.com/docker/docker-agent/pull/1958) - Use docker agent command
- [#1959](https://github.com/docker/docker-agent/pull/1959) - Improve docs search
- [#1960](https://github.com/docker/docker-agent/pull/1960) - todo: extract storage interface with in-memory implementation
- [#1961](https://github.com/docker/docker-agent/pull/1961) - docker-agent is primary binary in taskfile
- [#1962](https://github.com/docker/docker-agent/pull/1962) - A few more renames from cagent
- [#1964](https://github.com/docker/docker-agent/pull/1964) - Some more cagent urls
- [#1965](https://github.com/docker/docker-agent/pull/1965) - Add timeouts to shutdown contexts to prevent goroutine leaks
- [#1967](https://github.com/docker/docker-agent/pull/1967) - Disable automatic gzip compression to fix SSE streaming
- [#1968](https://github.com/docker/docker-agent/pull/1968) - Fix main branch
- [#1971](https://github.com/docker/docker-agent/pull/1971) - Add search, update, categories, and default path to memory tool
- [#1972](https://github.com/docker/docker-agent/pull/1972) - Update winget workflow to modify Docker.Agent package, with the new GH repo name
- [#1973](https://github.com/docker/docker-agent/pull/1973) - Fix context window overflow: auto-recovery and proactive compaction
- [#1974](https://github.com/docker/docker-agent/pull/1974) - updated GHA with new checks:write permission
- [#1979](https://github.com/docker/docker-agent/pull/1979) - Fix cobra command and rename more things from cagent to docker agent
- [#1983](https://github.com/docker/docker-agent/pull/1983) - Fix documentation
- [#1984](https://github.com/docker/docker-agent/pull/1984) - Support comma-separated string for allowed-tools in skills
- [#1988](https://github.com/docker/docker-agent/pull/1988) - Fix gopls versions
- [#1989](https://github.com/docker/docker-agent/pull/1989) - auto-complete tests
- [#1990](https://github.com/docker/docker-agent/pull/1990) - Daily fixes
- [#1991](https://github.com/docker/docker-agent/pull/1991) - Fix model name
- [#1992](https://github.com/docker/docker-agent/pull/1992) - Dockerfile with docker-agent binary, keeping cagent only as compatible symlink
- [#1993](https://github.com/docker/docker-agent/pull/1993) - Rename cagent in eval
- [#1994](https://github.com/docker/docker-agent/pull/1994) - More renames from cagent to docker-agent
- [#1995](https://github.com/docker/docker-agent/pull/1995) - Fix documentation
- [#1996](https://github.com/docker/docker-agent/pull/1996) - Remove ConnectRPC code
- [#1997](https://github.com/docker/docker-agent/pull/1997) - Rename e2e test files
- [#1998](https://github.com/docker/docker-agent/pull/1998) - Remove useless documentation
- [#1999](https://github.com/docker/docker-agent/pull/1999) - More renames
- [#2000](https://github.com/docker/docker-agent/pull/2000) - Remove package to github.com/docker/docker-agent
- [#2001](https://github.com/docker/docker-agent/pull/2001) - Remove my name :-)


## [v1.29.0] - 2026-03-03

This release adds automated issue triage capabilities and new CLI configuration options for directory overrides.

## What's New
- Adds auto issue triage workflow that automatically evaluates bug reports and can create fix PRs
- Adds `--config-dir`, `--data-dir`, and `--cache-dir` global CLI flags to override default paths

## Bug Fixes
- Fixes result marker parsing in auto-issue-triage workflow to handle LLM output with trailing empty lines
- Fixes GitHub Pages deployment issues

## Technical Changes
- Updates nightly scanner documentation and configuration
- Removes draft status from PR creation workflow steps
- Adds tip about the default agent in documentation

### Pull Requests

- [#1888](https://github.com/docker/docker-agent/pull/1888) - feat: add auto issue triage workflow
- [#1901](https://github.com/docker/docker-agent/pull/1901) - Fix GitHub pages deployment
- [#1902](https://github.com/docker/docker-agent/pull/1902) - docs: update CHANGELOG.md for v1.28.1
- [#1903](https://github.com/docker/docker-agent/pull/1903) - Fix the github pages?
- [#1905](https://github.com/docker/docker-agent/pull/1905) - Replace the brittle tail -n 1 parsing with something that searches for the marker
- [#1906](https://github.com/docker/docker-agent/pull/1906) - Add tip about the default agent
- [#1907](https://github.com/docker/docker-agent/pull/1907) - Add --config-dir and --data-dir global CLI flags to override default paths


## [v1.28.1] - 2026-03-03

This release adds image support for AI agents, improves cross-platform compatibility, and includes various stability fixes.

## What's New
- Adds image support to read_file tool and MCP tool results, allowing agents to view and describe images
- Adds content-based MIME detection and automatic image resizing for vision capabilities
- Strips image content for text-only models using model capabilities detection

## Improvements
- Reduces builtin tool prompt lengths while preserving key examples for better performance
- Skips hidden directories in recursive skill loading to avoid walking large trees like .git and .node_modules
- Only uses insecure TLS for localhost OTLP endpoints for better security

## Bug Fixes
- Fixes Esc key not interrupting sub-agents in multi-agent sessions
- Fixes slice bounds out of range panic for short JWT tokens
- Fixes goroutine tight loop in LSP readNotifications
- Fixes race condition with elicitation events channel
- Avoids looping forever on symlinks during skill loading
- Handles json.Marshal errors for tool Parameters and OutputSchema

## Technical Changes
- Replaces syscall.Rmdir with golang.org/x/sys for cross-platform directory removal
- Removes per-chunk UpdateMessage debug log from SQLite store to reduce log noise
- Stops tool sets for team loaded in GetAgentToolCount
- Migrates GitHub pages to markdown with Jekyll

### Pull Requests

- [#1875](https://github.com/docker/docker-agent/pull/1875) - Skip hidden directories in recursive skill loading
- [#1879](https://github.com/docker/docker-agent/pull/1879) - Reduce builtin tool prompt lengths while preserving key examples
- [#1885](https://github.com/docker/docker-agent/pull/1885) - Replace syscall.Rmdir with golang.org/x/sys for cross-platform directory removal
- [#1889](https://github.com/docker/docker-agent/pull/1889) - :eyes: Vision :eyes:
- [#1892](https://github.com/docker/docker-agent/pull/1892) - docs: update CHANGELOG.md for v1.28.0
- [#1893](https://github.com/docker/docker-agent/pull/1893) - Fixes to the documentation
- [#1895](https://github.com/docker/docker-agent/pull/1895) - Daily fixes of the bot-detected issues
- [#1896](https://github.com/docker/docker-agent/pull/1896) - Remove per-chunk UpdateMessage debug log
- [#1897](https://github.com/docker/docker-agent/pull/1897) - Pushes docker/docker-agent next to docker/cagent hub image
- [#1899](https://github.com/docker/docker-agent/pull/1899) - fix: Esc key not interrupting sub-agents in multi-agent sessions
- [#1900](https://github.com/docker/docker-agent/pull/1900) - Migrate our GitHub pages to markdown, with Jekyll


## [v1.28.0] - 2026-03-03

This release improves authentication debugging, session management, and MCP server reliability, along with UI enhancements to the command palette.

## What's New
- Adds 'debug auth' command to inspect Docker Desktop JWT with optional JSON output
- Adds automatic retry functionality for all models, including those without fallbacks

## Improvements
- Improves MCP server lifecycle with caching and auto-restart capabilities using exponential backoff
- Sorts command palette actions alphabetically within each group
- Uses tea.View.ProgressBar instead of raw escape codes for better display

## Bug Fixes
- Fixes session derailment by preserving user messages during conversation trimming
- Fixes duplicate Session header in command palette on macOS
- Fixes mcp/notion not working with OpenAI models by properly walking additionalProperties in schemas
- Defaults to string type for script tool arguments when type is not specified

## Technical Changes
- Updates tool filtering documentation
- Updates CHANGELOG.md for v1.27.1
- Updates Charm libraries to stable v2.0.0 releases (bubbletea, bubbles, lipgloss)

### Pull Requests

- [#1859](https://github.com/docker/docker-agent/pull/1859) - Fix script args with DMR
- [#1861](https://github.com/docker/docker-agent/pull/1861) - Add 'debug auth' command to inspect Docker Desktop JWT
- [#1862](https://github.com/docker/docker-agent/pull/1862) - docs: update CHANGELOG.md for v1.27.1
- [#1863](https://github.com/docker/docker-agent/pull/1863) - fix(#1863): preserve user messages in trimMessages to prevent session derailment
- [#1864](https://github.com/docker/docker-agent/pull/1864) - fix(#1863): preserve user messages in trimMessages to prevent session derailment
- [#1871](https://github.com/docker/docker-agent/pull/1871) - Fix `mcp/notion` not working with OpenAI models
- [#1872](https://github.com/docker/docker-agent/pull/1872) - Improve MCP server lifecycle: caching and auto-restart
- [#1874](https://github.com/docker/docker-agent/pull/1874) - Improve tool filtering doc
- [#1876](https://github.com/docker/docker-agent/pull/1876) - Bump dependencies
- [#1877](https://github.com/docker/docker-agent/pull/1877) - Improve Commands dialog
- [#1886](https://github.com/docker/docker-agent/pull/1886) - Add retries even for models without fallbacks


## [v1.27.1] - 2026-02-26

This release improves the user interface experience with better message editing capabilities and fixes several issues with token usage tracking and session loading.

## What's New
- Adds `on_user_input` hook that triggers when the agent is waiting for user input or tool confirmation

## Improvements
- Improves multi-line editing of past user messages
- Adds clipboard paste support during inline message editing
- Makes loading past sessions faster
- Updates TUI display when the current agent changes

## Bug Fixes
- Fixes token usage being recorded multiple times per stream, preventing inflated telemetry counts
- Fixes empty inline edit textarea expanding to full height
- Fixes docker ai shellout to cagent for standalone invocations

## Technical Changes
- Updates schema tests to only run for latest version
- Fixes documentation issues

### Pull Requests

- [#1845](https://github.com/docker/docker-agent/pull/1845) - Repaint the TUI when the current agent changes
- [#1846](https://github.com/docker/docker-agent/pull/1846) - docs: update CHANGELOG.md for v1.27.0
- [#1847](https://github.com/docker/docker-agent/pull/1847) - feat(hooks): add on_user_input
- [#1850](https://github.com/docker/docker-agent/pull/1850) - Improve editing past user messages
- [#1854](https://github.com/docker/docker-agent/pull/1854) - Make loading past sessions faster
- [#1855](https://github.com/docker/docker-agent/pull/1855) - fix: record token usage once per stream to prevent inflated telemetry
- [#1857](https://github.com/docker/docker-agent/pull/1857) - Schema tests should be only for latest version
- [#1858](https://github.com/docker/docker-agent/pull/1858) - Fix doc
- [#1860](https://github.com/docker/docker-agent/pull/1860) - Fix docker ai shellout to cagent


## [v1.27.0] - 2026-02-25

This release introduces dynamic agent color styling for multi-agent teams, adds new filesystem tools, and includes several bug fixes and security improvements.

## What's New

- Adds dynamic agent color styling system that assigns unique, deterministic colors to each agent in multi-agent teams for visual distinction across the TUI
- Adds hue-based agent color generation with theme integration that adapts saturation and lightness based on theme background
- Adds mkdir and rmdir filesystem tools so agents can create and remove directories without using shell commands
- Allows .github and .gitlab directories in WalkFiles traversal for better CI workflow support

## Bug Fixes

- Fixes race condition in agent color style lookups
- Fixes path traversal vulnerability in ACP filesystem operations
- Fixes YAML marshalling issues that could produce corrupted configuration files
- Handles case-insensitive filesystems properly
- Logs errors when persisting session title in TUI

## Technical Changes

- Consolidates color utilities into styles/colorutil.go
- Unexports internal color helpers and deduplicates fallbacks
- Fixes cassettes functionality

### Pull Requests

- [#1756](https://github.com/docker/docker-agent/pull/1756) - feat(#1756): Add dynamic agent color styling system
- [#1757](https://github.com/docker/docker-agent/pull/1757) - feat(#1756): Add dynamic agent color styling system
- [#1781](https://github.com/docker/docker-agent/pull/1781) - tools/fs: Add mkdir and rmdir
- [#1832](https://github.com/docker/docker-agent/pull/1832) - Daily fixes
- [#1833](https://github.com/docker/docker-agent/pull/1833) - allow .github and .gitlab directories in WalkFiles traversal
- [#1841](https://github.com/docker/docker-agent/pull/1841) - docs: update CHANGELOG.md for v1.26.0
- [#1844](https://github.com/docker/docker-agent/pull/1844) - Fix yaml marshalling


## [v1.26.0] - 2026-02-24

This is a maintenance release with dependency updates and internal improvements.

## Technical Changes
- Maintenance release with dependency updates



## [v1.24.0] - 2026-02-24

This release introduces remote skills discovery capabilities and improves file reading tools with pagination support.

## What's New
- Adds remote skills discovery with disk cache and dedicated tools, supporting the well-known skills discovery specification
- Adds offset and line_count pagination parameters to read_file and read_multiple_files tools for incremental reading of large files

## Improvements
- Limits output size for read_file and read_multiple_files tools to prevent excessive token usage
- Removes pagination instructions from tool descriptions for cleaner interface

## Bug Fixes
- Fixes LineCount metadata on truncated read_multiple_files results

## Technical Changes
- Freezes configuration version v5 and bumps to v6
- Updates test cassettes to match schema changes for file reading tools

### Pull Requests

- [#1810](https://github.com/docker/docker-agent/pull/1810) - Freeze v5 (and a few refactoring)
- [#1822](https://github.com/docker/docker-agent/pull/1822) - Implement remote skills discovery with disk cache and dedicated tools
- [#1828](https://github.com/docker/docker-agent/pull/1828) - builtin: add offset and line_count pagination to read_file and read_multiple_files
- [#1829](https://github.com/docker/docker-agent/pull/1829) - docs: update CHANGELOG.md for v1.23.6


## [v1.23.6] - 2026-02-23

This release improves cost tracking accuracy, enhances session management, and fixes several UI and functionality issues.

## What's New

- Adds tab completion for /commands dialog
- Adds mouse support for selecting and opening sessions in the sessions dialog

## Improvements

- Computes session cost from messages instead of accumulating on session for better accuracy
- Includes compaction cost in /cost dialog
- Displays original YAML model names in sidebar instead of resolved aliases
- Improves emoji copying support by reversing clipboard copy order (OSC52 first, then pbcopy fallback)

## Bug Fixes

- Fixes token usage percentage display during and after agent transfers
- Fixes session forking and costs calculation
- Fixes actual provider display for alloy models in sidebar (was showing wrong provider)
- Restores ctrl-1, ctrl-2... shortcuts for quick agent selection
- Fixes NewHandler panic on parameterless tool calls

## Technical Changes

- Consolidates TokenUsage event constructors
- Removes dead UpdateLastAssistantMessageUsage method
- Emits TokenUsageEvent on session restore for context percentage display
- Emits TokenUsageEvent after compaction so sidebar cost updates
- Adds e2e tests on binaries for CLI plugin execution
- Creates ~/.docker/cli-plugins directory if it doesn't exist

### Pull Requests

- [#1795](https://github.com/docker/docker-agent/pull/1795) - Fix multiple cost/tokens related issues
- [#1803](https://github.com/docker/docker-agent/pull/1803) - docs: update CHANGELOG.md for v1.23.5
- [#1804](https://github.com/docker/docker-agent/pull/1804) - Better support copying emojis
- [#1806](https://github.com/docker/docker-agent/pull/1806) - Tab completion for /commands dialog
- [#1807](https://github.com/docker/docker-agent/pull/1807) - fix: use actual provider for alloy models in sidebar
- [#1808](https://github.com/docker/docker-agent/pull/1808) - Update winget workflow
- [#1811](https://github.com/docker/docker-agent/pull/1811) - Improve sessions dialog
- [#1812](https://github.com/docker/docker-agent/pull/1812) - Binary e2e tests
- [#1813](https://github.com/docker/docker-agent/pull/1813) - feat: use docker read write bot
- [#1816](https://github.com/docker/docker-agent/pull/1816) - fix: restore ctrl-1, ctrl-2... shortcuts for quick agent selection
- [#1817](https://github.com/docker/docker-agent/pull/1817) - Bump Go dependencies
- [#1826](https://github.com/docker/docker-agent/pull/1826) - Refactor winget workflow to use wingetcreate CLI
- [#1827](https://github.com/docker/docker-agent/pull/1827) - get_memories errors on new memories


## [v1.23.5] - 2026-02-20

This release improves the session browser interface and fixes several issues with the docker-agent standalone binary.

## Improvements
- Shows message count in session browser dialog for better session overview

## Bug Fixes
- Fixes recognition of cobra internal completion commands as subcommands
- Fixes help text display for docker-agent standalone binary exec
- Fixes version output for docker-agent CLI plugin and standalone exec

## Technical Changes
- Renames internal schema structure

### Pull Requests

- [#1792](https://github.com/docker/docker-agent/pull/1792) - docs: update CHANGELOG.md for v1.23.4
- [#1796](https://github.com/docker/docker-agent/pull/1796) - Fix help for docker-agent standalone binary exec
- [#1802](https://github.com/docker/docker-agent/pull/1802) - Fix docker-agent version for cli plugin & standalone exec


## [v1.23.4] - 2026-02-19

This release introduces parallel session support with tab management, major command restructuring, and enhanced UI interactions.

## What's New

- Adds parallel session support with a new tab view to switch between sessions
- Adds drag and drop functionality for reordering tabs
- Adds mouse click support to elicitation, prompt input, and tool confirmation dialogs
- Adds `X-Cagent-Model-Name` header to models gateway requests
- Adds Ask list to permissions config to force confirmation for read-only tools
- Defaults to running the default agent when no subcommand is given

## Improvements

- Restores ctrl-r binding for searching prompt history
- Updates Claude Sonnet model version to 4.6
- Prevents closing the last remaining tab with Ctrl+W
- Makes fetch tool not read-only
- Handles Claude overloaded_error with retry logic

## Bug Fixes

- Fixes ctrl-c in docker agent and `docker agent` defaulting to `docker agent run`
- Fixes completion command
- Fixes cagent-action to expect a prompt
- Fixes gemini use of vertexai environment variables
- Fixes CPU profile file handling and error handling in isFirstRun

## Technical Changes

- Removes `cagent config` commands (breaking change)
- Removes `cagent feedback` command (breaking change)
- Removes `cagent build` command (breaking change)
- Removes `cagent catalog` command (breaking change)
- Moves a2a, acp, mcp and api commands under `cagent serve` (breaking change)
- Replaces `cagent exec` with `cagent run --exec` (breaking change)
- Moves pull and push under `cagent share` (breaking change)
- Hides `cagent debug`
- Adds skills to the default agent
- Defaults restore_tabs to false

### Pull Requests

- [#1751](https://github.com/docker/docker-agent/pull/1751) - feat: add `X-Cagent-Model-Name` header to models gateway requests
- [#1753](https://github.com/docker/docker-agent/pull/1753) - docs: update CHANGELOG.md for v1.23.3
- [#1755](https://github.com/docker/docker-agent/pull/1755) - Review cagent commands
- [#1759](https://github.com/docker/docker-agent/pull/1759) - Restore ctrl-r binding for searching prompt history
- [#1761](https://github.com/docker/docker-agent/pull/1761) - Fix completion command
- [#1762](https://github.com/docker/docker-agent/pull/1762) - fix: cagent-action expects a prompt
- [#1763](https://github.com/docker/docker-agent/pull/1763) - fix: gemini use of vertexai environment variables 
- [#1766](https://github.com/docker/docker-agent/pull/1766) - Add mouse click support to elicitation, prompt input, and tool confirmation dialogs
- [#1768](https://github.com/docker/docker-agent/pull/1768) - chore(config): Update Claude Sonnet model version to 4.6
- [#1772](https://github.com/docker/docker-agent/pull/1772) - drag 'n drop tabs
- [#1773](https://github.com/docker/docker-agent/pull/1773) - temp home dir to avoid issues in some environments
- [#1777](https://github.com/docker/docker-agent/pull/1777) - Bump Go dependencies
- [#1780](https://github.com/docker/docker-agent/pull/1780) - fallback: Handle overloaded_error
- [#1782](https://github.com/docker/docker-agent/pull/1782) - Fix ctrl-c in `docker agent serve api` and fix `docker agent` defaulting to `docker agent run`
- [#1785](https://github.com/docker/docker-agent/pull/1785) - permissions: add Ask list to force confirmation for tools
- [#1786](https://github.com/docker/docker-agent/pull/1786) - Make fetch tool not read-only
- [#1787](https://github.com/docker/docker-agent/pull/1787) - Daily fixes for the Nightly issue detector
- [#1788](https://github.com/docker/docker-agent/pull/1788) - Fix path and typo
- [#1789](https://github.com/docker/docker-agent/pull/1789) - Keep same error handling for main cli plugin execution
- [#1790](https://github.com/docker/docker-agent/pull/1790) - tui/tabbar: Prevent closing the last remaining tab


## [v1.23.3] - 2026-02-16

This release adds Docker CLI plugin support and improves TUI performance by making model reasoning checks asynchronous.

## What's New
- Adds support for using cagent as a Docker CLI plugin with `docker agent` command (no functional changes to existing `cagent` command)
- Handles Windows .exe binary suffix for CLI plugin compatibility

## Improvements
- Makes model reasoning support checks asynchronous to prevent TUI freezing (previously could block for up to 30 seconds)
- Threads context.Context through modelsdev store API to allow proper cancellation and deadline propagation

## Technical Changes
- Renames cagent OCI annotation to `io.docker.agent.version` while maintaining backward compatibility with the old annotation
- Updates config media type to use `docker.agent`
- Adds TUI general guidelines to AGENTS.md documentation

### Pull Requests

- [#1745](https://github.com/docker/docker-agent/pull/1745) - Rename cagent OCI annotation, keep old one
- [#1746](https://github.com/docker/docker-agent/pull/1746) - docs: update CHANGELOG.md for v1.23.2
- [#1747](https://github.com/docker/docker-agent/pull/1747) - Thread context.Context through modelsdev store API
- [#1748](https://github.com/docker/docker-agent/pull/1748) - Allow to use cagent binary as a docker cli plugin docker-agent. No functional change for cagent command.
- [#1749](https://github.com/docker/docker-agent/pull/1749) - Move ModelSupportsReasoning calls to async bubbletea commands


## [v1.23.2] - 2026-02-16

This release adds header forwarding capabilities for toolsets and includes several bug fixes and code improvements.

## What's New
- Adds support for `${headers.NAME}` syntax to forward upstream API headers to toolsets, allowing toolset configurations to reference incoming HTTP request headers

## Bug Fixes
- Fixes race condition in isFirstRun using atomic file creation
- Fixes nil pointer dereference when RateLimit is present without Usage
- Fixes double-counting of session costs with cumulative usage providers
- Fixes Ctrl+K key binding conflict in session browser by reassigning CopyID to Ctrl+Y
- Fixes model selection functionality

## Improvements
- Adds input validation and audit logging to shell tool
- Adds input validation and error handling to RunBangCommand

## Technical Changes
- Extracts shared helpers for command-based providers to reduce code duplication
- Removes duplication from config.Resolv
- Moves GetUserSettings() from pkg/config to pkg/userconfig as Get()
- Removes redundant Reader interface from pkg/config
- Fixes leaked os.Root handle in fileSource.Read
- Makes small improvements to cmd/root

### Pull Requests

- [#1725](https://github.com/docker/docker-agent/pull/1725) - Support ${headers.NAME} syntax to forward upstream API headers to toolsets
- [#1727](https://github.com/docker/docker-agent/pull/1727) - docs: update CHANGELOG.md for v1.23.1
- [#1729](https://github.com/docker/docker-agent/pull/1729) - Cleanup config code
- [#1730](https://github.com/docker/docker-agent/pull/1730) - refactor(environment): extract shared helpers for command-based providers
- [#1731](https://github.com/docker/docker-agent/pull/1731) - Daily fixes
- [#1732](https://github.com/docker/docker-agent/pull/1732) - Fix two issues with costs
- [#1734](https://github.com/docker/docker-agent/pull/1734) - Small improvements to cmd/root
- [#1740](https://github.com/docker/docker-agent/pull/1740) - Fix model switcher
- [#1741](https://github.com/docker/docker-agent/pull/1741) - fix(#1741): resolve Ctrl+K key binding conflict in session browser
- [#1742](https://github.com/docker/docker-agent/pull/1742) - fix(#1741): resolve Ctrl+K key binding conflict in session browser


## [v1.23.1] - 2026-02-13

This release introduces a new OpenAPI toolset for automatic API integration, task management capabilities, and several improvements to message handling and testing infrastructure.

## What's New

- Adds Tasks toolset with support for priorities and dependencies
- Adds OpenAPI built-in toolset type that automatically converts OpenAPI specifications into usable tools
- Adds support for custom telemetry tags via `TELEMETRY_TAGS` environment variable

## Improvements

- Preserves line breaks and indentation in welcome messages for better formatting
- Updates documentation links to point to GitHub Pages instead of code repository

## Bug Fixes

- Fixes recursive enforcement of required properties in OpenAI tool schemas (resolves Chrome MCP compatibility with OpenAI 5.2)
- Returns error when no messages are available after conversion instead of sending invalid requests

## Technical Changes

- Replaces time.Sleep in tests with deterministic synchronization for faster, more reliable testing
- Refactors models store implementation
- Adds .idea/ directory to gitignore
- Removes fake models.dev and unused code

### Pull Requests

- [#1704](https://github.com/docker/docker-agent/pull/1704) - Tasks toolset
- [#1710](https://github.com/docker/docker-agent/pull/1710) - fix: recursively enforce required properties in OpenAI tool schemas
- [#1714](https://github.com/docker/docker-agent/pull/1714) - docs: update CHANGELOG.md for v1.23.0
- [#1718](https://github.com/docker/docker-agent/pull/1718) - preserve line breaks and indentation in welcome messages
- [#1719](https://github.com/docker/docker-agent/pull/1719) - Add openapi built-in toolset type
- [#1720](https://github.com/docker/docker-agent/pull/1720) - return error if no messages are available after conversion
- [#1721](https://github.com/docker/docker-agent/pull/1721) - Refactor models store
- [#1722](https://github.com/docker/docker-agent/pull/1722) - Replace time.Sleep in tests with deterministic synchronization
- [#1723](https://github.com/docker/docker-agent/pull/1723) - Allow passing in custom tags to telemetry
- [#1724](https://github.com/docker/docker-agent/pull/1724) - Speed up fallback tests
- [#1726](https://github.com/docker/docker-agent/pull/1726) - Update documentation links to GitHub Pages


## [v1.23.0] - 2026-02-12

This release improves TUI display accuracy, enhances API security defaults, and fixes several memory leaks and session handling issues.

## What's New

- Adds optional setup script support for evaluation sessions to prepare container environments before agent execution
- Adds user_prompt tools to the planner for interactive user questions

## Improvements

- Makes session compaction non-blocking with spinner feedback instead of blocking the TUI render thread
- Returns error responses for unknown tool calls instead of silently skipping them
- Strips null values from MCP tool call arguments to fix compatibility with models like GPT-5.2
- Improves error handling and logging in evaluation judge with better error propagation and structured logging

## Bug Fixes

- Fixes incorrect tool count display in TUI when running in --remote mode
- Fixes tick leak that caused ~10% CPU usage when assistant finished answering
- Fixes session store leak and removes redundant session store methods
- Fixes A2A agent card advertising unroutable wildcard address by using localhost
- Fixes potential goroutine leak in monitorStdin
- Fixes Agents.UnmarshalYAML to properly reject unknown fields in agent configurations
- Persists tool call error state in session messages so failed tool calls maintain error status when sessions are reloaded

## Technical Changes

- Removes CORS middleware from 'cagent api' command
- Changes default binding from 0.0.0.0 to 127.0.0.1:8080 for 'cagent api', 'cagent a2a' and 'cagent mcp' commands
- Uses different default ports for better security
- Lists valid versions in unsupported config version error messages
- Adds the summary message as a user message during session compaction
- Propagates cleanup errors from fakeCleanup and recordCleanup functions
- Logs errors on log file close instead of discarding them

### Pull Requests

- [#1648](https://github.com/docker/docker-agent/pull/1648) - fix: show correct tool count in TUI when running in --remote mode
- [#1657](https://github.com/docker/docker-agent/pull/1657) - Better default security for cagent api|mcp|a2a
- [#1663](https://github.com/docker/docker-agent/pull/1663) - docs: update CHANGELOG.md for v1.22.0
- [#1668](https://github.com/docker/docker-agent/pull/1668) - Session store cleanup
- [#1669](https://github.com/docker/docker-agent/pull/1669) - Fix tick leak
- [#1673](https://github.com/docker/docker-agent/pull/1673) - eval: add optional setup script support for eval sessions
- [#1684](https://github.com/docker/docker-agent/pull/1684) - Fix Agents.UnmarshalYAML to reject unknown fields
- [#1685](https://github.com/docker/docker-agent/pull/1685) - Fix A2A agent card advertising unroutable wildcard address
- [#1686](https://github.com/docker/docker-agent/pull/1686) - Close the session
- [#1687](https://github.com/docker/docker-agent/pull/1687) - Make /compact non-blocking with spinner feedback
- [#1688](https://github.com/docker/docker-agent/pull/1688) - Remove redundant stdin nil check in api command
- [#1689](https://github.com/docker/docker-agent/pull/1689) - Return error response for unknown tool calls instead of silently skipping
- [#1692](https://github.com/docker/docker-agent/pull/1692) - Add documentation gh-pages
- [#1693](https://github.com/docker/docker-agent/pull/1693) - Add the summary message as a user message
- [#1694](https://github.com/docker/docker-agent/pull/1694) - Add more documentation
- [#1696](https://github.com/docker/docker-agent/pull/1696) - Fix MCP tool calls with gpt 5.2
- [#1697](https://github.com/docker/docker-agent/pull/1697) - Bump Go to 1.26.0
- [#1699](https://github.com/docker/docker-agent/pull/1699) - Fix issues found by the review agent
- [#1700](https://github.com/docker/docker-agent/pull/1700) - List valid versions in unsupported config version error
- [#1703](https://github.com/docker/docker-agent/pull/1703) - Bump direct Go dependencies
- [#1705](https://github.com/docker/docker-agent/pull/1705) - Improve the Planner
- [#1706](https://github.com/docker/docker-agent/pull/1706) - Improve error handling and logging in evaluation judge
- [#1711](https://github.com/docker/docker-agent/pull/1711) - Persist tool call error state in session messages


## [v1.22.0] - 2026-02-09

This release enhances the chat experience with history search functionality and improves file attachment handling, along with multi-turn conversation support for command-line operations.

## What's New

- Adds Ctrl+R reverse history search to the chat editor for quickly finding previous conversations
- Adds support for multi-turn conversations in `cagent exec`, `cagent run`, and `cagent eval` commands
- Adds support for queueing multiple messages with `cagent run question1 question2 ...`

## Improvements

- Improves file attachment handling by inlining text-based files and fixing placeholder stripping
- Refactors scrollbar into a reusable scrollview component for more consistent scrolling behavior across the interface

## Bug Fixes

- Fixes pasted attachments functionality
- Fixes persistence of multi_content for user messages to ensure attachment data is properly saved
- Fixes session browser shortcuts (star, filter, copy-id) to use Ctrl modifier, preventing conflicts with search input
- Fixes title generation spinner that could spin forever
- Fixes scrollview height issues when used with dialogs
- Fixes double @@ symbols when using file picker for @ attachments

## Technical Changes

- Updates OpenAI schema format handling to improve compatibility

### Pull Requests

- [#1630](https://github.com/docker/docker-agent/pull/1630) - feat: add Ctrl+R reverse history search
- [#1640](https://github.com/docker/docker-agent/pull/1640) - better file attachments
- [#1645](https://github.com/docker/docker-agent/pull/1645) - Prevent title generation spinner to spin forever
- [#1649](https://github.com/docker/docker-agent/pull/1649) - docs: update CHANGELOG.md for v1.21.0
- [#1650](https://github.com/docker/docker-agent/pull/1650) - OpenAI doesn't like those format indications on the schema
- [#1652](https://github.com/docker/docker-agent/pull/1652) - Fix: persist multi_content for user messages
- [#1654](https://github.com/docker/docker-agent/pull/1654) - Refactor scrollbar into more reusable `scrollview` component
- [#1656](https://github.com/docker/docker-agent/pull/1656) - fix: use ctrl modifier for session browser shortcuts to avoid search conflict
- [#1659](https://github.com/docker/docker-agent/pull/1659) - Fix pasted attachments
- [#1661](https://github.com/docker/docker-agent/pull/1661) - deleting version 2 so i can use permissions
- [#1662](https://github.com/docker/docker-agent/pull/1662) - Multi turn (cagent exec|run|eval)


## [v1.21.0] - 2026-02-09

This release adds a new generalist coding agent, improves agent configuration handling, and includes several bug fixes and UI improvements.

## What's New
- Adds a generalist coding agent for enhanced coding assistance
- Adds OCI artifact wrapper for spec-compliant manifest with artifactType

## Improvements
- Supports recursive ~/.agents/skills directory structure
- Wraps todo descriptions at word boundaries in sidebar for better display
- Preserves 429 error details on OpenAI for better error handling

## Bug Fixes
- Fixes subagent delegation and validates model outputs when transfer_task is called
- Fixes YAML parsing issue with unquoted strings containing special characters like colons

## Technical Changes
- Freezes config version v4 and bumps to v5

### Pull Requests

- [#1419](https://github.com/docker/docker-agent/pull/1419) - Help fix #1419
- [#1625](https://github.com/docker/docker-agent/pull/1625) - Add a generalist coding agent
- [#1631](https://github.com/docker/docker-agent/pull/1631) - Support recursive ~/.agents/skills
- [#1632](https://github.com/docker/docker-agent/pull/1632) - Help fix #1419
- [#1633](https://github.com/docker/docker-agent/pull/1633) - Add OCI artifact wrapper for spec-compliant manifest with artifactType
- [#1634](https://github.com/docker/docker-agent/pull/1634) - docs: update CHANGELOG.md for v1.20.6
- [#1635](https://github.com/docker/docker-agent/pull/1635) - Freeze v4 and bump config version to v5
- [#1637](https://github.com/docker/docker-agent/pull/1637) - Fix subagent logic
- [#1641](https://github.com/docker/docker-agent/pull/1641) - unquoted strings are fine until they contain special characters like :
- [#1643](https://github.com/docker/docker-agent/pull/1643) - Wrap todo descriptions at word boundaries in sidebar
- [#1646](https://github.com/docker/docker-agent/pull/1646) - Bump Go dependencies
- [#1647](https://github.com/docker/docker-agent/pull/1647) - Preserve 429 error details on OpenAI


## [v1.20.6] - 2026-02-07

This release introduces branching sessions, model fallbacks, and automated code quality scanning, along with performance improvements and enhanced file handling capabilities.

## What's New

- Adds branching sessions feature that allows editing previous messages to create new session branches without losing original conversation history
- Adds automated nightly codebase scanner with multi-agent architecture for detecting code quality issues and creating GitHub issues
- Adds model fallback system that automatically retries with alternative models when inference providers fail
- Adds skill invocation via slash commands for enhanced workflow automation
- Adds `--prompt-file` CLI flag for including file contents as system context
- Adds debug title command for troubleshooting session title generation

## Improvements

- Improves @ attachment performance to prevent UI hanging in large or deeply nested directories
- Switches to Anthropic Files API for file uploads instead of embedding content directly, dramatically reducing token usage
- Enhances scanner resilience and adds persistent memory system for learning from previous runs

## Bug Fixes

- Fixes tool calls score rendering in evaluations
- Fixes title generation for OpenAI and Gemini models
- Fixes GitHub Actions directory creation issues

## Technical Changes

- Refactors to use cagent's built-in memory system and text format for sub-agent output
- Enables additional golangci-lint linters and fixes code quality issues
- Simplifies PR review workflow by adopting reusable workflow from cagent-action
- Updates Model Context Protocol SDK and other dependencies

### Pull Requests

- [#1573](https://github.com/docker/docker-agent/pull/1573) - Automated nightly codebase scanner
- [#1578](https://github.com/docker/docker-agent/pull/1578) - Branching sessions on message edit
- [#1589](https://github.com/docker/docker-agent/pull/1589) - Model fallbacks
- [#1595](https://github.com/docker/docker-agent/pull/1595) - Simplifies PR review workflow by adopting the new reusable workflow from cagent-action
- [#1610](https://github.com/docker/docker-agent/pull/1610) - docs: update CHANGELOG.md for v1.20.5
- [#1611](https://github.com/docker/docker-agent/pull/1611) - Improve @ attachments perf 
- [#1612](https://github.com/docker/docker-agent/pull/1612) - Only create a new modelstore if none is given
- [#1613](https://github.com/docker/docker-agent/pull/1613) - [evals] Fix tool calls score rendering
- [#1614](https://github.com/docker/docker-agent/pull/1614) - Added space between release links
- [#1617](https://github.com/docker/docker-agent/pull/1617) - Opus 4.6
- [#1618](https://github.com/docker/docker-agent/pull/1618) - feat: add --prompt-file CLI flag for including file contents as system context
- [#1619](https://github.com/docker/docker-agent/pull/1619) - Update Nightly Scan Workflow
- [#1620](https://github.com/docker/docker-agent/pull/1620) - /attach use file upload instead of embedding in the context
- [#1621](https://github.com/docker/docker-agent/pull/1621) - Update Go deps
- [#1622](https://github.com/docker/docker-agent/pull/1622) - Add debug title command for session title generation
- [#1623](https://github.com/docker/docker-agent/pull/1623) - Add skill invocation via slash commands 
- [#1624](https://github.com/docker/docker-agent/pull/1624) - Fix schema and add drift test
- [#1627](https://github.com/docker/docker-agent/pull/1627) - Enable more linters and fix existing issues


## [v1.20.5] - 2026-02-05

This release improves stability for non-interactive sessions, updates the default Anthropic model to Claude Sonnet 4.5, and adds support for private GitHub repositories and standard agent directories.

## What's New

- Adds support for using agent YAML files from private GitHub repositories
- Adds support for standard `.agents/skills` directory structure
- Adds deepwiki integration to the librarian
- Adds timestamp tracking to runtime events
- Allows users to define their own default model in global configuration

## Improvements

- Updates default Anthropic model to Claude Sonnet 4.5
- Adds reason explanations when relevance checks fail during evaluations
- Persists ACP sessions to default SQLite database unless specified with `--session-db` flag
- Makes aliased agent paths absolute for better path resolution
- Produces session database for evaluations to enable investigation of results

## Bug Fixes

- Prevents panic when elicitation is requested in non-interactive sessions
- Fixes title generation hanging with Gemini 3 models by properly disabling thinking
- Fixes current agent display in TUI interface
- Prevents TUI dimensions from going negative when sidebar is collapsed
- Fixes flaky test issues

## Technical Changes

- Simplifies ElicitationRequestEvent check to reduce code duplication
- Allows passing additional environment variables to Docker when running evaluations
- Passes LLM as judge on full transcript for better evaluation accuracy


## [v1.20.4] - 2026-02-03

This release improves session handling with relative references and tool permissions, along with better table rendering in the TUI.

## What's New
- Adds support for relative session references in --session flag (e.g., `-1` for last session, `-2` for second to last)
- Adds "always allow this tool" option to permanently approve specific tools or commands for the session
- Adds granular permission patterns for shell commands that auto-approve specific commands while requiring confirmation for others

## Improvements
- Updates shell command selection to work with the new tool permission system
- Wraps tables properly in the TUI's experimental renderer to fit terminal width with smart column sizing

## Bug Fixes
- Fixes reading of legacy sessions
- Fixes getting sub-session errors where session was not found

## Technical Changes
- Adds test databases for better testing coverage
- Automatically runs PR reviewer for Docker organization members
- Exposes new approve-tool confirmation type via HTTP and ConnectRPC APIs


## [v1.20.3] - 2026-02-02

This release migrates PR review workflows to packaged actions and includes visual improvements to the Nord theme.

## Improvements
- Migrates PR review to packaged cagent-action sub-actions, reducing workflow complexity
- Changes code fences to blue color in Nord theme for better visual consistency

## Technical Changes
- Adds task rebuild when themes change to ensure proper theme updates
- Removes local development configuration that was accidentally committed


## [v1.20.2] - 2026-02-02

This release improves the tools system architecture and enhances TUI scrolling performance.

## Improvements
- Improves render and mouse scroll performance in the TUI interface

## Technical Changes
- Adds StartableToolSet and As[T] generic helper to tools package
- Adds capability interfaces for optional toolset features
- Adds ConfigureHandlers convenience function for tools
- Migrates StartableToolSet to tools package and cleans up ToolSet interface
- Removes BaseToolSet and DescriptionToolSet wrapper
- Reorganizes tool-related code structure


## [v1.20.1] - 2026-02-02

This release includes UI improvements, better error handling, and internal code organization enhancements.

## Improvements

- Changes audio listening shortcut from ctrl-k to ctrl-l (ctrl-k is now reserved for line editing)
- Improves title editing by allowing double-click anywhere on the title instead of requiring precise icon clicks
- Keeps footer unchanged when using /session or /new commands unless something actually changes
- Shows better error messages when using "auto" model with no available providers or when dmr is not available

## Bug Fixes

- Fixes flaky test that was causing CI failures
- Fixes `cagent new` command functionality
- Fixes title edit hitbox issues when title wraps to multiple lines

## Technical Changes

- Organizes TUI messages by domain concern
- Introduces SessionStateReader interface for read-only access
- Introduces Subscription type for cleaner animation lifecycle management
- Improves tool registry API with declarative RegisterAll method
- Introduces HitTest for centralized mouse target detection in chat
- Makes sidebar View() function pure by moving SetWidth to SetSize
- Introduces cmdbatch package for fluent command batching
- Organizes chat runtime event handlers by category
- Introduces subscription package for external event sources
- Separates CollapsedViewModel from rendering in sidebar
- Improves provider handling and error messaging


## [v1.20.0] - 2026-01-30

This release introduces editable session titles, custom TUI themes, and improved evaluation capabilities, along with database improvements and bug fixes.

## What's New
- Adds editable session titles with `/title` command and TUI support for renaming sessions
- Adds custom TUI theme support with built-in themes and hot-reloading capabilities
- Adds permissions view dialog for better visibility into agent permissions
- Adds concurrent LLM-as-a-judge relevance checks for faster evaluations
- Adds image cache to cagent eval for improved performance

## Improvements
- Makes slash commands searchable in the command palette
- Improves command palette with scrolling, mouse support, and dynamic resizing
- Adds validation error display in elicitation dialogs when Enter is pressed
- Adds Ctrl+z support for suspending TUI application to background
- Adds `--exit-on-stdin-eof` flag for better integration control
- Adds `--keep-containers` flag to cagent eval for debugging

## Bug Fixes
- Fixes auto-heal corrupted OCI local store by forcing re-pull when corruption is detected
- Fixes input token counting with Gemini models
- Fixes space key not working in elicitation text input fields
- Fixes session compaction issues
- Fixes stdin EOF checking to prevent cagent api from terminating unexpectedly in containers

## Technical Changes
- Extracts messages from sessions table into normalized session_items table
- Adds database backup and recovery on migration failure
- Maintains backward/forward compatibility for session data
- Removes ESC key from main status bar (now shown in spinner)
- Removes progress bar from cagent eval logs
- Sends mouse events to dialogs only when open


## [v1.19.7] - 2026-01-26

This release improves the user experience with better error handling and enhanced output formatting.

## Improvements
- Improves error handling and user feedback throughout the application
- Enhances output formatting for better readability and user experience

## Technical Changes
- Updates internal dependencies and build configurations
- Refactors code structure for improved maintainability
- Updates development and testing infrastructure


## [v1.19.6] - 2026-01-26

This release improves the user experience with better error handling and enhanced output formatting.

## Improvements
- Improves error handling and user feedback throughout the application
- Enhances output formatting for better readability and user experience

## Technical Changes
- Updates internal dependencies and build configurations
- Refactors code structure for better maintainability
- Updates development and testing infrastructure


## [v1.19.5] - 2026-01-22

This release improves the terminal user interface with better error handling and visual feedback, along with concurrency fixes and enhanced Docker authentication options.

## What's New

- Adds external command support for providing Docker access tokens
- Adds MCP Toolkit example for better integration guidance
- Adds realistic benchmark for markdown rendering performance testing

## Improvements

- Improves edit_file tool error rendering with consistent styling and single-line display
- Improves PR reviewer agent with Go-specific patterns and feedback learning capabilities
- Enhances collapsed reasoning blocks with fade-out animation for completed tool calls
- Makes dialog value changes clearer by indicating space key usage
- Adds dedicated pending response spinner with improved rendering performance

## Bug Fixes

- Fixes edit_file tool to skip diff rendering when tool execution fails
- Fixes concurrent access issues in user configuration aliases map
- Fixes style restoration after inline code blocks in markdown text
- Fixes model defaults when using the "router" provider to prevent erroneous thinking mode
- Fixes paste events incorrectly going to editor when dialog is open
- Fixes cassette recording functionality

## Technical Changes

- Adds clarifying comments for configuration and data directory paths
- Hides tools configuration interface
- Protects aliases map with mutex for thread safety


[v1.19.5]: https://github.com/docker/docker-agent/releases/tag/v1.19.5

[v1.19.6]: https://github.com/docker/docker-agent/releases/tag/v1.19.6

[v1.19.7]: https://github.com/docker/docker-agent/releases/tag/v1.19.7

[v1.20.0]: https://github.com/docker/docker-agent/releases/tag/v1.20.0

[v1.20.1]: https://github.com/docker/docker-agent/releases/tag/v1.20.1

[v1.20.2]: https://github.com/docker/docker-agent/releases/tag/v1.20.2

[v1.20.3]: https://github.com/docker/docker-agent/releases/tag/v1.20.3

[v1.20.4]: https://github.com/docker/docker-agent/releases/tag/v1.20.4

[v1.20.5]: https://github.com/docker/docker-agent/releases/tag/v1.20.5

[v1.20.6]: https://github.com/docker/docker-agent/releases/tag/v1.20.6

[v1.21.0]: https://github.com/docker/docker-agent/releases/tag/v1.21.0

[v1.22.0]: https://github.com/docker/docker-agent/releases/tag/v1.22.0

[v1.23.0]: https://github.com/docker/docker-agent/releases/tag/v1.23.0

[v1.23.1]: https://github.com/docker/docker-agent/releases/tag/v1.23.1

[v1.23.2]: https://github.com/docker/docker-agent/releases/tag/v1.23.2

[v1.23.3]: https://github.com/docker/docker-agent/releases/tag/v1.23.3

[v1.23.4]: https://github.com/docker/docker-agent/releases/tag/v1.23.4

[v1.23.5]: https://github.com/docker/docker-agent/releases/tag/v1.23.5

[v1.23.6]: https://github.com/docker/docker-agent/releases/tag/v1.23.6

[v1.24.0]: https://github.com/docker/docker-agent/releases/tag/v1.24.0

[v1.26.0]: https://github.com/docker/docker-agent/releases/tag/v1.26.0

[v1.27.0]: https://github.com/docker/docker-agent/releases/tag/v1.27.0

[v1.27.1]: https://github.com/docker/docker-agent/releases/tag/v1.27.1

[v1.28.0]: https://github.com/docker/docker-agent/releases/tag/v1.28.0

[v1.28.1]: https://github.com/docker/docker-agent/releases/tag/v1.28.1

[v1.29.0]: https://github.com/docker/docker-agent/releases/tag/v1.29.0

[v1.30.0]: https://github.com/docker/docker-agent/releases/tag/v1.30.0

[v1.30.1]: https://github.com/docker/docker-agent/releases/tag/v1.30.1

[v1.31.0]: https://github.com/docker/docker-agent/releases/tag/v1.31.0

[v1.32.0]: https://github.com/docker/docker-agent/releases/tag/v1.32.0

[v1.32.1]: https://github.com/docker/docker-agent/releases/tag/v1.32.1

[v1.32.2]: https://github.com/docker/docker-agent/releases/tag/v1.32.2

[v1.32.3]: https://github.com/docker/docker-agent/releases/tag/v1.32.3

[v1.32.4]: https://github.com/docker/docker-agent/releases/tag/v1.32.4

[v1.32.5]: https://github.com/docker/docker-agent/releases/tag/v1.32.5

[v1.33.0]: https://github.com/docker/docker-agent/releases/tag/v1.33.0

[v1.34.0]: https://github.com/docker/docker-agent/releases/tag/v1.34.0

[v1.36.0]: https://github.com/docker/docker-agent/releases/tag/v1.36.0

[v1.36.1]: https://github.com/docker/docker-agent/releases/tag/v1.36.1

[v1.37.0]: https://github.com/docker/docker-agent/releases/tag/v1.37.0

[v1.38.0]: https://github.com/docker/docker-agent/releases/tag/v1.38.0

[v1.39.0]: https://github.com/docker/docker-agent/releases/tag/v1.39.0

[v1.40.0]: https://github.com/docker/docker-agent/releases/tag/v1.40.0

[v1.41.0]: https://github.com/docker/docker-agent/releases/tag/v1.41.0

[v1.42.0]: https://github.com/docker/docker-agent/releases/tag/v1.42.0

[v1.43.0]: https://github.com/docker/docker-agent/releases/tag/v1.43.0

[v1.44.0]: https://github.com/docker/docker-agent/releases/tag/v1.44.0

[v1.45.0]: https://github.com/docker/docker-agent/releases/tag/v1.45.0

[v1.46.0]: https://github.com/docker/docker-agent/releases/tag/v1.46.0

[v1.47.0]: https://github.com/docker/docker-agent/releases/tag/v1.47.0

[v1.48.0]: https://github.com/docker/docker-agent/releases/tag/v1.48.0

[v1.49.0]: https://github.com/docker/docker-agent/releases/tag/v1.49.0

[v1.49.1]: https://github.com/docker/docker-agent/releases/tag/v1.49.1

[v1.49.2]: https://github.com/docker/docker-agent/releases/tag/v1.49.2

[v1.50.0]: https://github.com/docker/docker-agent/releases/tag/v1.50.0

[v1.51.0]: https://github.com/docker/docker-agent/releases/tag/v1.51.0

[v1.52.0]: https://github.com/docker/docker-agent/releases/tag/v1.52.0

[v1.53.0]: https://github.com/docker/docker-agent/releases/tag/v1.53.0

[v1.54.0]: https://github.com/docker/docker-agent/releases/tag/v1.54.0

[v1.55.0]: https://github.com/docker/docker-agent/releases/tag/v1.55.0

[v1.56.0]: https://github.com/docker/docker-agent/releases/tag/v1.56.0

[v1.57.0]: https://github.com/docker/docker-agent/releases/tag/v1.57.0

[v1.58.0]: https://github.com/docker/docker-agent/releases/tag/v1.58.0

[v1.59.0]: https://github.com/docker/docker-agent/releases/tag/v1.59.0

[v1.60.0]: https://github.com/docker/docker-agent/releases/tag/v1.60.0

[v1.61.0]: https://github.com/docker/docker-agent/releases/tag/v1.61.0

[v1.62.0]: https://github.com/docker/docker-agent/releases/tag/v1.62.0

[v1.64.0]: https://github.com/docker/docker-agent/releases/tag/v1.64.0

[v1.65.0]: https://github.com/docker/docker-agent/releases/tag/v1.65.0

[v1.66.0]: https://github.com/docker/docker-agent/releases/tag/v1.66.0

[v1.67.0]: https://github.com/docker/docker-agent/releases/tag/v1.67.0

[v1.68.0]: https://github.com/docker/docker-agent/releases/tag/v1.68.0

[v1.69.0]: https://github.com/docker/docker-agent/releases/tag/v1.69.0

[v1.70.0]: https://github.com/docker/docker-agent/releases/tag/v1.70.0

[v1.70.1]: https://github.com/docker/docker-agent/releases/tag/v1.70.1

[v1.70.2]: https://github.com/docker/docker-agent/releases/tag/v1.70.2

[v1.71.0]: https://github.com/docker/docker-agent/releases/tag/v1.71.0

[v1.72.0]: https://github.com/docker/docker-agent/releases/tag/v1.72.0

[v1.73.0]: https://github.com/docker/docker-agent/releases/tag/v1.73.0

[v1.74.0]: https://github.com/docker/docker-agent/releases/tag/v1.74.0

[v1.76.0]: https://github.com/docker/docker-agent/releases/tag/v1.76.0

[v1.77.0]: https://github.com/docker/docker-agent/releases/tag/v1.77.0

[v1.78.0]: https://github.com/docker/docker-agent/releases/tag/v1.78.0

[v1.79.0]: https://github.com/docker/docker-agent/releases/tag/v1.79.0

[v1.81.2]: https://github.com/docker/docker-agent/releases/tag/v1.81.2

[v1.82.0]: https://github.com/docker/docker-agent/releases/tag/v1.82.0

[v1.83.0]: https://github.com/docker/docker-agent/releases/tag/v1.83.0

[v1.84.0]: https://github.com/docker/docker-agent/releases/tag/v1.84.0

[v1.85.0]: https://github.com/docker/docker-agent/releases/tag/v1.85.0

[v1.86.0]: https://github.com/docker/docker-agent/releases/tag/v1.86.0

[v1.87.0]: https://github.com/docker/docker-agent/releases/tag/v1.87.0

[v1.88.0]: https://github.com/docker/docker-agent/releases/tag/v1.88.0

[v1.88.1]: https://github.com/docker/docker-agent/releases/tag/v1.88.1

[v1.89.0]: https://github.com/docker/docker-agent/releases/tag/v1.89.0

[v1.90.0]: https://github.com/docker/docker-agent/releases/tag/v1.90.0

[v1.91.0]: https://github.com/docker/docker-agent/releases/tag/v1.91.0

[v1.92.0]: https://github.com/docker/docker-agent/releases/tag/v1.92.0

[v1.93.0]: https://github.com/docker/docker-agent/releases/tag/v1.93.0

[v1.94.0]: https://github.com/docker/docker-agent/releases/tag/v1.94.0

[v1.95.0]: https://github.com/docker/docker-agent/releases/tag/v1.95.0

[v1.96.0]: https://github.com/docker/docker-agent/releases/tag/v1.96.0

[v1.97.0]: https://github.com/docker/docker-agent/releases/tag/v1.97.0

[v1.98.0]: https://github.com/docker/docker-agent/releases/tag/v1.98.0

[v1.99.0]: https://github.com/docker/docker-agent/releases/tag/v1.99.0

[v1.100.0]: https://github.com/docker/docker-agent/releases/tag/v1.100.0

[v1.101.0]: https://github.com/docker/docker-agent/releases/tag/v1.101.0

[v1.102.0]: https://github.com/docker/docker-agent/releases/tag/v1.102.0

[v1.103.0]: https://github.com/docker/docker-agent/releases/tag/v1.103.0

[v1.107.0]: https://github.com/docker/docker-agent/releases/tag/v1.107.0

[v1.108.0]: https://github.com/docker/docker-agent/releases/tag/v1.108.0

[v1.109.0]: https://github.com/docker/docker-agent/releases/tag/v1.109.0

[v1.110.0]: https://github.com/docker/docker-agent/releases/tag/v1.110.0

[v1.111.0]: https://github.com/docker/docker-agent/releases/tag/v1.111.0

[v1.112.0]: https://github.com/docker/docker-agent/releases/tag/v1.112.0

[v1.113.0]: https://github.com/docker/docker-agent/releases/tag/v1.113.0

[v1.114.0]: https://github.com/docker/docker-agent/releases/tag/v1.114.0

[v1.115.0]: https://github.com/docker/docker-agent/releases/tag/v1.115.0

[v1.116.0]: https://github.com/docker/docker-agent/releases/tag/v1.116.0

[v1.117.0]: https://github.com/docker/docker-agent/releases/tag/v1.117.0

[v1.118.0]: https://github.com/docker/docker-agent/releases/tag/v1.118.0

[v1.119.0]: https://github.com/docker/docker-agent/releases/tag/v1.119.0

[v1.120.0]: https://github.com/docker/docker-agent/releases/tag/v1.120.0

[v1.121.0]: https://github.com/docker/docker-agent/releases/tag/v1.121.0

[v1.122.0]: https://github.com/docker/docker-agent/releases/tag/v1.122.0

[v1.123.0]: https://github.com/docker/docker-agent/releases/tag/v1.123.0

[v1.124.0]: https://github.com/docker/docker-agent/releases/tag/v1.124.0

[v1.125.0]: https://github.com/docker/docker-agent/releases/tag/v1.125.0

[v1.126.0]: https://github.com/docker/docker-agent/releases/tag/v1.126.0

[v1.127.0]: https://github.com/docker/docker-agent/releases/tag/v1.127.0

[v1.128.0]: https://github.com/docker/docker-agent/releases/tag/v1.128.0

[v1.129.0]: https://github.com/docker/docker-agent/releases/tag/v1.129.0

[v1.130.0]: https://github.com/docker/docker-agent/releases/tag/v1.130.0

[v1.131.0]: https://github.com/docker/docker-agent/releases/tag/v1.131.0

[v1.132.0]: https://github.com/docker/docker-agent/releases/tag/v1.132.0

[v1.133.0]: https://github.com/docker/docker-agent/releases/tag/v1.133.0

[v1.134.0]: https://github.com/docker/docker-agent/releases/tag/v1.134.0

[v1.135.0]: https://github.com/docker/docker-agent/releases/tag/v1.135.0

[v1.136.0]: https://github.com/docker/docker-agent/releases/tag/v1.136.0

[v1.137.0]: https://github.com/docker/docker-agent/releases/tag/v1.137.0

[v1.138.0]: https://github.com/docker/docker-agent/releases/tag/v1.138.0

[v1.138.1]: https://github.com/docker/docker-agent/releases/tag/v1.138.1

[v1.139.0]: https://github.com/docker/docker-agent/releases/tag/v1.139.0

[v1.140.0]: https://github.com/docker/docker-agent/releases/tag/v1.140.0

[v1.141.0]: https://github.com/docker/docker-agent/releases/tag/v1.141.0

[v1.142.0]: https://github.com/docker/docker-agent/releases/tag/v1.142.0

[v1.143.0]: https://github.com/docker/docker-agent/releases/tag/v1.143.0

[v1.144.0]: https://github.com/docker/docker-agent/releases/tag/v1.144.0

[v1.145.0]: https://github.com/docker/docker-agent/releases/tag/v1.145.0

[v1.147.0]: https://github.com/docker/docker-agent/releases/tag/v1.147.0

[v1.148.0]: https://github.com/docker/docker-agent/releases/tag/v1.148.0
