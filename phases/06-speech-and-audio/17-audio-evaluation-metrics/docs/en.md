# Audio Evaluation — WER、MOS、UTMOS、MMAU、FAD、Open Leaderboards

> 測れないものは出荷できません。このレッスンでは、2026 年の音声タスクごとの指標を整理します。ASR (WER、CER、RTFx)、TTS (MOS、UTMOS、SECS、WER-on-ASR-round-trip)、audio-language (MMAU、LongAudioBench)、music (FAD、CLAP)、speaker (EER)。さらに比較に使う leaderboards も扱います。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**所要時間:** 約 60 分

## 問題

すべての音声タスクには複数の指標があり、それぞれ異なる軸を測ります。間違った指標を使うと、ダッシュボード上では優秀に見えて、本番ではひどいモデルを出荷することになります。2026 年の標準リストは次のとおりです。

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## コンセプト

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### ASR metrics

**WER (Word Error Rate)。** `(S + D + I) / N`。採点前に lowercase、punctuation strip、number normalize を行います。`jiwer` または OpenAI の `whisper_normalizer` を使います。&lt; 5% は read speech で human-parity です。

**CER (Character Error Rate)。** 同じ式を character-level で使います。word segmentation が曖昧な tone languages (Mandarin、Cantonese) で使います。

**RTFx (inverse real-time factor)。** wall-clock 1 秒あたりに処理できる audio seconds。高いほど良いです。Parakeet-TDT は 3380×。Whisper-large-v3 は約 30× です。

**First-token latency。** 音声入力から最初の transcript token までの wall-clock。streaming では重要です。Deepgram Nova-3 は約 150 ms。

### TTS metrics

**MOS (Mean Opinion Score)。** 1-5 の人間評価。gold standard ですが遅いです。モデルごとに 100+ samples、各 sample 20+ listeners を集めます。

**UTMOS (2022-2026)。** 学習済み MOS predictor。標準 benchmark では human MOS と約 0.9 相関します。F5-TTS: UTMOS 3.95、ground truth: 4.08。

**SECS (Speaker Encoder Cosine Similarity)。** voice cloning 用。reference と cloned output の ECAPA embedding cosine。&gt; 0.75 なら recognizable clone です。

**WER-on-ASR-round-trip。** TTS output に Whisper をかけ、入力テキストに対する WER を計算します。明瞭度の退行を捕まえます。2026 SOTA は &lt; 2% CER。

**TTFA (time-to-first-audio)。** wall-clock latency。Kokoro-82M は約 100 ms、F5-TTS は約 1 s。

### Voice-cloning-specific

**SECS + MOS + CER** を 3 点セットで使います。SECS が高く MOS が低い cloning は、音色は合っているが不自然という意味です。逆は、自然な声だが話者が違うという意味です。

### Speaker verification

**EER (Equal Error Rate)。** False Accept Rate と False Reject Rate が等しくなるしきい値です。VoxCeleb1-O 上の ECAPA は 0.87%。

**minDCF (min Detection Cost)。** 選んだ operating point (多くは FAR=0.01) での重み付きコスト。EER より本番に近い指標です。

### Diarization

**DER (Diarization Error Rate)。** `(FA + Miss + Confusion) / total_speaker_time`。missed speech、false-alarm speech、speaker-confusion をそれぞれ割合として足します。AMI meetings では DER ~10-20% が現実的です。pyannote 3.1 + Precision-2 commercial は、よく録音された音声で &lt;10% DER です。

**JER (Jaccard Error Rate)。** DER の代替で、short-segment bias に頑健です。

### Audio classification

Multi-label では、全クラスの **mAP (mean Average Precision)** を使います。AudioSet では BEATs-iter3 が 0.548 mAP。

Multi-class exclusive では **top-1、top-5 accuracy** を使います。Speech Commands v2 では Audio-MAE が 99.0% top-1。

不均衡データでは **macro F1** + **per-class recall** を使います。per-class を報告してください。aggregate accuracy はどのクラスが失敗しているかを隠します。

### Music generation

**FAD (Fréchet Audio Distance)。** real と generated audio の VGGish-embedding distributions 間の距離です。MusicCaps 上の MusicGen-small は 4.5。MusicLM は 4.0。低いほど良いです。

**CLAP Score。** CLAP embeddings を使った text-audio alignment score。&gt; 0.3 なら妥当な alignment です。

**Listening panel MOS。** consumer-grade music では今でも最終判断です。Suno v5 は TTS Arena の paired human preferences で ELO 1293。

