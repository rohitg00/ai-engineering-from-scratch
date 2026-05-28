# 構造化出力と制約付きデコーディング

> LLMにJSONを求めると、たいていJSONが返ります。本番では、この「たいてい」が問題です。制約付きデコーディングは、サンプリング前にlogitを編集することで「たいてい」を「常に」に変えます。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**所要時間:** ~60分

## 問題

分類器がLLMにこうプロンプトします。「`{positive, negative, neutral}` のいずれかを返してください」。モデルはこう返します。「The sentiment is positive — this review is overwhelmingly favorable because the customer explicitly states that they ...」。パーサがクラッシュします。分類器のF1は0.0です。

自由形式の生成は契約ではありません。提案にすぎません。本番システムには契約が必要です。

2026年時点では3つの層があります。

1. **プロンプティング。** 丁寧に頼みます。「JSON objectだけを返してください」。フロンティアモデルでは約80%うまくいきますが、小型モデルではさらに下がります。
2. **ネイティブのstructured output API。** OpenAI `response_format`、Anthropic tool use、Gemini JSON mode。サポートされるスキーマでは信頼できます。ベンダーロックインがあります。
3. **制約付きデコーディング。** 生成の各ステップでlogitを修正し、モデルが無効なトークンを出せないようにします。構造上、100%有効です。どのローカルモデルでも動きます。

このレッスンでは3つすべての直感を作り、どの場面でどれを使うべきかを示します。

## コンセプト

![制約付きデコーディングが各ステップで無効トークンをmaskする様子](../assets/constrained-decoding.svg)

**制約付きデコーディングの仕組み。** 各生成ステップで、LLMは全語彙（約100kトークン）に対するlogitベクトルを出します。*logit processor* がモデルとsamplerの間に入ります。現在のターゲット文法内の位置に応じて有効なトークンを計算します。文法はJSON Schema、regex、context-free grammarなどです。そして、すべての無効トークンのlogitを負の無限大に設定します。残ったlogitに対するsoftmaxは、有効な継続だけに確率質量を置きます。

2026年時点の実装:

- **Outlines。** JSON Schemaまたはregexをfinite-state machineにコンパイルします。各トークンはO(1)でvalid-next-token lookupできます。FSMベースなので、再帰スキーマはflatteningが必要です。
- **XGrammar / llguidance。** context-free grammarエンジンです。再帰的なJSON Schemaを扱えます。デコーディングのオーバーヘッドはほぼゼロです。OpenAIは2025年のstructured output実装でllguidanceに言及しました。
- **vLLM guided decoding。** Outlines、XGrammar、またはlm-format-enforcer backendを通じて、組み込みの `guided_json`、`guided_regex`、`guided_choice`、`guided_grammar` を提供します。
- **Instructor。** 任意のLLMに対するPydanticベースのラッパーです。バリデーション失敗時にリトライします。プロバイダ横断で使えますが、logitは修正しません。リトライとstructured-output-aware promptsに依存します。

### 直感に反する結果

制約付きデコーディングは、制約なし生成より*速い*ことがよくあります。理由は2つあります。第一に、next-tokenの探索空間を小さくします。第二に、賢い実装は強制トークン（`{"name": "` のようなscaffolding、つまり各バイトが確定している部分）について、トークン生成そのものをスキップします。

### コストの高い落とし穴

フィールド順序は重要です。`answer` を `reasoning` より前に置くと、モデルは考える前に答えを確定します。JSONは有効です。しかし答えは間違っています。バリデーションでは検出できません。

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

スキーマのフィールド順序は、整形ではなくロジックです。

## 作る

### Step 1: regex制約付き生成をスクラッチから実装する

単独で動くFSM実装は `code/main.py` を見てください。中心となる考え方は30行程度です。

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

FSMは、文法のどの部分をここまで満たしたかを追跡します。`valid_tokens(state, tokenizer)` は、受理可能な経路から外れずにFSMを進められる語彙トークンを計算します。

### Step 2: JSON SchemaにOutlinesを使う

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

バリデーションエラーはゼロです。常にです。FSMが無効な出力へ到達できないようにするからです。

### Step 3: プロバイダ非依存のPydanticにInstructorを使う

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

仕組みが異なります。Instructorはlogitに触りません。スキーマをプロンプトに整形して入れ、出力をパースし、バリデーション失敗時にリトライします（デフォルトは3回）。どのプロバイダでも使えます。リトライはレイテンシとコストを増やします。プロバイダ横断の移植性が売りです。

### Step 4: ネイティブのベンダーAPI

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

