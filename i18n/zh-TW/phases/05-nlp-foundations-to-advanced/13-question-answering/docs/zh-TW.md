# 問答系統（question answering）

> 三種系統塑造了現代問答。抽取式找到片段。檢索增強把它們錨在文件上。生成式產出答案。每個現代 AI 助理都是這三者的混合。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## The Problem｜問題

使用者打「When did the first iPhone launch?」，期待的是「June 29, 2007.」。不是「Apple's history is long and varied.」。也不是孤零零的「2007」，旁邊沒有句子。要的是直接、有依據、而且正確的答案。

過去十年，三種架構主導問答。

- **抽取式問答。** 給定問題，以及已知含有答案的段落，找出答案片段在段落裡的起點和終點索引。SQuAD 是標準評測。
- **開放領域問答。** 不給段落。先檢索相關段落，再抽取或生成答案。這是今天每條檢索增強生成（retrieval-augmented generation，RAG）管線（pipeline）的地基。
- **生成式／閉卷（closed-book）問答。** 大型語言模型從它的參數記憶回答。沒有檢索。推論（inference）最快，事實最不可靠。

2026 年的趨勢是混合：檢索最好的幾段，再 prompt 一個生成模型，讓答案錨在那些段落上。那就是 RAG，第 14 課會深入講檢索那一半。這一課做問答這一半。

## The Concept｜核心概念

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**抽取式。** 用 transformer（BERT 家族）把問題和段落一起編碼。訓練兩個頭，預測答案的起點和終點 token 索引。損失是合法位置上的交叉熵（cross-entropy）。輸出是段落裡的一個片段。構造上不會幻覺（hallucination），構造上也處理不了段落答不出的問題。

**檢索增強（RAG）。** 兩個階段。第一，檢索器從語料庫（corpus）找出前 `k` 段。第二，閱讀器（抽取式或生成式）用那些段落產出答案。檢索器和閱讀器拆開，才能各自訓練、各自評估。現代 RAG 常常在中間加一個重排器（reranker）。

**生成式。** 只有解碼器的大型語言模型（GPT、Claude、Llama）從學到的權重回答。沒有檢索步驟。常識很好，稀有或最近的事實則是災難。幻覺率和該事實在預訓練資料裡的頻率負相關。

```figure
qa-span
```

## Build It｜動手實作

