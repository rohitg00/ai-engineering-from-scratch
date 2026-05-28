# Sequence-to-Sequence モデル

> 2つのRNNが翻訳機のふりをする。この方式がぶつかったボトルネックこそ、attentionが生まれた理由です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**所要時間:** 約75分

## 問題

分類は、可変長の系列を1つのラベルへ対応づけます。翻訳は、可変長の系列を別の可変長の系列へ対応づけます。入力と出力は異なる語彙、場合によっては異なる言語に属し、長さが一致する保証もありません。

seq2seqアーキテクチャ（Sutskever, Vinyals, Le, 2014）は、意図的に単純な手順でこれを解きました。2つのRNNです。片方がソース文を読み、固定サイズのcontext vectorを作ります。もう片方がそのベクトルを読み、ターゲット文をトークンごとに生成します。レッスン08で書いたのと同じコードを、違う形でつなぎ合わせただけです。

これを学ぶ価値は2つあります。第一に、context vectorのボトルネックは、NLPで最も教育的に役立つ失敗例です。attentionとtransformerが何に強いのかを動機づけてくれます。第二に、学習のレシピ（teacher forcing、scheduled sampling、推論時のbeam search）は、LLMを含む現代のあらゆる生成システムにもまだ当てはまります。

## コンセプト

**Encoder。** ソース文を読むRNNです。最後の隠れ状態が**context vector**、つまり入力全体の固定サイズ要約になります。ソース以外は何も失わない、という建前です。

**Decoder。** context vectorから初期化される別のRNNです。各ステップで直前に生成されたトークンを入力として受け取り、ターゲット語彙上の分布を出力します。サンプリングまたはargmaxで次のトークンを選びます。それを再び入力に戻します。`<EOS>`トークンが生成されるか、最大長に達するまで繰り返します。

**学習:** 各decoderステップでcross-entropy lossを計算し、系列全体で合計します。2つのネットワーク全体に対して、標準的なbackprop through timeを行います。

**Teacher forcing。** 学習中、ステップ`t`のdecoder入力には、decoder自身の直前予測ではなく、位置`t-1`の*正解*トークンを使います。これにより学習が安定します。使わない場合、序盤の誤りが連鎖してモデルは何も学べません。推論時にはモデル自身の予測を使う必要があるため、学習時と推論時の分布には必ずずれが生じます。このずれを**exposure bias**と呼びます。

**ボトルネック。** encoderがソースについて学んだすべての情報を、1つのcontext vectorに押し込む必要があります。長い文では細部が失われます。まれな単語はぼやけます。語順の入れ替え（chat noir vs. black cat）は、計算されるのではなく記憶される必要があります。

attention（レッスン10）は、decoderが最後の状態だけでなく、*すべての*encoder隠れ状態を見られるようにすることで、これを解決します。要点はそれだけです。

## 作ってみる

