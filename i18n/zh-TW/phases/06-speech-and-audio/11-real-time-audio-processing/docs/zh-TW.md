# 即時音訊處理

> 批次管線（pipeline）處理一個檔案。即時管線要在下一個 20 毫秒到來之前，處理完這 20 毫秒。每一個對話式 AI、廣播棚、電話機器人，成敗都看這個延遲預算。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 6 · 04 (ASR), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## The Problem｜問題

你要一個反應自然的語音助理。人類對話輪替的延遲大約 230 毫秒（從靜音到回應）。超過 500 毫秒就覺得像機器人。超過 1500 毫秒就覺得壞了。2026 年一整圈**聽、懂、回應、說**的預算是：

| 階段 | 預算 |
|-------|--------|
| 麥克風到緩衝 | 20 毫秒 |
| VAD | 10 毫秒 |
| ASR（串流） | 150 毫秒 |
| LLM（第一個 token） | 100 毫秒 |
| TTS（第一塊） | 100 毫秒 |
| 渲染到喇叭 | 20 毫秒 |
| **合計** | **約 400 毫秒** |

Moshi（Kyutai，2024）量到全雙工（full-duplex）200 毫秒。GPT-4o-realtime（2024）大約 320 毫秒。2022 年的串接管線交付時是 2500 毫秒。快 10 倍來自三個手法：（1）每一段都串流，（2）非同步管線化，帶部分結果，（3）可打斷的生成。

## The Concept｜核心概念

![Streaming audio pipeline with ring buffer, VAD gate, interruption](../assets/real-time.svg)

**音框（frame）／塊／視窗。** 即時音訊以固定大小的區塊流動。常見選擇是 20 毫秒（16 kHz 下 320 個樣本）。下游都必須跟上這個節拍。

**環形緩衝（ring buffer）。** 固定大小的環形緩衝。生產者執行緒寫新音框，消費者執行緒讀。避免在熱路徑上配置記憶體。大小大約是最大延遲乘取樣率。2 秒、16 kHz 的環是 32,000 個樣本。

**VAD（語音活動偵測）。** 沒人說話時停止下游處理。Silero VAD 4.0（2024）在 CPU 上每個 30 毫秒音框不到 1 毫秒。`webrtcvad` 是較舊的替代。

**串流 ASR。** 音訊一邊到，一邊吐出部分逐字稿的模型。Parakeet-CTC-0.6B 的串流模式（NeMo，2024）在 320 毫秒延遲下 WER 是 2% 到 5%。Whisper-Streaming（Macháček 等人，2023）把 Whisper 切塊，接近串流，延遲大約 2 秒。

**打斷。** 助理還在說話時使用者開口，你必須（a）偵測插話，（b）停掉 TTS，（c）丟掉剩下的 LLM 輸出。全部要在 100 毫秒內，否則使用者會覺得助理沒在聽。

**WebRTC Opus 傳輸。** 20 毫秒音框、48 kHz、適應位元率 8 到 128 kbps。瀏覽器和手機的標準。LiveKit、Daily.co、Pion 是 2026 年做語音應用的堆疊。

**抖動緩衝（jitter buffer）。** 網路封包會亂序或遲到。抖動緩衝重新排序並平滑封包到達時間。太小就有聽得到的空隙。太大就增加延遲。典型是 60 到 80 毫秒。

### 常見的坑

- **執行緒爭用（thread contention）。** Python 的 GIL 加重模型，會使音訊執行緒得不到執行資源。用 C 回呼的音訊函式庫（sounddevice、PortAudio），熱路徑上不要跑 Python。
- **取樣率轉換的延遲。** 管線裡重取樣會多 5 到 20 毫秒。要麼事先重取樣，要麼用零延遲重取樣器（PolyPhase、`soxr_hq`）。
- **TTS 暖機。** 就算 Kokoro 這種快的 TTS，第一次請求也要暖機 100 到 200 毫秒。把模型快取起來，真正的第一輪之前先空跑一次。
- **回音消除。** 沒有 AEC，TTS 輸出會再進麥克風，ASR 就去聽機器人自己的聲音。開放原始碼的預設是 WebRTC AEC3。

```figure
nyquist-aliasing
```

## Build It｜動手實作

### 步驟 1：環形緩衝

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

容量決定最大緩衝延遲。16 kHz 下 32,000 個樣本是 2 秒。

