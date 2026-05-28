# MCP Resources and Prompts — Tool を超えた Context Exposure

> MCP では tool に注目が集まりがちです。しかし残り 2 つの server primitive は別の問題を解きます。Resource は read 用の data を expose し、prompt は reusable template を slash-command として expose します。多くの server は、read を tool で包むのではなく resource を使い、workflow を client prompt に hard-code するのではなく prompt を使うべきです。このレッスンでは decision rule を定義し、`resources/*` と `prompts/*` message をたどります。

**種別:** 構築
**言語:** Python (stdlib, resource + prompt handler)
**前提条件:** Phase 13 · 07 (MCP server)
**所要時間:** ~45 分

## Learning Objectives

- ある domain の capability を tool、resource、prompt のどれとして expose するかを判断する。
- `resources/list`、`resources/read`、`resources/subscribe` を実装し、`notifications/resources/updated` を handle する。
- argument template 付きで `prompts/list` と `prompts/get` を実装する。
- host が prompt を slash-command として surface する場合と、auto-injected context として扱う場合を見分ける。

## 問題

notes app 用の素朴な MCP server は、すべてを tool として expose します。`notes_read`、`notes_list`、`notes_search` です。これはすべての data access を model-driven tool call で包みます。結果はこうです。

- context が役立つかもしれない query ごとに、model が `notes_read` を呼ぶべきか判断しなければならない。
- read-only content を subscribe したり、host の side panel に stream したりできない。
- Client UI (Claude Desktop の resource attachment panel、Cursor の "Include file" picker) が data を surface できない。

正しい分割はこうです。data は resource として expose し、mutating または computed action は tool として expose し、reusable multi-step workflow は prompt として expose します。それぞれの primitive には固有の UX affordance と access pattern があります。

## The Concept

### Tools vs resources vs prompts — the decision rule

| Capability | Primitive |
|------------|-----------|
| user が data の search、filter、transform をしたい | tool |
| user が host にこの data を context として含めたい | resource |
| user が再実行できる templated workflow を欲しい | prompt |

Guideline: 関連 query のたびに model がそれを呼ぶことで得をするなら tool です。User がそれを conversation に attach できることで得をするなら resource です。User が再利用したい unit が multi-step workflow 全体なら prompt です。

### Resources

`resources/list` は `{resources: [{uri, name, mimeType, description?}]}` を返します。`resources/read` は `{uri}` を受け取り、`{contents: [{uri, mimeType, text | blob}]}` を返します。

URI は addressable であれば何でも構いません。

- `file:///Users/alice/notes/mcp.md`
- `postgres://my-db/query/SELECT ...`
- `notes://note-14` (custom scheme)
- `memory://session-2026-04-22/recent` (server-specific)

`contents[]` は text と binary の両方を support します。Binary は base64-encoded string の `blob` と `mimeType` を使います。

### Resource subscriptions

capabilities で `{resources: {subscribe: true}}` を宣言します。Client は `resources/subscribe {uri}` を呼びます。Resource が変わると、server は `notifications/resources/updated {uri}` を送ります。Client は再 read します。

Use case: resource が disk 上の file である notes server。file watcher が update notification を trigger し、host の外で編集されたとき Claude Desktop が file を context に再 pull します。

### Resource templates (2025-11-25 addition)

`resourceTemplates` により parameterized URI pattern を expose できます。例: `id` を completion target とする `notes://{id}`。Client は resource picker で id を autocomplete できます。

### Prompts

`prompts/list` は `{prompts: [{name, description, arguments?}]}` を返します。`prompts/get` は `{name, arguments}` を受け取り、`{description, messages: [{role, content}]}` を返します。

Prompt は、host が model に渡す message list に展開される template です。たとえば `code_review` prompt は `file_path` argument を受け取り、3-message sequence を返します。system message、file body を含む user message、reasoning template を含む assistant kickoff です。

### Hosts and prompts

Claude Desktop、VS Code、Cursor は chat UI で prompt を slash-command として expose します。User は `/code_review` と入力し、form から argument を選びます。Server の prompt は、「user shortcut」と「model に送られる full prompt」の間の contract です。

すべての client が prompt を support しているわけではありません。capability negotiation を確認してください。Server が prompt capability を宣言していても、client が prompt support を持たなければ slash command は見えません。

### The "list changed" notification

resources と prompts はどちらも、set が mutate したとき `notifications/list_changed` を emit します。20 個の新しい note を import した notes server は `notifications/resources/list_changed` を emit します。Client は追加分を取得するために `resources/list` を再 call します。

