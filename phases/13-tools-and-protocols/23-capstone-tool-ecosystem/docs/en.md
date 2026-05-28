# Capstone — Complete Tool Ecosystemを構築する

> Phase 13では部品をすべて学んだ。このcapstoneでは、それらを1つのproduction-shaped systemへ配線する。Tools + resources + prompts + tasks + UIを持つMCP server、edgeのOAuth 2.1、RBAC gateway、multi-server client、A2A sub-agent call、collectorへ流すOTel tracing、CIでのtool-poisoning detection、AGENTS.md + SKILL.md bundle。最後には、各architecture choiceを説明して守れるようになる。

**種別:** 構築
**言語:** Python (stdlib, end-to-end ecosystem harness)
**前提条件:** Phase 13 · 01 through 21
**所要時間:** 約120分

## Learning Objectives

- Tools、resources、prompts、`ui://` app付きtaskを公開するMCP serverを構成する。
- OAuth 2.1 gatewayを前段に置き、RBACとpinned hashesを強制する。
- OTel GenAI attributesでend-to-endにtraceするmulti-server clientを書く。
- Workloadの一部をA2A sub-agentへdelegateし、opacityが保たれることを検証する。
- Stack全体をAGENTS.md + SKILL.mdでpackageし、他のagentsが操作できるようにする。

## 問題

「research and report」systemをshipする。

- User asks: "summarize the three most-cited 2026 arXiv papers on agent protocols."
- System: MCP経由でarXivをsearchする。A2A経由でpaper summarizationをspecialized writer agentへdelegateする。結果をaggregateする。MCP Apps `ui://` resourceとしてinteractive reportをrenderする。全stepをOTelへlogする。

Phase 13のprimitivesがすべて登場する。これはtoyではない。Anthropic（Claude Research product）、OpenAI（Apps SDK付きGPTs）、third partiesが2026年にshipしたproduction research-assistant systemsは、この形とほぼ同じである。

## The Concept

### Architecture

```
[user] -> [client] -> [gateway (OAuth 2.1 + RBAC)] -> [research MCP server]
                                                      |
                                                      +- MCP tool: arxiv_search (pure)
                                                      +- MCP resource: notes://recent
                                                      +- MCP prompt: /research_topic
                                                      +- MCP task: generate_report (long)
                                                      +- MCP Apps UI: ui://report/current
                                                      +- A2A call: writer-agent (tasks/send)
                                                      |
                                                      +- OTel GenAI spans
```

### Trace hierarchy

```
agent.invoke_agent
 ├── llm.chat (kick off)
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── task transitions (opaque internals)
 ├── mcp.call -> tools/call generate_report (task-augmented)
 │    └── tasks/status polling
 │    └── tasks/result (completed, returns ui:// resource)
 └── llm.chat (final synthesis)
```

1つのtrace id。すべてのspanが正しい`gen_ai.*` attributesを持つ。

### Security posture

- OAuth 2.1 + PKCE。Resource indicatorでaudienceをgatewayへpinする。
- Gatewayがupstream credentialsを保持し、userには見せない。
- RBAC: `alice`は`research:read`と`research:write`を持ち、すべてのtoolsをcallできる。`bob`は`research:read`のみで、`generate_report`はcallできない。
- Pinned description manifest: tool hashが変わったserverはdropする。
- Rule of Two audit: untrusted input、sensitive data、consequential actionを1つに結合するtoolを許可しない。

### Rendering

最終的に`generate_report` taskはcontent blocksと`ui://report/current` resourceを返す。Client host（Claude Desktopなど）はinteractive dashboardをsandbox iframeでrenderする。Dashboardにはsorted paper list、citation counts、userがpaperをclickしたときに`host.callTool('summarize_paper', {arxiv_id})`を呼ぶbuttonが含まれる。

### Packaging

全体は次の形でshipする。

```
research-system/
  AGENTS.md                     # project conventions
  skills/
    run-research/
      SKILL.md                  # the top-level workflow
  servers/
    research-mcp/               # the MCP server
      pyproject.toml
      src/
  agents/
    writer/                     # the A2A agent
  gateway/
    config.yaml                 # RBAC + pinned manifest
```

