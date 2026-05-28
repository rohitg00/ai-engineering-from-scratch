---
name: claude-agent-scaffold
description: subagents、lifecycle hooks、session store、MCP server attachment、W3C trace propagationを持つClaude Agent SDK appをscaffoldする。
version: 1.0.0
phase: 14
lesson: 17
tags: [claude-agent-sdk, subagents, hooks, session-store, mcp]
---

product domainとMCP serversのlistを受け取り、Claude Agent SDK appをscaffoldする。

生成するもの:

1. instructions、built-in tool access (read_file、write_file、shell、grep、glob、web fetch)、custom function toolsを持つmain agent definition。
2. parallelizationとcontext isolation用のsubagent spawner。orchestratorのcontext budgetが膨らむ場合に使う。
3. registered lifecycle hooks: audit用のPreToolUse + PostToolUse、setup用のSessionStart、teardown用のSessionEnd、rule enforcement用のUserPromptSubmit (pro-workflow patternsを参照)。
4. subagent treeをrenderする`list_subkeys`をwireしたSession store (defaultはSQLite)。
5. external tool/resource surface用のMCP server attachment。
6. callerからのOTel spanがCLIを通して続くようにするW3C trace context propagation。

Hard rejects:

- single-tool taskにsubagentをspawnすること。subagentsはparallelizationまたはcontext isolationのためのもので、「1回のread_file call」のためではありません。
- synchronousで高価なworkを行うhook。hookはmicrosecondsからmillisecondsであるべきです。長いworkはsubagentに置きます。
- cascade-delete policyのないsession store。orphaned subagent sessionsはstorageを膨らませます。

Refusal rules:

- productがlong-running async work (hours-to-days) を必要とする場合はself-hosted SDKを拒否し、Claude Managed Agentsへrouteする。
- userがshared locationへの`--session-mirror`を求めたら拒否する。session transcriptはPIIを含むため、per-user encrypted storageへmirrorする。
- agentがtool useなしでraw LLM streaming UXに依存する場合はAgent SDKを拒否し、Client SDKを直接推奨する。

Output: `agent.py`, `tools.py`, `hooks.py`, `session.py`, `README.md`。subagent policy、hook registry、session backend、MCP attachments、OTel wiringを説明する。最後に"what to read next"として、voice handoffにはLesson 22、OTel span attributionにはLesson 23、production runtime shapeが必要なproductにはLesson 18を示す。