### Step 1: encoder

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs`のshapeは`[batch, seq_len, hidden_dim]`です。入力位置ごとに1つの隠れ状態があります。`hidden`のshapeは`[1, batch, hidden_dim]`で、最後のステップです。レッスン08では「分類のためにoutputsをpoolする」と説明しました。ここでは最後の隠れ状態をcontext vectorとして保持し、各ステップのoutputsは無視します。

### Step 2: decoder

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

decoderは1ステップずつ呼び出します。入力は、単一トークンのバッチと現在の隠れ状態です。出力は、次のトークンに対する語彙logitsと、更新された隠れ状態です。

### Step 3: teacher forcingを使った学習ループ

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

名前を付けておくべきつまみが2つあります。`ignore_index=0`はpadding token上のlossを無視します。`teacher_forcing_ratio`は、各ステップで真のトークンを使うか、モデルの予測を使うかの確率です。1.0（完全なteacher forcing）から始め、学習中に~0.5まで下げていくと、exposure biasのギャップを縮められます。

### Step 4: 推論ループ（greedy）

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

Greedy decodingは、各ステップで最も確率の高いトークンを選びます。これは簡単に道を外れます。一度あるトークンに決めると、それを取り消せません。**Beam search**は上位`k`個の部分系列を残し続け、最後に最もスコアの高い完成系列を選びます。beam widthは3-5が標準です。

### Step 5: ボトルネックを実演する

おもちゃのcopy taskでモデルを学習します。source `[a, b, c, d, e]`、target `[a, b, c, d, e]`です。系列長を伸ばして、accuracyを観察します。

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

単一のGRU隠れ状態は、40トークンの入力を損失なく記憶できません。情報はencoderの各ステップにありますが、decoderが見るのは最後の状態だけです。attentionはこれを直接解決します。

## 使ってみる

PyTorchには`nn.Transformer`と`nn.LSTM`ベースのseq2seqテンプレートがあります。Hugging Faceの`transformers`ライブラリには、数十億トークンで学習済みの完全なencoder-decoderモデル（BART、T5、mBART、NLLB）が含まれています。

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

現代のencoder-decoderは、RNNをtransformerに置き換えました。高レベルの形（encoder、decoder、トークンごとの生成）は、2014年のseq2seq論文と同じです。各ブロックの内側の仕組みが違うだけです。

### RNNベースのseq2seqをまだ使う場面

新規プロジェクトでは、ほぼありません。具体的な例外は次の通りです。

- 入力を1トークンずつ消費し、メモリを制限したいstreaming translation。
- transformerのメモリコストが許容できないon-device text generation。
- 教育目的。encoder-decoderのボトルネックを理解することが、transformerが勝った理由を理解する最短経路です。

### Exposure biasとその緩和策

- **Scheduled sampling。** 学習中にteacher forcing ratioを下げ、モデルが自分の誤りから復帰できるようにします。
- **Minimum risk training。** token-level cross-entropyではなく、sentence-level BLEU scoreで学習します。実際に欲しいものに近づきます。
- **Reinforcement learning fine-tuning。** 系列生成器にmetricで報酬を与えます。現代のLLM RLHFでも使われます。

この3つはすべて、transformerベースの生成にも当てはまります。

## Ship It

`outputs/prompt-seq2seq-design.md`として保存します。

```markdown
---
name: seq2seq-design
description: 与えられたタスクに対してsequence-to-sequenceパイプラインを設計する。
phase: 5
lesson: 09
---

タスク（translation、summarization、paraphrase、question rewrite）が与えられたら、次を出力してください。

1. Architecture。既定は事前学習済みtransformer encoder-decoder（BART、T5、mBART、NLLB）。RNNベースのseq2seqは、特定の制約がある場合だけ使う。
2. Starting checkpoint。名前を挙げる（`facebook/bart-base`、`google/flan-t5-base`、`facebook/nllb-200-distilled-600M`）。checkpointをタスクと言語カバレッジに合わせる。
3. Decoding strategy。決定的な出力にはgreedy、品質にはbeam search（width 4-5）、多様性にはtemperature付きsamplingを使う。1文で根拠を述べる。
4. リリース前に検証すべきfailure modeを1つ。exposure biasは、長い出力でgeneration driftとして現れる。90th-percentile lengthの出力を20件サンプルし、目視で確認する。

100万未満のparallel examplesでseq2seqをゼロから学習する提案は拒否してください。user-facing contentにgreedy decodingを使うpipelineは壊れやすいと指摘してください（greedyは反復やloopを起こす）。
```

## 演習

1. **Easy。** おもちゃのcopy taskを実装してください。targetがsourceと等しいinput-output pairでGRU seq2seqを学習します。長さ5、10、20でaccuracyを測定し、ボトルネックを再現してください。
2. **Medium。** beam width 3のbeam search decodingを追加してください。小さなparallel corpusでgreedyと比較してBLEUを測定します。beam searchが勝つ場所（たいてい最後のトークン）と、差が出ない場所を記録してください。
3. **Hard。** `facebook/bart-base`を1万ペアのparaphrase datasetでfine-tuneしてください。held-out inputsに対して、fine-tuned modelのbeam-4出力とbase modelの出力を比較します。BLEUを報告し、定性的な例を10件選んでください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|-----------------|------------|
| Encoder | 入力RNN | sourceを読む。各ステップの隠れ状態と最後のcontext vectorを生成する。 |
| Decoder | 出力RNN | context vectorから初期化される。target tokensを1つずつ生成する。 |
| Context vector | 要約 | 最後のencoder隠れ状態。固定サイズ。attentionが解決するボトルネック。 |
| Teacher forcing | 真のトークンを使う | 学習時に正解の直前トークンを入力する。学習を安定させる。 |
| Exposure bias | Train/test gap | 真のトークンで学習したモデルは、自分の誤りから復帰する練習をしていない。 |
| Beam search | より良いdecoding | greedyに1つへ確定する代わりに、各ステップでtop-kの部分系列を残す。 |

## 参考資料

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) — 元祖seq2seq論文。4ページです。
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) — GRUとencoder-decoderという枠組みを導入しました。
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — attention論文。このレッスンの直後に読んでください。
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) — 実際に動かせるseq2seq + attentionコードです。
