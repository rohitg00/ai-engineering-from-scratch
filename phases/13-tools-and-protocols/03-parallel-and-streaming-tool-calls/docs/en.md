# Parallel Tool Calls and Streaming with Tools

> 独立した 3 つの weather lookup を直列化すると 3 round trips になります。parallel に実行すれば、total time は最も遅い 1 call に縮みます。いまやすべての frontier provider が 1 turn で複数 tool calls を emit します。payoff は本物ですが、plumbing は繊細です。この lesson では parallel fan-out と streamed-argument reassembly の両方を扱い、特に id-correlation trap に注目します。

**種別:** 構築
**言語:** Python (stdlib, thread pool + streaming harness)
**前提条件:** Phase 13 · 02 (function calling deep dive)
**所要時間:** 約75分

## 学習目標

- `parallel_tool_calls: true` が存在する理由と、無効化すべき場面を説明する。
- parallel fan-out 中に streamed argument chunks を正しい tool-call id へ correlate する。
- partial `arguments` strings を、早すぎる parse なしで complete JSON に reassemble する。
- sequential latency と parallel latency を示す 3-city weather benchmark を実行する。

## 問題

parallel calls がない場合、agent が「Bengaluru、Tokyo、Zurich の天気は？」に答えるとこうなります。

```text
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

LLM round trip が 3 回で、それぞれ executor latency も払います。理想的な wall-clock time のおよそ 4 倍です。

parallel calls ではこうなります。

```text
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

LLM round trip は 1 回です。executor time は 3 つの合計ではなく最大値になります。OpenAI、Anthropic、Gemini の production benchmarks では、fan-out workloads において wall-clock が 60 から 70 percent 短縮されます。

代償は correlation complexity です。3 つの call が順不同に完了したとき、result は matching `tool_call_id` を持っていなければ model が対応付けられません。results が stream される場合、実行前に partial argument fragments を complete JSON に assemble しなければなりません。Gemini 3 が unique ids を追加した理由の一部は、同じ tool への 2 つの parallel calls を区別できないという real-world issue を解決するためでした。

## コンセプト

### Enabling parallel

- **OpenAI.** `parallel_tool_calls: true` が default で on です。serial に強制するには `false` を設定します。
- **Anthropic.** `disable_parallel_tool_use: false` により parallel になります (Claude 3.5 以降の default)。serial には `true` を設定します。
- **Gemini.** 常に parallel-capable です。`tool_config.function_calling_config.mode = "AUTO"` により model が decide できます。

tools に ordering dependencies がある場合 (`create_file` の後に `write_file`)、ある call の output が別 call の input を決める場合、または rate limiter が fan-out を処理できない場合は、parallel を無効化してください。

### Id correlation

model が emit する各 call には `id` があります。host が返す各 result は同じ id を含めなければなりません。これがないと result は曖昧になります。

- **OpenAI.** 各 tool-role message の `tool_call_id`。
- **Anthropic.** 各 `tool_result` block の `tool_use_id`。
- **Gemini.** 各 `functionResponse` の `id` (Gemini 3 以降。Gemini 2 は name で match していたため same-name parallel calls で壊れました)。

### Running calls concurrently

host は各 call の executor を独自の thread、coroutine、または remote worker で実行します。最も単純な harness は thread pool を使います。production では `asyncio.gather` や structured concurrency 付きの asyncio を使います。completion order は予測不能です。identifier は id です。

よくある bug の 1 つは、completion order ではなく call-list order で results を reply することです。model は `tool_call_id` だけを気にするため通常は動きますが、result が dropped または duplicated された場合、out-of-order submission は debugging を難しくします。explicit ids を付け、completion order で reply する方を推奨します。

### Streaming tool calls

model が stream する場合、`arguments` は分割されて届きます。3 つの parallel calls に対する chunk の 3 streams が wire 上で interleave します。id ごとに 1 つの accumulator が必要です。

provider ごとの shape:

- **OpenAI.** 各 chunk は `choices[0].delta.tool_calls[i].function.arguments` (partial string) です。chunk は `index` (call list 内の position) を持ちます。per-index に accumulate し、最初に現れたときに `id` を読み、`finish_reason = "tool_calls"` のときに JSON を parse します。
- **Anthropic.** stream events は `message_start` から始まり、type `tool_use` の block ごとに `content_block_start` があり (id、name、empty input を含む)、`content_block_delta` events が `input_json_delta` chunks を運びます。`content_block_stop` が各 block を閉じます。
- **Gemini.** `streamFunctionCallArguments` (Gemini 3 以降) は `functionCallId` 付き chunks を emit するため、calls が clean に interleave できます。Gemini 3 より前は、streaming は complete call を 1 つずつ返していました。

### Partial JSON and the parse-early trap

`arguments` は complete になるまで parse できません。`{"city": "Beng` のような partial JSON は valid ではなく raise します。正しい gate は provider の end-of-call signal です。OpenAI の `finish_reason = "tool_calls"`、Anthropic の `content_block_stop`、Gemini の stream-end event です。その後でのみ `json.loads` を試します。より robust な approach は、structure が完成するたび event を yield する incremental JSON parser を使うことです。OpenAI の streaming guide は、live "thinking" indicator を見せる UX にはこれを推奨しています。brace-counting は completeness test として信頼できません (quoted string や escaped content 内の brace が false positive を起こす) ので、informal debug heuristic としてだけ使ってください。