Usersは`docker compose up`でdeployする。Claude Code、Cursor、Codex、opencodeのusersは`run-research` skillをinvokeしてsystemを操作できる。

### What each Phase 13 lesson contributed

| Lesson | What the capstone uses |
|--------|------------------------|
| 01-05 | Tool interface、provider-portability、parallel calls、schemas、linting |
| 06-10 | MCP primitives、server、client、transports、resources + prompts |
| 11-14 | Sampling、roots + elicitation、async tasks、`ui://` apps |
| 15-17 | Tool poisoning、OAuth 2.1、gateway + registry |
| 18 | A2A sub-agent delegation |
| 19 | OTel GenAI tracing |
| 20 | LLM layer向けrouting gateway |
| 21 | SKILL.md + AGENTS.md packaging |

## Use It

`code/main.py`はこれまでのlessonsのpatternsを1つのrunnable demoへ縫い合わせる。すべてstdlib、すべてin-processなのでend-to-endで読める。Research-and-report scenarioのfull flowを走らせる。Gatewayとのhandshake、simulated OAuth 2.1、merged tools/list、taskとしてのgenerate_report、writerへのA2A call、返却されるui:// resource、emitされるOTel spans。

見るべき点:

- すべてのhopをまたぐ1つのtrace id。
- Gateway policyがsecond userのwriteをblockする。
- Task lifecycleがworking → completedへ進み、textとui:// contentの両方を返す。
- A2A callのinner stateはorchestratorからopaqueである。
- AGENTS.mdとSKILL.mdだけが、別agentがworkflowを再現するために必要なfilesである。

## Ship It

このlessonは`outputs/skill-ecosystem-blueprint.md`を生成する。Product need（research、summarization、automation）を与えると、このskillはfull architectureを作る。どのMCP primitives、どのgateway controls、どのA2A calls、どのtelemetry、どのpackagingが必要かを示す。

## Exercises

1. `code/main.py`を実行する。Single trace idとspanのnestを確認する。DemoがPhase 13のprimitivesをいくつ触るか数える。

2. Demoを拡張する。Second backend MCP server（例: `bibliography`）を追加し、gatewayがそのtoolsを同じnamespaceへmergeすることを確認する。

3. Fake A2A writer agentを、subprocess上で動くreal agentへ置き換える。Lesson 19 harnessを使う。

4. OrchestratorとLLMの間のrouting gatewayにPII redaction stepを追加する。User query内のemailがscrubされることを確認する。

5. このsystemを保守するteammate向けのAGENTS.mdを書く。5分以内で読め、CursorまたはCodexでcapstoneを操作するのに必要な情報がすべて入っているべきである。

## Key Terms

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| Capstone | 「Phase 13のintegration demo」 | すべてのprimitiveを使うend-to-end system |
| Research and report | 「このscenario」 | Search、summarize、render pattern |
| Ecosystem | 「全部品をまとめたもの」 | Server + client + gateway + sub-agent + telemetry + package |
| Trace hierarchy | 「single trace id」 | すべてのhopのspanがtraceを共有し、span idでparent-childになる |
| Gateway-issued token | 「transitive auth」 | Clientはgateway tokenだけを見る。Gatewayがupstream credsを保持 |
| Merged namespace | 「all tools in one flat list」 | Gatewayでmulti-serverをmergeし、collision時はprefixする |
| Opacity boundary | 「A2A callがinternalsを隠す」 | Sub-agentのreasoningはorchestratorから見えない |
| Three-layer stack | 「AGENTS.md + SKILL.md + MCP」 | Project context + workflow + tools |
| Defense-in-depth | 「複数のsecurity layers」 | Pinned hashes、OAuth、RBAC、Rule of Two、audit log |
| Spec compliance matrix | 「spec要求と出荷内容の対応」 | 成果物を2025-11-25要件へ対応付けるチェックリスト |

## 参考文献

- [MCP — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 統合リファレンス
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — プロトコルの今後
- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A v1.0 reference
- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — canonical tracing conventions
- [Anthropic — Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) — production agent runtime patterns
