# Speaker Recognition と Verification

> ASR は「何と言ったか」を問います。speaker recognition は「誰が言ったか」を問います。数式は embeddings と cosine で同じように見えますが、本番での判断はすべて 1 つの EER に依存します。

**種類:** Build
**言語:** Python
**前提:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**時間:** 約 45 分

## 問題

ユーザーが passphrase を話します。知りたいのは、その人が主張している本人か (*verification*, 1:1)、それとも enrollment bank の中の誰かか (*identification*, 1:N) です。あるいはどちらでもなく、未知の話者 (*open-set*) かもしれません。

2018 年以前は GMM-UBM + i-vectors でした。EER はそこそこ良いものの、channel shift (電話と laptop など) や感情に弱い方式です。2018-2022 年は x-vectors (angular margin で学習した TDNN backbone) が中心でした。2022 年以降は ECAPA-TDNN と WavLM-large embeddings です。2026 年には、この分野は 3 つのモデルと 1 つの metric にほぼ集約されています。

その metric が **EER**、Equal Error Rate です。False Accept Rate = False Reject Rate になるよう decision threshold を設定します。その交点が EER です。すべての論文、leaderboard、調達の会話で使われます。

## コンセプト

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**パイプライン。** Enrollment: 対象話者の音声を 5-30 秒録音し、固定次元 embedding (ECAPA-TDNN なら 192-d、WavLM-large なら 256-d) を計算します。Verification: test utterance の embedding を取得し、cosine similarity を計算し、threshold と比較します。

**ECAPA-TDNN (2020, 2026 年も主流)。** Emphasized Channel Attention, Propagation and Aggregation - Time-Delay Neural Network。squeeze-excitation、multi-head attention pooling を持つ 1D conv blocks の後に、192-d への linear layer が続きます。VoxCeleb 1+2 (2,700 speakers, 1.1M utterances) で Additive Angular Margin loss (AAM-softmax) により学習されました。

**WavLM-SV (2022+)。** 事前学習済み WavLM-large SSL backbone を AAM loss で fine-tune します。品質は高いですが遅く、300+ MB に対して ECAPA は 15 MB です。

**x-vector (baseline)。** TDNN + statistics pooling。古典的ですが、CPU / edge では今でも有用です。

**AAM-softmax。** angular space で正解 class に margin `m` を加える標準 softmax です。式は `cos(θ + m)`。class 間の角度分離を強制します。典型値は `m=0.2`、scale `s=30` です。

### スコアリング

- **Cosine** は enrollment embedding と test embedding の間で計算します。threshold による判定です。
- **PLDA (Probabilistic LDA)。** embeddings を、same-speaker と different-speaker の closed-form likelihood ratio を持つ latent space に射影します。cosine の上に載せると EER が 10-20% 改善します。2020 年以前は標準でしたが、現在は主に closed-set setup で使われます。
- **Score normalization。** `S-norm` または `AS-norm`: imposter cohort の means と stds に対して各 score を正規化します。cross-domain eval では必須です。

### 知っておくべき数値 (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### Diarization

複数話者のクリップで「誰がいつ話したか」を推定します。パイプラインは VAD → segment → 各 segment を embed → clustering (agglomerative または spectral) → boundary smoothing です。現代的なスタックは `pyannote.audio` 3.1 で、speaker segmentation + embedding + clustering を 1 つの call の裏にまとめています。2026 年の AMI における SOTA DER は約 15% です (2022 年の 23% から改善)。

## 作ってみる

### Step 1: MFCC 統計量から toy embedding を作る

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

SOTA にはまったく届きません。教育用です。`code/main.py` は synthetic speaker data 上の proof-of-concept としてこれを使います。

### Step 2: cosine similarity と threshold

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### Step 3: similarity pairs から EER を求める

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

戻り値は (eer, threshold_at_eer) です。両方を報告します。

### Step 4: SpeechBrain で本番相当の処理

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### Step 5: pyannote で diarize する

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## 使いどころ

2026 年のスタック:

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## 落とし穴

- **Channel mismatch。** VoxCeleb (web video) で学習したモデルは phone-call audio とは異なります。必ず対象 channel で評価してください。
- **Short utterances。** test audio が 3 秒未満になると EER は急激に悪化します。
- **ノイズのある enrollment。** ノイズの多い enrollment が 1 つあるだけで anchor が汚染されます。3 つ以上の clean samples を使い、平均してください。
- **条件をまたいだ固定 threshold。** threshold は必ず対象 domain の held-out dev set で調整します。
- **非正規化 embeddings で cosine。** 先に L2-normalize してください。そうしないと magnitude が支配します。

## 提出物

`outputs/skill-speaker-verifier.md` として保存してください。model、enrollment protocol、threshold-tuning plan、fraud safeguards を選びます。

## 演習

1. **Easy.** `code/main.py` を実行してください。synthetic "speakers" (異なる tone profiles) を作り、enroll し、100-pair trial list で EER を計算します。
2. **Medium.** 30 個の VoxCeleb1 utterances (5 speakers × 6 each) に SpeechBrain ECAPA を使ってください。cosine と PLDA の EER を計算します。
3. **Hard.** `pyannote.audio` で enroll → diarize → verify の完全な pipeline を作ります。AMI dev set で DER を評価します。

## 重要用語

| Term | よく言われる意味 | 実際の意味 |
|------|-----------------|------------|
| EER | 代表指標 | False Accept = False Reject となる threshold。 |
| Verification | 1:1 | 「これは Alice か？」 |
| Identification | 1:N | 「誰が話しているか？」 |
| Open-set | Unknown possible | test set に未登録話者が含まれうる。 |
| Enrollment | 登録 | 話者の reference embedding を計算すること。 |
| AAM-softmax | loss | additive angular margin 付き softmax。cluster separation を強制する。 |
| PLDA | 古典的 scoring | Probabilistic LDA。embeddings の上で likelihood-ratio scoring を行う。 |
| DER | Diarization metric | Diarization Error Rate - miss + false alarm + confusion。 |

## 参考資料

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) - 古典的な deep-embedding paper。
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) - 2020-2026 年の主流 architecture。
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) - SV と diarization の SSL backbone。
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) - production diarization + embedding stack。
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) - モデル横断の現在の EER standings。
