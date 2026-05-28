# 機械翻訳

> 翻訳は、30 年にわたって NLP 研究を支え、今も支え続けているタスクである。

**種類:** Build
**言語:** Python
**前提:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**時間:** 約 75 分

## 問題

モデルはある言語の文を読み、別の言語の文を生成する。長さは変わる。語順も変わる。ある原文語が複数の訳語に対応することもあれば、その逆もある。慣用句は 1 対 1 の対応を拒む。"I miss you" はフランス語では "tu me manques"、直訳すれば「あなたが私に欠けている」になる。単語単位のアラインメントはここでは成立しない。

機械翻訳は、NLP に encoder-decoder、attention、transformer、そして最終的には LLM というパラダイム全体を発明させたタスクだった。前進は常に、翻訳品質を測定でき、人間と機械の差がしぶとく残り続けたからこそ生まれた。

このレッスンでは歴史の講義は省き、2026 年時点の実務パイプラインを扱う。事前学習済み多言語 encoder-decoder (NLLB-200 または mBART)、subword tokenization、beam search、BLEU と chrF による評価、そして今でも本番にすり抜ける代表的な失敗モードを学ぶ。

## コンセプト

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

現代の MT は、並列テキストで学習された transformer encoder-decoder である。encoder は原文をその言語の tokenization で読む。decoder は encoder の出力を cross-attention (レッスン 10) 経由で使いながら、訳文を subword 単位で 1 つずつ生成する。decoding では貪欲 decoding の落とし穴を避けるために beam search を使う。出力は detokenize、detruecase され、参照訳と照合して採点される。

現実の MT 品質を左右する運用上の選択は 3 つある。

- **Tokenizer。** 多言語混合コーパスで学習した SentencePiece BPE。言語間で語彙を共有することが、NLLB の zero-shot 言語ペアを可能にしている。
- **モデルサイズ。** NLLB-200 distilled 600M はノート PC に載る。NLLB-200 3.3B は公開されている本番向けデフォルト。54.5B は研究上限に近い。
- **Decoding。** 一般的なコンテンツでは beam width 4-5。短すぎる出力を避けるために length penalty を使う。用語の一貫性が必要な場合は constrained decoding を使う。

## 作ってみる

### ステップ 1: 事前学習済み MT の呼び出し

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

ここで重要なことは 3 つある。`src_lang` は、どの文字体系と分割方法を tokenizer に適用させるかを指定する。`forced_bos_token_id` は、decoder にどの言語を生成させるかを指定する。どちらも NLLB 固有の仕組みであり、mBART や M2M-100 はそれぞれ独自の規約を使うため、相互に入れ替えられない。

### ステップ 2: BLEU と chrF

BLEU は、出力と参照訳の n-gram overlap を測る。参照 n-gram は 4 種類 (1-4)、precision の幾何平均、短すぎる出力への brevity penalty で構成される。スコアは [0, 100]。広く使われているが、解釈は厄介だ。30 BLEU は「使える」、40 は「良い」、50 は「例外的」と見なされることが多く、1 BLEU 未満の差はノイズである。

chrF は文字レベルの F-score を測る。BLEU が一致を過小評価しやすい、形態変化の多い言語に対してより敏感である。BLEU と並べて報告されることが多い。

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

必ず `sacrebleu` を使うこと。tokenization を正規化するため、論文間でスコアを比較できる。BLEU を自作すると、誤解を招く benchmark が生まれる。

### 3 層の評価階層 (2026)

現代の MT 評価では、相補的な 3 種類の metric family を使う。本番投入では少なくとも 2 種類を使う。

- **Heuristic** (BLEU, chrF)。高速で、参照訳ベース、解釈しやすいが、言い換えには鈍感。過去比較と regression 検知に使う。
- **Learned** (COMET, BLEURT, BERTScore)。人間評価で学習した neural model。翻訳と原文・参照訳の semantic similarity を比較する。COMET は 2023 年以降の MT 研究で最も強く使われており、品質が重要な 2026 年の本番デフォルトである。
- **LLM-as-judge** (reference-free)。大規模モデルに fluency、adequacy、tone、cultural appropriateness を採点させる。rubric が適切に設計されていれば、GPT-4-as-judge は約 80% のケースで人間との合意に達する。参照訳がない open-ended content に使う。

実務的な 2026 年スタックは、BLEU と chrF に `sacrebleu`、COMET に `unbabel-comet`、最後の人間向けシグナルにプロンプト付き LLM を使う構成である。本番データで信頼する前に、すべての metric を 50-100 件の人手ラベル付き例で calibration する。

Reference-free metric (COMET-QE, BLEURT-QE, LLM-as-judge) を使うと参照訳なしで翻訳を評価できる。これは、参照訳が存在しない long-tail language pair で重要になる。

### ステップ 3: 本番で壊れるもの

上の実用パイプラインは 80% のケースで流暢に翻訳し、残り 20% では静かに失敗する。名前を付けるべき失敗モードは次の通り。

