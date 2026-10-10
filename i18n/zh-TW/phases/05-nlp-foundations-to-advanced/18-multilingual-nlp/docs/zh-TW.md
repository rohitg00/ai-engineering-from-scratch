# 多語 NLP

> 一個模型、100 種以上的語言，其中多數沒有訓練資料。跨語言遷移（cross-lingual transfer）是 2020 年代實務上的奇蹟。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## The Problem｜問題

英文有數十億筆有標籤（label）的例子。烏爾都語有幾千筆。邁蒂利語幾乎沒有。任何要服務全球受眾的實務 NLP 系統，都得在任務專用訓練資料不存在的語言長尾上運作。

多語模型的解法是同時在很多語言上訓練一個模型。共享的表示讓模型把高資源語言學到的能力，遷移到低資源語言。在英文情感分析（sentiment analysis）上 fine-tune 這個模型，它開箱就能在烏爾都語上給出好得出人意料的情感預測。那就是零樣本（zero-shot）跨語言遷移（cross-lingual transfer），它改變了 NLP 推向全球使用者的方式。

這一課點名取捨、標準模型，以及會絆倒剛做多語的團隊的那個決定：選哪個來源語言來遷移。

## The Concept｜核心概念

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**共享詞彙表。** 多語模型用在所有目標語言文本上訓練的 SentencePiece 或 WordPiece tokenizer。詞彙表是共享的：同一個子詞（subword）單位，在親緣語言裡代表同一個語素（morpheme）。英文和義大利文的 `anti-` 得到同一個 token。

**共享表示。** 在很多語言上做遮罩語言建模（masked language modeling）、預訓練過的 transformer，會學到語意相近的句子在不同語言裡產生相近的隱藏狀態。mBERT、XLM-R、NLLB 都有這個現象。「cat」的 embedding 會靠在法文「chat」和西班牙文「gato」附近，整句的 embedding 也一樣。

**零樣本遷移。** 在一種語言（通常是英文）的有標籤資料上 fine-tune 模型。推論（inference）時，在模型支援的任何其他語言上跑。不需要目標語言的標籤。語言類型學上相近的語言結果強，距離遠的較弱。

**少樣本（few-shot）fine-tune。** 在目標語言加 100 到 500 個有標籤的例子。分類任務上，準確率（accuracy）跳到英文基準模型（baseline）的 95% 到 98%。這是多語 NLP 裡最具成本效益的做法。

## 這些模型

| 模型 | 年份 | 覆蓋 | 備註 |
|-------|------|----------|-------|
| mBERT | 2018 | 104 種語言 | 在 Wikipedia 上訓練。第一個實用的多語言模型。低資源語言較弱。 |
| XLM-R | 2019 | 100 種語言 | 在 CommonCrawl 上訓練（比 Wikipedia 大很多）。立下跨語言基準。Base 2.7 億，Large 5.5 億。 |
| XLM-V | 2023 | 100 種語言 | 詞彙表有 100 萬個 token 的 XLM-R（對上 25 萬）。低資源較好。 |
| mT5 | 2020 | 101 種語言 | 給多語生成用的 T5 架構。 |
| NLLB-200 | 2022 | 200 種語言 | Meta 的翻譯模型；含 55 個低資源語言。 |
| BLOOM | 2022 | 46 種語言加 13 種程式語言 | 多語訓練的開放 1760 億 LLM。 |
| Aya-23 | 2024 | 23 種語言 | Cohere 的多語 LLM。阿拉伯語、印地語、史瓦希里語較強。 |

按用途挑。分類用 XLM-R-base 當穩妥的預設，通常很好。生成任務看是翻譯還是開放生成，應選用 mT5 或 NLLB。LLM 風格的工作搭配 Aya-23，或用具備明確多語 prompting 的 Claude。

## 來源語言的決定（2026 年的研究）

多數團隊把 fine-tune 的來源預設成英文。2026 年的研究顯示這常常是錯的。

語言相似度比原始語料庫（corpus）大小更能預測遷移品質。斯拉夫語目標上，德文或俄文常常贏過英文。印度語系目標上，印地語常常贏過英文。**qWALS** 相似度指標（2026，基於 World Atlas of Language Structures 的特徵）把這件事量化。**LANGRANK**（Lin 等人，ACL 2019）是另一個、更早的方法，用語言相似度、語料庫大小和語系親緣的組合，為候選來源語言排名。

實務規則：若目標語言有一個類型上接近的高資源親戚，先在那個語言上 fine-tune，再和英文 fine-tune 比。

```figure
n5-crosslingual-bridge
```

## Build It｜動手實作

### 步驟 1：零樣本跨語言分類

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

一個模型，三種語言，同一套 API。在 自然語言推論（natural language inference，NLI）上訓練的 XLM-R，藉蘊涵（entailment）技巧，遷移到分類上表現好。

### 步驟 2：多語 embedding 空間

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

譯文在 embedding 空間裡靠得很近。另一句英文落得較遠。跨語言檢索、分群和相似度靠的就是這個。

### 步驟 3：少樣本 fine-tune 策略

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

