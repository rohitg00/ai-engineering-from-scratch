# LLM 評估——RAGAS、DeepEval、G-Eval

> 完全相符和 F1 抓不到語意等價。人工審查無法因應如此大的評估規模。LLM-as-judge（LLM 當評審）是正式環境（production）的答案——校準夠了，那個數字才信得過。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## The Problem｜問題

你的 RAG 系統回答：「June 29th, 2007.」。
標準參考答案（gold reference）是：「June 29, 2007.」。
完全相符（Exact Match）是 0。F1 大約 75%。人會打 100%。

再乘上 1 萬個測試案例。每次檢索器、切塊、prompt 或模型一改，再乘一次。你需要一個懂意思、大規模跑起來便宜、不會把退步說成沒事、而且把對的失敗模式露出來的評估器。

2026 年有三個框架在處理這件事。

- **RAGAS。** Retrieval-Augmented Generation ASsessment。四個 RAG 指標：忠實度（faithfulness）、答案相關性（answer relevance）、脈絡精確率（context precision）、脈絡召回率（context recall）。後端是 NLI 加 LLM 評審。有研究支持，且輕量。
- **DeepEval。** 給 LLM 用的 Pytest。G-Eval、任務完成、幻覺（hallucination）、偏差（bias）指標。原生就進 CI/CD。
- **G-Eval。** 一個方法（也是 DeepEval 的一個指標）：LLM-as-judge（LLM 當評審），帶逐步推理（chain-of-thought）、自訂準則、0 到 1 的分數。

三者都靠 LLM-as-judge（LLM 當評審）。這一課為這個方法、以及圍繞它的信任層建立直覺。

## The Concept｜核心概念

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge（LLM 當評審）。** 用一個 LLM 換掉靜態指標：給它評分準則，它為輸出打分。給定 `(query, context, answer)`，prompt 評審 LLM：「在忠實度上打 0 到 1 分。」回傳分數。

為什麼行得通：LLM 以成本的一小部分逼近人的判斷。GPT-4o-mini 每個已評分案例約 0.003 美元，1000 個樣本的回歸評測不到 5 美元。

為什麼它會悄悄失敗：

1. **評審偏差。** 評審偏好較長的答案、來自自己模型家族的答案、以及和 prompt 風格相符的答案。
2. **JSON 解析失敗。** 壞的 JSON → NaN 分數 → 悄悄被排除在加總之外。RAGAS 的使用者知道這個痛。用 try/except 把關，並給明確的失敗模式。
3. **模型版本漂移。** 升級評審，每個指標都變。把評審模型和版本凍住。

**RAG 的四個。**

| 指標 | 問題 | 後端 |
|--------|----------|---------|
| 忠實度 | 答案裡的每個主張都來自檢索到的脈絡嗎？ | 基於 NLI 的蘊涵（entailment） |
| 答案相關性（answer relevance） | 答案有沒有回應問題？ | 從答案生成假設問題，再和真問題比 |
| 脈絡精確率（context precision） | 檢索到的區塊裡，相關的佔多少？ | LLM 評審 |
| 脈絡召回率（context recall） | 檢索有沒有把需要的都找回來？ | 對照標準答案的 LLM 評審 |

**G-Eval。** 定義一個自訂準則：「答案有沒有引用正確的來源？」框架自動展開成逐步推理的評估步驟，再打 0 到 1 分。適合 RAGAS 沒蓋到的、領域專用的品質維度（dimension）。

**校準。** 在評審分數與人工標籤（label）有相關性之前，不要信原始的評審分數。跑 100 個手標的例子。先確認評審分數與人工標註結果的相關性；繪製評審與人工分數的比較圖。算 Spearman rho。若 rho 低於 0.7，評審的評分準則需要再修。

```figure
n5-judge-gauge
```

## Build It｜動手實作

### 步驟 1：用 NLI 做忠實度（RAGAS 風格）

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

把答案拆成原子主張。每個主張用 NLI 對上檢索到的脈絡。忠實度 = 被支持的比例。

