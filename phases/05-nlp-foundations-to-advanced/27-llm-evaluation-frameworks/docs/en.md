# LLM 評価 — RAGAS, DeepEval, G-Eval

> Exact-match と F1 は意味的な同等性を取りこぼす。人手レビューはスケールしない。本番での答えは LLM-as-judge だ。ただし、その数値を信頼できるだけの calibration が必要になる。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**所要時間:** 約75分

## 問題

RAG system がこう答えたとする: "June 29th, 2007."
gold reference はこうだ: "June 29, 2007."
Exact Match は 0 点。F1 は約 75%。人間なら 100% と判定する。

これを 10,000 件の test cases に拡大する。さらに retriever、chunking、prompt、model を変更するたびに繰り返す。必要なのは、意味を理解し、低コストで大規模に実行でき、regression について嘘をつかず、正しい failure modes を浮かび上がらせる evaluator だ。

2026 年時点では、この問題を担う framework が 3 つある。

- **RAGAS.** Retrieval-Augmented Generation ASsessment。faithfulness、answer-relevance、context-precision、context-recall という 4 つの RAG metrics を、NLI + LLM-judge backends で扱う。研究に裏付けられ、軽量。
- **DeepEval.** LLM のための Pytest。G-Eval、task-completion、hallucination、bias metrics。CI/CD に馴染む。
- **G-Eval.** 手法であり DeepEval metric でもある。chain-of-thought、custom criteria、0-1 score を使う LLM-as-judge。

3 つとも LLM-as-judge に依存する。この lesson では、その手法と、それを信頼するための層について直感を作る。

## コンセプト

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.** 静的 metric の代わりに、rubric に基づいて output を採点する LLM を使う。`(query, context, answer)` が与えられたら judge LLM に "Score 0-1 on faithfulness." と prompt し、score を返す。

うまくいく理由: LLM は、人間の判断に近いものを、ごく小さいコストで近似できる。GPT-4o-mini なら 1 scored case あたり約 $0.003 で、1000 sample の regression eval run を $5 未満で実行できる。

静かに失敗する理由:

1. **Judge bias.** Judges は長い answer、自分と同じ model family の answer、prompt style に合う answer を好む。
2. **JSON parsing failures.** 壊れた JSON → NaN score → aggregate から静かに除外される。RAGAS users はこの痛みを知っている。try/except + 明示的な failure mode で gate する。
3. **Drift over model versions.** judge を upgrade するとすべての metric が変わる。judge model + version を固定する。

**RAG の 4 指標。**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | answer 内の各 claim は retrieved context に由来しているか？ | NLI-based entailment |
| Answer relevance | answer は question に答えているか？ | answer から仮想 questions を生成し、実際の question と比較 |
| Context precision | retrieved chunks のうち、どれだけが relevant だったか？ | LLM-judge |
| Context recall | retrieval は必要な情報をすべて返したか？ | gold answer に対する LLM-judge |

**G-Eval.** "Did the answer cite the correct source?" のような custom criterion を定義する。framework が chain-of-thought evaluation steps に展開し、0-1 で採点する。RAGAS では扱えない domain-specific quality dimensions に向いている。

**Calibration.** human labels との相関を確認するまで、生の judge score を信用してはいけない。100 件を人手でラベル付けする。judge vs human を plot する。Spearman rho を計算する。rho < 0.7 なら judge rubric を作り直す。

## 作ってみる

### Step 1: NLI による faithfulness（RAGAS-style）

```python
from typing import Callable
from transformers import pipeline

nli = pipeline("text-classification",
               model="MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
               top_k=None)

# `llm` is any callable: prompt str -> generated str.
# Example: llm = lambda p: client.messages.create(model="claude-haiku-4-5", ...).content[0].text
LLM = Callable[[str], str]


def atomic_claims(answer: str, llm: LLM) -> list[str]:
    prompt = f"""Break this answer into simple factual claims (one per line):
{answer}
"""
    return llm(prompt).splitlines()


def faithfulness(answer: str, context: str, llm: LLM) -> float:
    claims = atomic_claims(answer, llm)
    if not claims:
        return 0.0
    supported = 0
    for claim in claims:
        result = nli({"text": context, "text_pair": claim})[0]
        entail = next((s for s in result if s["label"] == "entailment"), None)
        if entail and entail["score"] > 0.5:
            supported += 1
    return supported / len(claims)
```

answer を atomic claims に分解する。各 claim を retrieved context に対して NLI-check する。Faithfulness = support された割合。

### Step 2: answer relevance

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# encoder: any model implementing .encode(texts, normalize_embeddings=True) -> ndarray
# e.g., encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")

def answer_relevance(question: str, answer: str, encoder, llm: LLM, n: int = 3) -> float:
    prompt = f"Write {n} questions this answer could be the answer to:\n{answer}"
    generated = [line for line in llm(prompt).splitlines() if line.strip()][:n]
    if not generated:
        return 0.0
    q_emb = np.asarray(encoder.encode([question], normalize_embeddings=True)[0])
    g_embs = np.asarray(encoder.encode(generated, normalize_embeddings=True))
    sims = [float(q_emb @ g_emb) for g_emb in g_embs]
    return sum(sims) / len(sims)
