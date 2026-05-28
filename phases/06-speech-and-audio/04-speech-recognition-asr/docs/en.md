# 音声認識 (ASR) — CTC、RNN-T、Attention

> 音声認識は、各タイムステップでの音声分類を、英語と無音を理解する系列モデルでつなぎ合わせる問題です。CTC、RNN-T、attention はそれを行う 3 つの方法です。1 つ選び、なぜそうするのかを理解しましょう。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**所要時間:** 約45分

## 問題

10 秒、16 kHz のクリップがあります。欲しいのは "turn on the kitchen lights" という文字列です。難しさは構造にあります。音声フレームは文字と 1 対 1 に対応しません。"okay" という単語は 200 ms のことも 1200 ms のこともあります。無音が発話に句読点を打ちます。音素ごとに長さも違います。出力トークン数は事前には分かりません。

この問題を解く定式化は 3 つあります。

1. **CTC (Connectionist Temporal Classification)。** 特別な *blank* を含むトークン確率をフレームごとに出力します。デコード時に反復と blank を畳み込みます。非自己回帰で高速です。wav2vec 2.0、MMS で使われます。
2. **RNN-T (Recurrent Neural Network Transducer)。** Joint network が encoder frame と過去トークンから次トークンを予測します。ストリーミング可能です。Google のオンデバイス ASR、NVIDIA Parakeet で使われます。
3. **Attention encoder-decoder。** Encoder が音声を hidden states に圧縮し、decoder が cross-attention して自己回帰的にトークンを生成します。Whisper、SeamlessM4T で使われます。

2026 年、LibriSpeech test-clean の SOTA WER は 1.4% (Parakeet-TDT-1.1B, NVIDIA) と 1.58% (Whisper-Large-v3-turbo) です。差は小さいですが、デプロイ上の違いは大きいです。

## 概念

![3 つの ASR 定式化: CTC、RNN-T、attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC の直感。** Encoder が `V+1` 個のトークン (V chars + blank) に対する `T` 個のフレームレベル分布を出力するとします。長さ `U < T` の対象文字列 `y` に対して、畳み込むと `y` になる任意のフレームアラインメントが有効です。CTC loss はそのような全アラインメントにわたって和を取ります。推論では、フレームごとの argmax を取り、反復を畳み込み、blank を取り除きます。

利点: 非自己回帰、ストリーミング可能、lookahead なし。欠点: *conditional independence assumption* です。各フレーム予測は互いに独立で、内部言語モデルがありません。beam search や shallow fusion で外部 LM を足して補います。

**RNN-T の直感。** トークン履歴を埋め込む *predictor* network と、predictor state と encoder frame を `V+1` (`+1` は null / no-emit) の同時分布へ結合する *joiner* を追加します。CTC が無視した条件付き依存性を明示的にモデル化します。各ステップが過去フレームと過去トークンだけに条件付けるため、ストリーミング可能です。

利点: streamable + internal LM。欠点: 学習がより複雑でメモリを食います (3D loss lattice)。RNN-T loss kernels はそれだけで 1 つのライブラリカテゴリです。

**Attention encoder-decoder。** Log-mel フレーム上の encoder (6-32 transformer layers)。Decoder (6-32 transformer layers) が encoder outputs に cross-attend して自己回帰的にトークンを生成します。アラインメント制約はありません。attention は音声内のどこでも見られます。attention を制限しない限りストリーミングできません (chunked Whisper-Streaming, 2024)。

利点: オフライン ASR で最高品質、標準の seq2seq tooling で学習しやすい。欠点: 自己回帰レイテンシは出力長に比例します。エンジニアリングなしではストリーミングできません。

### WER: 1 つの数値

**Word Error Rate** = `(S + D + I) / N`。S=substitutions、D=deletions、I=insertions、N=reference word count です。単語レベルの Levenshtein edit distance と一致します。低いほど良いです。WER が 20% を超えると一般に実用になりません。5% 未満は読み上げ音声では human-parity です。標準ベンチマークでの 2026 年の数値:

| モデル | LibriSpeech test-clean | LibriSpeech test-other | サイズ |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

これらはすべて encoder-decoder または RNN-T ベースです。純粋な CTC システム (wav2vec 2.0) は test-clean で 1.8–2.1% 程度です。

## 作る

### 手順 1: greedy CTC decode

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

規則は 2 つです。連続する反復を畳み込み、blank を捨てます。例: `a a _ _ a b b _ c` → `a a b c`。

### 手順 2: beam-search CTC

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

本番では LM fusion 付きの prefix tree beam search を使います。これは概念的な骨格です。

### 手順 3: WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### 手順 4: Whisper で推論する

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

2026 年の最強クラスの汎用 ASR を 1 行で使えます。24 GB GPU では約 20× realtime で動きます。

### 手順 5: Parakeet または wav2vec 2.0 でストリーミングする

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

Streaming ASR には chunked encoder attention と carryover state が必要です。それをサポートするライブラリを使います (Parakeet なら NeMo、`chunk_length_s` 付きの `transformers` pipeline)。

## 使う

2026 年のスタック:

| 状況 | 選択 |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B または Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized または Moonshine (2024) |
| Long-form | VAD-based chunking 付き Whisper (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## 2026 年でも本番に紛れ込む落とし穴

- **VAD なし。** 無音に Whisper を走らせると hallucinations ("Thanks for watching!") が出ます。必ず VAD で gate します。
- **Character vs word vs subword WER。** 正規化後 (lowercase、punctuation stripped) の word-level WER を報告します。
- **Language ID drift。** Whisper の auto LID は、ノイズのあるクリップを日本語やウェールズ語へ誤って振り分けることがあります。分かっているなら `language="en"` を強制します。
- **チャンク化なしの長いクリップ。** Whisper には 30 秒ウィンドウがあります。それより長いものには `chunk_length_s=30, stride=5` を使います。

## 出荷する

`outputs/skill-asr-picker.md` として保存します。指定されたデプロイ対象に対して model、decoding strategy、chunking、LM fusion を選びます。

## 演習

1. **Easy.** `code/main.py` を実行します。手作りの CTC 出力を greedy decode し、参照に対する WER を計算します。
2. **Medium.** 手順 2 の prefix-tree beam search を正しく実装します (blank merge rule を考慮します)。10 例の合成データセットで greedy と比較します。
3. **Hard.** [LibriSpeech test-clean](https://www.openslr.org/12) で `whisper-large-v3-turbo` を使います。最初の 100 発話で WER を計算します。公開値と比較します。

## 重要用語

| 用語 | よく言われる説明 | 実際の意味 |
|------|-----------------|-----------------------|
| CTC | blank-token loss | frame-to-token alignments 全体にわたる周辺化。非 AR。 |
| RNN-T | streaming loss | CTC + next-token predictor。語順を扱えます。 |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder。オフライン品質が最高。 |
| WER | 報告する数値 | 単語レベルの `(S+D+I)/N`。 |
| Blank | 空っぽ | CTC で「このフレームでは出力なし」を示す特殊トークン。 |
| LM fusion | 外部言語モデル | beam search 中に重み付き LM log-probs を足します。 |
| VAD | 無音 gate | Voice activity detector。非音声を削ります。 |

## 参考資料

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) — CTC の論文。
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) — RNN-T の論文。
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — 2022 年の標準的な論文。v3-turbo 拡張は 2024 年。
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) — 2026 Open ASR Leaderboard leader。
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — 25+ models にわたる live benchmark。