サーバーサイドの制約付きデコーディングです。サポートされるスキーマではOutlinesと同等の信頼性があります。ローカルモデル管理は不要です。ベンダーにロックインされます。

## 落とし穴

- **再帰スキーマ。** Outlinesは再帰を固定深さにflattenします。木構造の出力（入れ子コメント、AST）にはXGrammarまたはllguidance（CFGベース）が必要です。
- **巨大なenum。** 10,000選択肢のenumはコンパイルが遅い、またはタイムアウトします。retrieverに切り替えます。まずtop-k候補を予測し、その候補に制約します。
- **厳しすぎる文法。** `date: "YYYY-MM-DD"` のregexを強制すると、日付が欠損している場合にモデルは `"unknown"` を出せません。代わりに日付を捏造して埋めようとします。`null` またはsentinelを許可してください。
- **早すぎるコミット。** 上のフィールド順序の落とし穴を参照してください。常にreasoningを先に置きます。
- **スキーマなしのベンダーJSON mode。** 純粋なJSON modeは有効なJSONだけを保証し、あなたのユースケースに対して有効であることは保証しません。必ず完全なスキーマを与えてください。

## 使う

2026年のスタック:

| 状況 | 選ぶもの |
|-----------|------|
| OpenAI/Anthropic/Googleモデル、単純なスキーマ | ベンダーのネイティブstructured output |
| 任意のプロバイダ、Pydantic workflow、リトライを許容できる | Instructor |
| ローカルモデル、100%の妥当性が必要、flat schema | Outlines (FSM) |
| ローカルモデル、recursive schema | XGrammarまたはllguidance |
| 自前ホストの推論サーバー | vLLM guided decoding |
| リトライを許容できるバッチ処理 | Instructor + 最安モデル |

## Ship It

`outputs/skill-structured-output-picker.md` として保存します。

```markdown
---
name: structured-output-picker
description: 構造化出力の方式、スキーマ設計、検証計画を選ぶ。
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

ユースケース（プロバイダ、レイテンシ予算、スキーマの複雑さ、失敗許容度）が与えられたら、次を出力してください。

1. 仕組み。ベンダーのネイティブstructured output、Instructor retries、Outlines FSM、XGrammar CFGのいずれか。理由を1文で述べる。
2. スキーマ設計。フィールド順序（reasoningを先、answerを最後）、`"unknown"` に対するnullable fields、enum vs regex、required fields。
3. 失敗戦略。最大リトライ数、fallback model、自然な `null` handling、out-of-distribution refusal。
4. 検証計画。schema compliance rate（target 100%）、semantic validity（LLM-judge）、field-coverage rate、latency p50/p99。

`answer` または `decision` をreasoning fieldsより前に置く設計は拒否してください。スキーマなしのbare JSON modeの使用は拒否してください。FSM-only libraryで再帰スキーマを扱おうとしている場合は警告してください。
```

## 演習

1. **Easy。** 小さなopen-weights model（例: Llama-3.2-3B）に、`Review(sentiment, confidence, evidence_span)` を制約付きデコーディングなしでプロンプトしてください。100件のレビューで有効なJSONとしてパースできる割合を測定します。
2. **Medium。** 同じコーパスをOutlines JSON modeで処理します。compliance rate、latency、semantic accuracyを比較してください。
3. **Hard。** 電話番号（`\d{3}-\d{3}-\d{4}`）用のregex制約付きデコーダをスクラッチから実装してください。1000サンプルで無効出力が0件であることを確認します。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Constrained decoding | 有効な出力を強制する | 生成の各ステップで無効トークンのlogitをmaskする。 |
| Logit processor | 制約をかけるもの | 関数: `(logits, state) -> masked_logits`。 |
| FSM | Finite-state machine | コンパイル済みの文法表現。O(1)でvalid-next-token lookupできる。 |
| CFG | Context-free grammar | 再帰を扱える文法。FSMより遅いが表現力が高い。 |
| Schema field order | それは重要なのか | 重要。最初のフィールドでコミットする。常にanswerより前にreasoningを置く。 |
| Guided decoding | vLLMでの呼び名 | 同じ概念を推論サーバーに統合したもの。 |
| JSON mode | OpenAIの初期版 | JSON構文を保証するが、スキーマ一致は保証しない。 |

## 参考文献

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) — Outlinesの論文。
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) — 高速なCFGベース制約付きデコーディング。
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) — 推論サーバー統合。
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) — APIリファレンスと注意点。
- [Instructor library](https://python.useinstructor.com/) — 複数プロバイダにまたがるPydantic + retries。
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) — 6つの制約付きデコーディングフレームワークのベンチマーク。
