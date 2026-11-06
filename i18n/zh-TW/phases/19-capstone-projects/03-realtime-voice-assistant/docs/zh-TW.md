# 專案實戰 03——即時語音助理（ASR 到 LLM 到 TTS）（Capstone 03 — Real-Time Voice Assistant (ASR to LLM to TTS)）

> 一個讓人感到自然流暢的語音 Agent，必須將端到端通訊延遲嚴格壓在 800 毫秒以內、能敏銳察覺你何時已說完話、具備優雅的插話打斷（Barge-in）能力，且能在呼叫外部工具時絕不造成語音卡頓。Retell、Vapi、LiveKit Agents 與 Pipecat 在 2026 年皆已跨越這道及格線。它們的底層全體遵循完全相同的拓撲架構：串流語音辨識（Streaming ASR）、對話輪替偵測器（Turn-detector）、串流大語言模型（Streaming LLM），以及串流語音合成（Streaming TTS），全鏈路透過 WebRTC 協定緊密串接，並在每一跳都積極控管延遲預算。親手打造一套完整的語音助手，實測 WER 字詞錯誤率、MOS 語音品質與誤打斷率，並在模擬網路丟包的高壓下驗收其工程韌性。

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:** P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## Problem｜問題

語音對話已成為 2025 至 2026 年間技術演進最為迅猛的 AI 使用者互動品類。技術門檻每季都在降低。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0 以及 Pipecat 0.0.70，使得首包音訊吐出時間（First-audio-out）壓進 800ms 以內成為可及目標。然而這道及格線遠非單純追求數字延遲。它決定的是人類對話的真實交互體感：不搶話插話、不被打斷、能從句中遭打斷的狀況復原、能在對話中途呼叫外部 API 工具時維持音訊平滑而不致尷尬冷場，且能在不穩定的行動網路抖動下頑強生存。

你無法只靠串接三次 REST 呼叫達到這種效果。其底層必須是全鏈路完全打通的管線串流架構。只有親自建構它，各類致命的工程邊界才會浮出水面：一個依市話音質調整的語音活動偵測器（VAD）會被客廳背景的電視噪音瘋狂誤觸發、一個對話輪替偵測器因為傻等著永遠不會出現的句尾標點符號而陷入漫長沉默、一個語音合成引擎在吐出第一個音訊封包前竟然在記憶體中硬生生緩衝了 400ms。本專案實戰的核心目標，就是在高壓負載下一一修復這些瑕疵，並最終產出一份具備實測支撐的延遲與品質全景報告。

## Concept｜核心概念

整套資料流管線包含五大即時串流階段：**音訊輸入（Audio in）**（來自瀏覽器或 PSTN 電話網路的 WebRTC 串流）、**語音辨識（ASR）**（來自 Deepgram Nova-3 或本地部署 faster-whisper 的即時漸進式辨識文字碎片）、**對話輪替偵測（Turn detection）**（由 VAD 搭配一個讀取文字碎片以預測語義完整度的微型 Transformer 輪替偵測器）、**大模型推理（LLM）**（一旦判斷使用者發言結束，立即以串流模式吐出 Token）、**語音合成（TTS）**（在接收到大模型首個 Token 的約 200ms 內，立即以串流模式向外送出首包 PCM 音訊）。

系統必須妥善處理三大橫切關注點。**插話打斷（Barge-in）**：當使用者在 Agent 正在說話的中途突然開口時，系統必須瞬間發出取消訊號掐斷 TTS 播放，並立刻讓 ASR 重新就緒捕捉使用者的新語句。**外部工具呼叫（Tool use）**：在對話中途發起的函式呼叫（如查詢天氣、預約行事曆）必須在側信道獨立非同步執行，絕不能阻塞主語音流；若工具呼叫超過 300ms 仍未完成，Agent 會先插播一句口頭墊詞（例如「請稍候，我幫您查一下...」）。**背壓流控（Backpressure）**：在網路發生嚴重丟包時，系統會暫存文字碎片、VAD 會動態拉高語音判定閾值，Agent 亦會主動避免在尚未收到確認的封包上盲目搶答。

測量及格線完全具備量化指標。在 15 dB SNR 的 Hamming VAD 標準基準下，WER 字詞錯誤率必須低於 8%。在 100 次真實通話測試中，首包音訊吐出時間的 p50 中位數必須小於 800ms。對話誤打斷率必須嚴格控制在 3% 以下。TTS 語音品質的 MOS 評分必須高於 4.2。單一 AWS g5.xlarge 執行個體必須具備同時支撐 50 路併發通話的能力。這些嚴苛指標即是本專案實戰的驗收交付物。