### Out-of-order completion

```text
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

host reply はそれでも ids を引用しなければなりません。

```text
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

reply 内の順序は、OpenAI と Anthropic では correctness に影響しません。Gemini も ids が match していれば任意の順序を受け入れます。

### Benchmark: sequential vs parallel

`code/main.py` の harness は 400、600、800 ms latency の 3 executor を simulate します。sequential では total 1800 ms です。parallel では max(400, 600, 800) = 800 ms です。差は proportional ではなく constant なので、tool count が増えるほど savings が増えます。

real-world caveat: parallel calls は downstream APIs に負荷をかけます。rate-limited service への 10-way fan-out は失敗します。Phase 13 · 17 は gateway-level backpressure を扱います。retry semantics は future phase で計画されています。

### Streaming fan-out wall-clock

model 自体が stream する場合、すべての calls の finalize を待つのではなく、ある call の arguments が complete になった時点で execution を開始できます。これは OpenAI が document している optimization ですが、すべての SDK が expose しているわけではありません。この lesson の harness はそれを行います。simulated stream が complete argument object を yield した瞬間に、host はその call を kick off します。

## 使ってみる

`code/main.py` は 2 つの half を持ちます。first half は `concurrent.futures.ThreadPoolExecutor` を使って 3 つの simulated weather calls を sequential と parallel で実行し、wall-clock time を print します。second half は fake streaming response、つまり 1 stream 上で interleave した 3 parallel calls の `arguments` chunks を replay し、`StreamAccumulator` で per-id に reassemble します。LLM も network もありません。reassembly logic だけです。

見るべき点:

- sequential timer は 1.8 seconds になります。同じ fake latencies で parallel timer は 0.8 seconds になります。
- accumulator は out of order に届く chunks を per-id に buffer し、各 call の JSON が complete になったときだけ parse します。
- executor はすべての streams が終わるのを待たず、id の arguments が finalize した時点で kick off します。

## 出荷物

この lesson は `outputs/skill-parallel-call-safety-check.md` を生成します。tool registry が与えられると、この skill はどの tools が parallelize して安全か、どれに ordering dependencies があるか、どれが downstream rate limits を圧迫するかを audit し、per-tool `parallel_safe` flags を持つ revised registry を返します。

## 演習

1. `code/main.py` を実行し、simulated latencies を変えてください。parallel-to-sequential ratio がほぼ `max/sum` であることを確認してください (実際の run は thread scheduling、serialization、harness overhead により ideal から少しずれます)。どの latency distribution では parallel が重要でなくなるでしょうか。

2. "call was cancelled mid-stream" case を処理するよう accumulator を拡張し、その buffer を drop して `cancelled` event を emit してください。どの provider がこの case を明示的に document していますか。Anthropic の `content_block_stop` semantics と OpenAI の `finish_reason: "length"` behavior を確認してください。

3. thread pool を `asyncio.gather` に置き換えてください。両方を benchmark してください。executor が real I/O を行う場合に限り、async は lower context-switch cost のため小さな wins が見えるはずです。

4. parallelize すべきでない 2 tools (例: `create_file` の後に `write_file`) を選んでください。registry に `ordering_dependency` graph を追加し、その graph で parallel fan-out を gate してください。これは dependency-aware scheduling の最小限の仕組みで、future agent-engineering phase が formalize します。

5. OpenAI の parallel-function-calling section と Anthropic の `disable_parallel_tool_use` docs を読んでください。Anthropic が parallelism を無効化することを推奨する real-world tool type を 1 つ特定してください。(Hint: 同じ resource に対する consequential mutations。)

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Parallel tool calls | "Fan-out in one turn" | model が 1 assistant message 内で複数 tool calls を emit すること |
| `parallel_tool_calls` | "OpenAI's flag" | multi-call emission を enable または disable する |
| `disable_parallel_tool_use` | "Anthropic's inverse" | opt-out flag。default は parallel enabled |
| Tool call id | "Correlation handle" | result message が echo しなければならない per-call identifier |
| Accumulator | "Stream buffer" | partial `arguments` chunks のための per-id string buffer |
| Out-of-order completion | "Fastest first" | parallel calls は予測不能な順序で finish する。ids が glue になる |
| Dependency graph | "Ordering constraints" | output が他 tool の input になる tools。parallelize できない |
| Parse-early trap | "JSON.parse exploded" | incomplete `arguments` string を parse しようとすること |
| `streamFunctionCallArguments` | "Gemini 3 feature" | call ごとに unique id を持つ streamed argument chunks |
| Completion-order reply | "Don't wait for all" | id で key された results を到着順に reply すること |

## 参考資料

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) — default behavior と opt-out flag
- [Anthropic — Tool use: implementing tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) — `disable_parallel_tool_use` と result batching
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) — Gemini 3 の id-correlated parallel calls
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) — OpenAI streams における chunked argument reassembly
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) — `input_json_delta` を持つ `content_block_delta`
