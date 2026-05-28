# Async Tasks（SEP-1686）- 長時間処理を今呼び出し、後で取得する

> 実際の agent work には数分から数時間かかります。CI runs、deep-research synthesis、batch exports などです。synchronous tool call は connection を落とし、time out し、UI を block します。2025-11-25 に merge された SEP-1686 は Tasks primitive を追加します。任意の request を task に拡張でき、result は後で fetch するか state notifications で stream できます。drift-risk note: Tasks は 2026 H1 を通じて experimental で、SDK surface はまだ spec に合わせて設計中です。

**種別:** 構築
**言語:** Python (stdlib, async task state machine)
**前提条件:** Phase 13 · 07 (MCP server), Phase 13 · 09 (transports)
**所要時間:** 約75分

## 学習目標

- tool を synchronous から task-augmented に昇格すべきタイミングを特定する（server-side work が 30 秒超）。
- task lifecycle をたどる: `working` → `input_required` → `completed` / `failed` / `cancelled`。
- crash しても in-flight work が失われないように task state を persist する。
- `tasks/status` を poll し、`tasks/result` を正しく fetch する。

## 問題

`generate_report` tool は数分かかる extraction pipeline を実行します。synchronous model での選択肢は次の通りです。

1. connection を 3 分間開いたままにする。Remote transports は切断し、clients は time out し、UI は固まる。
2. placeholder を即座に返し、client に custom endpoint を poll させる。MCP の uniformity を壊す。
3. fire-and-forget にする。result はない。

どれも良い選択ではありません。SEP-1686 は 4 つ目の選択肢、task augmentation を追加します。任意の request（通常は `tools/call`）を task として tag できます。server は task id を即座に返します。client は `tasks/status` を poll し、完了時に `tasks/result` を fetch します。server-side state は restart をまたいで残ります。

## コンセプト

### Task augmentation

`params._meta.task.required: true`（または server が判断する `optional: true`）を設定すると、request は task になります。server は即座に次を返します。

```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "_meta": {
      "task": {
        "id": "tsk_9f7b...",
        "state": "working",
        "ttl": 900000
      }
    }
  }
}
```

`ttl` は state を保持するという server の promise です。ttl 経過後、task result は破棄されます。

### Tool ごとの opt-in

Tool annotations は task support を宣言できます。

- `taskSupport: "forbidden"` — この tool は常に synchronously に実行されます。高速な tools には安全です。
- `taskSupport: "optional"` — client が task-augmentation を request できます。
- `taskSupport: "required"` — client は task augmentation を使わなければなりません。

`generate_report` tool は `required` になります。`notes_search` tool は `forbidden` になります。

### States

```
working  -> input_required -> working  (loop via elicitation)
working  -> completed
working  -> failed
working  -> cancelled
```

State machine は append-only です。一度 `completed`、`failed`、または `cancelled` になると、その task は terminal です。

### Methods

- `tasks/status {taskId}` — current state と progress hint を返す。
- `tasks/result {taskId}` — まだ完了していなければ block するか 404 を返す。
- `tasks/cancel {taskId}` — idempotent。terminal states では無視される。
- `tasks/list` — optional。active tasks と recently-completed tasks を列挙する。

### State changes の streaming

server が support している場合、client は state notifications を subscribe できます。

```
server -> notifications/tasks/updated {taskId, state, progress?}
```

poll ではなく stream する clients はより良い UX を得られます。Polling は minimal surface として常に support されます。

### Durable state

spec は task support を宣言する servers に state の persist を求めます。crash しても ttl 内の completed results は失われるべきではありません。stores は SQLite、Redis、filesystem まで幅があります。Lesson 13 harness は filesystem を使います。

### Cancellation semantics

`tasks/cancel` は idempotent です。task が execution 中なら、server は停止を試みます（executor-cooperative cancellation を確認します）。すでに terminal なら request は no-op です。

### Crash recovery

server process が restart したら、次を行います。

