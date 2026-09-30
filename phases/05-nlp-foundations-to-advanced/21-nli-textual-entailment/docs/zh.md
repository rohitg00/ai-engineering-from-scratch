# 自然語言推論 —— 文本蘊涵

> 「t 蘊涵 h」的意思是：一個人讀了 t 之後，會推斷出 h 為真。自然語言推論（NLI）這個任務，就是預測蘊涵／矛盾／中立。表面上很無聊，實際上撐著整個生產系統。

**類型：** 學習
**程式語言：** Python
**先修單元：** 階段 5 · 05（情感分析）、階段 5 · 13（問答系統）
**時間：** 約 60 分鐘

## 問題所在

你做了一個摘要器。它產出了一段摘要。你怎麼知道這段摘要裡沒有幻覺？

你做了一個聊天機器人。它回答了「yes」。你怎麼知道這個答案有被檢索到的段落支持？

你要把 10,000 篇新聞依主題分類。你手上沒有任何訓練標籤。有沒有現成的模型可以拿來用？

這三個問題都可以化約成自然語言推論。NLI 問的是：給定一個前提 `t` 與一個假設 `h`，`h` 是被 `t` 蘊涵、被 `t` 矛盾，還是中立（無關）？

- **幻覺檢查：** `t` = 原始文件，`h` = 摘要中的主張。不是蘊涵，就是幻覺。
- **有依據的問答：** `t` = 檢索到的段落，`h` = 生成的答案。不是蘊涵，就是憑空編造。
- **零樣本分類：** `t` = 文件，`h` = 把標籤寫成句子（「This is about sports」）。蘊涵者即為預測標籤。

一個任務，三種生產用途。這就是為什麼每一套 RAG 評估框架底層都塞了一個 NLI 模型。

## 核心概念

![NLI：前提對假設的三分類](../assets/nli.svg)

**三種標籤。**

- **蘊涵。** `t` → `h`。"The cat is on the mat" 蘊涵 "There is a cat."
- **矛盾。** `t` → ¬`h`。"The cat is on the mat" 矛盾於 "There is no cat."
- **中立。** 兩個方向都推不出來。"The cat is on the mat" 對 "The cat is hungry" 是中立的。

**這不是邏輯上的蘊涵。** NLI 是*自然*語言推論——看的是一般讀者會推斷出什麼，而不是嚴格的邏輯。在 NLI 裡，"John walked his dog" 蘊涵 "John has a dog"；但嚴格的一階邏輯只有在你先把「擁有」公理化之後才會承認這一步。

**資料集。**

- **SNLI**（2015）。57 萬組人工標註的句對，前提取自圖片說明。領域偏窄。
- **MultiNLI**（2017）。43.3 萬組句對，橫跨 10 種文體。2026 年的標準訓練語料。
- **ANLI**（2019）。對抗式 NLI。由人類專門寫出用來擊破現有模型的樣本。更難。
- **DocNLI、ConTRoL**（2020–21）。前提是文件長度。用來測試多跳與長距離的推論。

**架構。** 一個 transformer 編碼器（BERT、RoBERTa、DeBERTa）讀入 `[CLS] premise [SEP] hypothesis [SEP]`。`[CLS]` 的表示送進一個三分類的 softmax。在 MNLI 上訓練，在保留的基準上評估，同分佈的句對可以拿到 90% 以上的準確率。

**用 NLI 做零樣本。** 給定一份文件與一組候選標籤，把每個標籤改寫成一個假設（「This text is about sports」）。逐一算出蘊涵機率。取最大值。這就是 Hugging Face `zero-shot-classification` pipeline 背後的機制。

```figure
nli-router
```

## 動手實作

### 步驟 1：跑一個預訓練的 NLI 模型

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

要在生產環境做 NLI，`facebook/bart-large-mnli` 與 `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` 是開源界的預設選擇。DeBERTa-v3 在排行榜上居首。

### 步驟 2：零樣本分類

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

預設的假設模板是 "This example is about {label}."。要改就用 `hypothesis_template`。不需要訓練資料。不需要微調。開箱就能用。

