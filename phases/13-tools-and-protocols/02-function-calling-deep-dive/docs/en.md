# Function Calling Deep Dive — OpenAI, Anthropic, Gemini

> 3 つの frontier provider は 2024 年に同じ tool-call loop へ収束し、その後それ以外のすべてで分岐しました。OpenAI は `tools` と `tool_calls` を使います。Anthropic は `tool_use` と `tool_result` block を使います。Gemini は `functionDeclarations` と unique-id correlation を使います。このレッスンでは 3 つを横並びで diff し、1 つの provider で動く code が port したときに壊れないようにします。

**種別:** 構築
**言語:** Python (stdlib, schema translators)
**前提条件:** Phase 13 · 01 (the tool interface)
**所要時間:** 約75分

## 学習目標

- OpenAI、Anthropic、Gemini の function-calling payload における 3 つの shape difference (declaration、call、result) を述べる。
- 1 つの tool declaration を 3 provider format すべてに変換し、strict-mode constraints がどこで異なるかを予測する。
- 各 provider の `tool_choice` を使って、tool call を force、forbid、auto-pick する。
- provider ごとの hard limits (tool count、schema depth、argument length) と、limit 違反時に出る error signatures を知る。

## 問題

function-calling request の shape は provider ごとに異なります。2026 年の production stack から 3 つの具体例を見ます。

**OpenAI Chat Completions / Responses API.** `tools: [{type: "function", function: {name, description, parameters, strict}}]` を渡します。model response は `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]` を含み、`arguments` は parse が必要な JSON string です。Strict mode (`strict: true`) は constrained decoding によって schema compliance を enforce します。

**Anthropic Messages API.** `tools: [{name, description, input_schema}]` を渡します。response は `content: [{type: "text"}, {type: "tool_use", id, name, input}]` として戻ります。`input` はすでに parse 済みです (string ではなく object)。`{type: "tool_result", tool_use_id, content}` block を含む新しい `user` message で返答します。

**Google Gemini API.** `tools: [{functionDeclarations: [{name, description, parameters}]}]` を渡します (`functionDeclarations` の下に nest されます)。response は `candidates[0].content.parts: [{functionCall: {name, args, id}}]` として届きます。Gemini 3 以降では、parallel-call correlation のために `id` が unique です。`{functionResponse: {name, id, response}}` で返答します。

同じ loop です。field 名が違い、nesting が違い、string-vs-object convention が違い、correlation mechanism が違います。OpenAI で weather agent を書いた team は、plumbing だけのために Anthropic への port で 2 日、Gemini への port でもう 1 日を払うことになります。

このレッスンでは、3 つの format を 1 つの canonical tool declaration に統一し、edge で route する translator を作ります。Phase 13 · 17 では、同じ pattern を LLM gateway へ一般化します。

## コンセプト

### The common structure

どの provider も 5 つを必要とします。

1. **Tool list.** tool ごとの name、description、input schema。
2. **Tool choice.** specific tool を force する、tools を forbid する、または model に判断させる。
3. **Call emission.** tool と arguments を名指す structured output。
4. **Call id.** response を正しい call に対応付ける (parallel で重要)。
5. **Result injection.** result を call に結び付ける message または block。

### Shape diffs, field by field

| Aspect | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| Declaration envelope | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema field | `parameters` | `input_schema` | `parameters` |
| Response container | assistant message 上の `tool_calls[]` | type `tool_use` の `content[]` | type `functionCall` の `parts[]` |
| Arguments type | stringified JSON | parsed object | parsed object |
| Id format | `call_...` (OpenAI が生成) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Result block | role `tool`, `tool_call_id` | `tool_result`, `tool_use_id` を含む `user` | matching `id` を含む `functionResponse` |
| Force-a-tool | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Forbid tools | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | schema-is-schema (常に enforce) | request level の `responseSchema` |

### Limits you will actually hit

- **OpenAI.** request ごとに 128 tools。Schema depth 5。Argument string <= 8192 bytes。Strict mode では `$ref` なし、overlap する `oneOf`/`anyOf`/`allOf` なし、すべての property を `required` に列挙、が必要です。
- **Anthropic.** request ごとに 64 tools。Schema depth は実質 unbounded ですが practical limit は 10。strict-mode flag はありません。schema は contract であり、model は概ね従います。
- **Gemini.** request ごとに 64 functions。Schema type は OpenAPI 3.0 subset です (JSON Schema 2020-12 から少し divergence)。Gemini 3 以降は parallel calls に unique-id があります。

### `tool_choice` behavior

全員が同じ 3 mode を、別々の名前で support しています。

- **Auto.** Model が tool または text を選ぶ。default。
- **Required / Any.** Model は少なくとも 1 つの tool を呼ばなければならない。
- **None.** Model は tools を呼んではならない。

provider ごとに固有の mode もあります。

- **OpenAI.** name で specific tool を force する。
- **Anthropic.** name で specific tool を force する。`disable_parallel_tool_use` flag は single と multi を分ける。
- **Gemini.** `mode: "VALIDATED"` は model intent に関係なく、すべての response を schema validator に通す。

### Parallel calls

OpenAI の `parallel_tool_calls: true` (default) は、1 assistant message 内に複数の call を出力します。すべて実行し、`tool_call_id` ごとに 1 entry を含む batched tool-role message で返答します。Anthropic は歴史的には single-call でしたが、`disable_parallel_tool_use: false` (Claude 3.5 以降の default) で multi が有効です。Gemini 2 は parallel calls を許していましたが stable id がありませんでした。Gemini 3 は UUID を追加し、out-of-order responses が clean に correlate できるようにしています。

