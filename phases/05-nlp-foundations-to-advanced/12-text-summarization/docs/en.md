# テキスト要約

> 抽出的システムは、文書が何を述べたかを伝える。抽象的システムは、著者が何を意味したかを伝える。別のタスクであり、落とし穴も別である。

**種類:** Build
**言語:** Python
**前提:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**時間:** 約 75 分

## 問題

2,000 語のニュース記事が feed に流れてくる。それを 120 語で要点が伝わるようにしたい。記事から最も重要な 3 文を選ぶこともできる (extractive) し、内容を自分の言葉で書き直すこともできる (abstractive)。どちらも要約と呼ばれるが、完全に異なる問題である。

Extractive summarization は ranking 問題である。すべての文に score を付け、上位 `k` 件を返す。出力は原文からそのまま抜き出されるため常に文法的である。リスクは、記事全体に分散している内容を取り落とすことだ。

Abstractive summarization は generation 問題である。transformer が入力に条件付けられた新しいテキストを生成する。出力は流暢で圧縮的だが、原文にない事実を hallucinate することがある。リスクは、自信に満ちた捏造である。

このレッスンでは両方を作り、それぞれ固有の失敗モードを扱う。

## コンセプト

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive。** 記事を graph として扱う。node は文、edge は類似度である。その graph 上で PageRank あるいはそれに近いものを走らせ、各文が他の文とどれだけつながっているかで score を付ける。score の高い文が要約になる。標準的な実装は **TextRank** (Mihalcea and Tarau, 2004) である。

**Abstractive。** transformer encoder-decoder (BART, T5, Pegasus) を document-summary pair で fine-tune する。推論時には、モデルが文書を読み、cross-attention を通じて summary を token-by-token で生成する。特に Pegasus は gap-sentence pretraining objective を使っており、あまり fine-tuning しなくても要約に強い。

評価には **ROUGE** (Recall-Oriented Understudy for Gisting Evaluation) を使う。ROUGE-1 と ROUGE-2 は unigram と bigram の overlap を score にする。ROUGE-L は longest common subsequence を score にする。高いほどよいが、40 ROUGE-L は「良い」、50 は「例外的」である。すべての論文がこの 3 つを報告する。`rouge-score` package を使う。

## 作ってみる

### ステップ 1: TextRank (extractive)

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

ここで名前を付けておくべきことが 2 つある。similarity function は log-normalized word overlap を使っており、これは元の TextRank variant である。TF-IDF vector の cosine を使ってもよい。damping factor 0.85 と iteration count は PageRank の default である。

### ステップ 2: BART による abstractive summarization

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN は CNN/DailyMail corpus で fine-tune されている。ニュース風の要約をそのまま生成できる。別ドメイン (scientific papers、dialog、legal) では、対応する Pegasus checkpoint を使うか、target data で fine-tune する。

### ステップ 3: ROUGE 評価

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

必ず stemming を使うこと。使わないと "running" と "run" が別語として数えられ、ROUGE が一致を過小評価する。

### ROUGE を超えて (2026 年の要約評価)

ROUGE は 20 年にわたり要約 metric の中心だったが、2026 年には単独では不十分である。NLG 論文の大規模 meta-analysis は次のことを示した。