100 到 500 個目標語言例子時，`num_train_epochs=5` 和 `learning_rate=2e-5` 是安全預設。學習率再高，多語對齊會崩，你會得到一個只會英文的模型。

## 真的有用的評估

- **在留出集合上按語言分開的準確率。** 不要加總。加總會藏起長尾。
- **對上單語基準模型。** 資料夠的語言，從零訓練的單語模型有時贏過多語模型。要測。
- **實體層級測試。** 目標語言的命名實體（named entity）。多語模型對非拉丁字母系統的文字，tokenization 常常偏弱。
- **跨語言一致性。** 兩種語言裡的同一個意思，應該得到同一個預測。量這個差距。

## Use It｜實際應用

2026 年的組合：

| 任務 | 建議 |
|-----|-------------|
| 分類，100 種語言 | XLM-R-base（約 2.7 億）fine-tune 過 |
| 零樣本文本分類 | `joeddav/xlm-roberta-large-xnli` |
| 多語句 embedding | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| 翻譯，200 種語言 | `facebook/nllb-200-distilled-600M`（見第 11 課） |
| 生成式多語 | Claude、GPT-4、Aya-23、mT5-XXL |
| 低資源語言 NLP | XLM-V，或在親緣的高資源語言上做領域 fine-tune |

若效能要緊，永遠為目標語言的 fine-tune 留預算。零樣本是起點，不是最終答案。

### 切分的稅（低資源語言會出什麼錯）

多語模型在所有語言上共享一個 tokenizer。那個詞彙表是在英文、法文、西班牙文、中文、德文佔多數的語料庫上訓練的。對主導集合以外的任何語言，三種稅會悄悄疊加：

- **切分倍率稅（fertility）。** 低資源語言的文本，每個詞切出的 token 比英文多很多。一句印地語可以需要等義英文的 3 到 5 倍 token。這 3 到 5 倍吃掉脈絡視窗、訓練效率和延遲（latency）。
- **變體復原稅。** 每個錯字、附加符號變體、Unicode 正規化（normalization）對不上、或大小寫變化，都變成 embedding 空間裡冷啟動的、不相干的序列。模型學不會母語者覺得理所當然的正字對應。
- **容量外溢稅。** 前兩種稅吃掉脈絡位置、層的深度和 embedding 維度（dimension）。剩下能拿來真正推理的，系統性地比高資源語言從同一個模型拿到的少。

實務症狀：模型在印地語上訓練看起來正常，損失曲線看起來對，評估困惑度（perplexity）看起來合理，正式環境的輸出卻微妙地錯。構詞在句子中途崩掉。罕見屈折救不回來。**你沒辦法靠把資料做大，逃出一個壞掉的 tokenizer。**

緩解：挑一個對目標語言覆蓋好的 tokenizer（XLM-V 的 100 萬 token 詞彙表就是直接的修法）；訓練前先在留出的目標文本上驗證切分倍率；真正的長尾文字用位元組層級後援（SentencePiece `byte_fallback=True`、GPT-2 風格的位元組層級 BPE），這樣永遠沒有 OOV。

## Ship It｜交付成果

存成 `outputs/skill-multilingual-picker.md`：

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## Exercises｜練習

1. **簡單。** 在英文、法文、印地語、阿拉伯語上，每種語言 10 句，跑零樣本分類管線（pipeline）。各報準確率。你應該會看到法文強、印地語還可以、阿拉伯語不定。
2. **中等。** 用 `paraphrase-multilingual-MiniLM-L12-v2` 在一個小型混合語言語料庫上做跨語言檢索器。用英文查詢，檢索任何語言的文件。量前 5 名的召回率（recall）。
3. **困難。** 比較以英文為來源和以印地語為來源的 fine-tune，做一個印地語分類任務。兩種設定都用 500 個目標語言例子做少樣本 fine-tune。報告哪個來源的印地語準確率較好、好多少。這是 LANGRANK 論點的縮小版。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 多語模型 | 一個模型，很多語言 | 跨語言共享詞彙表和參數。 |
| 跨語言遷移（cross-lingual transfer） | 在一種語言上訓練，在另一種上跑 | 在來源上 fine-tune，在目標上評估，不用目標語言的標籤。 |
| 零樣本 | 沒有目標語言標籤 | 不在目標語言上 fine-tune 就遷移。 |
| 少樣本 | 少量目標標籤 | 用 100 到 500 個目標語言例子做 fine-tune。 |
| mBERT | 第一個多語言模型 | 在 Wikipedia 上預訓練的 104 種語言 BERT。 |
| XLM-R | 標準跨語言基準 | 在 CommonCrawl 上預訓練的 100 種語言 RoBERTa。 |
| NLLB | Meta 的 200 種語言機器翻譯 | No Language Left Behind。含 55 個低資源語言。 |

## Further Reading｜延伸閱讀

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) ——XLM-R 論文。
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) ——開啟跨語言遷移（cross-lingual transfer）這條研究線的分析論文。
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) ——NLLB-200 論文。
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827) ——Aya，Cohere 的多語 LLM。
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) ——qWALS／LANGRANK 的來源語言論文。
