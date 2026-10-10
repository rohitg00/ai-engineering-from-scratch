# 文字摘要（text summarization）

> 抽取式（extractive）系統告訴你文件說了什麼。抽象式（abstractive）系統告訴你作者的意思。任務不同，坑也不同。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## The Problem｜問題

一篇 2000 個詞的新聞落到你的動態裡。你需要 120 個詞把它抓住。你可以從文章裡挑出最重要的三句（抽取式），或用自己的話重寫（抽象式）。兩者都叫摘要。它們是完全不同的問題。

抽取式摘要是排序問題。給每句打分，回傳前 `k` 名。輸出永遠合乎文法，因為是原句搬出來的。風險是漏掉散落在整篇文章裡的內容。

抽象式摘要是生成問題。transformer 依輸入產出新文字。輸出流暢、也壓得短，但可能幻覺（hallucination）出來源沒有的事實。風險是自信地編造。

這一課把兩者都做出來，並點名各自擁有的失敗方式。

## The Concept｜核心概念

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**抽取式。** 把文章當成圖：節點是句子，邊是相似度。在圖上跑 PageRank（或類似的東西），依句子和其餘一切有多連通來打分。分數最高的句子就是摘要。標準實作是 **TextRank**（Mihalcea 和 Tarau，2004）。

**抽象式。** 在文件－摘要配對上 fine-tune 一個 transformer 編碼器－解碼器（encoder-decoder）（BART、T5、Pegasus）。推論（inference）時，模型讀文件，經由交叉注意力（cross-attention）一個 token 一個 token 生成摘要。Pegasus 特別用缺句生成預訓練目標（gap-sentence generation objective），所以不用太多 fine-tune 就很會做摘要。

用 **ROUGE**（Recall-Oriented Understudy for Gisting Evaluation）評估。ROUGE-1 和 ROUGE-2 給一元和二元 n-gram 的重疊打分。ROUGE-L 給最長共同子序列打分。越高越好，但 40 的 ROUGE-L 是「好」，50 是「非常出色」。每篇論文三個都報。用 `rouge-score` 套件。

```figure
summarize-collapse
```

## Build It｜動手實作

### 步驟 1：TextRank（抽取式）

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

兩件事值得點名。相似度函式用對數正規化（normalization）的詞重疊，這是原始 TextRank 的變體。TF-IDF 向量的餘弦（cosine）也可以。阻尼 0.85 和迭代次數是 PageRank 的預設。

### 步驟 2：用 BART 做抽象式

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN 在 CNN/DailyMail 語料庫（corpus）上 fine-tune 過。開箱就產出新聞風格的摘要。其他領域（科學論文、對話、法律）用對應的 Pegasus checkpoint，或在你的目標資料上 fine-tune。

### 步驟 3：ROUGE 評估

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

永遠做詞幹提取（stemming）。沒有它，「running」和「run」會被算成不同的詞，ROUGE 就少算。

### ROUGE 之外（2026 年的摘要評估）

ROUGE 當了二十年的主要摘要指標，到 2026 年單靠它不夠。一份大規模的自然語言生成論文後設分析顯示：

- **BERTScore**（contextual embedding 的相似度）到 2023 年站穩，現在多數摘要論文和 ROUGE 一起報。
- **BARTScore** 把評估當成生成：給定來源，看預訓練 BART 有多可能寫出這份摘要，用那個機率打分。
- **MoverScore**（contextual embedding 上的 Earth Mover's Distance）在 2025 年的摘要基準拿到第一，因為它抓語意重疊比 ROUGE 好。
- **FactCC** 和**以問答為基礎的忠實度**在 2021 到 2023 年常見，現在常常被 **G-Eval** 換掉（一條 GPT-4 prompt 鏈，用逐步推理（chain-of-thought）給連貫、一致、流暢、相關打分）。
- **G-Eval** 和類似的 LLM 評審，評分規準設計得好時，和人類判斷一致的時候大約 80%。

