# Voice Activity Detection & Turn-Taking — Silero、Cobra、Flush Trick

> すべての音声エージェントは 2 つの判断で成否が決まります。ユーザーはいま話しているか、そして話し終えたか。VAD は前者に答えます。Turn-detection (VAD + silence-hangover + semantic endpoint model) は後者に答えます。どちらかを間違えると、アシスタントはユーザーを遮るか、いつまでも黙りません。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**所要時間:** 約 45 分

## 問題

音声エージェントは 20 ms チャンクごとに、3 つの異なる判断をします。

1. **このフレームは音声か。** — VAD。フレーム単位の二値判定です。
2. **ユーザーが新しい発話を始めたか。** — onset detection。
3. **ユーザーが話し終えたか。** — end-pointing (turn-end)。

素朴な答えである energy threshold は、交通音、キーボード、群衆のざわめきなど、どんなノイズでも壊れます。2026 年の答えは、Silero VAD (オープンで深層学習ベース) + turn-detection model (semantic endpointing) + VAD で較正した silence hangover です。

## コンセプト

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### 3 段の VAD カスケード

**Tier 1: energy gate。** 最安です。RMS を -40 dBFS でしきい値判定します。明らかな無音を除去できますが、しきい値を超えるノイズにはすべて反応します。

**Tier 2: Silero VAD** (2020-2026, MIT)。1M パラメータ。6000 以上の言語で訓練。単一 CPU スレッドで 30 ms チャンクあたり約 1 ms で動きます。5% FPR で 87.7% TPR。オープンソースの既定選択です。

**Tier 3: semantic turn detector。** LiveKit の turn-detection model (2024-2026) または自作の小さな分類器です。「文中のポーズ」と「話し終わり」を区別します。無音だけでなく、言語的文脈 (イントネーション + 直近の単語) を使います。

### 主要パラメータと既定値

- **Threshold。** Silero は確率を出します。&gt; 0.5 (既定) または &gt; 0.3 (高感度) を音声と分類します。低いしきい値は冒頭単語の欠けを減らしますが、false positives を増やします。
- **Minimum speech duration。** 250 ms 未満の音声を拒否します。通常は咳や椅子の音です。
- **Silence hangover (end-pointing)。** VAD が 0 に戻った後、end-of-turn と宣言する前に 500-800 ms 待ちます。短すぎるとユーザーを遮り、長すぎるともたつきます。
- **Pre-roll buffer。** VAD が発火する前の 300-500 ms の音声を保持します。"hey" が欠けるのを防ぎます。

### flush trick (Kyutai 2025)

Streaming STT モデルには look-ahead delay があります (Kyutai STT-1B は 500 ms、STT-2.6B は 2.5 s)。通常は発話終了後、その時間だけ待って transcript を受け取ります。Flush trick では、VAD が end-of-speech を検出したときに **STT へ flush signal を送る**ことで、即時出力を強制します。STT は約 4× realtime で処理するため、500 ms バッファは約 125 ms で終わります。

エンドツーエンドでは 125 ms VAD + flush STT = 会話的なレイテンシになります。

### 2026 年の VAD 比較

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

Silero が正しい既定値です。Cobra はコンプライアンスや精度が必要な場合のアップグレードです。Energy-only VAD は 2026 年の本番には居場所がありません。

## 作ってみる

### Step 1: energy gate

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### Step 2: Python で Silero VAD

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### Step 3: turn-end state machine

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### Step 4: flush trick の骨組み

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

これが機能するには、STT (Kyutai、Deepgram、AssemblyAI) が flush に対応している必要があります。Whisper streaming は対応しません。ブロックベースで、常にチャンクを待つためです。

## 使いどころ

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

目安: 本当に他に選択肢がない場合を除き、energy-only VAD を出荷しないでください。

## 落とし穴

- **固定しきい値。** 静かな環境では動きますが、騒がしい環境で失敗します。デバイス上で較正するか、Silero に切り替えます。
- **短すぎる silence hangover。** エージェントが文の途中で割り込みます。会話音声では 500-800 ms がちょうどよい範囲です。
- **長すぎる hangover。** もたついて感じます。対象ユーザーで A/B test します。
- **pre-roll buffer がない。** ユーザー音声の最初の 200-300 ms が失われます。必ず rolling pre-roll を保持します。
- **semantic endpointing を無視する。** "Hmm, let me think..." には長いポーズが含まれます。ユーザーは考えている途中で遮られることを嫌います。LiveKit の turn-detector などを使います。

## 出荷する

`outputs/skill-vad-tuner.md` として保存します。ワークロードに対して VAD model、threshold、hangover、pre-roll、turn-detection strategy を選びます。

## 演習

1. **Easy.** `code/main.py` を実行します。speech + silence + speech + coughs のシーケンスをシミュレーションし、3 段の VAD をテストします。
2. **Medium.** `silero-vad` をインストールし、5 分の録音を処理します。冒頭単語の欠けと false triggers の両方を最小化するよう threshold を調整します。precision/recall を報告します。
3. **Hard.** 小さな turn-detector を作ります。Silero VAD + 直近 10 単語の embeddings 上の 3-layer MLP (sentence-transformers を使用)。手でラベル付けした turn-end データセットで訓練します。Silero-only を F1 で 10% 上回ります。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | フレーム単位の二値判定: これは音声か。 |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint。 |
| Silence hangover | Wait-after-speech | turn end と宣言する前に待つ時間。500-800 ms。 |
| Pre-roll | Pre-speech buffer | VAD 発火前の 300-500 ms 音声を保持する。 |
| Flush trick | Kyutai hack | VAD → flush-STT → 500 ms 遅延ではなく 125 ms。 |
| Semantic endpoint | "Did they mean to stop?" | 無音だけでなく単語を見る ML 分類器。 |
| TPR @ FPR 5% | ROC point | 標準 VAD benchmark。Silero は 87.7%、WebRTC は 50%。 |

## さらに読む

- [Silero VAD](https://github.com/snakers4/silero-vad) — 参照実装となる open VAD。
- [Picovoice Cobra VAD](https://picovoice.ai/products/cobra/) — 商用精度リーダー。
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt) — sub-200 ms のエンジニアリング手法。
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) — 本番向け semantic endpointing。
- [WebRTC VAD](https://webrtc.googlesource.com/src/) — legacy baseline。
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) — diarization-grade segmentation。
