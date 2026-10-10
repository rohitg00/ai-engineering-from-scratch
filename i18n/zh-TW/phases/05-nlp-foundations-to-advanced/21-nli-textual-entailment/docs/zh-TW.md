# 自然語言推論（natural language inference，NLI）——文本蘊涵（textual entailment）

> 「t 蘊涵 h」的意思是，人讀了 t 會認定 h 為真。NLI 是預測蘊涵、矛盾或中立的任務。表面無聊，在正式環境（production）裡卻是不可或缺的基礎。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## The Problem｜問題

你做了一個摘要器。它產出一份摘要。你怎麼知道摘要裡沒有幻覺（hallucination）？

你做了一個聊天機器人。它回答「yes.」。你怎麼知道這個答案有檢索到的段落支撐？

你要把 1 萬篇新聞按主題分類。你沒有訓練標籤（label）。能不能重用一個模型？

這三個問題都化成自然語言推論（natural language inference，NLI）。NLI 問的是：給定前提 `t` 和假設 `h`，`h` 是被 `t` 蘊涵、被矛盾，還是中立（無關）？

- **幻覺檢查：** `t` 是來源文件，`h` 是摘要裡的主張。不是蘊涵，就是幻覺。
- **有依據的問答：** `t` 是檢索到的段落，`h` 是生成的答案。不是蘊涵，就是捏造。
- **零樣本（zero-shot）分類：** `t` 是文件，`h` 是轉述成自然語句的標籤（「This is about sports」）。蘊涵就是預測的標籤。

一個任務，三種正式環境用途。所以每個 RAG 評估框架裡，都藏著一個 NLI 模型。

## The Concept｜核心概念

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**三種標籤。**

- **蘊涵（entailment）。** `t` → `h`。「The cat is on the mat」蘊涵「There is a cat.」。
- **矛盾。** `t` → ¬`h`。「The cat is on the mat」矛盾「There is no cat.」。
- **中立。** 兩邊都推不出。「The cat is on the mat」對「The cat is hungry.」是中立。

**不是邏輯蘊涵。** NLI 是*自然*語言推論——典型的人類讀者會推出什麼，不是嚴格邏輯。「John walked his dog」在 NLI 裡蘊涵「John has a dog」，但嚴格的一階邏輯只有在你把擁有公理化之後才承認。

**資料集（dataset）。**

- **SNLI**（2015）。57 萬對人工標註，前提是圖像說明。領域窄。
- **MultiNLI**（2017）。43.3 萬對，跨 10 個文類。2026 年的標準訓練語料庫（corpus）。
- **ANLI**（2019）。對抗式 NLI。人專門寫用來打壞既有模型的例子。更難。
- **DocNLI、ConTRoL**（2020–21）。文件長度的前提。測多跳和長距離推論。

**架構。** transformer 編碼器（BERT、RoBERTa、DeBERTa）讀 `[CLS] premise [SEP] hypothesis [SEP]`。`[CLS]` 的表示送進三路 softmax。在 MNLI 上訓練，在留出評測上評估，分布內的配對準確率（accuracy）超過 90%。

**透過 NLI 做零樣本。** 給一份文件和候選標籤，把每個標籤變成假設（「This text is about sports」）。各自算蘊涵機率。取最大的。這就是 Hugging Face `zero-shot-classification` 管線（pipeline）背後的機制。

```figure
nli-router
```

## Build It｜動手實作

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

正式環境的 NLI，`facebook/bart-large-mnli` 和 `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` 是常用開源預設模型。DeBERTa-v3 在排行榜上居前。

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

模板預設是「This example is about {label}.」。用 `hypothesis_template` 自訂。不需要訓練資料。不做 fine-tune。開箱就能用。

### 步驟 3：給 RAG 做的忠實度檢查

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

這是 RAGAS 忠實度的核心。把生成的答案拆成原子主張。逐一檢查每項主張是否受到檢索脈絡蘊涵。報告被蘊涵的比例。

### 步驟 4：手寫的 NLI 分類器（classifier，概念用）

見 `code/main.py` 的純標準函式庫（library）玩具：前提和假設用詞彙重疊加否定偵測來比。打不過 transformer 模型——但它露出任務的形狀：兩段文本進去，三路標籤出來，損失是 `{entail, contradict, neutral}` 上的交叉熵（cross-entropy）。

## 坑

- **只看假設的捷徑。** 模型可以只從假設預測標籤，在 SNLI 上約 60%，因為「not」「nobody」「never」和矛盾相關。這是偵測標籤洩漏的強基準模型（baseline）。
- **詞彙重疊捷徑。** 「每個子序列都被蘊涵」這個捷徑過得了 SNLI，但過不了 HANS／ANLI。用對抗評測。
- **文件長度上的退化。** 單句 NLI 模型在文件長度的前提上，F1 掉 20 分以上。長脈絡用在 DocNLI 上訓練的模型。
- **零樣本模板很敏感。** 「This example is about {label}」對上「{label}」對上「The topic is {label}」，準確率可以相差 10 分以上。要調校模板。
- **領域不合。** MNLI 在一般英文上訓練。法律、醫學、科學文本需要領域專用的 NLI 模型（例如 SciNLI、MedNLI）。

## Use It｜實際應用

2026 年的組合：

| 用途 | 模型 |
|---------|-------|
| 通用 NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 要快／邊緣（edge） | `cross-encoder/nli-deberta-v3-base` |
| 零樣本分類（輕量） | `facebook/bart-large-mnli` |
| 文件層級 NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| 多語 | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| RAG 裡的幻覺偵測 | RAGAS／DeepEval 裡的 NLI 層 |

2026 年的後設模式：NLI 是文字理解的萬用補強工具。每當你需要「A 支撐 B 嗎？」或「A 矛盾 B 嗎？」——先伸手拿 NLI，再去多叫一次 LLM。

## Ship It｜交付成果

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

## Exercises｜練習

1. **簡單。** 在 20 個手寫的（前提、假設、標籤）三元組上跑 `facebook/bart-large-mnli`，三種都要涵蓋。量準確率。再加對抗的「子序列捷徑」陷阱（「I did not eat the cake」對上「I ate the cake」），觀察模型是否因此失效。
2. **中等。** 在 100 則 AG News 標題上，比較零樣本模板 `"This text is about {label}"`、`"The topic is {label}"` 和 `"{label}"`。報告準確率相差多少。
3. **困難。** 做一個 RAG 忠實度檢查器：原子主張分解，加上每個主張的 NLI。在 50 個有人工標註參考脈絡的 RAG 生成答案上評估。對上手寫標籤，量偽陽性（false positive）和偽陰性（false negative）比率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| NLI | 自然語言推論（natural language inference，NLI） | 前提和假設關係的三路分類。 |
| RTE | 辨識文本蘊涵（Recognizing Textual Entailment） | NLI 的舊名；同一個任務。 |
| 蘊涵 | 「t 蘊涵 h」 | 典型讀者給定 t 會認定 h 為真。 |
| 矛盾 | 「t 排除 h」 | 典型讀者給定 t 會認定 h 為假。 |
| 中立 | 「定不下來」 | 從 t 到 h 兩邊都推不出。 |
| 零樣本分類 | 把 NLI 當分類器 | 把標籤說成假設，取蘊涵最大的。 |
| 忠實度 | 答案有沒有被支撐？ | 在（檢索到的脈絡，生成的答案）上做 NLI。 |

## Further Reading｜延伸閱讀

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) ——SNLI。
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) ——MultiNLI。
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) ——ANLI 評測。
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) ——把 NLI 當分類器。
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) ——2026 年 NLI 的主力。