### 步驟 2：答案相關性

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

若答案暗示的問題和被問的不一樣，相關性就掉。

### 步驟 3：G-Eval 自訂指標

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

評估步驟就是評分準則。明確的步驟比隱含的「打 0 到 1 分」prompt 更穩。

### 步驟 4：CI 閘門

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

存成 pytest 檔案。每個 PR 都跑。退步就擋下合併。

### 步驟 5：從零寫的玩具評估

見 `code/main.py`。只有標準函式庫（library）的近似：忠實度（答案主張和脈絡的重疊）和相關性（答案 token 和問題 token 的重疊）。不是正式環境。露出形狀。

## 坑

- **沒有校準。** 和人類標籤相關只有 0.3 的評審是雜訊。交付前必須跑一輪校準。
- **自我評估。** 用同一個 LLM 又生成又評審，會把分數灌高 10% 到 20%。評審用不同的模型家族。
- **成對評審的位置偏差。** 評審偏好先出現的那個選項。永遠把順序打亂，兩邊都跑。
- **整體平均分數會掩蓋失敗案例。** 平均 0.85 常常藏起 5% 的災難性失敗。永遠看最低分位數。
- **評估資料集逐漸失效。** 沒有版本、隨時間漂移的評估集，會弄壞縱向比較。每次變更都給資料集貼上標籤。
- **LLM 成本。** 規模一大，評審呼叫就主導成本。用達到校準閾值（threshold）的最便宜模型。GPT-4o-mini、Claude Haiku、Mistral-small。

## Use It｜實際應用

2026 年的組合：

| 用途 | 框架 |
|---------|-----------|
| RAG 品質監控 | RAGAS（4 個指標） |
| CI/CD 退步閘門 | DeepEval 加 pytest |
| 自訂領域準則 | DeepEval 裡的 G-Eval |
| 線上即時流量監控 | RAGAS 的不需參考模式 |
| 人在迴圈裡的抽查 | LangSmith 或 Phoenix，帶標註介面 |
| 紅隊／安全評估 | Promptfoo 加 DeepEval |

典型組合：RAGAS 做監控，DeepEval 做 CI，G-Eval 做新的維度。三個都跑；它們意見不合，但這很有用。

## Ship It｜交付成果

存成 `outputs/skill-eval-architect.md`：

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

## Exercises｜練習

1. **簡單。** 在 10 個已知有幻覺的 RAG 例子上用 RAGAS。確認忠實度指標每個都抓到。
2. **中等。** 為 50 個問答的答案手標 0 到 1 的正確性。用 G-Eval 打分。量評審和人之間的 Spearman rho。
3. **困難。** 用 DeepEval 做 pytest 的 CI 閘門。故意讓檢索器退步。確認閘門失敗。用最低 10% 的閾值檢查，加上最低分位數的警報。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| LLM-as-judge（LLM 當評審） | 用 LLM 打分 | prompt 一個評審模型，依評分準則為輸出打 0 到 1 分。 |
| RAGAS | RAG 的指標函式庫 | 開放原始碼的評估框架，有 4 個不需參考的 RAG 指標。 |
| 忠實度 | 答案有沒有依據？ | 答案主張裡，被檢索脈絡蘊涵的比例。 |
| 脈絡精確率 | 檢索到的區塊相關嗎？ | 前 K 個區塊裡，真正要緊的比例。 |
| 脈絡召回率 | 檢索找齊了嗎？ | 標準答案的主張裡，被檢索區塊支持的比例。 |
| G-Eval | 自訂的 LLM 評審 | 評分準則加逐步推理的評估步驟，再加 0 到 1 的分數。 |
| 校準 | 信，但要查 | 評審分數和人類分數的 Spearman 相關。 |

## Further Reading｜延伸閱讀

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) ——RAGAS 論文。
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) ——G-Eval 論文。
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) ——開放的正式環境組合。
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) ——偏差、校準、極限。
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) ——把 RAGAS、DeepEval、Phoenix 接在一起的統一框架。
