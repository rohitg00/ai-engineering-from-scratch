# A2A — Agent-to-Agent Protocol

> MCPはagent-to-toolである。A2A（Agent2Agent）はagent-to-agentであり、異なるframework上に構築されたopaque agentsをcollaborateさせるopen protocolである。Googleが2025年4月にreleaseし、2025年6月にLinux Foundationへ寄贈され、2026年4月にv1.0へ到達した。AWS、Cisco、Microsoft、Salesforce、SAP、ServiceNowを含む150以上のsupportersがいる。IBMのACPを吸収し、AP2 payments extensionも追加された。このlessonではAgent Card、Task lifecycle、2つのtransport bindingsを歩く。

**種別:** 構築
**言語:** Python (stdlib, Agent Card + Task harness)
**前提条件:** Phase 13 · 06 (MCP fundamentals), Phase 13 · 08 (MCP client)
**所要時間:** 約75分

## Learning Objectives

- Agent-to-tool（MCP）とagent-to-agent（A2A）のuse casesを区別する。
- Skillsとendpoint metadataを含むAgent Cardを`/.well-known/agent.json`でpublishする。
- Task lifecycle（submitted → working → input-required → completed / failed / canceled / rejected）を追う。
- Parts（text、file、data）を持つMessagesと、outputsとしてのArtifactsを使う。

## 問題

Customer-service agentが、report-writingをspecialized writer agentへdelegateする必要がある。A2A以前の選択肢:

- Custom REST API。動くが、pairingごとにone-offになる。
- Shared codebase。2つのagentsが同じframeworkで動く必要がある。
- MCP。合わない。MCPはtoolsをcallするためのもので、2つのagentsがopaqueなinternal reasoningを保ちながらcollaborateするためではない。

A2Aはこのgapを埋める。Interactionを、あるagentが別agentへTaskを送る形としてmodel化し、lifecycle、messages、artifactsを持たせる。呼ばれたagentのinternal stateはopaqueのままで、callerにはtask state transitionsとeventual outputsだけが見える。

A2Aは「frameworkを跨いでagentsが会話する」protocolである。MCPを置き換えない。2つはcomplementaryである。

## The Concept

### Agent Card

すべてのA2A-compliant agentは`/.well-known/agent.json`でcardをpublishする。

```json
{
  "schemaVersion": "1.0",
  "name": "research-agent",
  "description": "Summarizes academic papers and drafts citations.",
  "url": "https://research.example.com/a2a",
  "version": "1.2.0",
  "skills": [
    {
      "id": "summarize_paper",
      "name": "Summarize a paper",
      "description": "Read a paper PDF and produce a 3-paragraph summary.",
      "inputModes": ["text", "file"],
      "outputModes": ["text", "artifact"]
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true}
}
```

DiscoveryはURL-basedである。Cardをfetchし、A2A endpointのURLを知り、skillsをenumerateする。

### Signed Agent Cards (AP2)

AP2 extension（2025年9月）はAgent Cardsにcryptographic signaturesを追加する。Publisherは自分のcardへJWTでsignし、consumersがverifyする。Impersonationを防ぐ。

