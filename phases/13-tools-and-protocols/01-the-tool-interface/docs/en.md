# The Tool Interface — なぜ Agents には構造化 I/O が必要なのか

> language model は token を生成します。program は action を実行します。この 2 つの隔たりを埋めるのが tool interface です。model が action を要求し、host がそれを実行するための契約です。2026 年のあらゆる stack、つまり OpenAI / Anthropic / Gemini の function calling、MCP の `tools/call`、A2A の task parts は、同じ 4 ステップ loop を別々に encode したものです。この lesson ではその loop に名前を付け、それを動かすための最小限の仕組みを示します。

**種別:** 学習
**言語:** Python (stdlib, no LLM)
**前提条件:** Phase 11 (LLM completion APIs)
**所要時間:** 約45分

## 学習目標

- text しか生成できない LLM が、それ単体では現実世界に対する action を実行できない理由を説明する。
- 4 ステップの tool-call loop (describe → decide → execute → observe) を図示し、各 step の責任者を言えるようにする。
- tool description を name、JSON Schema input、決定的な executor function の 3 つの part として書く。
- pure tool と side-effecting tool を区別し、その分離が安全性に重要な理由を述べる。

## 問題

LLM は次の token に対する確率分布を出力します。それが出力面のすべてです。chat model に「今の Bengaluru の天気は？」と聞けば、もっともらしい文は書けますが、weather API に接続することはできません。その文は偶然正しいかもしれませんし、3 日前の情報かもしれません。

この gap を閉じることが tool interface の目的です。host program、つまりあなたの agent runtime、Claude Desktop、ChatGPT、Cursor、または custom script が、呼び出し可能な tool の list を model に提示します。model は action が必要だと判断すると、tool 名と arguments を含む structured payload を出力します。host はその payload を parse し、実際に tool を実行し、その result を戻します。model が追加 call は不要だと判断するまで、この loop が続きます。

この契約の最初の version は、2023 年 6 月に OpenAI の "functions" parameter として登場しました。Anthropic は Claude 2.1 の `tool_use` block で続き、Gemini は数か月後に `functionDeclarations` を追加しました。現在はどの provider も同じ shape を公開しています。JSON-Schema で型付けされた tool list を入力し、JSON payload の tool call を出力する形です。Model Context Protocol (2024 年 11 月) はこの契約を一般化し、1 つの tool registry をすべての model から使えるようにしました。A2A (2026 年 4 月、v1.0) は、agent-to-agent delegation に同じ primitive を重ねています。

この 4 ステップ loop は、これらすべての下にある invariant です。Phase 13 の残りはすべて、この発展形です。

## コンセプト

### Step one: describe

host は各 tool を 3 つの field で宣言します。

- **Name.** 安定した machine-readable identifier。`get_weather` であり、"weather thing" ではありません。
- **Description.** 1 段落の natural-language brief。"Use when the user asks about current conditions for a specific city. Do not use for historical data."
- **Input schema.** tool の arguments を記述する JSON Schema object (draft 2020-12)。

model はこの list を受け取ります。modern provider は、provider 固有の template を使ってこれらの declaration を system prompt に serialize するため、caller であるあなたは structured form だけを扱えばよくなります。

### Step two: decide

user message と利用可能な tools をもとに、model は 3 つの behavior のいずれかを選びます。

1. text で **直接 answer** する。tool call はありません。
2. **1 つ以上の tools を call** する。structured call object を出力します。`parallel_tool_calls: true` (OpenAI と Gemini では default、Anthropic では opt-in) のもとでは、model は 1 turn で複数の call を出力できます。
3. **Refuse** する。strict-mode structured outputs は call の代わりに typed `refusal` block を生成できます。

tool call payload には安定した 3 field があります。call `id`、tool `name`、JSON `arguments` object です。id があるのは、後で返る result と特定の call を host が対応付けるためです。parallel calls が順不同で戻るときに重要になります。

### Step three: execute