- **Hallucination。** モデルが原文にない内容を作り出す。未知のドメイン語彙でよく起きる。症状は、出力は流暢だが原文が述べていない事実を主張すること。対策は、ドメイン用語に対する constrained decoding、規制対象コンテンツの人手 review、入力より極端に長い出力の監視。
- **Off-target generation。** モデルが誤った言語に翻訳する。NLLB は希少な言語ペアで意外にこれを起こしやすい。対策は、`forced_bos_token_id` を確認し、出力に対して常に language-ID model check を行ってから decode 結果を返すこと。
- **Terminology drift。** "Sign up" が doc 1 では "s'inscrire"、doc 2 では "créer un compte" になる。UI テキストやユーザー向け文字列では、生の品質より一貫性が重要である。対策は glossary-constrained decoding または post-edit dictionary。
- **Formality mismatch。** フランス語の "tu" と "vous"、日本語の敬体レベルなど。モデルは学習中により多かった形式を選ぶ。顧客向けコンテンツではたいてい不適切になる。対策は、モデルが対応していれば formality token を prefix として与えるか、formal-only corpus で小さなモデルを fine-tune すること。
- **短い入力での length explosion。** 非常に短い入力文では、source token が約 5 未満になると length penalty が急に効かなくなり、過長な翻訳が出やすい。対策は、原文長に比例した hard max-length cap を設定すること。

### ステップ 4: ドメイン向け fine-tuning

事前学習済みモデルは generalist である。法律、医療、ゲーム会話の翻訳では、ドメインの並列データで fine-tune すると測定可能な改善が出る。レシピは特殊ではない。

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

数千件の高品質な並列例は、数十万件のノイズだらけの web-scraped 例に勝る。学習データの品質は、本番で最も大きく効くレバーである。

## 使ってみる

2026 年の MT 本番スタック:

| ユースケース | 推奨される出発点 |
|---------|---------------------------|
| Any-to-any、200 言語 | `facebook/nllb-200-distilled-600M` (ノート PC) または `nllb-200-3.3B` (本番) |
| 英語中心、高品質、50 言語 | `facebook/mbart-large-50-many-to-many-mmt` |
| 短い実行、安価な推論、英仏/英独/英西 | Helsinki-NLP / Marian models |
| latency-critical な browser-side | ONNX-quantized Marian (約 50 MB) |
| 最高品質、コストを許容 | GPT-4 / Claude / Gemini with translation prompts |

2026 年時点では、特に慣用表現を含むコンテンツや長い文脈において、LLM はいくつかの言語ペアで専用 MT モデルを上回る。トレードオフは token 単価と latency である。context length、文体の一貫性、prompting による domain adaptation が throughput より重要な場合は LLM を選ぶ。

## 出荷する

`outputs/skill-mt-evaluator.md` として保存する:

```markdown
---
name: mt-evaluator
description: 出荷前に機械翻訳出力を評価する。
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

原文テキストと翻訳候補が与えられたら、次を出力する:

1. 自動スコアの推定。期待される BLEU と chrF の範囲。参照訳が利用可能かどうかを明記する。
2. 人間が検証できる 5 点チェックリスト: (a) 内容保持 (hallucination なし)、(b) 正しい言語、(c) register / formality の一致、(d) glossary が提供されている場合は用語の一貫性、(e) truncation や length explosion がないこと。
3. 調べるべきドメイン固有の問題を 1 つ。例: 法律なら named entities と statute citations。医療なら drug names と dosages。UI なら placeholder variables `{name}`。
4. 信頼度フラグ。"Ship" / "Ship with review" / "Do not ship"。step 2 で見つかった問題の深刻度に結び付ける。

出力に対する language-ID check なしで翻訳を出荷してはならない。ユーザーが reference-free scoring (COMET-QE, BLEURT-QE) を明示的に選択しない限り、参照訳なしで評価してはならない。1000 tokens を超えるコンテンツは chunked translation が必要になりやすいものとして flag する。
```

## 演習

1. **初級。** `nllb-200-distilled-600M` を使い、5 文の英語段落をフランス語に翻訳し、さらに英語に戻す。round-trip が元文にどれくらい近いかを測る。語選択の drift はあるが意味は保たれるはずである。
2. **中級。** `fasttext lid.176` または `langdetect` を使って、翻訳出力に対する language-ID check を実装する。MT 呼び出しに組み込み、off-target generation が返る前に捕捉されるようにする。
3. **上級。** 任意のドメインで 5,000 ペアの corpus を用意し、`nllb-200-distilled-600M` を fine-tune する。fine-tuning 前後で held-out set の BLEU を測る。どの種類の文が改善し、どれが悪化したかを報告する。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| BLEU | 翻訳スコア | brevity penalty 付きの n-gram precision。[0, 100]。 |
| chrF | Character F-score | 文字レベルの F-score。形態変化の多い言語でより敏感。 |
| NMT | Neural MT | 並列テキストで学習した transformer encoder-decoder。2017 年以降のデフォルト。 |
| NLLB | No Language Left Behind | Meta の 200 言語対応 MT モデルファミリー。 |
| Constrained decoding | 制御された出力 | 特定の token または n-gram を出力に出現させる / 出現させないよう強制する。 |
| Hallucination | 作り出された内容 | 原文に裏付けられていないモデル出力。 |

## 参考文献

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) — NLLB 論文。
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) — BLEU を報告する唯一の正しい方法が `sacrebleu` である理由。
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) — chrF 論文。
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) — 実践的な fine-tuning walkthrough。
