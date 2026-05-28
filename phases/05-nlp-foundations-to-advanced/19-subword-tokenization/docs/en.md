# サブワードトークン化 — BPE, WordPiece, Unigram, SentencePiece

> 単語単位のトークナイザは未知語で詰まります。文字単位のトークナイザはシーケンス長を爆発させます。サブワードトークナイザはその中間を取ります。現代のLLMはどれもこれを使っています。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 5 · 01 (Text Processing), Phase 5 · 04 (GloVe / FastText / Subword)
**所要時間:** ~60分

## 問題

語彙が50,000語あるとします。ユーザーが `"untokenizable"` と入力しました。トークナイザは `[UNK]` を返します。これでモデルは、その単語に関する手がかりを何も得られません。さらに悪いことに、コーパス内の90パーセンタイルの文書にレア語が40個含まれているなら、文書ごとに40ビット分の情報を落としていることになります。

サブワードトークン化はこの問題を解きます。一般的な単語は1トークンのままです。レア語は意味のある部品に分解されます。`untokenizable` → `un`, `token`, `izable`。どんな文字列も最終的にはバイト列として表せるため、学習データはあらゆる入力をカバーできます。

2026年時点のフロンティアLLMはすべて、3つのアルゴリズムのいずれか（BPE, Unigram, WordPiece）を使い、3つのライブラリのいずれか（tiktoken, SentencePiece, HF Tokenizers）で包まれています。言語モデルを出荷するなら、必ずどれかを選ぶ必要があります。

## コンセプト

![BPE・Unigram・WordPieceを文字単位で比較](../assets/subword-tokenization.svg)

**BPE (Byte-Pair Encoding)。** 文字レベルの語彙から始めます。隣接するすべてのペアを数えます。最も頻度の高いペアを新しいトークンにマージします。目標語彙サイズに達するまで繰り返します。GPT-2/3/4, Llama, Gemma, Qwen2, Mistralで使われる主流アルゴリズムです。

**Byte-level BPE。** 同じアルゴリズムですが、Unicode文字ではなく生のバイト（256個の基本トークン）上で動きます。`[UNK]` トークンがゼロであることを保証します。どんなバイト列でもエンコードできるからです。GPT-2は50,257トークン（256バイト + 50,000マージ + 1特殊トークン）を使います。

**Unigram。** 巨大な語彙から始めます。各トークンにUnigram確率を割り当てます。取り除いてもコーパスの対数尤度を最も悪化させないトークンを反復的に刈り込みます。推論時に確率的に扱えるため、トークン化をサンプリングできます（subword regularizationによるデータ拡張に有用）。T5, mBART, ALBERT, XLNet, Gemmaで使われます。

**WordPiece。** 生の頻度ではなく、学習コーパスの尤度を最大化するペアをマージします。BERT, DistilBERT, ELECTRAで使われます。

**SentencePiece vs tiktoken。** SentencePieceは、生のUnicodeテキストから直接語彙（BPEまたはUnigram）を*学習*するライブラリで、空白を `▁` としてエンコードします。tiktokenは、事前構築済み語彙に対するOpenAIの高速*エンコーダ*です。学習は行いません。

目安:

- **新しい語彙を学習する:** SentencePiece（多言語、事前トークン化不要）またはHF Tokenizers。
- **GPT語彙で高速推論する:** tiktoken（cl100k_base, o200k_base）。
- **両方が必要:** HF Tokenizers。1つのライブラリで学習とサービングを扱えます。

## 作る

### Step 1: BPEをスクラッチから実装する

`code/main.py` を見てください。ループは次の通りです。

```python
def train_bpe(corpus, num_merges):
    vocab = {tuple(word) + ("</w>",): count for word, count in corpus.items()}
    merges = []
    for _ in range(num_merges):
        pairs = Counter()
        for symbols, freq in vocab.items():
            for a, b in zip(symbols, symbols[1:]):
                pairs[(a, b)] += freq
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        vocab = apply_merge(vocab, best)
    return merges
```

このアルゴリズムには3つの事実が埋め込まれています。`</w>` は単語末を示すため、`"low"`（接尾辞）と `"lower"`（接頭辞）を区別できます。頻度で重み付けするため、高頻度のペアほど早く勝ちます。マージリストには順序があります。推論時は学習時の順序でマージを適用します。

### Step 2: 学習したマージでエンコードする

```python
def encode_bpe(word, merges):
    symbols = list(word) + ["</w>"]
    for a, b in merges:
        i = 0
        while i < len(symbols) - 1:
            if symbols[i] == a and symbols[i + 1] == b:
                symbols = symbols[:i] + [a + b] + symbols[i + 2:]
            else:
                i += 1
    return symbols
```

素朴には O(n·|merges|) です。本番実装（tiktoken, HF Tokenizers）は、優先度付きキューとmerge-rank lookupを使い、ほぼ線形時間で動きます。

### Step 3: 実務でSentencePieceを使う

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="my_tokenizer",
    vocab_size=8000,
    model_type="bpe",          # or "unigram"
    character_coverage=0.9995, # lower for CJK (e.g. 0.9995 for English, 0.995 for Japanese)
    normalization_rule_name="nmt_nfkc",
)