## 系統架構

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## 技術堆疊

- 傳輸網路層：LiveKit Agents 1.0（WebRTC 協定）搭配 Twilio PSTN 電話閘道器；亦可選用 Pipecat 0.0.70 作為 Python 原生備選框架
- 語音辨識（ASR）：Deepgram Nova-3（串流 API，首個文字碎片延遲低於 300ms），或在 GPU 上本地私有託管的 faster-whisper（Whisper-v3-turbo）
- 語音活動偵測（VAD）：Silero VAD v5 搭配 LiveKit 專屬 turn-detector（專門閱讀即時文字碎片以判斷語義終止符號的小型 Transformer）
- 大語言模型（LLM）：追求緊密整合時選用 OpenAI GPT-4o-realtime、Gemini 2.5 Flash Live，或採用級聯模式的 Claude Haiku 4.5（串流輸出，獨立音訊管線）
- 語音合成（TTS）：Cartesia Sonic-2（首位元組延遲在業界最低）、ElevenLabs Flash v3，或本地部署的開源 Orpheus 模型
- 工具整合：基於 FastMCP 的側通道通訊，處理天氣、行事曆預訂；若工具呼叫耗時超過 300ms，Agent 自動預先吐出緩衝墊詞
- 全鏈路可觀測性：OpenTelemetry 語音專屬 Span，搭配支援音訊即時回放的 Langfuse 語音追蹤
- 部署實體：單台 AWS g5.xlarge（配備 24GB VRAM）用於私有化託管 Whisper + Orpheus；或使用雲端託管 API 換取極致低延遲

```figure
ce-voice-latency
```

## Build It｜動手實作

1. **建立 WebRTC 通訊房間**。拉起一個 LiveKit 房間並開發一個能串流麥克風音訊的 Web 端用戶端。在伺服器端編寫並掛載一個加入該房間的 Agent 背景工作行程。

2. **ASR 串流接入**。將音訊切分為 20ms 的 PCM 封包串流持續送入 Deepgram Nova-3（或在本地 GPU 上運行的 faster-whisper）。訂閱其漸進式文字碎片（partial）與最終轉錄文本（final）。記錄每個文字碎片的發布延遲。

3. **VAD 靜音偵測與對話輪替偵測**。在音訊幀串流上即時運行 Silero VAD v5。當偵測到「語音結束」事件時，立即觸發 LiveKit 輪替偵測器 針對最新累積的文字碎片進行語義完整度推論。只有當 VAD 持續報告靜音達 500ms，且輪替偵測器給出的語義完整度分數大於 0.6 時，系統才正式裁定「使用者本輪發言結束」。

4. **大模型串流激發**。在確認發言結束的瞬間，立即將滾動對話歷史與最新確認的語音文本打包送入大模型發起推論。以非同步串流模式逐字接收 Token。在收到第一個 Token 的瞬間，立即無縫交接給 TTS 模組。

5. **TTS 串流發射**。Cartesia Sonic-2 以串流形式回傳 PCM 音訊區塊。伺服器必須確保在收到大模型首個 Token 的 200ms 內，首包音訊區塊必須成功自伺服器向外發出。將音訊區塊注入 LiveKit 房間；用戶端透過 WebRTC 抖動緩衝區（Jitter buffer）進行平滑解碼播放。

6. **即時插話打斷（Barge-in）**。當 TTS 正在發聲播放時，一旦 VAD 再次偵測到使用者開口說話的新音訊訊號，立即向底層下發中斷訊號掐斷 TTS 串流，丟棄剩餘的 LLM 輸出，並重新武裝 ASR 進入聽取狀態。在系統中發布 `tts_canceled` Span 追蹤。

7. **工具側信道架構**。將天氣查詢與行事曆註冊為大模型的 Function Calling 工具。當被模型觸發時，以並行方式在側信道發起非同步請求；若該呼叫在 300ms 內未能回傳，大模型自動先吐出一句「請稍等，我查一下」作為語音墊詞；待工具資料回傳後，模型再無縫接續後續正式回答。

