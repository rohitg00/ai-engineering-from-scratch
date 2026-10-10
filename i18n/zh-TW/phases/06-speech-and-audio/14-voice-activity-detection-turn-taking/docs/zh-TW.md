# 語音活動偵測與輪替：Silero、Cobra，以及 flush 手法

> 每個語音 agent的成敗取決於兩項判斷：使用者現在在說話嗎？他們說完了嗎？VAD 答第一個。輪次偵測（turn detection，VAD 加靜音拖尾加語意結束點模型）答第二個。任何一個錯，助理不是把使用者切斷，就是一直說不停。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## The Problem｜問題

語音 agent對每個 20 毫秒的塊做三個不同的決定：

1. **這一框是語音嗎？** VAD。逐框進行二元分類。
2. **使用者開始了新的語句嗎？** 起始偵測。
3. **使用者說完了嗎？** 結束點（輪次結束）。

單純的答案（能量閾值）在任何噪音上都會失敗：車流、鍵盤、人群嘈雜。2026 年的答案：Silero VAD（開放、以深度學習訓練的）加輪次偵測模型（語意結束點）加依 VAD 調過的靜音拖尾。

## The Concept｜核心概念

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### 三層 VAD

**第 1 層：能量閘。** 最便宜。RMS 閾值在 −40 dBFS。明顯的靜音濾得掉，但閾值以上的任何噪音都會觸發。

**第 2 層：Silero VAD**（2020 到 2026，MIT）。100 萬參數（parameter）。在 6000 種以上語言上訓練。單一 CPU 執行緒上，每個 30 毫秒塊大約 1 毫秒。5% 偽陽性率下真陽性率 87.7%。開放原始碼的預設。

**第 3 層：語意輪次偵測器。** LiveKit 的輪次偵測模型（2024 到 2026），或你自己的小分類器。分辨「句子中間的停頓」和「說完了」。用的是語言脈絡（語調加最近的詞），不只是靜音。

### 關鍵參數和預設

- **閾值。** Silero 輸出機率。語音判定在 &gt; 0.5（預設）或 &gt; 0.3（較敏感）。閾值愈低，第一個字被切掉愈少，偽陽性愈多。
- **最短語音時長。** 短於 250 毫秒的語音丟掉。通常是咳嗽或椅子聲。
- **靜音拖尾（結束點）。** VAD 回到 0 之後，等 500 到 800 毫秒再宣布輪次結束。太短會打斷使用者。太長會覺得遲鈍。
- **預捲緩衝。** VAD 觸發前留 300 到 500 毫秒音訊。避免「hey」被切掉。

### flush 手法（Kyutai，2025）

串流語音轉文字有前瞻延遲（Kyutai STT-1B 是 500 毫秒，STT-2.6B 是 2.5 秒）。平常你得在語音結束後等那麼久才拿到逐字稿。flush 手法：VAD 發出語音結束時，**送一個 flush 訊號給語音轉文字**，強迫它立刻輸出。語音轉文字大約 4 倍即時，所以 500 毫秒緩衝大約 125 毫秒就處理完。

端到端：125 毫秒的 VAD 加 flush 語音轉文字，就是對話延遲。

### 2026 年的 VAD 比較

| VAD | 5% 偽陽性率下的真陽性率 | 延遲 | 授權 |
|-----|--------------|---------|---------|
| WebRTC VAD（Google，2013） | 50.0% | 30 毫秒 | BSD |
| Silero VAD（2020 到 2026） | 87.7% | 約 1 毫秒 | MIT |
| Cobra VAD（Picovoice） | 98.9% | 約 1 毫秒 | 商業 |
| pyannote 切段 | 95% | 約 10 毫秒 | 大致 MIT |

預設該用 Silero。要合規或更高準確率就升級到 Cobra。2026 年正式環境沒有只用能量的 VAD 的位置。

```figure
sp-vad-cascade
```

## Build It｜動手實作

### 步驟 1：能量閘

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### 步驟 2：Python 裡的 Silero VAD

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

### 步驟 3：輪次結束的狀態機

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

### 步驟 4：flush 手法的骨架

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

語音轉文字（Kyutai、Deepgram、AssemblyAI）必須支援 flush，這才行得通。Whisper 串流不支援。它以區塊為基礎，永遠等塊到齊。

## Use It｜實際應用

| 情況 | VAD 選擇 |
|-----------|-----------|
| 開放、快、一般用途 | Silero VAD |
| 商業客服 | Cobra VAD |
| 裝置上（手機） | Silero VAD ONNX |
| 研究／說話人分離 | pyannote 切段 |
| 零依賴的退路 | WebRTC VAD（舊的） |
| 需要輪次結束的品質 | Silero 再疊 LiveKit 輪次偵測器 |

經驗法則：除非真的沒有別的選擇，否則不要交付只用能量的 VAD。

## Pitfalls｜容易踩的坑

- **固定閾值。** 安靜時行，吵的時候不行。要麼在裝置上校正，要麼換成 Silero。
- **靜音拖尾太短。** agent 在句子中間打斷。對話語音的甜蜜點是 500 到 800 毫秒。
- **拖尾太長。** 感覺遲鈍。和目標使用者做 A/B 測試。
- **沒有預捲緩衝。** 使用者音訊的前 200 到 300 毫秒丟了。一律持續保留滾動的預捲。
- **忽略語意結束點。** 「嗯，讓我想想……」裡有長停頓。使用者討厭想想到一半被切斷。用 LiveKit 的輪次偵測器，或類似的東西。

## Ship It｜交付成果

存成 `outputs/skill-vad-tuner.md`。依工作負載挑 VAD 模型、閾值、拖尾、預捲，以及輪次偵測策略。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它模擬語音、靜音、語音、咳嗽的序列，並測試三層 VAD。
2. **中等。** 安裝 `silero-vad`，處理 5 分鐘錄音，調閾值，讓第一個字被切掉和誤觸發都變少。回報精確率（precision）和召回率（recall）。
3. **困難。** 做一個小的輪次偵測器：Silero VAD 加 3 層 MLP，吃最後 10 個詞的 embedding（用 sentence-transformers）。在用手標的輪次結束資料集上訓練。F1 要比只用 Silero 高 10%。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| VAD | 語音偵測器 | 每一框二元：這是語音嗎？ |
| 輪次偵測 | 結束點 | VAD 加靜音拖尾加語意結束點。 |
| 靜音拖尾 | 說完之後再等 | 宣布輪次結束前要等的時間。500 到 800 毫秒。 |
| 預捲 | 語音前緩衝 | VAD 觸發前留 300 到 500 毫秒音訊。 |
| flush 手法 | Kyutai 的手法 | VAD 到 flush 語音轉文字，125 毫秒，而不是 500 毫秒延遲。 |
| 語意結束點 | 「他們是故意停的嗎？」 | 看詞、不只看靜音的機器學習分類器。 |
| 5% 偽陽性率下的真陽性率 | ROC 上的一點 | 標準 VAD 基準。Silero 87.7%，WebRTC 50%。 |

## Further Reading｜延伸閱讀

- [Silero VAD](https://github.com/snakers4/silero-vad) ——開放 VAD 的參考。
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) ——商業準確率的領先者。
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt) ——低於 200 毫秒的工程手法。
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) ——正式環境裡的語意結束點。
- [WebRTC VAD](https://webrtc.googlesource.com/src/) ——舊的基準模型。
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) ——說話人分離等級的切段。
