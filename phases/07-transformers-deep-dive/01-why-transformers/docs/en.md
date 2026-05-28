# なぜ Transformers なのか — RNN の問題点

> RNN はトークンを 1 つずつ処理します。Transformer はすべてのトークンを一度に処理します。この 1 つのアーキテクチャ上の賭けが、2017 年以降のディープラーニングにおけるあらゆるスケーリング曲線を変えました。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 3 (Deep Learning Core), Phase 5 · 09 (Sequence-to-Sequence), Phase 5 · 10 (Attention Mechanism)
**所要時間:** 約 45 分

## 問題

2017 年以前、言語、翻訳、音声など、世界中の最先端シーケンスモデルはすべて再帰型ニューラルネットワークでした。LSTM と GRU は、翻訳における ImageNet 相当のベンチマークを約 5 年間勝ち続けていました。当時はそれが唯一の道具でした。

しかし、そこには 3 つの致命的な弱点がありました。逐次計算では時間軸方向に並列化できません。トークン `t+1` はトークン `t` の隠れ状態を必要とするからです。1,024 トークンの系列は、1 サイクルで 1,000,000 回の浮動小数点演算ができる GPU 上でも、1,024 回の直列ステップを意味しました。並列処理のために設計されたハードウェア上で、学習の実時間は系列長に対して線形に伸びていました。

勾配消失により、50 トークン前の情報はすでに 50 個の非線形変換を通って圧縮されていました。ゲート付き再帰ユニット（LSTM、GRU）はこの圧迫を和らげましたが、完全には取り除けませんでした。「去年の夏に京都行きの飛行機で読んだ本は...」のような長距離依存は、日常的に失敗していました。

固定幅の隠れ状態は、デコーダが何かを見る前に、エンコーダがソース系列全体を 1 つのベクトルへ押し込むことを意味しました。ソースが 5 トークンでも 500 トークンでも関係ありません。ボトルネックの形は同じです。

2017 年の論文 "Attention Is All You Need" は、過激な提案をしました。再帰を完全に捨てる、というものです。すべての位置が、他のすべての位置に並列に attention できるようにする。1,024 回の逐次計算ではなく、1 つの大きな行列積として学習する。

その結果、2026 年にはあらゆるモダリティで Transformer が支配的になっています。言語（GPT-5、Claude 4、Llama 4）、画像（ViT、DINOv2、SAM 3）、音声（Whisper）、生物学（AlphaFold 3）、ロボティクス（RT-2）。同じブロックに、異なる入力を与えているだけです。

## コンセプト

![RNN の逐次計算と Transformer の並列 attention の比較](../assets/rnn-vs-transformer.svg)

**ボトルネックとしての再帰。** RNN は `h_t = f(h_{t-1}, x_t)` を計算します。各ステップは直前のステップに依存します。`h_4` の前に `h_5` を計算することはできません。10,000 個以上の並列コアを持つ現代の GPU では、長い系列に対してシリコンの 99% を無駄にします。

**ブロードキャストとしての attention。** Self-attention は、すべてのペア `(i, j)` について `output_i = sum_j(a_ij * v_j)` を同時に計算します。N×N の attention 行列全体が、1 回のバッチ化された matmul で埋まります。どのステップも別のステップに依存しません。GPU に非常に向いています。

**高速化は定数倍ではありません。** これは `O(N)` の直列深さと `O(1)` の直列深さの違いです。実際、N=512 では、同等のハードウェア上で Transformer は 1 エポックあたり 5〜10 倍速く学習します。そして系列長が伸びるほど差は広がり、attention の `O(N²)` メモリ壁にぶつかるまで続きます（この定数部分は後に Flash Attention が改善しました。Lesson 12 を参照）。

**Transformer のコスト。** attention のメモリは `O(N²)` で増えます。2K コンテキストなら問題ありません。128K コンテキストでは、sliding window、RoPE の外挿、Flash Attention のタイリング、または線形 attention の変種が必要になります。再帰は時間もメモリも `O(N)` でした。Transformer は時間をメモリと交換し、その時間を並列化で取り戻します。

**帰納バイアスの変化。** RNN は局所性と新近性を仮定します。Transformer は何も仮定しません。すべてのペアが attention の候補です。そのため Transformer はうまく学習するにはより多くのデータを必要としますが、データがあるとさらに大きくスケールします。Chinchilla（2022）はこれを定式化しました。十分なトークンがあれば、同じパラメータ数の RNN より Transformer が常に勝ちます。

## 作ってみる

ここではニューラルネットワークは使いません。中核となるボトルネックを数値的にシミュレートし、手元のノート PC で差を体感します。

### Step 1: 直列深さを測る

`code/main.py` を見てください。2 つの関数を作ります。1 つは系列を加算の連鎖として符号化します（RNN のような直列処理）。もう 1 つは並列 reduction として符号化します（attention のようなブロードキャスト）。数学は同じでも、依存グラフが違います。

