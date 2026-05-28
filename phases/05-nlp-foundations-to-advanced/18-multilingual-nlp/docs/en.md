# 多言語NLP

> 1つのモデル、100以上の言語、その大半では学習データがゼロ。クロスリンガル転移は、2020年代の実用上の奇跡です。

**種別:** 学習
**言語:** Python
**前提:** Phase 5 · 04（GloVe、FastText、Subword）、Phase 5 · 11（Machine Translation）
**時間:** 約45分

## 問題

英語には数十億件のラベル付き例があります。ウルドゥー語には数千件あります。マイティリー語にはほとんどありません。世界中のユーザーに提供する実用的なNLPシステムは、タスク固有の学習データが存在しない言語のロングテールでも動かなければなりません。

多言語モデルは、1つのモデルを多くの言語で同時に学習することでこの問題を解きます。共有表現により、高リソース言語で学んだスキルを低リソース言語へ転移できます。英語の感情分析でモデルをファインチューニングすると、追加学習なしでもウルドゥー語で驚くほど良い感情予測が出ます。これがゼロショット・クロスリンガル転移であり、NLPを世界に出荷する方法を作り替えました。

このレッスンでは、トレードオフ、代表的なモデル、そして多言語対応に慣れていないチームがつまずきやすい1つの判断を扱います。転移に使うソース言語の選び方です。

## コンセプト

![共有された多言語埋め込み空間によるクロスリンガル転移](../assets/multilingual.svg)

**共有語彙。** 多言語モデルは、すべての対象言語のテキストで学習したSentencePieceまたはWordPiece tokenizerを使います。語彙は共有されます。関連言語間では、同じsubword単位が同じ形態素を表します。英語とイタリア語の `anti-` は同じトークンになります。

**共有表現。** 多くの言語にまたがるmasked language modelingで事前学習したtransformerは、異なる言語でも意味的に似た文が似たhidden stateを生むことを学びます。mBERT、XLM-R、NLLBはいずれもこれを示します。英語の "cat" の埋め込みは、フランス語の "chat" やスペイン語の "gato" の近くに集まり、全文埋め込みでも同じことが起きます。

**ゼロショット転移。** 1つの言語（通常は英語）のラベル付きデータでモデルをファインチューニングします。推論時には、そのモデルが対応する任意の別言語で実行します。対象言語のラベルは不要です。類型的に近い言語では結果が強く、遠い言語では弱くなります。

**few-shotファインチューニング。** 対象言語のラベル付き例を100-500件追加します。分類タスクでは、精度が英語ベースラインの95-98%まで跳ね上がります。これは多言語NLPで最も費用対効果の高いレバーです。

## モデル

| モデル | 年 | カバレッジ | 注記 |
|-------|------|----------|-------|
| mBERT | 2018 | 104言語 | Wikipediaで学習。最初の実用的な多言語LM。低リソースには弱い。 |
| XLM-R | 2019 | 100言語 | CommonCrawl（Wikipediaよりはるかに大規模）で学習。クロスリンガルのベースラインを作った。Base 270M、Large 550M。 |
| XLM-V | 2023 | 100言語 | 1M-token語彙を持つXLM-R（250kに対して）。低リソースでより強い。 |
| mT5 | 2020 | 101言語 | 多言語生成向けのT5アーキテクチャ。 |
| NLLB-200 | 2022 | 200言語 | Metaの翻訳モデル。55の低リソース言語を含む。 |
| BLOOM | 2022 | 46言語 + 13プログラミング言語 | 多言語で学習されたオープンな176B LLM。 |
| Aya-23 | 2024 | 23言語 | Cohereの多言語LLM。アラビア語、ヒンディー語、スワヒリ語に強い。 |

ユースケースに応じて選びます。分類では、現実的なデフォルトとしてXLM-R-baseがよく機能します。生成タスクでは、翻訳か自由生成かに応じてmT5またはNLLBを使います。LLM型の作業では、Aya-23またはClaudeに明示的な多言語プロンプトを組み合わせます。

## ソース言語の判断（2026年の研究）