### Audio-language benchmarks

**MMAU (Massive Multi-Audio Understanding)。** 10k audio-QA pairs。

**MMAU-Pro。** 1800 hard items、4 categories: speech / sound / music / multi-audio。4 択の random chance は 25%。Gemini 2.5 Pro は overall 約 60%、multi-audio は全モデルで約 22%。

**LongAudioBench。** 数分の clips に対する semantic queries。Audio Flamingo Next が Gemini 2.5 Pro を上回ります。

**AudioCaps / Clotho。** Captioning benchmarks。SPICE、CIDEr、FENSE metrics。

### Streaming speech-to-speech

**Latency P50 / P95 / P99。** end-of-user-speech から最初に聞こえる response までの wall-clock。Moshi は 200 ms、GPT-4o Realtime は 300 ms。

**WER / MOS** を output に対して測ります。

**Barge-in responsiveness。** ユーザー割り込みから assistant mute までの時間。目標は &lt; 150 ms。

### 2026 年の leaderboards

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `mmaubenchmark.github.io` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

## 作ってみる

### Step 1: normalization つき WER

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### Step 2: TTS round-trip WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### Step 3: voice cloning 用 SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### Step 4: music generation 用 FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### Step 5: speaker verification 用 EER (Lesson 6 と同じコード)

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## 使いどころ

すべての deploy に、モデル更新ごとに動く固定 eval harness を組み合わせます。3 つの基本ルールがあります。

1. **採点前に正規化する。** Lowercase、punctuation-strip、number-expand。normalization rule を報告します。
2. **平均ではなく分布を報告する。** latency は P50/P95/P99。classification は per-class recall。MMAU は per-category。
3. **標準的な public benchmark を 1 つ実行する。** production data が違っていても、Open ASR / TTS Arena / MMAU で報告すれば、reviewers が apples-to-apples に比較できます。

## 落とし穴

- **UTMOS extrapolation。** VCTK-style clean speech で訓練されています。noisy / cloned / emotional audio ではスコアが悪くなります。
- **MOS panel bias。** 20 人の Amazon Mechanical Turk workers は 20 人の target users と同じではありません。重要度が高いなら domain panel に支払います。
- **FAD depends on reference set。** モデル間では同じ reference distribution に対して比較します。
- **Aggregate WER。** 全体 5% WER は accented speech で 30% WER を隠すことがあります。demographic slice ごとに報告します。
- **Public benchmark saturation。** ほとんどの frontier models は標準 benchmarks で天井に近いです。自分の traffic を反映する in-house held-out set を作ります。

## 出荷する

`outputs/skill-audio-evaluator.md` として保存します。任意の audio model release に対して metrics、benchmarks、reporting format を選びます。

## 演習

1. **Easy.** `code/main.py` を実行します。toy inputs 上で WER / CER / EER / SECS / FAD-ish / MMAU-ish を計算します。
2. **Medium.** TTS round-trip WER harness を作ります。Kokoro または F5-TTS の出力を Whisper に通します。50 prompts で WER を計算し、WER &gt; 10% の prompts を flag します。
3. **Hard.** Lesson 10 で選んだ LALM を MMAU-Pro speech + multi-audio subsets (各 50 items) で採点します。per-category accuracy を報告し、公開値と比較します。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | normalization 後の word level の `(S+D+I)/N`。 |
| CER | Character WER | tone languages や char-level systems 用。 |
| MOS | Human opinion | 1-5 rating。20+ listeners × 100 samples。 |
| UTMOS | ML MOS predictor | 学習済みモデル。human MOS と約 0.9 相関。 |
| SECS | Voice-clone similarity | reference と clone の ECAPA cosine。 |
| EER | Speaker verif score | FAR = FRR となる threshold。 |
| DER | Diarization score | (FA + Miss + Confusion) / total。 |
| FAD | Music-gen quality | VGGish embeddings 上の Fréchet distance。 |
| RTFx | Throughput | wall-clock 1 秒あたりの audio seconds。 |

## さらに読む

- [jiwer](https://github.com/jitsi/jiwer) — normalization utilities つき WER/CER library。
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) — learned MOS predictor。
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) — music-gen の標準。
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — 2026 live rankings。
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) — human-vote TTS leaderboard。
- [MMAU-Pro benchmark](https://mmaubenchmark.github.io/) — LALM reasoning leaderboard。
- [HEAR benchmark](https://hearbenchmark.com/) — audio SSL benchmarks。
