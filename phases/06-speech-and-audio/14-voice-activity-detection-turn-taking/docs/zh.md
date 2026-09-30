# 語音活動偵測與輪替 —— Silero、Cobra 與 flush 技巧

> 每個語音代理程式的生死都取決於兩個判斷：使用者現在在說話嗎，以及他說完了嗎？語音活動偵測（VAD）回答第一個問題。輪替偵測（VAD + 靜音殘留時間 + 語意端點模型）回答第二個。任一個判斷錯了，你的助理就會不是打斷使用者，就是講個不停。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 6 · 11（即時音訊）、階段 6 · 12（語音助理）
**時間：** 約 45 分鐘

## 問題所在

語音代理程式在每一個 20 ms 音訊塊上都要做三個彼此不同的判斷：

1. **這一幀是語音嗎？** —— VAD。二元、逐幀。
2. **使用者開始一段新的話語了嗎？** —— 起始偵測（onset detection）。
3. **使用者說完了嗎？** —— 端點偵測（輪替結束）。

天真的做法（能量門檻）碰到任何噪音都會失效 —— 車流、鍵盤、人群嘈雜聲。2026 年的答案是：Silero VAD（開源、深度學習）＋一個輪替偵測模型（語意端點偵測）＋一段依 VAD 校準過的靜音殘留時間。

## 核心概念

![VAD 串接層級：能量 → Silero → 輪替偵測器 → flush 技巧](../assets/vad-turn-taking.svg)

### 三層式 VAD 串接

**第 1 層：能量門。** 最便宜。把 RMS 門檻設在 -40 dBFS。可以濾掉明顯的靜音，但只要噪音超過門檻就會誤觸發。

**第 2 層：Silero VAD**（2020-2026，MIT 授權）。100 萬參數。用 6000 種以上的語言訓練。在單一 CPU 執行緒上，每 30 ms 音訊塊只要約 1 ms。在 5% FPR 下有 87.7% TPR。開源界的預設選擇。

**第 3 層：語意輪替偵測器。** LiveKit 的輪替偵測模型（2024-2026），或你自己的小型分類器。它能區分「句子中間的停頓」和「講完了」。用的是語言脈絡（語調＋最近說的詞），而不只是靜音。

### 關鍵參數與其預設值

- **門檻值。** Silero 輸出的是機率；預設在 &gt; 0.5 判定為語音，或 &gt; 0.3（較敏感）。門檻越低 = 第一個字被切掉的次數越少，但誤判越多。
- **最短語音長度。** 拒絕短於 250 ms 的語音 —— 那通常是咳嗽或椅子的聲音。
- **靜音殘留時間（端點偵測）。** VAD 回到 0 之後，先等 500-800 ms 再宣告輪替結束。太短 → 打斷使用者。太長 → 感覺遲鈍。
- **前置緩衝（pre-roll）。** 保留 VAD 觸發前的 300-500 ms 音訊。避免「hey」被切掉。

### flush 技巧（Kyutai 2025）

串流 STT 模型都有前瞻延遲（Kyutai STT-1B 是 500 ms，STT-2.6B 是 2.5 秒）。照常來說，語音結束後你得等那麼久才拿到轉錄結果。flush 技巧是：當 VAD 判定語音結束時，**送一個 flush 訊號給 STT**，強迫它立刻輸出。STT 的處理速度約為即時的 4 倍，所以那 500 ms 的緩衝約 125 ms 就跑完了。

端到端算下來：125 ms 的 VAD ＋ flush 過的 STT = 可對話的延遲。

### 2026 年 VAD 比較

| VAD | TPR @ 5% FPR | 延遲 | 授權 |
|-----|--------------|---------|---------|
| WebRTC VAD（Google，2013） | 50.0% | 30 ms | BSD |
| Silero VAD（2020-2026） | 87.7% | ~1 ms | MIT |
| Cobra VAD（Picovoice） | 98.9% | ~1 ms | 商業 |
| pyannote segmentation | 95% | ~10 ms | 近似 MIT |

