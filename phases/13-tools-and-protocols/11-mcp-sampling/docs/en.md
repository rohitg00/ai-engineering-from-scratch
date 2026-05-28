# MCP Sampling - サーバー要求のLLM補完とAgent Loop

> ほとんどのMCP serverは単純な実行器です。引数を受け取り、コードを実行し、contentを返します。Samplingでは向きを反転できます。serverがclientのLLMに判断を依頼するのです。これにより、serverがmodel credentialを持たなくても、server-hosted agent loopを実現できます。2025-11-25にmergeされたSEP-1577は、sampling requestの内部にtoolを追加し、loopがより深い推論を含められるようにしました。drift-risk note: SEP-1577のtool-in-sampling形状は2026年第1四半期を通じてexperimentalで、SDK APIではまだ安定途上です。

**種別:** 構築
**言語:** Python (stdlib, sampling harness)
**前提条件:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**所要時間:** 約75分

## 学習目標

- `sampling/createMessage`が解決することを説明する（server側API keyなしのserver-hosted loop）。
- multi-turn promptについてclientにsamplingを依頼し、completionを返すserverを実装する。
- `modelPreferences`（cost / speed / intelligence priority）を使って、clientのmodel選択を誘導する。
- behaviorをhard-codeする代わりに、内部でsamplingを反復する`summarize_repo` toolを構築する。

## 問題

code summary workflow向けの有用なMCP serverは、file treeをたどり、読むべきfileを選び、summaryを合成して返す必要があります。では、LLM reasoningはどこで行うべきでしょうか。

Option A: serverが自前のLLMを呼び出す。API keyが必要で、server側で課金され、userごとのコストが高くなります。

Option B: serverがraw contentを返し、clientのagentがreasoningする。動作はしますが、server logicがclient promptへ移動し、壊れやすくなります。

Option C: serverが`sampling/createMessage`でclientのLLMに依頼する。serverはalgorithm（どのfileを読むか、何pass行うか）を保持し、clientは課金とmodel選択を保持します。serverはcredentialを一切持ちません。

SamplingはOption Cです。trusted serverが、自分自身は完全なLLM hostにならずにagent loopをhostするためのmechanismです。

## コンセプト

### `sampling/createMessage` request