正式環境建議：報 ROUGE-L 以便和舊結果比，BERTScore 看語意重疊，G-Eval 看連貫和事實性。用 50 到 100 份人類標好的摘要來校準。

### 步驟 4：事實性問題

抽象式摘要容易幻覺。抽取式摘要的幻覺風險低很多，因為輸出是從來源原句搬出來的；不過來源句若被抽離脈絡、過時，或引用順序不對，仍然會誤導。這是正式環境系統在與法規遵循相關的內容上仍偏好抽取式的最大理由。

要點名的幻覺類型：

- **實體對調。** 來源說「John Smith.」。摘要說「John Brown.」。
- **數字漂移。** 來源說 25,000。摘要說 2500 萬。
- **極性翻轉。** 來源說「rejected the offer.」。摘要說「accepted the offer.」。
- **發明事實。** 來源沒提到執行長。摘要說執行長核准了。

行得通的評估做法：

- **FactCC。** 一個二元分類器（classifier），在來源句和摘要句的蘊涵（entailment）上訓練。預測符合事實或不符合。
- **以問答為基礎的事實性。** 向問答模型提出答案可在來源中找到的問題。如果摘要支持不同的答案，就標記。
- **實體級 F1。** 比較來源和摘要裡的命名實體。只出現在摘要裡的實體可疑。

任何給人看、而且事實性要緊的東西（新聞、醫學、法律、金融），抽取式是較安全的預設。抽象式需要在迴圈裡做事實性檢查。

## Use It｜實際應用

2026 年的組合：

| 用途 | 建議 |
|---------|-------------|
| 新聞、3 到 5 句摘要、英文 | `facebook/bart-large-cnn` |
| 科學論文 | `google/pegasus-pubmed`，或調校過的 T5 |
| 多文件、長篇 | 任何脈絡 3.2 萬以上的大型語言模型，用 prompt |
| 對話摘要 | `philschmid/bart-large-cnn-samsum` |
| 抽取式，構造上幻覺風險低 | TextRank，或 `sumy` 的 LSA／LexRank |

長脈絡的大型語言模型在 2026 年、算力不受限時，常常打贏專門模型。代價是成本和可重現性；專門模型的輸出比較一致。

## Ship It｜交付成果

存成 `outputs/skill-summary-picker.md`：

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## Exercises｜練習

1. **簡單。** 在 5 篇新聞上跑 TextRank。把前 3 句和一份參考摘要比。量 ROUGE-L。CNN/DailyMail 風格的文章上，你應該會看到 30 到 45 的 ROUGE-L。
2. **中等。** 實作實體級事實性：從來源和摘要抽出命名實體（spaCy），算摘要裡含有多少來源實體的召回率（recall），以及摘要實體對上來源的精確率（precision）。高精確率、低召回率表示安全但精簡；低精確率表示有幻覺出來的實體。
3. **困難。** 在 50 篇 CNN/DailyMail 文章上，比較 BART-large-CNN 和一個大型語言模型（Claude 或 GPT-4）。回報 ROUGE-L、事實性（用實體 F1）和每份摘要的成本。寫下各自在哪裡贏。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 抽取式 | 挑句子 | 從來源原句搬回來。不會幻覺。 |
| 抽象式 | 重寫 | 依來源生成新文字。可能幻覺。 |
| ROUGE | 摘要指標 | 系統輸出和參考摘要之間的 n-gram／最長共同子序列重疊。 |
| TextRank | 以圖為基礎的抽取式 | 在句子相似度圖上做 PageRank。 |
| 事實性 | 對不對 | 摘要的主張是否有來源支撐。 |
| 幻覺 | 編出來的內容 | 摘要裡有、來源卻支撐不了的內容。 |

## Further Reading｜延伸閱讀

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) ——抽取式的標準論文。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) ——BART 論文。
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) ——Pegasus 和缺句生成目標。
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) ——ROUGE 論文。
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) ——把事實性問題攤開的那篇論文。
