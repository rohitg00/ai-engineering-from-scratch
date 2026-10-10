# 串流語音轉語音：Moshi、Hibiki，以及全雙工對話

> 2024 到 2026 重新定義了語音 AI。Moshi 交付單一模型，同時聽、同時說，延遲 200 毫秒。Hibiki 一塊一塊做語音轉語音的翻譯。兩者都放棄 ASR 到 LLM 再到 TTS 的管線（pipeline），改成 Mimi 編解碼器 token 上的統一全雙工（full-duplex）架構。這是新的參考設計。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## The Problem｜問題

第 11 加第 12 課做出來的每個語音 agent，延遲下限（latency floor）大約都在 300 到 500 毫秒：VAD 觸發、語音轉文字處理、LLM 推理、TTS 生成。每一段都有自己的最低延遲。你可以調校、可以平行，但管線形狀限制了你的效能上限。

Moshi（Kyutai，2024 到 2026）問的是另一個問題：如果沒有管線呢？如果一個模型直接接收音訊、持續輸出音訊，文字只是中間的「內心獨白（inner monologue）」，而不是必經的一段呢？

答案是**全雙工的語音轉語音**。理論延遲 160 毫秒（80 毫秒 Mimi 音框（frame）加 80 毫秒聲學延遲）。實務上，單一張 L4 GPU 是 200 毫秒。那大約是同級最好的管線語音 agent的一半。

## The Concept｜核心概念

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### Moshi 的架構

**輸入。** 兩條 Mimi 編解碼器串流，都是 12.5 Hz 乘 8 本碼本：

- 串流 1：使用者音訊（Mimi 編碼，一直進來）
- 串流 2：Moshi 自己的音訊（Moshi 生成的）

**transformer。** 70 億參數（parameter）的時間 Transformer（Temporal Transformer）同時處理兩條串流，以及一條文字「內心獨白」串流。每 80 毫秒一步，它：

1. 吃最新的使用者 Mimi token（8 本碼本）。
2. 吃最近的 Moshi Mimi token（8 本碼本，依已產出的樣子）。
3. 生成下一個 Moshi 文字 token（內心獨白）。
4. 生成下一個 Moshi Mimi token（8 本碼本，由小型深度 transformer 產出）。

三條串流，使用者音訊、Moshi 音訊、Moshi 文字，平行跑。Moshi 說話時聽得見使用者。使用者打斷時，它能打斷自己。它能應聲（「嗯哼」），又不把主要語句打斷。

**深度 transformer。** 同一框裡，8 本碼本不是平行預測。碼本之間有相依。一個 2 層的小型「深度 transformer」在 80 毫秒內依序預測。這是自迴歸編解碼器語言模型的標準分解（VALL-E、VibeVoice 也用）。

### 為什麼內心獨白的文字有幫助

沒有明確文字，模型得在聲學串流裡隱含地建模語言。Moshi 的洞見：強迫它在音訊旁邊也吐文字 token。文字串流基本上就是 Moshi 正在說的逐字稿。這讓語意更連貫，換掉語言模型頭也比較容易，逐字稿還免費拿到。

### Hibiki：串流的語音轉語音翻譯

同一套架構，在翻譯配對上訓練。來源音訊進來，目標語言音訊持續出去。Hibiki-Zero（2026 年 2 月）不再需要詞級對齊的訓練資料。它用句子級資料，加上 GRPO 強化學習（reinforcement learning），把延遲降下來。

一開始支援四個語言對。新語言大約 1000 小時就能調整以支援。

### 更廣的 Kyutai 堆疊（2026）

- **Moshi**：全雙工對話（法文優先，英文也支援得很好）
- **Hibiki／Hibiki-Zero**：同步語音翻譯
- **Kyutai STT**：串流語音辨識（往前看 500 毫秒或 2.5 秒）
- **Kyutai Pocket TTS**：1 億參數的 TTS，在 CPU 上跑（2026 年 1 月）
- **Unmute**：把這些合在公開伺服器上的完整管線

L40S GPU 上的吞吐：64 個同時工作階段，3 倍即時。

### Sesame CSM：表親

Sesame CSM（2025）用類似的想法：Llama-3 骨幹加 Mimi 編解碼器頭。但 CSM 是單向的（吃脈絡加文字，產出語音），不是全雙工。它是市面上「聲音臨場感」最好的 TTS。和 Moshi 的全雙工能力不完全一樣。

### 2026 年的效能數字