### 步驟 3：RAG 的忠實度檢查

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

這就是 RAGAS 忠實度的核心。把生成的答案切成一條條原子主張。拿每一條主張去對檢索到的上下文做檢查。回報其中構成蘊涵的比例。

### 步驟 4：手寫的 NLI 分類器（概念示範）

`code/main.py` 裡有一個只用標準函式庫的玩具版：前提與假設之間比對詞彙重疊，再加上否定詞偵測。它跟 transformer 模型完全不能比——但它把任務的形狀交代清楚了：輸入兩段文字，輸出三分類標籤，損失是 `{entail, contradict, neutral}` 上的交叉熵。

## 常見陷阱

- **只看假設就能抄捷徑。** 在 SNLI 上，模型光憑假設就能猜到約 60% 的標籤，因為 "not"、"nobody"、"never" 與矛盾高度相關。這是偵測標籤洩漏的一條強力基準線。
- **詞彙重疊的捷徑。** 「子序列一律算蘊涵」這條啟發式規則在 SNLI 上過得去，在 HANS／ANLI 上就失效。請用對抗式基準。
- **文件長度會讓表現崩掉。** 單句 NLI 模型在文件長度的前提上會掉 20 個以上的 F1。長上下文請用 DocNLI 訓練過的模型。
- **零樣本對模板極度敏感。** "This example is about {label}"、"{label}"、"The topic is {label}" 之間的準確率差距可以拉開 10 個百分點以上。模板要調。
- **領域不匹配。** MNLI 訓練的是一般英文。法律、醫療與科學文本需要領域專用的 NLI 模型（例如 SciNLI、MedNLI）。

## 框架應用

2026 年的技術堆疊：

| 使用場景 | 模型 |
|---------|-------|
| 通用 NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 快速／邊緣裝置 | `cross-encoder/nli-deberta-v3-base` |
| 零樣本分類（輕量） | `facebook/bart-large-mnli` |
| 文件層級 NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 多語言 | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| RAG 的幻覺偵測 | RAGAS／DeepEval 內建的 NLI 層 |

2026 年的通用模式：NLI 是文本理解的萬用膠帶。任何時候你需要問「A 支持 B 嗎？」或「A 與 B 矛盾嗎？」——先想到 NLI，再想要不要多打一次 LLM。

## 產出交付

存成 `outputs/skill-nli-picker.md`：

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## 練習

1. **簡單。** 拿 `facebook/bart-large-mnli` 跑 20 組自己手寫的（前提、假設、標籤）三元組，三個類別都要涵蓋。量測準確率。再加上對抗式的「子序列啟發式」陷阱（"I did not eat the cake" 對 "I ate the cake"），看看它會不會破。
2. **中等。** 在 100 條 AG News 標題上，比較零樣本模板 `"This text is about {label}"` 與 `"The topic is {label}"`、`"{label}"` 的差別。回報準確率的擺動幅度。
3. **困難。** 做一個 RAG 忠實度檢查器：原子主張拆解 + 每條主張跑一次 NLI。在 50 筆有黃金上下文的 RAG 生成答案上評估。對照人工標註，量測誤判為真與誤判為假的比率。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| NLI | 自然語言推論 | 對前提與假設之間的關係做三分類。 |
| RTE | 辨識文本蘊涵 | NLI 的舊名；同一個任務。 |
| 蘊涵 | 「t 推得出 h」 | 一般讀者在讀了 t 之後會判定 h 為真。 |
| 矛盾 | 「t 排除了 h」 | 一般讀者在讀了 t 之後會判定 h 為假。 |
| 中立 | 「無法判定」 | 從 t 到 h，兩個方向都推不出結論。 |
| 零樣本分類 | 把 NLI 當分類器 | 把標籤寫成假設，取蘊涵機率最高者。 |
| 忠實度 | 答案有被支持嗎？ | 對（檢索到的上下文、生成的答案）跑 NLI。 |

## 延伸閱讀

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) —— SNLI。
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) —— MultiNLI。
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) —— ANLI 基準。
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) —— 把 NLI 當分類器。
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) —— 2026 年 NLI 的主力馬。