Silero 是對的預設值。Cobra 是為了法規遵循／準確度而做的升級。純能量式的 VAD 在 2026 年的正式環境已經沒有立足之地。

```figure
sp-vad-cascade
```

## 動手實作

### 步驟 1：能量門

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### 步驟 2：Python 版的 Silero VAD

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

### 步驟 3：輪替結束的狀態機

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

### 步驟 4：flush 技巧的骨架

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT（Kyutai、Deepgram、AssemblyAI）必須支援 flush 這招才行得通。Whisper 的串流做法不支援 —— 它是以區塊為單位，永遠都在等音訊塊。

## 框架應用

| 情境 | VAD 選擇 |
|-----------|-----------|
| 開源、快速、通用 | Silero VAD |
| 商業客服中心 | Cobra VAD |
| 裝置端（手機） | Silero VAD ONNX |
| 研究／語者分段 | pyannote segmentation |
| 零依賴的退路 | WebRTC VAD（舊方案） |
| 需要好的輪替結束品質 | Silero ＋ LiveKit 輪替偵測器疊起來用 |

決策原則：除非你真的沒有別的選擇，永遠不要把純能量式的 VAD 送上線。

## 陷阱

- **固定門檻值。** 在安靜環境行得通，吵雜環境就掛。要嘛在裝置上做校準，要嘛換成 Silero。
- **靜音殘留時間太短。** 代理程式會在句子中間打斷。對話式語音的甜蜜點是 500-800 ms。
- **殘留時間太長。** 感覺遲鈍。拿目標使用者做 A/B 測試。
- **沒有前置緩衝。** 使用者音訊的前 200-300 ms 就丟了。永遠保留一段滾動的前置緩衝。
- **忽略語意端點偵測。** 「嗯，我想一下……」裡面包含很長的停頓。使用者最恨思考被人打斷。用 LiveKit 的輪替偵測器或類似的方案。

## 產出交付

存成 `outputs/skill-vad-tuner.md`。為某個工作負載挑出 VAD 模型、門檻值、殘留時間、前置緩衝與輪替偵測策略。

## 練習

1. **簡單。** 跑 `code/main.py`。它模擬一段「語音 + 靜音 + 語音 + 咳嗽」的序列，並測試三層 VAD。
2. **中等。** 安裝 `silero-vad`，處理一段 5 分鐘的錄音，調整門檻值讓「第一個字被切掉」與「誤觸發」同時最小化。回報精確率／召回率。
3. **困難。** 做一個迷你輪替偵測器：Silero VAD ＋ 一個吃最後 10 個詞嵌入的 3 層 MLP（用 sentence-transformers）。在手工標註的輪替結束資料集上訓練。F1 要比只用 Silero 高 10%。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| VAD | 語音偵測器 | 逐幀的二元判斷：這是語音嗎？ |
| 輪替偵測 | 端點偵測 | VAD ＋ 靜音殘留時間 ＋ 語意端點。 |
| 靜音殘留時間 | 語音後的等待 | 宣告輪替結束前要等多久；500-800 ms。 |
| 前置緩衝 | 語音前的緩衝 | 保留 VAD 觸發前的 300-500 ms 音訊。 |
| flush 技巧 | Kyutai 的妙招 | VAD → flush STT → 延遲從 500 ms 變 125 ms。 |
| 語意端點 | 「他是真的想停了嗎？」 | 看詞而不只看靜音的機器學習分類器。 |
| TPR @ FPR 5% | ROC 上的一點 | 標準的 VAD 基準；Silero 是 87.7%，WebRTC 是 50%。 |

## 延伸閱讀

- [Silero VAD](https://github.com/snakers4/silero-vad) —— 開源 VAD 的參考實作。
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) —— 商業方案的準確度領先者。
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt) —— 壓到 200 ms 以下的工程妙招。
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) —— 正式環境裡的語意端點偵測。
- [WebRTC VAD](https://webrtc.googlesource.com/src/) —— 舊時代的基準線。
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) —— 語者分段等級的切分。
