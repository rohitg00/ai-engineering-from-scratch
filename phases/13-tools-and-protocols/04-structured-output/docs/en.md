# Structured Output — JSON Schema、Pydantic、Zod、Constrained Decoding

> 「JSON を返して」と丁寧に頼むだけでは、frontier model でも 5 から 15 パーセントの確率で失敗します。Structured outputs は constrained decoding でその差を埋めます。model は schema に違反する token を文字どおり出せなくなります。OpenAI の strict mode、Anthropic の schema 型付き tool use、Gemini の `responseSchema`、Pydantic AI の `output_type`、Zod の `.parse` は、同じ考え方の 5 つの表面形です。このレッスンでは、production の extraction pipeline すべてで使う schema validator と strict-mode contract を作ります。

**種別:** 構築
**言語:** Python (stdlib, JSON Schema 2020-12 subset)
**前提条件:** Phase 13 · 02 (function calling deep dive)
**所要時間:** 約75分

## 学習目標

- extraction target に対して、適切な制約 (enum、min/max、required、pattern) を使った JSON Schema 2020-12 を書く。
- strict mode と constrained decoding が、「生成後に validate する」方式と異なる保証を与える理由を説明する。
- 3 つの failure mode、parse error、schema violation、model refusal を区別する。
- typed repair と typed refusal handling を備えた extraction pipeline を出荷する。

## 問題

purchase-order email を読む agent は、自由文を `{customer, line_items, total_usd}` に変換する必要があります。方法は 3 つあります。

**方法 1: JSON を prompt で頼む。** 「customer、line_items、total_usd の fields を持つ JSON で返答して」。frontier models では 85 から 95 パーセントの確率で動きます。失敗の形は 6 つあります。brace の欠落、trailing comma、wrong types、hallucinated fields、token limit による truncation、「Here is your JSON:」のような prose の混入です。

**方法 2: 生成後に validate する。** 自由に生成し、parse し、schema に対して validate し、失敗したら retry します。信頼性はありますが高コストです。retry のたびに支払いが発生し、truncation bug が起きるたびに追加の 1 turn が必要になります。

**方法 3: constrained decoding。** provider が decode 時に schema を強制します。invalid token は sampling distribution から mask されます。output は parse できること、validate できることが保証されます。失敗は 1 つの mode、refusal に集約されます。model が input は schema に合わないと判断する場合です。

2026 年の frontier provider は、いずれも方法 3 の何らかの形を提供しています。

- **OpenAI.** `response_format: {type: "json_schema", strict: true}` と、model が拒否した場合の response 内の `refusal`。
- **Anthropic.** `tool_use` input に対する schema enforcement。`stop_reason: "refusal"` はありませんが、tool call なしの `end_turn` が signal です。
- **Gemini.** request level の `responseSchema`。2026 年の Gemini は selected types 向けの token-level grammar constraints を提供します。
- **Pydantic AI.** `output_type=InvoiceModel` が、`InvoiceModel` に型付けされた structured `RunResult` を返します。
- **Zod (TypeScript).** provider output を Zod schema に対して validate する runtime parser。OpenAI の `beta.chat.completions.parse` と組み合わせます。

共通点は、schema を一度宣言し、end to end で強制することです。

## コンセプト

### JSON Schema 2020-12 — 共通語

すべての provider が JSON Schema 2020-12 を受け付けます。最もよく使う constructs は次のとおりです。

- `type`: `object`、`array`、`string`、`number`、`integer`、`boolean`、`null` のいずれか。
- `properties`: field name から subschema への map。
- `required`: 必ず出現しなければならない field names の list。
- `enum`: 許可値の closed set。
- `minimum` / `maximum` (numbers)、`minLength` / `maxLength` / `pattern` (strings)。
- `items`: すべての array element に適用される subschema。
- `additionalProperties`: `false` は extra fields を禁止します。default は mode により異なります。

OpenAI strict mode は 3 つの要件を追加します。すべての property を `required` に列挙すること、すべての object に `additionalProperties: false` を置くこと、未解決の `$ref` を使わないことです。これらに違反すると、API は request 時に 400 を返します。

### Pydantic、Python binding

Pydantic v2 は dataclass 風の model から `model_json_schema()` で JSON Schema を生成します。Pydantic AI はこれを wrap するので、次のように書けます。

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

すると agent framework が edge で schema を OpenAI strict mode、Anthropic `input_schema`、または Gemini `responseSchema` に変換します。model の output は typed `Invoice` instance として返ります。validation errors は typed error paths を持つ `ValidationError` を raise します。

### Zod、TypeScript binding

Zod (`z.object({customer: z.string(), ...})`) は TS での同等物です。OpenAI の Node SDK は `zodResponseFormat(Invoice)` を公開しており、これが API の JSON Schema payload に変換されます。

### Refusals

Strict mode は model に回答を強制できません。input が schema に合わない場合、たとえば「email は invoice ではなく poem だった」場合、model は理由を含む `refusal` field を出します。code はこれを failure ではなく first-class outcome として扱う必要があります。refusal は safety signal としても有用です。protected-content email から credit card number を抽出するよう求められた model は、safety reason 付きの refusal を返します。