```

answer が、実際に問われたものとは別の questions を示唆するなら relevance は下がる。

### Step 3: G-Eval custom metric

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams, LLMTestCase

metric = GEval(
    name="Correctness",
    criteria="The answer should be factually accurate and match the expected output.",
    evaluation_steps=[
        "Read the expected output.",
        "Read the actual output.",
        "List factual claims in the actual output.",
        "For each claim, mark supported or unsupported by the expected output.",
        "Return score = fraction supported.",
    ],
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
)

test = LLMTestCase(input="When was the first iPhone released?",
                   actual_output="June 29th, 2007.",
                   expected_output="June 29, 2007.")
metric.measure(test)
print(metric.score, metric.reason)
```

evaluation steps が rubric になる。明示的な steps は、暗黙の "score 0-1" prompt より安定する。

### Step 4: CI gate

```python
import deepeval
from deepeval.metrics import FaithfulnessMetric, ContextualRelevancyMetric


def test_rag_system():
    cases = load_regression_cases()
    faith = FaithfulnessMetric(threshold=0.85)
    rel = ContextualRelevancyMetric(threshold=0.7)
    for case in cases:
        faith.measure(case)
        assert faith.score >= 0.85, f"faithfulness regression on {case.id}"
        rel.measure(case)
        assert rel.score >= 0.7, f"relevancy regression on {case.id}"
```

pytest file として ship する。すべての PR で実行する。regressions があれば merge を止める。

### Step 5: scratch からの toy eval

`code/main.py` を参照。faithfulness（answer claims と context の overlap）と relevance（answer tokens と question tokens の overlap）の stdlib-only 近似を含む。本番用ではない。形を示すためのもの。

## 落とし穴

- **No calibration.** human labels との相関が 0.3 の judge は noise でしかない。ship 前に calibration run を必須にする。
- **Self-evaluation.** 同じ LLM で生成と judging を行うと score が 10-20% 膨らむ。judge には別の model family を使う。
- **Positional bias in pairwise judging.** Judges は先に提示された option を好む。必ず順序を randomize し、両順序で走らせる。
- **Raw aggregate hides failures.** mean score 0.85 は、5% の catastrophic failures を隠しがち。必ず bottom quantile を確認する。
- **Golden dataset rot.** version 管理されていない eval sets が時間とともに drift すると、longitudinal comparison が壊れる。変更ごとに dataset を tag する。
- **LLM cost.** scale すると judge calls が cost を支配する。calibration threshold を満たす最安の model を使う。GPT-4o-mini、Claude Haiku、Mistral-small。

## 使いどころ

2026 年の stack:

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

Typical stack: monitoring には RAGAS、CI には DeepEval、新しい dimensions には G-Eval。3 つすべてを走らせる。意見の不一致が役に立つ。

## Ship It

`outputs/skill-eval-architect.md` として保存する。

```markdown
---
name: eval-architect
description: Design an LLM evaluation plan with calibrated judge and CI gates.
version: 1.0.0
phase: 5
lesson: 27
tags: [nlp, evaluation, rag]
---

Given a use case (RAG / agent / generative task), output:

1. Metrics. Faithfulness / relevance / context-precision / context-recall + any custom G-Eval metrics with criteria.
2. Judge model. Named model + version, rationale for cost vs accuracy.
3. Calibration. Hand-labeled set size, target Spearman rho vs human > 0.7.
4. Dataset versioning. Tag strategy, change log, stratification.
5. CI gate. Thresholds per metric, regression-window logic, bottom-quantile alert.

Refuse to rely on a judge untested against ≥50 human-labeled examples. Refuse self-evaluation (same model generates + judges). Refuse aggregate-only reporting without bottom-10% surfacing. Flag any pipeline where judge upgrade lands without parallel baseline eval.
```

## 演習

1. **Easy.** hallucinations が分かっている 10 個の RAG examples に RAGAS を使う。faithfulness metric がそれぞれを検出することを確認する。
2. **Medium.** 50 個の QA answers を correctness について 0-1 で hand-label する。G-Eval で採点する。judge と human の Spearman rho を測る。
3. **Hard.** DeepEval で pytest CI gate を作る。意図的に retriever を regress させる。gate が失敗することを確認する。lowest 10% に対する threshold check で bottom-quantile alerting を追加する。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| LLM-as-judge | LLM で採点する | rubric を与えて judge model に output を 0-1 で採点させる。 |
| RAGAS | RAG metric library | 4 つの reference-free RAG metrics を持つ open-source eval framework。 |
| Faithfulness | answer は根拠づけられているか？ | answer claims のうち retrieved context に entail される割合。 |
| Context precision | retrieved chunks は relevant だったか？ | top-K chunks のうち実際に重要だった割合。 |
| Context recall | retrieval は必要なものを見つけたか？ | gold-answer claims のうち retrieved chunks に support される割合。 |
| G-Eval | custom LLM judge | rubric + chain-of-thought eval steps + 0-1 score。 |
| Calibration | 信頼するが検証する | judge score と human score の Spearman correlation。 |

## 参考資料

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) — RAGAS paper。
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) — G-Eval paper。
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) — open production stack。
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) — biases、calibration、limits。
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) — RAGAS、DeepEval、Phoenix を統合する unifying framework。