host は call を受け取り、宣言された schema に対して arguments を validate し、executor を実行します。invalid arguments は、model が field を hallucinate したか、間違った type を使ったことを意味します。弱い model では非常によくある failure mode です。production host は invalid arguments に対して 3 つのうちどれかを行います。fail fast して error を model に見せる、constrained parser で JSON を repair する、または validation error を prompt に含めて model を retry する、です。

executor 自体は普通の code です。Python、TypeScript、shell command、database query などです。executor は result を生成します。通常は string ですが、任意の JSON value または structured content block (MCP では text、image、resource reference) にできます。result は serializable でなければなりません。

### Step four: observe

host は tool result を conversation に追加し (matching `id` を持つ `tool` role message として)、model を再度 invoke します。model は context 内の tool output を見て、final answer を生成するか、さらに call を要求できます。model が call の出力を止めるか、host が iteration count の safety limit に達するまでこれが続きます。

### The trust split

tool には安全性上重要な 2 種類があります。

- **Pure.** read-only、deterministic、side effect なし。`get_weather`、`search_docs`、`get_current_time`。speculative に call しても安全です。
- **Consequential.** state を mutate する、money を使う、user data に触れる。`send_email`、`delete_file`、`execute_trade`。gate が必要です。

Meta の 2026 年版 "Rule of Two" for agent security は、1 turn で組み合わせてよいものは次の 3 つのうち最大 2 つまでだとしています: untrusted input、sensitive data、consequential action。この rule を enforce する場所が tool interface です。call を reject する、user confirmation を要求する、scope を escalate する、といった形です。security chapter 全体は Phase 13 · 15、agent-level permission policy は Phase 14 · 09 を参照してください。

### Where the loop lives

| Context | Who describes | Who decides | Who executes |
|---------|---------------|-------------|--------------|
| Single-turn function calling (OpenAI/Anthropic/Gemini) | App developer | LLM | App developer |
| MCP | MCP server | LLM via MCP client | MCP server |
| A2A | Agent Card publisher | Calling agent | Called agent |
| Web browser (function-calling agent) | Browser extension / WebMCP | LLM | Browser runtime |

どこでも同じ 4 step です。column name は変わりますが、structure は変わりません。

### Why not just prompt the model to emit JSON?

"model に JSON で reply するよう頼む" のが function calling 以前の pattern でした。これは frontier model でも約 5 から 15 percent の頻度で失敗し、小さい model ではさらに多く失敗します。failure mode には、brace の欠落、trailing comma、hallucinated field、wrong type などがあります。そのため JSON repair pass、retry、または constrained decoder が必要になります。

native function calling は 3 つの理由で優れています。第一に、provider は exact call shape で model を end-to-end に train するため、strict mode では valid-JSON rate が 98 から 99 percent に上がります。第二に、call payload は free-text の中ではなく独自の protocol slot に置かれるため、tool call が user-visible reply に漏れることがありません。第三に、provider は constrained decoding (OpenAI の strict mode、Anthropic の `tool_use`、Gemini の `responseSchema`) で schema compliance を enforce します。output は validate されることが保証されます。

Phase 13 · 02 では 3 provider API を横並びで扱います。Phase 13 · 04 では structured outputs を深掘りします。

### Circuit breakers

loop は model が call の出力を止めたとき、または host が maximum turn count に達したときに終了します。production host はこれを 5 から 20 turns の間に設定します。それを超える場合、model が抜けられない loop に入っている可能性が非常に高いです。Claude Code の default は 20、OpenAI Assistants は 10、Cursor の agent mode は 25 です。

代替案である unbounded loop は、半年ごとに "agent spent $400 in API calls overnight" という post-mortem として現れます。上限なしで ship しないでください。

Phase 14 · 12 は error recovery と self-healing を詳しく扱い、Phase 17 は production rate limits を扱います。

### Where Phase 13 goes from here