```python
def rnn_style(xs):
    h = 0.0
    for x in xs:
        h = 0.9 * h + x   # can't parallelize: h depends on previous h
    return h

def attention_style(xs):
    return sum(xs) / len(xs)  # every x is independent
```

最大 100,000 要素の系列で両方を計測します。RNN 版は O(N) で、単一の CPU パイプラインを使います。純粋な Python でも、長さが 1,000 以上になると attention 風の reduction が勝ちます。Python の `sum()` は C で実装されており、各ステップでインタプリタのオーバーヘッドが発生しないためです。

### Step 2: 理論上の演算を数える

どちらのアルゴリズムも N 回の加算を行います。違いは*依存深さ*です。次の処理を始める前に、何個の演算を順番に実行しなければならないかです。RNN の深さは N。attention の深さは tree reduction なら log(N)、parallel scan なら 1 です。GPU 時間を決めるのは演算数ではなく深さです。

### Step 3: 長い系列での経験的スケーリング

O(N) の差が見えるタイミング表を出力します。2026 年の Mac ノートでは、1,000 要素未満の系列は速すぎて測りにくいです。100,000 要素の系列では、きれいな線形スキャンが見えます。これを 16,384 トークンの Transformer と 12 層 LSTM 相当へ拡大して考えると、2016 年に学習の実時間がなぜ障壁だったのかが分かります。

## 使いどころ

2026 年でも RNN を選ぶ場面:

| 状況 | 選択 |
|-----------|------|
| ストリーミング推論、1 トークンずつ、定数メモリ | RNN or state-space model (Mamba, RWKV) |
| attention メモリが爆発する非常に長い系列（>1M tokens） | Linear attention, Mamba 2, Hyena |
| matmul アクセラレータのないエッジデバイス | Depthwise-separable RNN は FLOPs/watt でまだ勝つ |
| それ以外（学習、バッチ推論、128K までのコンテキスト） | Transformer |

Mamba のような state-space model（SSM）は、本質的には構造化されたパラメータ化を持つ RNN で、両者の長所を併せ持ちます。`O(N)` のスキャンメモリと、selective scan による並列学習です。Transformer の品質の 90% を回復しつつ、長いコンテキストではよりよくスケールします。2026 年には、多くの frontier lab が SSM+Transformer のハイブリッドモデル（例: Jamba、Samba）を学習しています。再帰は死んだのではなく、構成要素になったのです。

## 仕上げる

`outputs/skill-architecture-picker.md` を見てください。この skill は、長さ、スループット、学習予算の制約をもとに、新しい系列問題に適したアーキテクチャを選びます。1B トークンを超える学習実行に対して純粋な RNN を推奨する場合は、必ずトレードオフを述べなければなりません。

## 演習

1. **Easy.** `code/main.py` の `rnn_style` を取り出し、スカラーの隠れ状態を長さ 64 の隠れ状態ベクトルに置き換えてください。再計測します。隠れ状態の次元に対して直列オーバーヘッドはどれくらい増えるでしょうか。
2. **Medium.** 純粋な Python で parallel prefix-sum（Hillis-Steele scan）を実装してください。長さ 1024 の serial scan と同じ数値出力になることを確認し、深さを数えてください。
3. **Hard.** attention 風の reduction を GPU 上の PyTorch に移植してください。系列長を 64 から 65,536 まで変えながら両方を計測します。プロットし、曲線の形を説明してください。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|-----------------|-----------------------|
| Recurrence | 「RNN は逐次的」 | ステップ `t` がステップ `t-1` に依存する計算。時間軸方向の直列実行を強制する。 |
| Serial depth | 「グラフがどれだけ深いか」 | 依存する演算の最長連鎖。無限のハードウェアがあっても実時間の下限になる。 |
| Attention | 「トークン同士を見せる」 | 位置 i と j の類似度スコアから得た `a_ij` を使う重み付き和 `sum_j a_ij v_j`。 |
| Context window | 「モデルが見られる範囲」 | attention 層が入力として受け取れる位置数。二次のメモリコストはここでスケールする。 |
| Inductive bias | 「アーキテクチャに埋め込まれた仮定」 | データがどのようなものかについての事前仮定。CNN は並進不変性を、RNN は新近性を仮定する。 |
| State-space model | 「代数を背負った RNN」 | 構造化 state-space 行列により並列学習できるようパラメータ化された再帰。 |
| Quadratic bottleneck | 「なぜコンテキストが高コストなのか」 | attention メモリ = 系列長に対して `O(N²)`。Flash Attention は定数を隠すが、スケーリング自体は変えない。 |

## 参考文献

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) — 主流 NLP における再帰を終わらせた論文。
- [Bahdanau, Cho, Bengio (2014). Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — RNN に後付けされた attention が生まれた場所。
- [Hochreiter, Schmidhuber (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — 記録としての、元祖 LSTM 論文。
- [Gu, Dao (2023). Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/abs/2312.00752) — Transformer に対する現代的な再帰型の回答。