### Streaming

3 provider とも streamed tool calls を support しています。wire format は異なります。

- **OpenAI.** `tool_calls[i].function.arguments` の delta chunks が incremental に届きます。`finish_reason: "tool_calls"` まで accumulate します。
- **Anthropic.** block-start / block-delta / block-stop events。`input_json_delta` chunks が partial arguments を運びます。
- **Gemini.** `streamFunctionCallArguments` (Gemini 3 の新機能) は `functionCallId` 付き chunk を出力するため、複数 parallel calls が interleave できます。

Phase 13 · 03 は parallel + streaming reassembly を深掘りします。このレッスンでは declaration と single-call shapes に集中します。

### Errors and repair

invalid-argument error も異なる見た目になります。

- **OpenAI (non-strict).** Model が `arguments: "{bad json}"` を返し、JSON parse が失敗します。error message を inject して再 call します。
- **OpenAI (strict).** Validation は decoding 中に起きます。invalid JSON は不可能ですが、`refusal` は現れます。
- **Anthropic.** `input` に unexpected fields が含まれる場合があります。schema は advisory です。server-side で validate してください。
- **Gemini.** OpenAPI 3.0 quirk: object field 上の `enum` が黙って無視されることがあります。自分で validate してください。

### The translator pattern

code 内の canonical tool declaration は、次のような形です (shape は自分で選びます)。

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

3 つの小さな function が、それを 3 provider shape へ変換します。`code/main.py` の harness はまさにこれを行い、fake tool call を各 provider の response shape に通して round-trip します。network は不要です。このレッスンは HTTP ではなく shape を教えます。

production team は、この translator を `AbstractToolset` (Pydantic AI)、`UniversalToolNode` (LangGraph)、`BaseTool` (LlamaIndex) で包みます。Phase 13 · 17 では、この 3 つのどれかの前に OpenAI-shaped API を公開する gateway を出荷します。

## 使ってみる

`code/main.py` は 1 つの canonical `Tool` dataclass と、OpenAI、Anthropic、Gemini declaration JSON を出力する 3 つの translator を定義します。次に、各 shape の hand-crafted provider response を同じ canonical call object に parse し、semantics は内部では同一であることを示します。実行して、3 つの declaration を横並びで diff してください。

見るべき点:

- 3 つの declaration block は envelope と field 名だけが異なります。
- 3 つの response block は call の置き場所が異なります (top-level `tool_calls`、`content[]` block、`parts[]` entry)。
- 1 つの `canonical_call()` function が 3 つすべての response shape から `{id, name, args}` を抽出します。

## 出荷物

このレッスンは `outputs/skill-provider-portability-audit.md` を生成します。1 provider 向けの function-calling integration を受け取り、その skill は portability audit を作ります。依存している provider limits、rename が必要な fields、他 provider へ port すると壊れるものを列挙します。

## 演習

1. `code/main.py` を実行し、3 provider declaration JSON がすべて同じ underlying `Tool` object を serialize していることを確認してください。canonical tool に enum parameter を追加し、Gemini translator だけが OpenAPI quirk に対応する必要があることを確認してください。

2. 各 provider の `ListToolsResponse` parser を追加し、`list_tools` または discovery call のあとで model が返す tool list を抽出してください。OpenAI には native には存在しません。この asymmetry を記録してください。

3. `tool_choice` conversion を実装してください。canonical `ToolChoice(mode="force", tool_name="x")` を 3 provider shape すべてへ map します。次に `mode="any"` と `mode="none"` も map してください。レッスンの diff table と照合します。

4. 3 provider の 1 つを選び、その function-calling guide を端から端まで読んでください。schema spec の中で他の 2 つが support しない field を 1 つ見つけてください。候補: OpenAI `strict`、Anthropic `disable_parallel_tool_use`、Gemini `function_calling_config.allowed_function_names`。

5. test vector を書いてください。declared schema に違反する arguments を持つ tool call です。各 provider の validator に通し (Lesson 01 の stdlib validator を proxy として使って構いません)、どの error が発火するか記録してください。strictness のために production で使う provider を document してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Function calling | "Tool use" | structured tool-call emission のための provider-level API |
| Tool declaration | "Tool spec" | name + description + JSON Schema input payload |
| `tool_choice` | "Force / forbid" | Auto / required / none / specific-name modes |
| Strict mode | "Schema enforcement" | schema と一致するよう decoding を constrain する OpenAI flag |
| `tool_use` block | "Anthropic's call shape" | id、name、input を持つ inline content block |
| `functionCall` part | "Gemini's call shape" | name、args、id を含む `parts[]` entry |
| Arguments-as-string | "Stringified JSON" | OpenAI は args を object ではなく JSON string として返す |
| Parallel tool calls | "Fan-out in one turn" | 1 assistant message 内の複数 tool calls |
| Refusal | "Model declines" | call の代わりに返る strict-mode-only refusal block |
| OpenAPI 3.0 subset | "Gemini schema quirk" | Gemini が使う JSON-Schema-like dialect。minor differences がある |

## 参考資料

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) — strict mode と parallel calls を含む正典リファレンス
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — `tool_use` と `tool_result` block semantics
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) — parallel calls、unique ids、OpenAPI subset
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) — Gemini の enterprise surface
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) — strict-mode schema enforcement の詳細
