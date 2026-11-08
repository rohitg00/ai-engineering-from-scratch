# 綜合專案 03 —— 即時語音助理（ASR 到 LLM 到 TTS）

> 一個感覺對的語音代理，端到端延遲要低於 800 毫秒、知道你什麼時候講完、處理得了插話，而且呼叫工具時不會卡住。Retell、Vapi、LiveKit Agents 與 Pipecat 在 2026 年都達到了這個標準。它們用的是同一套形狀：一個串流 ASR、一個輪次偵測器、一個串流 LLM，以及一個串流 TTS，全部透過 WebRTC 串起來，並在每一跳都設下嚴苛的延遲預算。建一個出來，量測 WER、MOS 與誤截斷率，並在封包遺失之下跑它。

**類型：** 綜合專案
**程式語言：** Python (agent + pipeline), TypeScript (web client)
**先修單元：** 階段 6（語音與音訊）、階段 7（transformer）、階段 11（LLM 工程）、階段 13（工具）、階段 14（代理）、階段 17（基礎設施）
**演練到的階段：** P6 · P7 · P11 · P13 · P14 · P17
**時間：** 30 小時

## 問題

語音是 2025-2026 年間移動最快的 AI 使用體驗類別。技術天花板每一季都在下降。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0，以及 Pipecat 0.0.70，都讓 800 毫秒以下的首個音訊輸出變得搆得到。標準不只在延遲。它在那個互動的感覺：不要打斷使用者、不要被打斷、能從句子中途的插話中恢復、能在對話中途呼叫工具而不讓音訊卡住、能撐過抖動的行動網路。

你沒辦法靠把三個 REST 呼叫縫起來達到這個境界。這套架構是端到端的管線式串流。把它建起來，失敗模式就會現形：一個為電話音訊調過的 VAD 被背景電視聲觸發、一個在等永遠不會來的標點的輪次偵測器、一個在輸出前先緩衝 400 毫秒的 TTS。這個綜合專案就是要在負載之下把這些一個一個修掉，並發表一份延遲與品質報告。

## 概念

這條管線有五個串流階段：**音訊輸入**（來自瀏覽器或 PSTN 的 WebRTC）、**ASR**（來自 Deepgram Nova-3 或 faster-whisper 的串流部分轉錄）、**輪次偵測**（VAD 加上一個小型輪次偵測模型，讀取部分轉錄以尋找完結線索）、**LLM**（一旦判定輪次結束就開始串流詞元）、**TTS**（在第一個 LLM 詞元後約 200 毫秒內開始串流音訊）。

有三個橫切的關注點。**插話**：當代理正在說話而使用者開口時，TTS 取消，ASR 立刻接手。**工具使用**：對話中途的函式呼叫（天氣、行事曆）必須跑在旁路通道上，不讓音訊卡住；若延遲超過 300 毫秒，代理會先墊一個確認用的詞元（「稍等一下……」）。**背壓**：在封包遺失之下，部分轉錄先扣住、VAD 提高語音閘門門檻，而代理會避免蓋過一則尚未被確認的訊息。

量測標準是定量的。在 15 dB 信噪比的 Hamming VAD 基準上 WER 低於 8%。100 通量測通話的首個音訊輸出 p50 低於 800 毫秒。誤截斷率低於 3%。TTS 的 MOS 高於 4.2。單台 g5.xlarge 上 50 通並行通話。這些數字就是交付物。

## 架構

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

- 傳輸：LiveKit Agents 1.0（WebRTC）加上 Twilio PSTN 閘道；Pipecat 0.0.70 作為替代框架
- ASR：Deepgram Nova-3（串流，首個部分結果低於 300 毫秒）或自架的 faster-whisper Whisper-v3-turbo
- VAD：Silero VAD v5 加上 LiveKit 的輪次偵測器（一個讀取部分轉錄的小型 transformer）
- LLM：整合最緊密的 OpenAI GPT-4o-realtime、Gemini 2.5 Flash Live，或串接式的 Claude Haiku 4.5（串流補完，音訊走獨立路徑）
- TTS：Cartesia Sonic-2（首位元組最快）、ElevenLabs Flash v3，或供自架用的開源 Orpheus
- 工具：供天氣／行事曆／訂位使用的 FastMCP 旁路通道；工具超過 300 毫秒時代理先送出填補語
- 可觀測性：OpenTelemetry 語音 span、帶音訊重播的 Langfuse 語音軌跡
- 部署：自架 Whisper + Orpheus 用單台 g5.xlarge（24GB VRAM）；要最低延遲則用託管 API

```figure
ce-voice-latency
```

## 動手建

1. **WebRTC 工作階段。** 架起一個 LiveKit 房間，以及一個會串流麥克風音訊的網頁客戶端。在伺服器端，掛上一個會加入該房間的代理 worker。

2. **ASR 串流。** 把 20 毫秒的 PCM 音框餵給 Deepgram Nova-3（或跑在 GPU 上的 faster-whisper）。訂閱部分與最終轉錄。記錄每一次部分結果的延遲。