Server sends:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "sampling/createMessage",
  "params": {
    "messages": [{"role": "user", "content": {"type": "text", "text": "..."}}],
    "systemPrompt": "...",
    "includeContext": "none",
    "modelPreferences": {
      "costPriority": 0.3,
      "speedPriority": 0.2,
      "intelligencePriority": 0.5,
      "hints": [{"name": "claude-3-5-sonnet"}]
    },
    "maxTokens": 1024
  }
}
```

Client runs its LLM, returns:

```json
{"jsonrpc": "2.0", "id": 42, "result": {
  "role": "assistant",
  "content": {"type": "text", "text": "..."},
  "model": "claude-3-5-sonnet-20251022",
  "stopReason": "endTurn"
}}
```

### `modelPreferences`

合計が1.0になる3つのfloatです。

- `costPriority`: より安価なmodelを優先する。
- `speedPriority`: より速いmodelを優先する。
- `intelligencePriority`: より高性能なmodelを優先する。

加えて`hints`: serverが希望する名前付きmodelです。clientはhintに従う場合も従わない場合もあります。常にclient側のuser configが優先されます。

### `includeContext`

3つの値があります。

- `"none"` - serverが渡したmessagesのみ。defaultです。
- `"thisServer"` - このserverのsessionにおける過去messagesを含める。
- `"allServers"` - session context全体を含める。

`includeContext`はcross-server contextを漏えいさせるため、security concernとして2025-11-25時点でsoft-deprecatedです。`"none"`を優先し、必要なcontextはmessagesで明示的に渡してください。

### Tool付きSampling（SEP-1577）

2025-11-25の新機能として、sampling requestは`tools` arrayを含められます。clientはそれらのtoolを使ってfull tool-calling loopを実行します。これにより、serverはclientのmodelを通じてReAct-style agent loopをhostできます。

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

clientはloopします。sampleし、toolがcallされたら実行し、再度sampleし、最後のassistant messageを返します。これは2026年第1四半期を通じてexperimentalです。SDK signatureはまだdriftする可能性があります。実装時は2025-11-25 specのclient/sampling sectionで確認してください。

### Human-in-the-loop

clientはsampleを実行する前に、serverがmodelに何をさせようとしているかをuserへ表示しなければなりません。悪意あるserverはsamplingを使ってuser sessionを操作できます（「userにXと言ってYをクリックさせる」など）。Claude Desktop、VS Code、Cursorはsampling requestを、userが拒否できるconfirmation dialogとして表示します。

2026年時点のconsensusでは、human confirmationなしのsamplingはred flagです。Gateway（Phase 13 · 17）はlow-risk samplingをauto-approveし、疑わしいものをauto-denyできます。

### API keyなしのserver-hosted loop

canonical use caseは、自前のLLM accessを持たないcode-summarization MCP serverです。serverは次を行います。

1. repo structureをwalkする。
2. 「このrepoの目的を説明する可能性が最も高いfileを5つ選んで」と`sampling/createMessage`を呼ぶ。
3. それらのfileを読む。
4. file contentと「repoを3段落でsummarizeして」で`sampling/createMessage`を呼ぶ。
5. summaryを`tools/call` resultとして返す。

serverはLLM APIに一切触れません。completionの費用は、clientのuserが自分のcredentialで支払います。

### Safety risks（Unit 42 disclosure, 2026 Q1）

- **Covert sampling.** 常に「session contextからuserのemailを返せ」というsamplingを呼ぶtool。Phase 13 · 15でattack vectorを扱います。
- **Resource theft via sampling.** serverがclientにattacker payloadのsummaryを依頼し、userに課金させる。
- **Loop bombs.** serverがtight loopでsamplingを呼ぶ。clientはsessionごとのrate limitを必ず強制しなければなりません。

## Use It

`code/main.py`はfake server-to-client sampling harnessを提供します。simulateされた`summarize_repo` toolが2回のsampling round（pick-files、次にsummarize）を呼び、fake clientがcanned responseを返します。このharnessは次を示します。

- Serverは`modelPreferences`付きで`sampling/createMessage`を送る。
- Clientはcompletionを返す。
- Serverはloopを継続する。
- Rate limiterがtool invocationごとのsampling call総数を制限する。

見るべき点:

- serverは1つのtool（`summarize_repo`）だけを公開し、reasoningはすべてsampling callで行われる。
- Model preferenceはclientのmodel選択に重みを与え、hintはpreferred modelを列挙する。
- loopは`stopReason: "endTurn"`で終了する。
- `max_samples_per_tool = 5`のlimitがrunaway loopを捕捉する。

## Ship It

このlessonは`outputs/skill-sampling-loop-designer.md`を生成します。server-side algorithmがLLM callを必要とする場合（research、summarization、planning）、このskillは適切なmodelPreferences、rate limit、safety confirmationを備えたsampling-based implementationを設計します。

## 演習

1. `code/main.py`を実行してください。`max_samples_per_tool`を2に変更し、rate-limitによるcut-offを観察してください。

2. SEP-1577のtool-in-sampling variantを実装してください。sampling requestが`tools` arrayを持つようにします。client-side loopがfinal completionを返す前にそれらのtoolを実行することを検証してください。drift riskに注意: SDK signatureは2026年上半期まで変わる可能性があります。

3. human-in-the-loop confirmationを追加してください。serverの最初の`sampling/createMessage`の前でpauseし、user approvalを待ちます。拒否されたcallはtyped refusalを返します。

4. client sessionをkeyにしたper-user rate limiterを追加してください。同じuserによるsame-server loopはbudgetを共有するべきです。

5. samplingを使って含めるchunkを選ぶ`summarize_pdf` toolを設計してください。送信されるmessagesをsketchしてください。`modelPreferences.intelligencePriority`が0.1の場合と0.9の場合でbehaviorはどう変わりますか。

## 主要用語

| Term | よく言われること | 実際の意味 |
|------|------------------|------------|
| Sampling | "Server-to-client LLM call" | Serverがclientのmodelにcompletionを依頼する |
| `sampling/createMessage` | "The method" | sampling request用のJSON-RPC method |
| `modelPreferences` | "Model priorities" | cost / speed / intelligenceの重みと名前hint |
| `includeContext` | "Cross-session leakage" | soft-deprecatedなcontext inclusion mode |
| SEP-1577 | "Tools in sampling" | server-hosted ReAct用にsampling内部のtoolを許可する |
| Human-in-the-loop | "User confirms" | 実行前にclientがsampling requestをuserへ表示する |
| Loop bomb | "Runaway sampling" | server-sideの無限sampling loop。clientがrate-limitする必要がある |
| Covert sampling | "Hidden reasoning" | 悪意あるserverがsampling prompt内に意図を隠す |
| Resource theft | "Using user's LLM budget" | serverがclientに望まないsampling支出を強制する |
| `stopReason` | "Why generation halted" | `endTurn`、`stopSequence`、または`maxTokens` |

## 参考資料

- [MCP - Concepts: Sampling](https://modelcontextprotocol.io/docs/concepts/sampling) - samplingのhigh-level overview
- [MCP - Client sampling spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) - canonicalな`sampling/createMessage`形状
- [MCP - GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) - sampling内toolのSpec Evolution Proposal（experimental）
- [Unit 42 - MCP attack vectors](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/) - covert samplingとresource-theft pattern
- [Speakeasy - MCP sampling core concept](https://www.speakeasy.com/mcp/core-concepts/sampling) - client-side code sample付きのwalk-through