| 模型 | 延遲 | 用途 | 授權 |
|-------|---------|----------|---------|
| Moshi | 200 毫秒（L4） | 全雙工英文／法文對話 | CC-BY 4.0 |
| Hibiki | 音框率 12.5 Hz | 法文 ↔ 英文串流翻譯 | CC-BY 4.0 |
| Hibiki-Zero | 相同 | 5 個語言對，沒有對齊資料 | CC-BY 4.0 |
| Sesame CSM-1B | 200 毫秒 TTFA | 以脈絡為條件的 TTS | Apache-2.0 |
| GPT-4o Realtime | 約 300 毫秒 | 封閉，OpenAI API | 商業 |
| Gemini 2.5 Live | 約 350 毫秒 | 封閉，Google API | 商業 |

```figure
sp-fullduplex
```

## Build It｜動手實作

### 步驟 1：介面

Moshi 提供 WebSocket 伺服器介面，吃 80 毫秒一塊的 Mimi 編碼音訊，回 80 毫秒一塊的 Mimi 編碼音訊。雙向。一直跑。

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### 步驟 2：全雙工迴圈

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

兩個方向同時跑。Python asyncio 或 Rust futures 是標準的傳輸。

### 步驟 3：訓練目標（概念上）

每一個 80 毫秒音框 `t`：

- 輸入：`user_mimi[0..t]`、`moshi_mimi[0..t-1]`、`moshi_text[0..t-1]`
- 預測：`moshi_text[t]`，然後 `moshi_mimi[t, codebook_0..7]`

文字在音訊之前預測（內心獨白）。音訊在深度 transformer 裡依碼本順序預測。

### 步驟 4：Moshi 贏在哪、不贏在哪

Moshi 贏的地方：

- 便宜硬體上，端到端低於 250 毫秒。
- 自然的應聲和打斷。
- 不需要黏合管線的程式碼。

Moshi 不贏的地方：

- 工具呼叫（沒有為這個訓練。你需要另一條 LLM 路徑）。
- 長推理（Moshi 是大約 80 億的對話模型，不是 Claude 或 GPT-4）。
- 冷門主題的事實準確度。
- 多數正式環境的企業用途（2026 年仍然用管線）。

## Use It｜實際應用

| 情況 | 選擇 |
|-----------|------|
| 延遲最低的語音同伴 | Moshi |
| 即時翻譯通話 | Hibiki |
| 語音示範／研究 | Moshi、CSM |
| 帶工具的企業 agent | 管線（第 12 課），不是 Moshi |
| 脈絡裡的自訂聲音 TTS | Sesame CSM |
| 語音轉語音、任何語言 | GPT-4o Realtime 或 Gemini 2.5 Live（商業） |

## Pitfalls｜容易踩的坑

- **工具呼叫有限。** Moshi 是對話模型，不是 agent 框架。要工具就和管線合起來。
- **特定聲音的條件。** Moshi 用單一訓練好的人格。仿製是另一次訓練。
- **語言覆蓋。** 法文加英文很好。其他有限。Hibiki-Zero 有幫助，但你仍然需要訓練資料。
- **資源成本。** 一個完整的 Moshi 工作階段佔一個 GPU 位子。不是便宜的多租戶共用部署模式。

## Ship It｜交付成果

存成 `outputs/skill-duplex-pipeline.md`。依語音 agent的工作負載，挑管線或全雙工架構，並寫理由。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它用符號模擬雙串流加內心獨白的架構。
2. **中等。** 從 HuggingFace 拉 Moshi，跑伺服器，測一次對話。量從使用者說完到 Moshi 開始回應的牆鐘延遲。
3. **困難。** 拿你第 12 課的管線 agent，在 20 句配對的測試語句上，和 Moshi 比 P50 延遲。寫下管線在架構上仍然會贏的時候。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 全雙工 | 同時聽和說 | 同一個模型上，兩條音訊串流同時在動。 |
| 內心獨白 | 模型的文字串流 | Moshi 在音訊輸出旁邊也吐文字 token。 |
| 深度 transformer | 碼本之間的預測器 | 小型 transformer，在一個 80 毫秒音框內預測 8 本碼本。 |
| Mimi | Kyutai 的編解碼器 | 12.5 Hz 乘 8 本碼本。語意加聲學。撐起 Moshi。 |
| 串流 S2S | 音訊到音訊、即時 | 一塊一塊的翻譯或對話，沒有管線階段。 |
| 應聲 | 「嗯哼」反應 | Moshi 能吐出小的確認，又不把輪次打斷。 |

## Further Reading｜延伸閱讀

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2) ——那篇論文。
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) ——沒有對齊資料的串流翻譯。
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) ——CSM 規格。
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) ——安裝加伺服器。
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) ——封閉的商業同儕。
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) ——底層的語音轉文字／TTS 框架。