### Task lifecycle

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (loop via message)
```

Clientsは`tasks/send`で開始する。呼ばれたagentはstatesを遷移し、clientsはSSE経由でstate updatesをsubscribeするかpollする。

### Messages and Parts

Messageは1つ以上のPartsを運ぶ。

- `text` — plain content。
- `file` — mimeType付きbase64 blob。
- `data` — typed JSON payload（called agent向けstructured input）。

Example:

```json
{
  "role": "user",
  "parts": [
    {"type": "text", "text": "Summarize this paper."},
    {"type": "file", "file": {"name": "paper.pdf", "mimeType": "application/pdf", "bytes": "..."}},
    {"type": "data", "data": {"targetLength": "3 paragraphs"}}
  ]
}
```

### Artifacts

Outputsはraw stringsではなくArtifactsである。Artifactはnamed、typed outputである。

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

Artifactsはchunksとしてstreamできる。Callerはaccumulateする。

### Two transport bindings

1. **JSON-RPC over HTTP.** `/a2a` endpoint、requestsはPOST、streamingにはoptional SSE。Default binding。
2. **gRPC.** gRPCがnativeなenterprise environments向け。

どちらのbindingも同じlogical message shapeを運ぶ。

### Opacity preservation

Key design principle: called agentのinternal stateはopaqueである。Callerが見るのはtask stateとartifactsだけ。Called agentのchain-of-thought、tool calls、sub-agent delegationはすべて見えない。Tool callsがtransparentなMCPとは異なる。

Rationale: A2Aは、internalsを明かさずにcompetitors同士がcollaborateできるようにする。「このcustomer-service agentをcallする」は可能でも、callerがそのagentの実装を知る必要はない。

### Timeline

- **2025-04-09.** GoogleがA2Aを発表。
- **2025-06-23.** Linux Foundationへ寄贈。
- **2025-08.** IBMのACPを吸収。
- **2025-09.** AP2 extension（Agent Payments）がship。
- **2026-04.** 150以上のsupporting organizationsとともにv1.0 release。

### Relationship to MCP

| Dimension | MCP | A2A |
|-----------|-----|-----|
| Use case | Agent-to-tool | Agent-to-agent |
| Opacity | Transparent tool calls | Opaque inner reasoning |
| Typical caller | Agent runtime | Another agent |
| State | Tool-call result | Task with lifecycle |
| Authorization | OAuth 2.1 (Phase 13 · 16) | JWT-signed Agent Cards (AP2) |
| Transport | Stdio / Streamable HTTP | JSON-RPC over HTTP / gRPC |

Specific toolをinvokeしたいならMCPを使う。Whole taskを別agentへdelegateしたいならA2Aを使う。多くのproduction systemsは両方を使う。Agentはtool layerにMCPを使い、collaboration layerにA2Aを使う。

## Use It

`code/main.py`はminimal A2A harnessを実装する。Research agentがcardをpublishし、writer agentがPDFとtext instructionを含むparts付き`tasks/send`を受け取り、working → input_required → working → completedへ遷移し、text artifactを返す。すべてstdlibで、message shapesに集中するためin-memory transportを使う。

見るべき点:

- Agent Card JSON shape。
- Task id assignmentとstate transitions。
- Mixed-type partsを持つMessages。
- Task途中のinput-required branch。
- Completion時のArtifact return。

## Ship It

このlessonは`outputs/skill-a2a-agent-spec.md`を生成する。他のagentsからcallableにしたいnew agentを与えると、このskillはAgent Card JSON、skills schema、endpoint blueprintを作る。

## Exercises

1. `code/main.py`を実行する。Called agentがclarificationを求めるinput-required pauseを含め、full Task lifecycleをtraceする。

2. Signed Agent Cardを追加する。Cardのcanonical JSONにHMACでsignする。Verifierを書き、mutated cardでfailすることを確認する。

3. Task streamingを実装する。Writer agentがSSEで3つのincremental artifact chunksをemitし、callerがaccumulateする。

4. MCP serverをwrapするA2A agentをdesignする。各MCP toolをA2A skillへmapする。Trade-off、つまり何のopacityが失われるかを記録する。

5. A2A v1.0 announcementを読み、2026年4月時点でどのframeworkもまだ実装していないfeatureを1つ特定する。（Hint: multi-hop task delegationに関係する）

## Key Terms

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| A2A | 「Agent-to-Agent protocol」 | Opaque agent collaboration向けopen protocol |
| Agent Card | 「`.well-known/agent.json`」 | Agentのskillsとendpointを説明するpublished metadata |
| Skill | 「callable unit」 | Agentがsupportするnamed operation（MCP toolに近い） |
| Task | 「delegation unit」 | Lifecycleとfinal artifactを持つwork item |
| Message | 「task input」 | Parts（text、file、data）を運ぶ |
| Part | 「typed chunk」 | Message内の`text` / `file` / `data` element |
| Artifact | 「task output」 | Completion時に返るnamed、typed output |
| AP2 | 「Agent Payments Protocol」 | Trustとpayments向けsigned Agent Cards extension |
| Opacity | 「black-box collaboration」 | Called agentのinternalsはcallerから隠れる |
| Input-required | 「task pause」 | Agentが追加情報を必要とするlifecycle state |

## 参考文献

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — canonical A2A specification
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — reference implementations and SDKs
- [Linux Foundation — A2A launch press release](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — 2025年6月のgovernance transfer
- [Google Cloud — A2A protocol upgrade](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — roadmap and partner momentum
- [Google Dev — A2A 1.0 milestone](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — v1.0 release notes and backward-compat guidance
