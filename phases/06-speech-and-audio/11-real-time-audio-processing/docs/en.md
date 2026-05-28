# Real-Time Audio Processing

> バッチパイプラインはファイルを処理します。リアルタイムパイプラインは、次の20ミリ秒が到着する前に、今の20ミリ秒を処理します。すべての会話 AI、放送スタジオ、電話 bot は、このレイテンシ予算で成否が決まります。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 6 · 02 (Spectrograms), Phase 6 · 04 (ASR), Phase 6 · 07 (TTS)
**所要時間:** 約75分

## 問題

生きているように感じられる voice assistant を作りたいとします。人間の会話の turn-taking latency は約 230 ms（沈黙から応答まで）です。500 ms を超えるとロボット的に感じられ、1500 ms を超えると壊れているように感じられます。2026年の **hear → understand → respond → speak** ループ全体の予算は次のとおりです。

| Stage | Budget |
|-------|--------|
| Mic → buffer | 20 ms |
| VAD | 10 ms |
| ASR (streaming) | 150 ms |
| LLM (first token) | 100 ms |
| TTS (first chunk) | 100 ms |
| Render → speaker | 20 ms |
| **Total** | **~400 ms** |

Moshi（Kyutai、2024年）は full-duplex で 200 ms を記録しました。GPT-4o-realtime（2024年）は約 320 ms です。2022年の cascaded pipeline は 2500 ms で出荷されていました。10倍の改善は、(1) すべてを streaming にする、(2) partial results を使って非同期に pipeline 化する、(3) generation を interruptible にする、という3つの技術から来ました。

## コンセプト

![Streaming audio pipeline with ring buffer, VAD gate, interruption](../assets/real-time.svg)

**Frame / chunk / window。** リアルタイム音声は固定サイズのブロックとして流れます。一般的な選択は 20 ms（16 kHz で 320 samples）です。下流のすべての処理は、この周期に追いつかなければなりません。

**Ring buffer。** 固定サイズの circular buffer です。producer thread が新しい frame を書き込み、consumer thread が読みます。hot path での allocation を防ぎます。サイズはおおよそ maximum-latency × sample-rate です。2秒の 16 kHz ring は 32,000 samples です。

**VAD (Voice Activity Detection)。** 誰も話していないとき、下流の処理を止めます。Silero VAD 4.0（2024年）は CPU 上で 30 ms frame あたり <1 ms で動作します。`webrtcvad` は古い代替です。

**Streaming ASR。** 音声が到着するにつれて partial transcript を出すモデルです。Parakeet-CTC-0.6B の streaming mode（NeMo、2024年）は、320 ms latency で 2-5% WER を出します。Whisper-Streaming（Macháček et al., 2023）は Whisper を chunk 化し、約 2 s latency の near-streaming を実現します。

**Interruption。** assistant が話している間にユーザーが話し始めたら、(a) barge-in を検出し、(b) TTS を停止し、(c) 残りの LLM output を捨てる必要があります。すべて 100 ms 以内に行わないと、ユーザーは assistant が耳を貸していないと感じます。

**WebRTC Opus transport。** 20 ms frames、48 kHz、adaptive bitrate 8-128 kbps。ブラウザとモバイルの標準です。LiveKit、Daily.co、Pion は、voice app を作るための2026年の stack です。

**Jitter buffer。** ネットワーク packet は順不同または遅延して到着します。jitter buffer は並べ替えと平滑化を行います。小さすぎると可聴の欠落が出て、大きすぎると latency が増えます。60-80 ms が典型です。

### よくある落とし穴

- **Thread contention。** Python の GIL と重いモデルは audio thread を飢えさせることがあります。C-callback の audio library（sounddevice、PortAudio）を使い、hot path に Python を置かないでください。
- **Sample-rate conversion latency。** pipeline 内の resampling は 5-20 ms を追加します。最初に resample するか、zero-latency resampler（PolyPhase、`soxr_hq`）を使います。
- **TTS priming。** Kokoro のような高速 TTS でも、初回リクエストでは 100-200 ms の warm-up があります。モデルを cache し、最初の実 turn の前に dummy run で warm します。
- **Echo cancellation。** AEC がないと、TTS output が mic に戻り、bot 自身の声で ASR が発火します。WebRTC AEC3 がオープンソースの標準です。

## 作ってみる

### Step 1: ring buffer

```python
import collections

class RingBuffer:
    def __init__(self, capacity):
        self.buf = collections.deque(maxlen=capacity)
    def write(self, frame):
        self.buf.extend(frame)
    def read(self, n):
        return [self.buf.popleft() for _ in range(min(n, len(self.buf)))]
    def level(self):
        return len(self.buf)
```

