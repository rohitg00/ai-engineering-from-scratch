# テキスト向けCNNとRNN

> 畳み込みはn-gramを学習する。再帰は記憶する。どちらもAttentionに置き換えられた。どちらも制約の厳しいハードウェアでは今でも重要だ。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**所要時間:** 約75分

## 問題

TF-IDFとWord2Vecは、語順を無視した平坦なベクトルを作った。それらの上に構築した分類器は、`dog bites man` と `man bites dog` を区別できない。語順が信号そのものを運ぶことがある。

Transformerが登場する前、この穴を埋めたアーキテクチャは大きく2系統あった。

**テキスト向け畳み込みネットワーク (TextCNN)。** 単語埋め込みの系列に1D畳み込みを適用する。幅3のフィルタは学習可能なtrigram検出器だ。3語にまたがってスコアを出す。幅を変えて (2, 3, 4, 5) 積み、複数スケールのパターンを検出する。max-poolで固定長表現にする。平坦、並列、高速。

**再帰ネットワーク (RNN, LSTM, GRU)。** トークンを1つずつ処理し、情報を前へ運ぶ隠れ状態を維持する。逐次的で、記憶を持ち、入力長に柔軟に対応する。2014年から2017年まで系列モデリングを支配し、その後Attentionが起きた。

このレッスンでは両方を作り、Attentionを必要にした失敗を名指しする。

## コンセプト

**TextCNN** (Kim, 2014)。トークンを埋め込みに変換する。幅 `k` の1D畳み込みが、連続する `k`-gramの埋め込み上をフィルタでスライドし、特徴マップを作る。そのマップに対するglobal max-poolingが最も強い活性化を選ぶ。複数のフィルタ幅から得たmax-pool済み出力を連結する。最後に分類ヘッドへ渡す。

なぜ動くのか。フィルタは学習可能なn-gramだ。max-poolingは位置不変なので、"not good" がレビューの冒頭にあっても中央にあっても同じ特徴を発火させる。フィルタ幅を3種類、各100フィルタにすれば、300個の学習済みn-gram検出器が得られる。訓練は並列で、逐次依存がない。

**RNN。** 各時刻 `t` で、隠れ状態は `h_t = f(W * x_t + U * h_{t-1} + b)` になる。`W`、`U`、`b` は時刻間で共有する。時刻 `T` の隠れ状態は、そこまでのprefix全体の要約である。分類では `h_1 ... h_T` に対してpooling (max、mean、last) する。

素のRNNは勾配消失に苦しむ。**LSTM** は、何を忘れ、何を保存し、何を出力するかを決めるゲートを追加し、長い系列を通した勾配を安定させる。**GRU** はLSTMを2つのゲートへ簡略化したものだ。より少ないパラメータで似た性能を出す。

**双方向RNN** は、一方のRNNを順方向に、もう一方を逆方向に走らせ、隠れ状態を連結する。各トークンの表現が左文脈と右文脈の両方を見る。タグ付けタスクでは不可欠だ。

## 作ってみる

### Step 1: PyTorchでTextCNN

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class TextCNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, n_classes, filter_widths=(2, 3, 4), n_filters=64, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.convs = nn.ModuleList([
            nn.Conv1d(embed_dim, n_filters, kernel_size=k)
            for k in filter_widths
        ])
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids).transpose(1, 2)
        pooled = []
        for conv in self.convs:
            c = F.relu(conv(x))
            p = F.max_pool1d(c, c.size(2)).squeeze(2)
            pooled.append(p)
        h = torch.cat(pooled, dim=1)
        return self.fc(self.dropout(h))
```

`nn.Conv1d` は中央の軸をチャネルとして扱うため、`transpose(1, 2)` は `[batch, seq_len, embed_dim]` を `[batch, embed_dim, seq_len]` に変形する。pooling後の出力は、入力長に関係なく固定長になる。

### Step 2: LSTM分類器

```python
class LSTMClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_classes, bidirectional=True, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=bidirectional)
        factor = 2 if bidirectional else 1
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_dim * factor, n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids)
        out, _ = self.lstm(x)
        pooled = out.max(dim=1).values
        return self.fc(self.dropout(pooled))
```

最後の状態ではなく、系列全体にmax-poolをかける。分類では、max-poolingはたいてい最後の隠れ状態だけを使うより良い。長い系列では末尾の情報が最後の状態を支配しやすいからだ。

### Step 3: 勾配消失デモ (直感)

ゲートを持たない素のRNNは、長距離依存を学習できない。おもちゃのタスクを考える。系列内のどこかにトークン `A` が現れたかを予測する。`A` が位置1にあり、系列長が100なら、損失からの勾配は再帰重みの99回の乗算をさかのぼる必要がある。重みが1未満なら勾配は消える。1を超えるなら爆発する。

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTMは、加算的な相互作用だけでネットワークを通る**cell state**によってこれを修正する。forget gateはそれを乗算的にスケールするが、それでも勾配は「高速道路」に沿って流れる。GRUは、より少ないパラメータで似たことをする。どちらも100ステップを超える系列で安定した訓練を可能にする。

### Step 4: それでも十分ではなかった理由

LSTMを使っても3つの問題が残った。

1. **逐次ボトルネック。** 長さ1000の系列でRNNを訓練するには、1000回の直列forward/backwardステップが必要になる。時間方向に並列化できない。
2. **encoder-decoder構成での固定長文脈ベクトル。** decoderは、入力全体を圧縮したencoderの最後の隠れ状態だけを見る。長い入力では詳細が失われる。レッスン09で直接扱う。
3. **遠距離依存における精度の上限。** LSTMは素のRNNを上回るが、それでも200ステップ以上にわたって特定の情報を伝播させるのは苦手だ。

Attentionはこの3つをすべて解いた。Transformerは再帰を完全に捨てた。レッスン10が転換点になる。

## 使ってみる

PyTorchの `nn.LSTM`、`nn.GRU`、`nn.Conv1d` は本番投入できる品質だ。訓練コードは標準的でよい。

Hugging Faceは、入力層として差し込める事前学習済み埋め込みを提供している。

```python
from transformers import AutoModel