### 步驟 2：VAD 閘

```python
def simple_energy_vad(frame, threshold=0.01):
    return sum(x * x for x in frame) / len(frame) > threshold ** 2
```

正式環境換成 Silero VAD：

```python
import torch
vad, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
is_speech = vad(torch.tensor(frame), 16000).item() > 0.5
```

### 步驟 3：串流 ASR

```python
# Parakeet-CTC-0.6B streaming via NeMo
from nemo.collections.asr.models import EncDecCTCModelBPE
asr = EncDecCTCModelBPE.from_pretrained("nvidia/parakeet-ctc-0.6b")
# chunk_ms=320 ms, look_ahead_ms=80 ms
for chunk in audio_stream():
    partial_text = asr.transcribe_streaming(chunk)
    print(partial_text, end="\r")
```

### 步驟 4：打斷處理器

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

靠非同步 I/O 和可取消的 TTS 串流。音訊軌上呼叫 WebRTC 的 peerconnection.stop()，是標準做法。

## Use It｜實際應用

2026 年的堆疊：

| 層 | 挑 |
|-------|------|
| 傳輸 | LiveKit（WebRTC）或 Pion（Go） |
| VAD | Silero VAD 4.0 |
| 串流 ASR | Parakeet-CTC-0.6B 或 Whisper-Streaming |
| LLM 第一個 token | Groq、Cerebras、vLLM-streaming |
| 串流 TTS | Kokoro 或 ElevenLabs Turbo v2.5 |
| 回音消除 | WebRTC AEC3 |
| 端到端原生 | OpenAI Realtime API 或 Moshi |

## Pitfalls｜容易踩的坑

- **為了安全緩衝 500 毫秒。** 緩衝就是你的延遲下限。把它縮小。
- **沒有把執行緒釘住。** 音訊回呼若在優先權低於 UI 的執行緒上，負載一來就爆音。
- **TTS 塊太小。** 低於 200 毫秒的塊，聲碼器瑕疵聽得出來。320 毫秒是甜蜜點。
- **沒有抖動緩衝。** 真實網路會抖。不平滑就會有爆音。
- **只處理一次的錯誤。** 音訊管線不能崩。一個例外就把會話殺掉。

## Ship It｜交付成果

存成 `outputs/skill-realtime-designer.md`。設計一條即時音訊管線，每個階段都有具體的延遲預算。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它模擬環形緩衝加能量 VAD，並印出一段假的 10 秒串流的各階段延遲。
2. **中等。** 用 `sounddevice` 做直通迴圈，以 20 毫秒音框處理你的麥克風，每一框印出 VAD 狀態。
3. **困難。** 用 `aiortc` 做全雙工回音測試：瀏覽器到 WebRTC 到 Python 再回到瀏覽器。用 1 kHz 脈衝量玻璃到玻璃的延遲。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 環形緩衝 | 環形佇列 | 固定大小、無鎖（或單生產者單消費者鎖定）的音訊音框 FIFO。 |
| VAD | 靜音閘 | 模型或啟發式，標出語音和非語音。 |
| 串流 ASR | 即時語音轉文字 | 音訊一邊到就吐出部分文字。往前看有上限。 |
| 抖動緩衝 | 網路平滑器 | 把亂序封包重新排隊。典型 60 到 80 毫秒。 |
| AEC | 回音消除 | 減掉喇叭到麥克風的回授路徑。 |
| 插話 | 使用者打斷 | 系統在 TTS 途中偵測到使用者說話。必須取消播放。 |
| 全雙工 | 兩邊同時 | 使用者和機器人可以同時說話。Moshi 是全雙工。 |

## Further Reading｜延伸閱讀

- [Macháček et al. (2023). Whisper-Streaming](https://arxiv.org/abs/2307.14743) ——切塊、接近串流的 Whisper。
- [Kyutai (2024). Moshi](https://kyutai.org/Moshi.pdf) ——全雙工、200 毫秒延遲。
- [LiveKit Agents framework (2024)](https://docs.livekit.io/agents/) ——正式環境的音訊 agent編排。
- [Silero VAD repo](https://github.com/snakers4/silero-vad) ——不到 1 毫秒的 VAD，Apache 2.0。
- [WebRTC AEC3 paper](https://webrtc.googlesource.com/src/+/main/modules/audio_processing/aec3/) ——開放原始碼下的回音消除。