8. **全自動化評測套件**。完整錄製 100 通真實對話。計算 WER 字詞錯誤率（對照真實文字標準標籤）、誤打斷率（使用者話才說到一半 TTS 就意外搶話中斷的頻率）、首包音訊延遲的 p50 中位數、TTS 語音品質 MOS（透過人工評分或 NISQA 神經網路模型），並注入 3% 隨機丟包測試網路抗抖動能力。

9. **極限併發壓力測試**。在單台 g5.xlarge 伺服器上，使用合成模擬機器人同時發起 50 路併發通話。高壓測量系統在高併發持續狀態下，首包音訊延遲的 p95 表現是否出現雪崩。

## Use It｜實際應用

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] first token @960ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @1140ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-voice-agent.md`。給定一個具體的商業業務場景（如智慧客服、行事曆預約或無人櫃台），該 Skill 將自動部署一套依上述測量目標調整的 LiveKit 語音 Agent 架構。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 端到端交互延遲 | 在 100 次錄音通話測試中，首包音訊延遲 p50 嚴格低於 800ms |
| 20 | 對話輪替偵測品質 | 在 Hamming VAD 標準基準測試中，誤打斷率嚴格低於 3% |
| 20 | 外部工具呼叫正確性 | 在對話中途發起工具呼叫時，能精準回傳正確資料且音訊完全不卡頓 |
| 20 | 弱網丟包下的系統韌性 | 在人為注入 3% 隨機封包遺失的高壓下，WER 與對話輪替依然維持高度穩定 |
| 15 | 評測套件的完備性 | 具備完全可重現的度量程式碼與公開配置文件 |
| **100** | | |

## Exercises｜練習

1. 在 AWS g5.xlarge 上，將 Deepgram Nova-3 替換為本地部署的 faster-whisper v3 turbo。客觀度量兩者在文字延遲與 WER 上的具體差距。指出在 CPU 與 GPU 資源排程上的關鍵權衡點。
2. 設計一套完善的插話仲裁策略：當使用者在 Agent 正在執行外部工具呼叫的節骨眼上突然插話時，系統該如何處置？對比三種不同策略（硬性掐斷、等待工具執行完畢再停手、將使用者新語句排入下一輪佇列）。
3. 實施對抗性對話輪替測試：讓測試人員在講話中途故意停頓較長時間。動態調整 VAD 的靜音時間閾值與輪替偵測器的信心閾值，在確保首包延遲不突破 900ms 的前提下，將誤打斷率降至最低。
4. 透過 Twilio 將相同的語音 Agent 接入傳統電信 PSTN 電話網路。對比 PSTN 環境與現代 WebRTC 在首包音訊延遲上的差異。深入分析抖動緩衝區與語音編解碼器（Codec）在兩種網路環境下的深層原理。
5. 為非英語語言（如日語、西班牙語）擴充語音活動偵測模組。測量通用 Silero VAD v5 在面對不同語種時的誤觸發頻率，並對比針對特定語言執行 fine-tuning 後的改善效果。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Turn detection |「對話輪替偵測」| 根據 VAD 靜音狀態與部分逐字稿，判斷使用者是否已停止說話的分類器 |
| Barge-in |「插話處理」| VAD 偵測到使用者開始說話時，中止正在播放的 TTS |
| First-audio-out |「延遲」| 從使用者停止說話到第一個音訊封包離開伺服器所經過的時間 |
| VAD |「語音閘門」| 判斷音訊影格是語音或靜音的模型；Silero VAD v5 是 2026 年的預設選擇 |
| Jitter buffer |「音訊平滑」| 用戶端短暫保留封包以吸收網路變化的緩衝區 |
| Filler |「確認用 Token」| 工具執行較慢時，agent 用來避免沉默的簡短語句 |
| MOS |「平均意見分數」| 感知語音品質的評分；NISQA 是自動化代理指標 |

## Further Reading｜延伸閱讀

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — 參考級 WebRTC 語音 Agent 框架開源儲存庫。
- [Pipecat](https://github.com/pipecat-ai/pipecat) — 優秀的 Python 原生串流語音 Agent 備選框架。
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — 端到端原生語音模型權威參考。
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) — 高效能串流語音辨識技術文件。
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — 工業級語音活動偵測參考模型。
- [Cartesia Sonic-2](https://docs.cartesia.ai) — 極低延遲串流語音合成參考文獻。
- [Retell AI architecture](https://docs.retellai.com) — 正式環境語音 Agent 商業架構白皮書。
- [Vapi.ai production stack](https://docs.vapi.ai) — 另一種成熟的正式環境語音架構參考。