sp = spm.SentencePieceProcessor(model_file="my_tokenizer.model")
print(sp.encode("untokenizable", out_type=str))
# ['▁un', 'token', 'izable']
```

注目点は、事前トークン化が不要であること、空白が `▁` としてエンコードされること、`character_coverage` がレア文字をどの程度保持し、どの程度 `<unk>` に写すかを制御することです。

### Step 4: OpenAI互換語彙にtiktokenを使う

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

エンコード専用です。高速です（Rust backend）。バイト数の計算、コスト見積もり、コンテキストウィンドウの予算管理で、GPT-4/5のトークン化と正確に一致します。

## 2026年でも本番で起きる落とし穴

- **Tokenizer drift。** 語彙Aで学習し、語彙Bでデプロイするケースです。トークンIDが変わり、モデル出力が壊れます。CIで `tokenizer.json` のハッシュを確認してください。
- **空白の曖昧さ。** BPEでは `"hello"` と `" hello"` が別トークンになります。`add_special_tokens` と `add_prefix_space` は必ず明示してください。
- **多言語の学習不足。** 英語に偏ったコーパスで作った語彙は、非ラテン文字体系を5〜10倍多いトークンに分割します。GPT-3.5では、同じプロンプトでも日本語やアラビア語だと5〜10倍高くつきます。o200k_baseではこの問題が一部改善されています。
- **絵文字の分割。** 1つの絵文字が5トークンになることがあります。コンテキスト予算を見積もるときは、絵文字の扱いを必ず確認してください。

## 使う

2026年のスタック:

| 状況 | 選ぶもの |
|-----------|------|
| 単一言語モデルをスクラッチから学習する | HF Tokenizers (BPE) |
| 多言語モデルを学習する | SentencePiece (Unigram, `character_coverage=0.9995`) |
| OpenAI互換APIを提供する | tiktoken (`o200k_base`、GPT-4+向け) |
| ドメイン固有語彙（コード、数学、タンパク質） | ドメインコーパスでカスタムBPEを学習し、ベース語彙とマージする |
| エッジ推論、小型モデル | Unigram（小さい語彙でうまく働きやすい） |

語彙サイズは定数ではなく、スケーリング上の意思決定です。おおまかなヒューリスティックは、1B未満のパラメータなら32k、1〜10Bなら50〜100k、多言語またはフロンティアモデルなら200k以上です。

## Ship It

`outputs/skill-bpe-vs-wordpiece.md` として保存します。

```markdown
---
name: tokenizer-picker
description: 与えられたコーパスとデプロイ対象に対して、トークナイザのアルゴリズム、語彙サイズ、ライブラリを選ぶ。
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

コーパス（サイズ、言語、ドメイン）とデプロイ対象（スクラッチからの学習 / fine-tuning / API互換推論）が与えられたら、次を出力してください。

1. アルゴリズム。BPE, Unigram, WordPieceのいずれか。理由を1文で述べる。
2. ライブラリ。SentencePiece, HF Tokenizers, tiktokenのいずれか。理由も述べる。
3. 語彙サイズ。最も近い1k単位に丸める。モデルサイズと言語カバレッジに結びつけて理由を述べる。
4. カバレッジ設定。`character_coverage`, `byte_fallback`, special tokenの一覧。
5. 検証計画。held-out setでの平均tokens-per-word、OOV率、圧縮率、round-trip decodeの一致。

レアな文字体系を含むコーパスに対して、character-coverage <0.995 のトークナイザを学習することは拒否してください。CIで凍結済み `tokenizer.json` ハッシュチェックがない語彙の出荷は拒否してください。単一言語トークナイザで語彙が16k未満なら、仕様不足の可能性が高いと警告してください。
```

## 演習

1. **Easy。** `code/main.py` の小さなコーパスで500マージのBPEを学習してください。held-outの単語を3つエンコードします。ちょうど1トークンになったものと、2トークン以上になったものはそれぞれいくつでしたか。
2. **Medium。** 英語版Wikipediaの100文について、`cl100k_base`、`o200k_base`、vocab=32kで学習したSentencePiece BPEのトークン数を比較してください。それぞれの圧縮率を報告してください。
3. **Hard。** 同じコーパスでBPE、Unigram、WordPieceを学習してください。それぞれを小さな感情分類器で使い、下流精度を測定します。選択によってF1が1ポイント以上動きますか。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| BPE | Byte-Pair Encoding | 最も頻度の高い文字ペアを、目標語彙サイズに達するまで貪欲にマージする。 |
| Byte-level BPE | 未知トークンが絶対に出ない | 生の256バイト上で行うBPE。GPT-2 / Llamaが使っている。 |
| Unigram | 確率的トークナイザ | 大きな候補集合から対数尤度を使って刈り込む。T5, Gemmaで使われる。 |
| SentencePiece | 空白を扱うやつ | 生テキスト上でBPE/Unigramを学習するライブラリ。空白は `▁` としてエンコードされる。 |
| tiktoken | 高速なやつ | 事前構築済み語彙向けの、OpenAIのRust-backed BPEエンコーダ。学習はしない。 |
| Merge list | 魔法の数字 | `(a, b) → ab` マージの順序付きリスト。推論時は順に適用する。 |
| Character coverage | どこまでレアならレアすぎるのか | トークナイザがカバーすべき学習コーパス内文字の割合。典型値は約0.9995。 |

## 参考文献

- [Sennrich, Haddow, Birch (2015). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) — BPEの論文。
- [Kudo (2018). Subword Regularization with Unigram Language Model](https://arxiv.org/abs/1804.10959) — Unigramの論文。
- [Kudo, Richardson (2018). SentencePiece: A simple and language independent subword tokenizer](https://arxiv.org/abs/1808.06226) — ライブラリ。
- [Hugging Face — Summary of the tokenizers](https://huggingface.co/docs/transformers/tokenizer_summary) — 簡潔なリファレンス。
- [OpenAI tiktoken repo](https://github.com/openai/tiktoken) — cookbookとencoding一覧。