- **BERTScore** (contextual embedding similarity) は 2023 年までに採用が広がり、現在では多くの要約論文で ROUGE と並んで報告される。
- **BARTScore** は評価を generation として扱う。source が与えられたとき、pretrained BART が summary にどれだけ高い likelihood を割り当てるかで score を付ける。
- **MoverScore** (contextual embedding 上の Earth Mover's Distance) は semantic overlap を ROUGE よりうまく捉えるため、2025 年の要約 benchmark で最上位に達した。
- **FactCC** と **QA-based faithfulness** は 2021-2023 年に一般的だったが、現在は **G-Eval** (coherence、consistency、fluency、relevance を chain-of-thought reasoning で採点する GPT-4 prompt chain) に置き換えられることが多い。
- **G-Eval** と類似の LLM-judge 手法は、rubric が適切に設計されていれば約 80% のケースで人間評価と一致する。

本番での推奨は、過去比較に ROUGE-L、semantic overlap に BERTScore、coherence と factuality に G-Eval を報告すること。50-100 件の人手ラベル付き要約に対して calibration する。

### ステップ 4: factuality 問題

Abstractive summary は hallucination を起こしやすい。Extractive summary は原文からそのまま抜き出すため hallucination risk はかなり低いが、source sentence が文脈から切り離されていたり、古かったり、引用の順序が変わったりすると、それでも誤解を招くことはある。これは、compliance-adjacent content で本番システムが今でも extractive methods を好む最大の理由である。

名前を付けるべき hallucination の種類:

- **Entity swap。** Source は "John Smith" と言っているのに、summary は "John Brown" と言う。
- **Number drift。** Source は "25,000" と言っているのに、summary は "25 million" と言う。
- **Polarity flip。** Source は "rejected the offer" と言っているのに、summary は "accepted the offer" と言う。
- **Fact invention。** Source は CEO に触れていないのに、summary は CEO が承認したと言う。

有効な評価アプローチ:

- **FactCC。** source sentence と summary sentence の entailment で学習された binary classifier。factual / not-factual を予測する。
- **QA-based factuality。** source に答えがある質問を QA model に尋ねる。summary が別の答えを支持する場合は flag する。
- **Entity-level F1。** source と summary の named entities を比較する。summary にだけ存在する entity は疑わしい。

factuality が重要なユーザー向け用途 (news、medical、legal、financial) では、extractive がより安全な default である。Abstractive では factuality check を loop に入れる必要がある。

## 使ってみる

2026 年のスタック:

| ユースケース | 推奨 |
|---------|-------------|
| News、3-5 文要約、英語 | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` または tuned T5 |
| Multi-document、long-form | 32k+ context を持つ任意の LLM、prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive、構造上 hallucination risk が低い | TextRank または `sumy` の LSA / LexRank |

2026 年には、compute が制約でなければ long context LLM が専用モデルを上回ることが多い。トレードオフは cost と reproducibility であり、専用モデルはより一貫した出力を返す。

## 出荷する

`outputs/skill-summary-picker.md` として保存する:

```markdown
---
name: summary-picker
description: extractive か abstractive かを選び、library 名と factuality check を示す。
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

task (document type、compliance requirement、length、compute budget) が与えられたら、次を出力する:

1. 方法。Extractive または abstractive。理由を 1 文で説明する。
2. 出発点となる model / library。名前を挙げる。`sumy.TextRankSummarizer`、`facebook/bart-large-cnn`、`google/pegasus-pubmed`、または LLM prompt。
3. 評価計画。ROUGE-1、ROUGE-2、ROUGE-L (`rouge-score` with stemming を使う)。abstractive の場合は factuality check も加える。
4. 調べるべき failure mode を 1 つ。abstractive news summarization で最も一般的なのは entity swap である。source entities が summary に現れない sample を flag する。

medical、legal、financial、regulated content では、factuality gate なしに abstractive summarization を使ってはならない。input が model の context window を超える場合は、単なる truncation ではなく chunked map-reduce summarization が必要だと flag する。
```

## 演習

1. **初級。** 5 本のニュース記事に TextRank を実行する。top-3 sentences を reference summary と比較し、ROUGE-L を測る。CNN/DailyMail 風の記事では 30-45 ROUGE-L になるはずである。
2. **中級。** entity-level factuality を実装する。source と summary から named entities を抽出し (spaCy)、summary に含まれる source entities の recall と、source に対する summary entities の precision を計算する。高 precision かつ低 recall は安全だが簡潔すぎることを意味し、低 precision は hallucinated entities を意味する。
3. **上級。** 50 本の CNN/DailyMail 記事で BART-large-CNN と LLM (Claude または GPT-4) を比較する。ROUGE-L、factuality (entity F1)、summary あたりの cost を報告する。それぞれがどこで勝つかを文書化する。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Extractive | 文を選ぶ | source から文をそのまま返す。hallucination は起こさない。 |
| Abstractive | 書き直す | source に条件付けて新しいテキストを生成する。hallucination しうる。 |
| ROUGE | 要約 metric | system output と reference の n-gram / LCS overlap。 |
| TextRank | Graph-based extractive | 文類似度 graph 上の PageRank。 |
| Factuality | 正しいか | summary の主張が source に裏付けられているか。 |
| Hallucination | 作り話の内容 | source が裏付けていない summary 内の内容。 |

## 参考文献

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) — extractive の標準的な論文。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) — BART 論文。
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) — Pegasus と gap-sentence objective。
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) — ROUGE 論文。
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) — factuality landscape 論文。