1. persist されたすべての task states を load する。
2. process が死んだ `working` tasks を error `CRASH_RECOVERY` 付きの `failed` として mark する。
3. `completed` / `failed` / `cancelled` を ttl の間 preserve する。

### Async tasks plus sampling

task 自体が `sampling/createMessage` を call できます。long-running research tasks はこの形で動きます。server の task thread が必要に応じて client の model を sample し、client の UI は periodic progress updates とともに task を `working` として表示します。

### なぜ experimental なのか

SEP-1686 は 2025-11-25 に shipped されましたが、broader roadmap は 3 つの open issues を挙げています。durable subscription primitives、subtasks（parent-child task relationships）、result-TTL standardization です。spec は 2026 年を通じて進化すると見込んでください。Production code では、Tasks は common case に限って stable とみなし、subtasks に関する future SDK changes に備えて guard するべきです。

## Use It

`code/main.py` は durable task store（filesystem-backed）と、background thread で動く `generate_report` tool を実装します。Clients は tool を call し、task id を即座に受け取り、worker が progress を更新する間 `tasks/status` を poll し、完了時に `tasks/result` を fetch します。Cancellation も動作します。crash recovery は worker thread を kill して state を reload することで simulate します。

見るべき点:

- Task state JSON が `/tmp/lesson-13-tasks/<id>.json` に persist される。
- Worker thread が `progress` field を更新し、poll で進捗が進む様子が見える。
- client side からの cancellation は event を set し、worker はそれを確認して早期終了する。
- "crash" 時の state reload は in-flight task を `CRASH_RECOVERY` 付きの `failed` として mark する。

## Ship It

この lesson は `outputs/skill-task-store-designer.md` を生成します。long-running tool（research、build、export）に対して、この skill は task store（state shape、ttl、durability）を設計し、適切な taskSupport flag を選び、progress notifications を sketch します。

## 演習

1. `code/main.py` を実行する。`generate_report` task を kick off し、status を poll してから result を fetch する。

2. 実行中に `tasks/cancel` call を追加する。worker がそれを尊重し、state が `cancelled` になることを検証する。

3. crash recovery を simulate する。worker thread を kill し、loader を restart して、`CRASH_RECOVERY` failure mode を観察する。

4. store を SQLite に拡張する。durability の利点は同じだが、query options が広がる（session X のすべての tasks を list するなど）。

5. 2026 年の MCP roadmap post を読む。今後 1 年の SDK API design に最も影響しそうな Tasks-related open issue を 1 つ特定する。

## 主要用語

| Term | よく言われること | 実際の意味 |
|------|------------------|------------|
| Task | "Long-running tool call" | async execution のために `_meta.task` で augment された request |
| SEP-1686 | "Tasks spec" | 2025-11-25 に Tasks を追加した Spec Evolution Proposal |
| `_meta.task` | "Task envelope" | id、state、ttl を含む per-request metadata |
| taskSupport | "Tool flag" | tool ごとの `forbidden` / `optional` / `required` |
| `tasks/status` | "Poll method" | current state と optional progress hint を fetch する |
| `tasks/result` | "Fetch result" | completed payload を返す。未完了なら 404 |
| `tasks/cancel` | "Stop it" | idempotent な cancellation request |
| ttl | "Retention budget" | server が task state を保持すると promise する milliseconds |
| `notifications/tasks/updated` | "State push" | server-initiated state-change event |
| Durable store | "Crash-safe state" | Filesystem / SQLite / Redis persistence layer |

## 参考資料

- [MCP — GitHub SEP-1686 issue](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686) — originating proposal と full discussion
- [WorkOS — MCP async tasks for AI agent workflows](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows) — rationale 付きの design walkthrough
- [DeepWiki — MCP task system and async operations](https://deepwiki.com/modelcontextprotocol/modelcontextprotocol/2.7-task-system-and-async-operations) — mechanics と state machine
- [FastMCP — Tasks](https://gofastmcp.com/servers/tasks) — SDK-level task implementation patterns
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — subtasks を含む open issues と 2026 priorities