ほとんどのチームは、ファインチューニング用ソースとして英語をデフォルトにします。最近の研究（2026年）は、それがしばしば間違いであることを示しています。

言語の類似性は、生コーパスサイズよりも転移品質をよく予測します。スラブ系の対象言語では、ドイツ語やロシア語が英語に勝つことがよくあります。インド系の対象言語では、ヒンディー語が英語に勝つことがよくあります。**qWALS** 類似度指標（2026年、World Atlas of Language Structuresの特徴に基づく）はこれを定量化します。**LANGRANK**（Lin et al., ACL 2019）は別の、より古い手法で、言語的類似性、コーパスサイズ、系統的近さの組み合わせから候補ソース言語をランク付けします。

実践上のルールは単純です。対象言語に類型的に近い高リソース言語があるなら、まずその言語でファインチューニングし、その後で英語ファインチューニングと比較します。

## 作ってみる

### Step 1: ゼロショット・クロスリンガル分類

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

1つのモデル、3つの言語、同じAPIです。NLIデータで学習したXLM-Rは、含意のトリックによって分類へうまく転移します。

### Step 2: 多言語埋め込み空間

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

翻訳文は埋め込み空間で近くに配置されます。別の英語文はより遠くに配置されます。これにより、クロスリンガル検索、クラスタリング、類似度計算が機能します。

### Step 3: few-shotファインチューニング戦略

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

対象言語の例が100-500件ある場合、`num_train_epochs=5` と `learning_rate=2e-5` が安全なデフォルトです。より高い学習率では多言語アラインメントが崩壊し、英語専用モデルになってしまいます。

## 実際に機能する評価

- **ホールドアウトセットでの言語別精度。** 集計ではありません。集計値はロングテールを隠します。
- **単言語ベースラインとの比較。** 十分なデータがある言語では、ゼロから学習した単言語モデルが多言語モデルを上回ることがあります。テストしてください。
- **エンティティレベルのテスト。** 対象言語の固有表現をテストします。多言語モデルは、ラテン文字から遠い文字体系でtokenizationが弱いことがよくあります。
- **クロスリンガル一貫性。** 2つの言語で同じ意味なら、同じ予測になるべきです。その差を測定します。

## 使ってみる

2026年のスタックは次のとおりです。

| タスク | 推奨 |
|-----|-------------|
| 100言語の分類 | ファインチューニング済みXLM-R-base（~270M） |
| ゼロショットテキスト分類 | `joeddav/xlm-roberta-large-xnli` |
| 多言語文埋め込み | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| 200言語の翻訳 | `facebook/nllb-200-distilled-600M`（lesson 11を参照） |
| 生成型多言語 | Claude、GPT-4、Aya-23、mT5-XXL |
| 低リソース言語NLP | XLM-V、または関連する高リソース言語でのドメイン特化ファインチューニング |

性能が重要なら、対象言語でのファインチューニング予算を必ず確保してください。ゼロショットは出発点であって、最終回答ではありません。

### トークン化税（低リソース言語で何が壊れるか）

多言語モデルは、すべての言語で1つのtokenizerを共有します。その語彙は、英語、フランス語、スペイン語、中国語、ドイツ語が支配的なコーパスで学習されています。支配的な集合の外にある言語では、3つの税が静かに積み重なります。

- **fertility tax。** 低リソース言語のテキストは、英語よりも1単語あたりはるかに多くのトークンに分割されます。ヒンディー語の文は、同等の英語文に比べて3-5倍のトークンを必要とすることがあります。その3-5倍が、コンテキストウィンドウ、学習効率、レイテンシを消費します。
- **variant recovery tax。** タイポ、ダイアクリティカルマークの変種、Unicode正規化の不一致、大文字小文字の揺れがすべて、埋め込み空間でコールドスタートの無関係な系列になります。ネイティブ話者には明らかな正書法上の対応を、モデルは学習できません。
- **capacity spillover tax。** 税1と2は、コンテキスト位置、層の深さ、埋め込み次元を消費します。実際の推論に残るものは、同じモデルで高リソース言語が得るものより体系的に小さくなります。

