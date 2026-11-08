# 語音代理：Pipecat 與 LiveKit

> 語音代理在 2026 年是一等的生產類別。Pipecat 給你一條 Python 的框架式管線（VAD → STT → LLM → TTS → 傳輸）。LiveKit Agents 則透過 WebRTC 把 AI 模型橋接到使用者身上。高階堆疊的生產延遲目標落在端到端 450–600 毫秒。

**類型：** 學習
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 01（代理迴圈）、階段 14 · 12（工作流模式）
**時間：** 約 60 分鐘

## 學習目標

- 描述 Pipecat 的 frame 式管線：DOWNSTREAM（source→sink）與 UPSTREAM（控制）。
- 說出典範化的語音管線各階段，以及 Pipecat 支援哪些傳輸。
- 解釋 LiveKit Agents 的兩種語音代理類別（MultimodalAgent、VoicePipelineAgent），以及各自何時合用。
- 摘要 2026 年的生產延遲期待，以及它們如何驅動架構選擇。

## 問題所在

語音代理不是一個文字迴圈後面硬栓一個 TTS。延遲預算很殘酷（約 600 毫秒）、部分音訊是常態、輪次偵測本身是個模型，而傳輸從電信 SIP 到 WebRTC 都有。你要嘛蓋一條 frame 式管線（Pipecat），要嘛靠一個平台（LiveKit）。

## 核心概念

### Pipecat（pipecat-ai/pipecat）

- Python 的 frame 式管線框架。
- `Frame` → `FrameProcessor` 鏈。
- 兩個流動方向：
  - **DOWNSTREAM** —— source → sink（音訊進、TTS 出）。
  - **UPSTREAM** —— 回饋與控制（取消、指標、插話）。
- `PipelineTask` 管理生命週期，帶事件（`on_pipeline_started`、`on_pipeline_finished`、`on_idle_timeout`）以及供指標／追蹤／RTVI 用的觀察者。

典型管線：

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

傳輸：Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flows 加上結構化對話（狀態機）。Pipecat Cloud 是那個託管執行環境。

### LiveKit Agents（livekit/agents）

- 透過 WebRTC 把 AI 模型橋接到使用者身上。
- 關鍵概念：`Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 兩種語音代理類別：
  - **MultimodalAgent** —— 透過 OpenAI Realtime 或同等物直接處理音訊。
  - **VoicePipelineAgent** —— STT → LLM → TTS 的串接；給你文字層級的掌控。
- 透過一個 transformer 模型做語意輪次偵測。
- 原生 MCP 整合。
- 透過 SIP 支援電信。
- 經由 LiveKit Inference 可用 50 種以上模型且免 API 金鑰；透過外掛還有 200 種以上。

### 商業平台

Vapi（在最佳化過的高階堆疊上約 450–600 毫秒）與 Retell（跨 180 通測試電話端到端約 600 毫秒）建構在這些之上。當你想要一套託管的語音堆疊、又沒有 WebRTC 團隊時，就挑平台。

### 這套模式在哪裡會出錯

- **沒處理插話。** 使用者打斷了；代理還在講。在 Pipecat 裡需要 UPSTREAM 的取消 frame，LiveKit 裡有對應物。
- **無視 STT 信心值。** 把低信心的轉錄當成聖旨餵給 LLM。要依信心設閘門，或請對方確認。
- **TTS 在句中被切斷。** 當管線在一句話中途取消時，TTS 得知道，或者把音訊切掉。
- **無視延遲預算。** 每個元件都加 50–200 毫秒。出貨前先把你那條鏈加總一遍。

### 2026 年的典型延遲

- VAD：20–60 毫秒
- STT 部分結果：100–250 毫秒
- LLM 首個詞元：150–400 毫秒
- TTS 首段音訊：100–200 毫秒
- 傳輸來回：30–80 毫秒

端到端 450–600 毫秒算高階。800–1200 毫秒很常見。超過 1500 毫秒的都感覺像壞了。

```figure
voice-pipeline
```

## 動手實作

`code/main.py` 是一條 frame 式的玩具管線，含：

- `Frame` 型別（audio、transcript、text、tts_audio、control）。
- `Processor` 介面，帶 `process(frame)`。
- 一條五階段管線（VAD → STT → LLM → TTS → 傳輸），以腳本化的處理器實作。
- 一個 UPSTREAM 的取消 frame，用來示範插話。

跑它：

```
python3 code/main.py
```

軌跡顯示正常流程，以及一次在句中停掉 TTS 的插話取消。

## 框架應用

- **Pipecat** 給要完整掌控的人 —— 自訂處理器、以 Python 為先、供應商可插拔。
- **LiveKit Agents** 給以 WebRTC 為先的部署與電信。
- **Vapi／Retell** 給沒有 WebRTC 團隊、想要託管語音代理的人。
- **OpenAI Realtime／Gemini Live** 給直接音訊進、音訊出的情境（MultimodalAgent）。

## 產出交付

`outputs/skill-voice-pipeline.md` 會搭出一條 Pipecat 形狀的語音管線鷹架，含 VAD + STT + LLM + TTS + 傳輸，外加插話處理。

## 練習

1. 給你的玩具管線加一個指標觀察者：計算每個階段每秒處理幾個 frame。延遲累積在哪裡？
2. 實作依信心設閘門的 STT：低於門檻就回問「可以再說一次嗎？」
3. 加上語意輪次偵測：簡單規則 —— 若轉錄以「？」結尾，就當作輪次結束。
4. 讀 Pipecat 的傳輸文件。把 stdlib 的傳輸換成 SmallWebRTCTransport 的設定（樁）。
5. 在同一則查詢上，量 OpenAI Realtime 與 STT+LLM+TTS 串接的差異。文字層級的掌控帶來多少延遲成本？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| Frame | 「事件」 | 管線中具型別的資料單位（音訊、轉錄、文字、控制） |
| Processor | 「管線階段」 | 帶 process(frame) 的處理器 |
| DOWNSTREAM | 「順流」 | source 到 sink：音訊進、語音出 |
| UPSTREAM | 「回饋流」 | 控制：取消、指標、插話 |
| VAD | 「語音活動偵測」 | 偵測使用者何時在說話 |
| 語意輪次偵測 | 「聰明的輪次結束判定」 | 由模型判斷使用者是否講完了 |
| MultimodalAgent | 「直接音訊代理」 | 音訊進、音訊出；中間沒有文字 |
| VoicePipelineAgent | 「串接式代理」 | STT + LLM + TTS；文字層級的掌控 |

## 延伸閱讀

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) —— frame 式管線、處理器、傳輸
- [LiveKit Agents docs](https://docs.livekit.io/agents/) —— WebRTC + 語音原語
- [Vapi](https://vapi.ai/) —— 託管的語音平台
- [Retell AI](https://www.retellai.com/) —— 託管語音，有延遲基準
