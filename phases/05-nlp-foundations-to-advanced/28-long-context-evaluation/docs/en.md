# Long-Context Evaluation — NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro は 10M tokens の context をうたっている。1M tokens では、8-needle MRCR が 26.3% まで落ちる。advertised ≠ usable。Long-context evaluation は、あなたが ship する model の実際の容量を教えてくれる。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**所要時間:** 約60分

## 問題

200 ページの契約書がある。model は 1M-token context を主張している。契約書を貼り付けて "What is the termination clause?" と聞く。model は答えるが、termination clause が 120k tokens の深さにあり実際には attention が届いていないため、表紙ページから答えてしまう。

これが 2026 年の context-capacity gap だ。spec sheet は 1M や 10M と言う。現実には、その 60-70% が usable ならよい方で、さらに "usable" は task に依存する。

- **Retrieval (single needle in haystack):** frontier models では advertised max 近くまでほぼ完全。
- **Multi-hop / aggregation:** 多くの models で ~128k を超えると急激に劣化する。
- **Reasoning over dispersed facts:** 最初に壊れる task。

Long-context evaluation はこれらの軸を測る。この lesson では benchmarks の名前、それぞれが実際に測るもの、そして自分の domain 向け custom needle test の作り方を扱う。

## コンセプト

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).** 長い context の制御された depth に fact（"the magic word is pineapple"）を置く。model にそれを retrieve させる。depth × length を sweep する。元祖 long-context benchmark。frontier models は今ではこれを飽和させるため、必要だが十分ではない baseline。

**RULER (Nvidia, 2024).** 4 categories にまたがる 13 task types: retrieval（single / multi-key / multi-value）、multi-hop tracing（variable tracking）、aggregation（common word frequency）、QA。context length（4k から 128k+）を設定できる。NIAH は飽和するが multi-hop で失敗する models を明らかにする。2024 release では、32k+ context を主張する 17 models のうち、32k で quality を維持したのは半分だけだった。

**LongBench v2 (2024).** 503 multiple-choice questions、8k-2M word contexts、6 task categories: single-doc QA、multi-doc QA、long in-context learning、long dialogue、code repo、long structured data。実世界の long-context behavior を測る production benchmark。

**MRCR (Multi-Round Coreference Resolution).** scale した multi-turn coreference。8-needle、24-needle、100-needle variants。attention が劣化する前に model がいくつの facts を扱えるかを暴く。

**NoLiMa.** "Non-lexical needle." needle と query が literal overlap を共有しない。retrieval には 1 step の semantic reasoning が必要になる。NIAH より難しい。

**HELMET.** 多数の documents を連結し、そのどれか 1 つから question を出す。selective attention をテストする。

**BABILong.** irrelevant haystacks の中に bAbI reasoning chains を埋め込む。単なる retrieval ではなく reasoning-in-a-haystack をテストする。

### 実際に報告すべきもの

- **Advertised context window.** spec-sheet 上の数値。
- **Effective retrieval length.** ある threshold（例: 90%）で NIAH に pass する長さ。
- **Effective reasoning length.** 同じ threshold で multi-hop または aggregation に pass する長さ。
- **Degradation curve.** task type ごとの accuracy vs context length plot。

spec sheet には retrieval-effective と reasoning-effective の 2 つの数値を載せる。通常、reasoning-effective は advertised window の 25-50% になる。

## 作ってみる

### Step 1: domain 向け custom NIAH

`code/main.py` を参照。骨格は次の通り。

```python
def build_haystack(filler_text, needle, depth_ratio, total_tokens):
    if not (0.0 <= depth_ratio <= 1.0):
        raise ValueError(f"depth_ratio must be in [0, 1], got {depth_ratio}")
    if total_tokens <= 0:
        raise ValueError(f"total_tokens must be positive, got {total_tokens}")

    filler_tokens = tokenize(filler_text)
    needle_tokens = tokenize(needle)
    if not filler_tokens:
        raise ValueError("filler_text produced no tokens")

    # Repeat filler until long enough to fill the haystack body.
    body_len = max(total_tokens - len(needle_tokens), 0)
    while len(filler_tokens) < body_len:
        filler_tokens = filler_tokens + filler_tokens
    filler_tokens = filler_tokens[:body_len]

    insert_at = min(int(body_len * depth_ratio), body_len)
    haystack = filler_tokens[:insert_at] + needle_tokens + filler_tokens[insert_at:]
    return " ".join(haystack)


def score_niah(model, haystack, question, expected):
    answer = model.complete(f"Context: {haystack}\nQ: {question}\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

`depth_ratio` ∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens` ∈ {1k, 4k, 16k, 64k} を sweep する。heatmap を plot する。これが target model の NIAH card になる。