実務上の症状はこうです。モデルはヒンディー語で普通に学習し、loss curveは正しく見え、評価perplexityも妥当に見えます。それでも本番出力は微妙に間違っています。文の途中で形態論が崩れます。まれな屈折は回復できないままです。**壊れたtokenizerを、データ量だけで乗り越えることはできません。**

緩和策: 対象言語を十分にカバーするtokenizerを選びます（XLM-Vの1M-token語彙は直接的な修正です）。学習前にホールドアウトした対象テキストでtokenization fertilityを検証します。本当にロングテールな文字体系では、byte-level fallback（SentencePiece `byte_fallback=True`、GPT-2型のbyte-level BPE）を使い、何もOOVにならないようにします。

## 仕上げ

`outputs/skill-multilingual-picker.md` として保存します。

```markdown
---
name: multilingual-picker
description: 多言語NLPタスク向けに、ソース言語、対象モデル、評価計画を選ぶ。
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

要件（対象言語、タスク種別、言語ごとに利用可能なラベル付きデータ）が与えられたら、次を出力する。

1. ファインチューニング用のソース言語。デフォルトは英語。対象言語に類型的に近い高リソース言語がある場合は、LANGRANKまたはqWALSを確認する。
2. ベースモデル。XLM-R（分類）、mT5（生成）、NLLB（翻訳）、Aya-23（生成型LLM）。
3. few-shot予算。利用可能なら対象言語の例を100-500件から始める。ゼロショットはラベル付けが現実的でない場合だけにする。
4. 評価計画。言語別の精度（集計値ではない）、クロスリンガル一貫性、非ラテン文字体系でのエンティティレベルF1。

言語別評価なしに多言語モデルを出荷してはいけない。集計指標はロングテールの失敗を隠す。トークン化カバレッジが低い文字体系（アムハラ語、ティグリニャ語、多くのアフリカ諸語）は、byte-fallbackを持つモデル（byte_fallback=True の SentencePiece、または GPT-2 のようなバイトレベルtokenizer）が必要だと明示する。
```

## 演習

1. **Easy.** 英語、フランス語、ヒンディー語、アラビア語について、各言語10文でゼロショット分類pipelineを実行してください。それぞれの精度を報告します。フランス語は強く、ヒンディー語はまずまず、アラビア語はばらつくはずです。
2. **Medium.** `paraphrase-multilingual-MiniLM-L12-v2` を使って、小さな混合言語コーパス上にクロスリンガルretrieverを構築してください。英語でクエリし、任意の言語の文書を取得します。recall@5を測定します。
3. **Hard.** ヒンディー語分類タスクで、英語ソースとヒンディー語ソースのファインチューニングを比較してください。両方の設定で、few-shotファインチューニング用に対象言語の例を500件使います。どちらのソースがより良いヒンディー語精度を出したか、どれだけ差があるかを報告します。これはLANGRANKの主張を小さく再現したものです。

## 重要用語

| 用語 | 一般に言うこと | 実際の意味 |
|------|-----------------|-----------------------|
| Multilingual model | 1つのモデル、多くの言語 | 言語間で語彙とパラメータを共有する。 |
| Cross-lingual transfer | 1つの言語で学習し、別の言語で実行する | ソースでファインチューニングし、対象言語ラベルなしでターゲットを評価する。 |
| Zero-shot | 対象言語ラベルなし | 対象言語でファインチューニングせずに転移する。 |
| Few-shot | 少量の対象言語ラベル | ファインチューニングに使う対象言語の例100-500件。 |
| mBERT | 最初の多言語LM | Wikipediaで事前学習された104言語BERT。 |
| XLM-R | 標準的なクロスリンガルベースライン | CommonCrawlで事前学習された100言語RoBERTa。 |
| NLLB | Metaの200言語MT | No Language Left Behind。55の低リソース言語を含む。 |

## 参考文献

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) — XLM-Rの論文。
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) — クロスリンガル転移研究の流れを始めた分析論文。
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) — NLLB-200の論文。
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827) — Cohereの多言語LLM、Aya。
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) — qWALS / LANGRANKのソース言語に関する論文。