- Lessons 02 through 05 は provider-level tool-call surface を磨きます。
- Lessons 06 through 14 は loop を MCP へ一般化します。
- Lessons 15 through 18 は hostile server、adversarial user、unauthenticated remote auth surface から loop を守ります。
- Lessons 19 through 22 は pattern を agent-to-agent collaboration、observability、routing、packaging へ拡張します。
- Lesson 23 はすべての primitive を使った complete ecosystem を ship します。

残りのすべての lesson は、この 4 ステップ loop の発展形です。これを invariant として覚えておいてください。

## 使ってみる

`code/main.py` は LLM なしで 4 ステップ loop を実行します。fake "decider" function が user message を pattern-match して model を simulate します。executor、schema validator、observe-step harness は本物です。実行して printable intermediate state 付きの request/response choreography 全体を確認し、後の lesson で fake decider を任意の real provider に置き換えてください。

見るべき点:

- tool registry は tool ごとに name、description、schema、executor reference の 3 field を保持します。
- validator は stdlib だけで書かれた minimal JSON Schema subset (types、required、enum、min/max) です。Phase 13 · 04 ではより完全なものを ship します。
- loop は iteration count を 5 に制限します。production agent にはこの種の circuit breaker が必ず必要です。

## 出荷物

この lesson は `outputs/skill-tool-interface-reviewer.md` を生成します。draft tool definition (name + description + schema + executor outline) が与えられると、この skill は loop fitness を audit します。name は machine-stable か、description は complete usage brief か、schema は JSON Schema 2020-12 を正しく使っているか、pure-vs-consequential classification は明示されているかを確認します。

## 演習

1. `code/main.py` に `get_stock_price(ticker)` という fourth tool を追加してください。description は "Use when the user asks for a current stock price by ticker. Do not use for historical prices or market summaries." と書きます。harness を実行し、ticker に言及する query が fake decider によって新しい tool に route されることを確認してください。

2. schema validator を壊してみましょう。required field が欠けた `arguments` object を持つ call を渡し、execution 前に host が reject することを確認してください。次に unknown field が余分に入った call を渡します。host は reject すべきでしょうか、それとも ignore すべきでしょうか。safety argument で判断を正当化してください。

3. harness 内の各 tool を pure または consequential に分類してください。必要な registry entry に `consequential: true` flag を追加し、consequential tool が選ばれたときに loop が "would confirm with user" line を print するよう変更してください。これはすべての production host に必要な confirmation gate の形です。

4. 上の provider-column table を、好きな client (Claude Desktop、Cursor、ChatGPT、custom stack) で埋めながら、4 ステップ loop を紙に描いてください。Phase 13 · 06 の MCP-specific variant と cross-reference してください。

5. OpenAI の function-calling guide を最初から最後まで読んでください。ここで示した 4 ステップ loop にはないが request には存在する field を 1 つ特定してください。それが何を追加し、なぜ essential ではなく convenient なのか説明してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Tool | "model が call できるもの" | name + JSON-Schema-typed input + executor function の triple |
| Function calling | "native tool use" | prose ではなく structured tool call を出力する provider-level API support |
| Tool call | "model からの action request" | model が出力する `id`, `name`, `arguments` を持つ JSON payload |
| Tool result | "tool が返したもの" | matching id を持つ `tool` role message に wrap された executor output |
| Parallel tool calls | "一度に多くの call" | 1 model turn 内の複数 call object。id で独立に順序付けできる |
| Strict mode | "guaranteed JSON" | model output が declared schema に validate されるよう強制する constrained decoding |
| Pure tool | "read-only tool" | side effect がなく、再実行しても安全 |
| Consequential tool | "action tool" | external state を mutate する。gate、audit、user confirmation が必要 |
| Four-step loop | "tool-call cycle" | describe → decide → execute → observe |
| Host | "agent runtime" | tool registry を保持し、model を call し、executor を実行する program |

## 参考資料

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) — OpenAI 形式の tool declaration と call shape の正典リファレンス
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — Claude の `tool_use` / `tool_result` block format
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) — Gemini の `functionDeclarations` と parallel-call semantics
- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — tool interface を provider に依存しない形へ一般化した仕様
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) — modern tool API が使う schema dialect