### Content type conventions

text の場合: `mimeType: "text/plain"`、`text/markdown`、`application/json`。
binary の場合: `image/png`、`application/pdf` と `blob` field。
MCP Apps (Lesson 14) の場合: `ui://` URI 内の `text/html;profile=mcp-app`。

### Dynamic resources

Resource URI は static file に対応している必要はありません。`notes://recent` は read のたびに最新 5 件の note を返せます。`db://query/users/active` は parameterized query を実行できます。Server は content を動的に compute して構いません。

Rule: client が URI で cache できるなら、URI は stable でなければなりません。Computation が one-shot なら、client cache が stale にならないように URI に timestamp または nonce を含めるべきです。

### Subscriptions vs polling

Subscription-capable client は `notifications/resources/updated` によって server push を受け取ります。pre-subscription client や、それを support しない host は再 read によって poll します。どちらも spec-compliant です。Server の capability declaration が、何を support しているかを client に伝えます。

Subscription の cost は、server 上の per-session state (誰が何を subscribe しているか) です。subscribed set は bounded に保ちます。disconnect した client は timeout させるべきです。

### Prompts vs system prompts

MCP の prompt は system prompt ではありません。Host の system prompt (それ自身の operating instruction) と MCP prompt (user が invoke する server-supplied template) は side by side に存在します。行儀のよい client は、server prompt に自分の system prompt を override させません。layer します。

## Use It

`code/main.py` は Lesson 07 の notes server を次のように拡張します。

- `resources/subscribe` support 付きの per-note resource (`notes://note-1` など)。
- three-message template に render される `review_note` prompt。
- note が変更されたとき `notifications/resources/updated` を emit する file-watcher simulation。
- 常に最新 5 件の note を返す `notes://recent` dynamic resource。

demo を実行して full flow を確認してください。

## Ship It

このレッスンは `outputs/skill-primitive-splitter.md` を作ります。提案された MCP server が与えられると、この skill は各 capability を rationale 付きで tool / resource / prompt に categorize します。

## Exercises

1. `code/main.py` を実行する。initial resource list を観察し、その後 note edit を trigger して `notifications/resources/updated` event が fire することを確認する。

2. `resources/list_changed` emitter を追加する。新しい note が作成されたら notification を送り、client が再 discover できるようにする。

3. GitHub MCP server 用に 3 つの prompt を設計する: `summarize_pr`、`triage_issue`、`release_notes`。それぞれ argument schema を持たせる。Prompt body は追加編集なしで runnable にする。

4. Lesson 07 server にある既存 tool を 1 つ取り上げ、それを tool のままにすべきか、resource plus tool pair に split すべきかを classify する。1 文で justify する。

5. spec の `server/resources` と `server/prompts` section を読む。`resources/read` のうち、ほとんど populate されないが spec-supported な field を 1 つ特定する。Hint: resource content の `_meta` を見る。

## Key Terms

| Term | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Resource | "Exposed data" | host が read できる URI-addressable content |
| Resource URI | "Pointer to data" | scheme-prefixed identifier (`file://`, `notes://` など) |
| `resources/subscribe` | "Watch for changes" | 特定 URI に対する client-opt-in の server-push update |
| `notifications/resources/updated` | "Resource changed" | subscribed resource に新しい content があることを client に知らせる signal |
| Resource template | "Parameterized URI" | host picker 用の completion hint を持つ URI pattern |
| Prompt | "Slash-command template" | argument slot を持つ named multi-message template |
| Prompt arguments | "Template inputs" | render 前に host が収集する typed parameter |
| `prompts/get` | "Render template" | server が filled-in message list を返す |
| Content block | "Typed chunk" | `{type: text \| image \| resource \| ui_resource}` |
| Slash-command UX | "User shortcut" | host が `/` で始まる command として prompt を surface する |

## 参考文献

- [MCP — Concepts: Resources](https://modelcontextprotocol.io/docs/concepts/resources) — resource URI、subscription、template
- [MCP — Concepts: Prompts](https://modelcontextprotocol.io/docs/concepts/prompts) — prompt template と slash-command integration
- [MCP — Server resources spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) — full `resources/*` message reference
- [MCP — Server prompts spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) — full `prompts/*` message reference
- [MCP — Protocol info site: resources](https://modelcontextprotocol.info/docs/concepts/resources/) — official docs を補足する community guide
