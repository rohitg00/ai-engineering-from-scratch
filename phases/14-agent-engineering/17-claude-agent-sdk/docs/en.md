# Claude Agent SDK: Subagents and Session Store

> Claude Agent SDKは、Claude Code harnessのlibrary版です。built-in tools、context isolation用のsubagents、hooks、W3C trace propagation、session store parityを備えます。Claude Managed Agentsは、long-running async work向けのhosted alternativeです。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**所要時間:** 約75分

## Learning Objectives

- Anthropic Client SDK (raw API) とClaude Agent SDK (harness shape) の違いを説明する。
- subagentsを説明する。parallelizationとcontext isolation、いつ使うべきか。
- Python SDKのsession store surface (`append`、`load`、`list_sessions`、`delete`、`list_subkeys`) と`--session-mirror`の役割を挙げる。
- built-in tools、isolated contextでのsubagent spawning、lifecycle hooks、session storeを備えたstdlib harnessを実装する。

## 問題

raw LLM APIで得られるのは1 round-tripです。production agentにはtool execution、MCP servers、lifecycle hooks、subagent spawning、session persistence、trace propagationが必要です。Claude Agent SDKは、このshapeをlibraryとしてshipします。Claude Codeが使っている同じharnessが、custom agents向けに公開されています。

## The Concept

### Client SDK vs Agent SDK

- **Client SDK (`anthropic`).** raw Messages API。loop、tools、stateは自分でownする。
- **Agent SDK (`claude-agent-sdk`).** built-in tool execution、MCP connections、hooks、subagent spawning、session store。Claude Code loopをlibrary化したもの。

### Built-in tools

SDKは10+ toolsをout of the boxでshipしています: file read/write、shell、grep、glob、web fetchなど。custom toolはstandard tool-schema interface経由でregisterします。

### Subagents

Anthropicがdocumentしている用途は2つです。

1. **Parallelization.** independent workをconcurrentlyに実行する。「これら20 modulesそれぞれのtest fileを探す」は20個のparallel subagent taskです。
2. **Context isolation.** subagentは自身のcontext windowを使い、resultだけがorchestratorへ戻ります。orchestratorのbudgetが保たれます。

Python SDKのrecent additions: subagent transcriptを読むための`list_subagents()`、`get_subagent_messages()`。

### Session store

TypeScriptとのprotocol parity:

- `append(session_id, message)` — turnを追加する。
- `load(session_id)` — conversationをrestoreする。
- `list_sessions()` — enumerateする。
- `delete(session_id)` — subagent sessionsへcascadeして削除する。
- `list_subkeys(session_id)` — subagent keysをlistする。

`--session-mirror` (CLI flag) は、debugging用にstreamしながらtranscriptをexternal fileへmirrorします。

### Hooks

registerできるlifecycle hook:

- `PreToolUse`, `PostToolUse` — tool callをgateまたはauditする。
- `SessionStart`, `SessionEnd` — setupとteardown。
- `UserPromptSubmit` — modelが見る前にuser inputへ作用する。
- `PreCompact` — context compaction前に実行する。
- `Stop` — agent exit時のcleanup。
- `Notification` — side-channel alerts。

hooksは、pro-workflow (Phase 14 curriculum reference) や類似systemがcross-cutting behaviorを追加する方法です。

### W3C trace context

caller上でactiveなOTel spanは、W3C trace context headers経由でCLI subprocessへpropagateします。multi-process trace全体がbackend内で1つのtraceとして表示されます。

### Claude Managed Agents

hosted alternativeです (beta header `managed-agents-2026-04-01`)。long-running async work、built-in prompt caching、built-in compaction。controlをmanaged infrastructureと交換します。

### Where this pattern goes wrong

- **Subagent over-spawn。** 100個の小さなtaskに100 subagentsをspawnする。overheadが支配的になります。batchしてください。
- **Hook creep。** すべてのteamがhookを追加し、startup timeが膨らみます。hookをquarterlyにreviewしてください。
- **Session bloat。** sessionが蓄積し、sizeが増えます。`list_sessions` + expiry policyを使います。

## 実装

`code/main.py`はstdlibでSDK shapeを実装しています。

- built-in `read_file`、`write_file`、`list_dir`を持つ`Tool`、`ToolRegistry`。
- `Subagent` — private context、isolated run、result return。
- `SessionStore` — append、load、list、delete、list_subkeys。
- `Hooks` — `pre_tool_use`、`post_tool_use`、`session_start`、`session_end`。
- demo: main agentが3 subagentsをparallelにspawnし (それぞれisolated)、resultをaggregateし、sessionをpersistする。

実行:

```
python3 code/main.py
```

traceでは、subagent context isolation (orchestrator context sizeがboundedに保たれる)、hook execution、session persistenceが見えます。

## Use It

- **Claude Agent SDK** for Claude-first products that want the Claude Code harness shape。
- **Claude Managed Agents** for hosted long-running async work。
- **OpenAI Agents SDK** (Lesson 16) for OpenAI-first counterparts。
- **LangGraph + custom tools** if you want the graph-shaped state machine instead。

## Ship It

`outputs/skill-claude-agent-scaffold.md`は、subagents、hooks、session store、MCP server attachment、W3C trace propagationを持つClaude Agent SDK appをscaffoldします。

## Exercises

1. 20 tasksを5 parallel subagentsのgroupsへbatchするsubagent spawnerを追加する。one-per-taskと比べてorchestrator context sizeを測る。
2. `write_file` callをrate-limitする`PreToolUse` hookを実装する (sessionごとに5/min)。behaviorをtraceする。
3. `list_subkeys`をwireしてsubagent treeをrenderする。deep nestingはどのように見えるか。
4. toyを実際の`claude-agent-sdk` Python packageへportする。tool registrationで何が変わるか。
5. Claude Managed Agents docsを読む。self-hostedからmanagedへ切り替えるのはどんな場合か。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | 「Claude Code as a library」 | tools、MCP、hooks、subagents、session storeを持つharness shape |
| Subagent | 「Child agent」 | separate context、own budget。resultは上位へ返る |
| Session store | 「Conversation DB」 | subagent cascadeを含めてturnをpersist/load/list/deleteする |
| Hook | 「Lifecycle callback」 | pre/post tool、session、prompt submit、compact、stop |
| W3C trace context | 「Cross-process trace」 | parent spanがCLI subprocessへpropagateする |
| Managed Agents | 「Hosted harness」 | Anthropic-hosted long-running async work |
| `--session-mirror` | 「Transcript mirror」 | stream中のsession turnをexternal fileへ書き出す |
| MCP server | 「Tool surface」 | agentへattachされるexternal tool/resource source |

## 参考文献

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude Codeのlibrary版
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — production patterns
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — hosted alternative
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — counterpart