encoder = AutoModel.from_pretrained("bert-base-uncased")
for param in encoder.parameters():
    param.requires_grad = False


class BertCNN(nn.Module):
    def __init__(self, n_classes, filter_widths=(2, 3, 4), n_filters=64):
        super().__init__()
        self.encoder = encoder
        self.convs = nn.ModuleList([nn.Conv1d(768, n_filters, kernel_size=k) for k in filter_widths])
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, input_ids, attention_mask):
        with torch.no_grad():
            out = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        x = out.transpose(1, 2)
        pooled = [F.max_pool1d(F.relu(conv(x)), kernel_size=conv(x).size(2)).squeeze(2) for conv in self.convs]
        return self.fc(torch.cat(pooled, dim=1))
```

制約に合うときに使うためのチェックリスト。

- **エッジ / オンデバイス推論。** GloVe埋め込みを使うTextCNNはTransformerより10〜100倍小さい。配布先がスマートフォンなら、この構成が候補になる。
- **ストリーミング / オンライン分類。** RNNはトークンを1つずつ処理する。Transformerは系列全体を必要とする。リアルタイムに流入するテキストでは、LSTMがまだ勝つ。
- **ベースライン用の小型モデル。** 新しいタスクで高速に反復できる。CPU上でもTextCNNを5分で訓練できる。
- **少量データでの系列ラベリング。** BiLSTM-CRF (レッスン06) は、1k〜10k件のラベル付き文に対して今でも本番級のNERアーキテクチャだ。

それ以外はTransformerへ行く。

## 提出物

`outputs/prompt-text-encoder-picker.md` として保存する。

```markdown
---
name: text-encoder-picker
description: 与えられた制約セットに合わせてテキストエンコーダのアーキテクチャを選ぶ。
phase: 5
lesson: 08
---

制約 (タスク、データ量、レイテンシ予算、配布先、計算予算) が与えられたら、次を出力する。

1. エンコーダアーキテクチャ: TextCNN、BiLSTM、BiLSTM-CRF、Transformer fine-tune、または「事前学習済みTransformerを凍結エンコーダとして使い、小さなヘッドを載せる」。
2. 埋め込み入力: ランダム初期化、凍結したGloVe / fastText、または文脈化Transformer埋め込み。
3. 5行の訓練レシピ: optimizer、learning rate、batch size、epochs、regularization。
4. 監視シグナルを1つ。RNN/CNNモデルでは、Attention機構がないため長距離依存を落とすことがある。系列長ごとの精度を確認する。Transformerでは、learning rateが高すぎる場合のfine-tuning collapseに注意し、train lossを確認する。

ラベル付き例が約500件未満のとき、TextCNN / BiLSTMベースラインが頭打ちになったことを示さずにTransformerのfine-tuningを推奨してはいけない。エッジ配布では、何より先にアーキテクチャ判断が必要だと指摘する。
```

## 演習

1. **易しい。** 3クラスのおもちゃデータセット (自分でデータを作る) でTextCNNを訓練する。フィルタ幅 (2, 3, 4) が、単一幅 (3) より平均F1で優れることを確認する。
2. **普通。** LSTM分類器にmax-pool、mean-pool、last-state poolingを実装する。小さなデータセットで比較し、どのpoolingが勝ったかを記録し、その理由を仮説として書く。
3. **難しい。** BiLSTM-CRF NERタガーを作る (レッスン06とこのレッスンを組み合わせる)。CoNLL-2003で訓練する。レッスン06のCRF単体ベースライン、およびBERT fine-tuneと比較する。訓練時間、メモリ、F1を報告する。

## 重要用語

| 用語 | よく言われる説明 | 実際の意味 |
|------|-----------------|-----------------------|
| TextCNN | テキスト向けCNN | 単語埋め込み上の1D畳み込みを重ね、global max-poolする構成。Kim (2014)。 |
| RNN | 再帰ネット | 各時刻で更新される隠れ状態: `h_t = f(W x_t + U h_{t-1})`。 |
| LSTM | ゲート付きRNN | input / forget / output gateとcell stateを追加する。長い系列でも安定して訓練できる。 |
| GRU | より単純なLSTM | 3つではなく2つのゲートを使う。似た精度で、パラメータが少ない。 |
| Bidirectional | 両方向 | 順方向RNNと逆方向RNNを連結する。各トークンが文脈の両側を見る。 |
| Vanishing gradient | 訓練信号が消える | 素のRNNで1未満の重みによる反復乗算が起こると、初期ステップへの勾配が実質ゼロになる。 |

## さらに読む

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) — TextCNNの論文。8ページで読みやすい。
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — LSTMの論文。意外なほど明快。
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) — LSTMを誰にでも分かりやすくした図解。