capacity は最大 buffering latency を決めます。16 kHz で 32,000 samples = 2 s です。

### Step 2: VAD gate

```python
def simple_energy_vad(frame, threshold=0.01):
    return sum(x * x for x in frame) / len(frame) > threshold ** 2
```

本番では Silero VAD に置き換えます。

```python
import torch
vad, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
is_speech = vad(torch.tensor(frame), 16000).item() > 0.5
```

### Step 3: streaming ASR

```python
# Parakeet-CTC-0.6B streaming via NeMo
from nemo.collections.asr.models import EncDecCTCModelBPE
asr = EncDecCTCModelBPE.from_pretrained("nvidia/parakeet-ctc-0.6b")
# chunk_ms=320 ms, look_ahead_ms=80 ms
for chunk in audio_stream():
    partial_text = asr.transcribe_streaming(chunk)
    print(partial_text, end="\r")
```

### Step 4: interruption handler

```python
class Dialog:
    def __init__(self):
        self.tts_task = None

    def on_user_speech(self, frame):
        if self.tts_task and not self.tts_task.done():
            self.tts_task.cancel()   # barge-in
        # then feed to streaming ASR

    def on_final_user_utterance(self, text):
        self.tts_task = asyncio.create_task(self.reply(text))

    async def reply(self, text):
        async for tts_chunk in llm_then_tts(text):
            speaker.write(tts_chunk)
```

async I/O と cancel 可能な TTS streaming に依存します。WebRTC では audio track に対する peerconnection.stop() が標準的な方法です。

## 使いどころ

2026年の stack:

| Layer | Pick |
|-------|------|
| Transport | LiveKit (WebRTC) or Pion (Go) |
| VAD | Silero VAD 4.0 |
| Streaming ASR | Parakeet-CTC-0.6B or Whisper-Streaming |
| LLM first-token | Groq, Cerebras, vLLM-streaming |
| Streaming TTS | Kokoro or ElevenLabs Turbo v2.5 |
| Echo cancel | WebRTC AEC3 |
| End-to-end native | OpenAI Realtime API or Moshi |

## 落とし穴

- **安全のために 500 ms buffering する。** buffer はそのまま latency floor です。縮めてください。
- **thread を pin しない。** UI より低い priority の thread で audio callback を動かすと、負荷時に glitch が出ます。
- **TTS chunk が小さすぎる。** 200 ms 未満の chunk は vocoder artifact が聞こえやすくなります。320 ms chunk がよい妥協点です。
- **Jitter buffer がない。** 実ネットワークは jittery です。平滑化しないと pop が出ます。
- **一発限りの error handling。** Audio pipeline は crash-proof でなければなりません。1つの例外で session が死にます。

## 出荷する

`outputs/skill-realtime-designer.md` として保存します。stage ごとの具体的な latency budget を持つ real-time audio pipeline を設計します。

## 演習

1. **Easy。** `code/main.py` を実行します。ring buffer + energy VAD をシミュレートし、fake 10-second stream の stage latencies を出力します。
2. **Medium。** `sounddevice` を使い、mic を 20 ms frame で処理する passthrough loop を作り、各 frame の VAD state を出力します。
3. **Hard。** `aiortc` で full duplex echo test を作ります。browser → WebRTC → Python → WebRTC → browser。1 kHz pulse で glass-to-glass latency を測定します。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Ring buffer | The circular queue | audio frames 向けの固定サイズ、lock-free（または SPSC-locked）FIFO。 |
| VAD | Silence gate | speech vs non-speech を示すモデルまたは heuristic。 |
| Streaming ASR | Real-time STT | 音声到着に合わせて partial text を出す。lookahead は bounded。 |
| Jitter buffer | Network smoother | out-of-order packets を並べ替える queue。典型値は 60-80 ms。 |
| AEC | Echo cancellation | speaker-to-mic feedback path を差し引く。 |
| Barge-in | User interrupt | TTS 中の user speech を system が検出し、playback を cancel する必要がある。 |
| Full duplex | Simultaneous both ways | user と bot が同時に話せる。Moshi は full duplex。 |

## 参考資料

- [Macháček et al. (2023). Whisper-Streaming](https://arxiv.org/abs/2307.14743) — chunked near-streaming Whisper。
- [Kyutai (2024). Moshi](https://kyutai.org/Moshi.pdf) — full-duplex 200 ms latency。
- [LiveKit Agents framework (2024)](https://docs.livekit.io/agents/) — production audio agent orchestration。
- [Silero VAD repo](https://github.com/snakers4/silero-vad) — sub-1 ms VAD、Apache 2.0。
- [WebRTC AEC3 paper](https://webrtc.googlesource.com/src/+/main/modules/audio_processing/aec3/) — オープンソースの echo cancellation。