### 步驟 1：用預訓練模型做抽取式問答

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2` 在 SQuAD 2.0 上訓練，其中包含無法回答的問題。預設上，`question-answering` 管線即使模型的空答案分數贏了，仍回傳分數最高的片段——它*不會*自動回傳空答案。要明確的「沒有答案」行為，在呼叫時傳 `handle_impossible_answer=True`：只有空答案分數超過每一個片段分數時，管線才回傳空答案。無論哪種，都要看 `score` 欄。

### 步驟 2：檢索增強管線（草圖）

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

兩階段管線。稠密檢索器（Sentence-BERT）用語意相似度找相關段落。抽取式閱讀器（RoBERTa-SQuAD）從合併後的前幾段抽出答案片段。小語料庫上可行。100 萬份文件的語料庫，用 FAISS 或向量資料庫。

### 步驟 3：帶 RAG 的生成

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

prompt 的模式要緊。明確告訴模型錨在脈絡上，脈絡不夠就回「I don't know.」，和單純 prompting 比，可以把幻覺率砍掉 40% 到 60%。更精細的模式會加引用、信心分數和結構化抽取。

### 步驟 4：反映真實世界的評估

SQuAD 用**完全相符（Exact Match，EM）**和 **token 級 F1**。EM 是正規化（normalization）之後的嚴格相符（小寫、去掉標點、拿掉冠詞）——預測要麼完全相符，要麼 0 分。F1 算預測和參考之間的 token 重疊，給部分分數。兩者都低估改寫：「June 29, 2007」對上「June 29th, 2007」通常 EM 是 0（序數後綴未經正規化處理），但重疊的 token 仍讓 F1 不低。

正式環境的問答：

- **答案準確率（accuracy）**（由 LLM 或人判斷，因為指標抓不到語意等價）。
- **引用準確率。** 引用的段落真的支撐答案嗎？把生成的引用和檢索到的段落做字串比對，自動檢查很直接。
- **拒答校準。** 答案不在檢索到的段落裡時，系統會不會正確說「I don't know.」？量錯誤自信的比率。
- **檢索召回率（recall）。** 評估閱讀器之前，先量檢索器有沒有把對的段落放進前 `k`。缺了段落，閱讀器補不回來。

### RAGAS：2026 年正式環境的評估框架

`RAGAS` 是為 RAG 系統做的，也是 2026 年交付時的預設。它打四個維度（dimension）的分數，不需要標準參考答案：

- **忠實度。** 答案裡的每個主張都來自檢索到的脈絡嗎？用基於 NLI 的蘊涵（entailment）來量。這是你的主要幻覺指標。
- **答案相關性。** 答案有沒有回應問題？從答案生成假設問題，再和真問題比。
- **脈絡精確率（precision）。** 檢索到的區塊裡，真正相關的佔多少？精確率低，表示 prompt 裡有雜訊。
- **脈絡召回率。** 檢索集合有沒有包含所有需要的資訊？召回率低，閱讀器不可能成功。

不需參考的打分，讓你在沒有人工整理的參考答案時，也能評估線上的正式環境流量。開放問題上，完全相符指標沒用，再在上面加一層 LLM 評審。

`pip install ragas`。接上你的檢索器和閱讀器。每個查詢得到四個純量。退步就警報。

## Use It｜實際應用

2026 年的組合。

| 用途 | 建議 |
|---------|-------------|
| 給定段落，找出答案片段 | `deepset/roberta-base-squad2` |
| 固定語料庫上，不能接受閉卷 | RAG：稠密檢索器加 LLM 閱讀器 |
| 文件庫上的即時問答 | RAG，混合檢索器（BM25 加稠密）加重排器（第 14 課） |
| 對話式問答（追問） | 大型語言模型帶著對話歷史，每一輪都做 RAG |
| 高度重視事實正確性、受管制的領域 | 在權威語料庫上做抽取式；不要只靠生成式 |

抽取式問答在 2026 年不流行，因為帶大型語言模型的 RAG 蓋得住更多情況。在必須逐字引用的地方，它仍會交付出去：法律研究、法規遵循、稽核工具。

## Ship It｜交付成果

存成 `outputs/skill-qa-architect.md`：

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## Exercises｜練習

1. **簡單。** 在 10 段 Wikipedia 上架好上面的 SQuAD 抽取式管線。自己寫 10 個問題。計算答案答對的次數／比例。段落和問題都乾淨的話，你應該會看到 7 到 9 題對。
2. **中等。** 加一個拒答分類器（classifier）。當最高檢索分數低於一個閾值（例如餘弦相似度 0.3），回「I don't know.」，不要呼叫閱讀器。在留出集合上調校閾值。
3. **困難。** 在你選的 1 萬份文件語料庫上做一條 RAG 管線。實作混合檢索（BM25 加稠密），用 RRF 融合（見第 14 課）。比較加入與未加入混合檢索時的答案準確率。寫下哪類問題受益最多。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 抽取式問答 | 找出答案片段 | 在給定段落裡預測答案的起點和終點索引。 |
| 開放領域問答 | 在語料庫上問答 | 不給段落；必須先檢索再回答。 |
| RAG | 先檢索再生成 | 檢索增強生成（retrieval-augmented generation）。檢索器加閱讀器的管線。 |
| SQuAD | 標準評測 | Stanford Question Answering Dataset。EM 加 F1。 |
| 幻覺 | 編出來的答案 | 閱讀器的輸出沒有檢索脈絡支撐。 |
| 拒答校準 | 知道何時閉嘴 | 答不出來時，系統正確說「I don't know.」。 |

## Further Reading｜延伸閱讀

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) ——基準論文。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) ——DPR，問答用的標準稠密檢索器。
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) ——把 RAG 命名的論文。
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) ——完整的 RAG 綜述。