### open な constrained decoding

open-weights implementation は 3 つの technique を使います。

1. **Grammar-based decoding** (`outlines`, `guidance`, `lm-format-enforcer`): schema から deterministic finite automaton を作り、各 step で FSM に違反する token の logits を mask します。
2. **JSON parser を使った logit masking**: streaming JSON parser を model と lockstep で走らせ、各 step で valid-next-token set を計算します。
3. **verifier 付き speculative decoding**: 安価な draft model が token を提案し、verifier が schema を強制します。

commercial providers は裏側でこれらのいずれかを選びます。2026 年の state of the art は、短い structured outputs では plain generation より速く、長い output ではほぼ同じ速度です。

### 3 つの failure modes

1. **Parse error.** output が valid JSON ではありません。strict mode では起きません。non-strict providers では起こり得ます。
2. **Schema violation.** output は parse できるが schema に違反しています。strict mode では起きません。それ以外ではよく起きます。
3. **Refusal.** model が拒否します。typed outcome として扱う必要があります。

### Retry strategy

strict mode の外側、つまり Anthropic tool use、non-strict OpenAI、古い Gemini では、recovery pattern は次のとおりです。

```text
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

通常は 1 回の retry で十分です。3 回の retry は weak model の不安定さを拾えます。3 回を超えるなら bad schema の兆候です。model が一部の input に対して満たせないため、prompt または schema の修正が必要です。

### Small-model support

Constrained decoding は small models でも機能します。grammar enforcement を使う 3B-parameter open model は、structured tasks では raw prompting の 70B-parameter model を上回ります。これが structured outputs が production で重要な主因です。reliability を model size から切り離せるからです。

## 使ってみる

`code/main.py` は stdlib だけで最小の JSON Schema 2020-12 validator を提供します (types、required、enum、min/max、pattern、items、additionalProperties)。`Invoice` schema を wrap し、fake LLM output を validator に通して、parse error、schema violation、refusal paths を示します。production では fake output を任意の provider の real response に差し替えてください。

見るべき点:

- validator は path と message を持つ typed `[ValidationError]` list を返します。retry prompt に見せたい shape はこれです。
- refusal branch は retry しません。log して typed refusal を返します。Phase 14 · 09 は refusals を safety signal として使います。
- adversarial test input では `additionalProperties: false` check が発火し、strict mode が hallucinated fields を締め出す理由を示します。

## 出荷物

このレッスンは `outputs/skill-structured-output-designer.md` を生成します。free-text extraction target (invoices、support tickets、resumes など) が与えられると、この skill は strict-mode-compatible な JSON Schema 2020-12 と、それを mirror する Pydantic model を作り、typed refusal と retry handling の stub も含めます。

## 演習

1. `code/main.py` を実行してください。`total_usd` が negative number である 4 つ目の test case を追加します。validator が `minimum` constraint path で拒否することを確認してください。

2. discriminator 付きの `oneOf` を support するよう validator を拡張してください。よくある case は、`line_item` が product または service で、`kind` で tag されるものです。strict mode にはここで微妙な rules があります。OpenAI の structured outputs guide を確認してください。

3. 同じ Invoice schema を Pydantic BaseModel として書き、`model_json_schema()` output を手書き schema と比較してください。Pydantic が default で設定し、手書き版では省略されている field を 1 つ特定してください。

4. refusal rates を測ってください。抽出できるべきではない input (song lyric、math proof、blank email) を 10 個作り、strict mode の real provider に通します。refusals と hallucinated outputs を数えてください。これが refusal-aware retries の ground truth になります。

5. OpenAI の structured outputs guide を最初から最後まで読んでください。plain JSON Schema では許されるが、strict mode では明示的に禁止される construct を 1 つ特定します。その forbidden construct を本質的ではない形で使う schema を設計し、strict-compatible になるよう refactor してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| JSON Schema 2020-12 | 「schema spec」 | すべての modern provider が話す IETF-draft schema dialect |
| Strict mode | 「guaranteed schema」 | constrained decoding により schema を強制する OpenAI flag |
| Constrained decoding | 「logit masking」 | invalid next-tokens を mask する decode-time enforcement |
| Refusal | 「model declines」 | input が schema に合わないときの typed outcome |
| Parse error | 「invalid JSON」 | output が JSON として parse できないこと。strict では不可能 |
| Schema violation | 「wrong shape」 | parse はできたが types / required / enum / range に違反した状態 |
| `additionalProperties: false` | 「no extras allowed」 | unknown fields を禁止する。OpenAI strict では必須 |
| Pydantic BaseModel | 「typed output」 | JSON Schema を emit し validate する Python class |
| Zod schema | 「TypeScript output type」 | provider output validation 用の TS runtime schema |
| Grammar enforcement | 「open-weights constrained decode」 | outlines / guidance などの FSM-based logit masking |

## 参考資料

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) — strict mode、refusals、schema requirements
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) — decoding guarantee を説明する 2024 年 8 月の launch post
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) — 各 provider に serialize される typed `output_type` bindings
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) — 正典仕様
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — enterprise deployment notes と strict-mode caveats