3. **VAD 與輪次偵測器。** 在音框串流上跑 Silero VAD v5。在語音結束事件上，用最新的部分轉錄去觸發 LiveKit 的輪次偵測器。只有在 VAD 判定靜默達 500 毫秒、且輪次偵測器的完結分數 > 0.6 時，才確認「輪次結束」。

4. **LLM 串流。** 輪次結束時，帶著目前的對話加上最終轉錄開始 LLM 呼叫。把詞元串流出去。在第一個詞元時就交棒給 TTS。

5. **TTS 串流。** Cartesia Sonic-2 把音訊片段串流回來。第一個片段必須在第一個 LLM 詞元後 200 毫秒內離開伺服器。把片段送進 LiveKit 房間；客戶端透過 WebRTC 的抖動緩衝區播放。

6. **插話。** 當 TTS 正在播放時 VAD 偵測到新的使用者語音，立刻取消 TTS 串流、丟掉剩下的 LLM 輸出，並重新武裝 ASR。發出一個 `tts_canceled` span。

7. **工具旁路通道。** 把天氣與行事曆註冊成函式呼叫工具。被觸發時，並行發動那次呼叫；若它在 300 毫秒內沒有回來，就讓 LLM 送出「稍等一下，我查一下」當填補語；工具回來後再繼續。

8. **評估框架。** 錄 100 通通話。計算 WER（對照一份保留的轉錄）、誤截斷率（使用者話講到一半 TTS 卻被取消）、首個音訊輸出的 p50、TTS 的 MOS（人工或 NISQA），以及一項抖動遺失測試（丟掉 3% 的封包）。

9. **負載測試。** 用一個合成來電者，在單台 g5.xlarge 上驅動 50 通並行通話。量測持續狀態下首個音訊輸出的 p95。

## 動手用

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] tool call emitted @880ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @940ms
[llm  ] first token @990ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## 產出交付

`outputs/skill-voice-agent.md` 就是那份交付物。給定一個領域（客服、排程，或自助服務機），它會架起一個 LiveKit 代理，其 ASR/VAD/LLM/TTS 管線已依那套量測標準調校過。評分表：

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 端到端延遲 | 100 通錄音通話上，首個音訊輸出 p50 低於 800 毫秒 |
| 20 | 輪流對話品質 | 在 Hamming VAD 基準上誤截斷率低於 3% |
| 20 | 工具使用正確性 | 對話中途的工具呼叫回傳正確資料，且不讓音訊卡住 |
| 20 | 封包遺失下的可靠度 | 注入 3% 封包丟棄時的 WER 與輪流對話穩定度 |
| 15 | 評估框架完整度 | 可重現的量測，附公開設定 |
| **100** | | |

## 練習

1. 把 Deepgram Nova-3 換成跑在 g5.xlarge 上的 faster-whisper v3 turbo。量測延遲與 WER 的差距。指出 CPU 與 GPU 的抉擇在哪裡要緊。

2. 加上一套插話仲裁政策：當使用者在工具呼叫期間插話時，代理該怎麼做？比較三種政策（硬取消、把工具做完再停、把下一輪排入佇列）。

3. 跑一次對抗性的輪次偵測器測試：讓使用者在句子中間停很久。調整 VAD 的靜默門檻與輪次偵測器的分數門檻，在不超過 900 毫秒的前提下把誤截斷率壓到最低。

4. 透過 Twilio 把同一個代理部署到 PSTN 上。比較 PSTN 與 WebRTC 的首個音訊輸出。解釋抖動緩衝區與編解碼器的差異。

5. 替非英語語言（日語、西班牙語）加上語音活動偵測。量測 Silero VAD v5 的誤觸發率，並與語言專屬的微調版本比較。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 輪次偵測 | 「話語結束」 | 在給定 VAD 靜默與部分轉錄之下，判定使用者已講完的分類器 |
| 插話 | 「打斷處理」 | VAD 偵測到新的使用者語音時，在播放中途取消 TTS |
| 首個音訊輸出 | 「延遲」 | 從使用者停止說話到第一個音訊封包離開伺服器的時間 |
| VAD | 「語音閘門」 | 把音框分類為語音或靜默的模型；Silero VAD v5 是 2026 年的預設 |
| 抖動緩衝區 | 「音訊平滑」 | 客戶端短暫扣住封包以吸收網路變異的緩衝區 |
| 填補語 | 「確認用詞元」 | 工具很慢時，代理送出來避免冷場的短句 |
| MOS | 「平均意見分數」 | 感知上的語音品質評分；NISQA 是它的自動化代理指標 |

## 延伸閱讀

- [LiveKit Agents 1.0](https://github.com/livekit/agents) —— 參考用的 WebRTC 代理框架
- [Pipecat](https://github.com/pipecat-ai/pipecat) —— 另一套以 Python 為主的串流代理框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) —— 整合式語音模型的參考
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) —— 串流 ASR 的參考
- [Silero VAD v5](https://github.com/snakers4/silero-vad) —— VAD 的參考模型
- [Cartesia Sonic-2](https://docs.cartesia.ai) —— 低延遲 TTS 的參考
- [Retell AI architecture](https://docs.retellai.com) —— 生產環境的語音代理架構
- [Vapi.ai production stack](https://docs.vapi.ai) —— 另一份生產環境參考