### Step 2: multi-needle variant

```python
def build_multi_needle(filler, needles, total_tokens):
    depths = [0.1, 0.4, 0.7]
    chunks = [filler[:int(total_tokens * 0.1)]]
    for depth, needle in zip(depths, needles):
        chunks.append(needle)
        next_chunk = filler[int(total_tokens * depth): int(total_tokens * (depth + 0.3))]
        chunks.append(next_chunk)
    return " ".join(chunks)
```

"What are the three magic words?" のような questions は 3 つすべてを retrieve する必要がある。single-needle success は multi-needle success を予測しない。

### Step 3: multi-hop variable tracing（RULER-style）

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

answer には 3 つの assignments を chain する必要がある。128k では frontier models でもここで 50-70% accuracy まで落ちることがよくある。

### Step 4: stack 上で LongBench v2

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\n\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

category ごとの accuracy を報告する。aggregate scores は大きな task-level differences を隠す。

## 落とし穴

- **NIAH-only evaluation.** 1M tokens で NIAH に pass しても multi-hop については何も分からない。必ず RULER か custom multi-hop test を走らせる。
- **Uniform depth sampling.** 多くの実装は depth=0.5 しか test しない。depth=0, 0.25, 0.5, 0.75, 1.0 を test する。"lost in the middle" effect は本物。
- **Lexical overlap with filler.** needle が filler と keywords を共有すると retrieval が trivial になる。NoLiMa-style の non-overlapping needles を使う。
- **Ignoring latency.** 1M-token prompts の prefill には 30-120 秒かかる。accuracy と一緒に time-to-first-token を測る。
- **Vendor-self-reported numbers.** OpenAI、Google、Anthropic はいずれも自社 scores を公開する。必ず自分の use case で独立に再実行する。

## 使いどころ

2026 年の stack:

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

production の経験則: intended length で NIAH + 1 reasoning task を実行するまで context window を信用しない。

## Ship It

`outputs/skill-long-context-eval.md` として保存する。

```markdown
---
name: long-context-eval
description: Design a long-context evaluation battery for a given model and use case.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Given a target model, target context length, and use case, output:

1. Tests. NIAH depth × length grid; RULER multi-hop; custom domain task.
2. Sampling. Depths 0, 0.25, 0.5, 0.75, 1.0 at each length.
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-query.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## 演習

1. **Easy.** 3 depths（0.25, 0.5, 0.75）× 3 lengths（1k, 4k, 16k）の NIAH を作る。任意の model で実行する。pass rate を 3×3 heatmap として plot する。
2. **Medium.** 3-needle variant を追加する。各 length で 3 つすべてを retrieve できるか測る。同じ length の single-needle pass rate と比較する。
3. **Hard.** 64k の filler に埋め込んだ variable-tracing task（X1 → X2 → X3、3 hops）を構築する。3 つの frontier models で accuracy を測る。model ごとの effective reasoning length を報告する。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| NIAH | Needle in haystack | filler に fact を植え、model に retrieve させる。 |
| RULER | 強化版 NIAH | retrieval / multi-hop / aggregation / QA にまたがる 13 task types。 |
| Effective context | 実際の容量 | accuracy が threshold を上回って維持される長さ。 |
| Lost in the middle | Depth bias | models は long inputs の中央にある content への attention が弱い。 |
| Multi-needle | 複数 facts を同時に扱う | 複数の planted facts。retrieval だけでなく attention juggling を試す。 |
| MRCR | Multi-round coref | 8、24、または 100-needle coreference。attention saturation を露出する。 |
| NoLiMa | Non-lexical needle | needle と query が literal tokens を共有せず、reasoning が必要。 |

## 参考資料

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) — original NIAH repo。
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) — multi-task benchmark。
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) — real-world long-context eval。
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) — より難しい needles。
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) — reasoning-in-haystack。
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) — depth-bias paper。
