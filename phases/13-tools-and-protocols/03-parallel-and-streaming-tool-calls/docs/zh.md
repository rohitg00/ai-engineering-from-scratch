# 平行工具呼叫與帶工具的串流

> 三次獨立的天氣查詢串起來跑，就是三趟來回。讓它們平行跑，總時間就塌縮成最慢那一次呼叫。現在每家前沿供應商都能在單一輪次中吐出多次工具呼叫。回報是實實在在的；管線則很微妙。這一課會走完兩半：平行扇出，以及串流參數的重組，並著重在 id 對應這個陷阱上。

**類型：** 實作
**程式語言：** Python (stdlib, thread pool + streaming harness)
**先修單元：** 階段 13 · 02（函數呼叫深入剖析）
**時間：** 約 75 分鐘

## 學習目標

- 說明 `parallel_tool_calls: true` 為什麼存在，以及什麼時候該關掉它。
- 在平行扇出期間，把串流進來的參數分塊對應到正確的工具呼叫 id。
- 在不提早解析的前提下，把不完整的 `arguments` 字串重組成完整的 JSON。
- 跑一次三城市的天氣基準測試，展示循序與平行的延遲差異。

## 問題所在

沒有平行呼叫時，一個要回答「Bengaluru、東京與蘇黎世的天氣如何」的代理會這樣做：

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

三趟 LLM 來回，而且每一趟都還要付執行器的延遲。大約是理想壁鐘時間的 4 倍。

有了平行呼叫：

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

一趟 LLM 來回。執行器的時間是三者的最大值，不是總和。OpenAI、Anthropic 與 Gemini 上的生產基準顯示，扇出型工作負載的壁鐘時間可減少 60% 到 70%。

代價是對應的複雜度。當那三次呼叫亂序完成時，你的結果必須帶上相符的 `tool_call_id`，模型才能把它們對上。當結果是串流進來的，你必須先把片段的參數組裝成完整 JSON，才能執行。Gemini 3 加上唯一 id，有一部分正是為了解決一個真實世界的問題：對同一個工具發出的兩次平行呼叫根本分不出來。

## 核心概念

### 啟用平行

- **OpenAI。** `parallel_tool_calls: true` 預設開啟。設成 `false` 可強制循序。
- **Anthropic。** 透過 `disable_parallel_tool_use: false` 啟用平行（Claude 3.5 以上預設如此）。設成 `true` 則變循序。
- **Gemini。** 一律具備平行能力；`tool_config.function_calling_config.mode = "AUTO"` 讓模型自己決定。

在以下情況關掉平行：工具之間有順序相依（先 `create_file` 再 `write_file`）、某次呼叫的輸出是另一次呼叫的輸入，或速率限制器承受不了扇出。

### id 對應

模型吐出的每一次呼叫都有一個 `id`。宿主回傳的每一份結果都必須帶上同一個 id。少了它，結果就有歧義。

- **OpenAI。** 每則 tool 角色訊息上的 `tool_call_id`。
- **Anthropic。** 每個 `tool_result` 區塊上的 `tool_use_id`。
- **Gemini。** 每個 `functionResponse` 上的 `id`（Gemini 3 以上；Gemini 2 是靠名稱比對，這在同名的平行呼叫上就壞了）。

### 並行執行呼叫

宿主把每次呼叫的執行器跑在各自的執行緒、協程或遠端工作者上。最簡單的測試框架用執行緒池；生產環境則用 asyncio 搭配 `asyncio.gather` 或結構化並行。完成順序無法預測 —— id 才是識別依據。

一個常見的 bug：依呼叫清單的順序而非完成順序回覆結果。這通常沒問題，因為模型只在乎 `tool_call_id`，但如果有結果被丟掉或重複，亂序送出會讓除錯更難。建議依完成順序回覆，並明確附上 id。

### 串流的工具呼叫

當模型串流時，`arguments` 是一片一片抵達的。三次平行呼叫的三道分塊串流，會在線路上交錯。你需要為每個 id 各配一個累積器。

各家供應商的形狀：

- **OpenAI。** 每個分塊是 `choices[0].delta.tool_calls[i].function.arguments`（部分字串）。分塊帶著 `index`（在呼叫清單中的位置）。你逐 index 累積，在 `id` 首次出現時把它讀下來，並在 `finish_reason = "tool_calls"` 時解析 JSON。
- **Anthropic。** 串流事件依序是 `message_start`，接著每個型別為 `tool_use` 的區塊各有一個 `content_block_start`（內含 id、name 與空的 input）。`content_block_delta` 事件承載 `input_json_delta` 分塊。`content_block_stop` 關閉每個區塊。
- **Gemini。** `streamFunctionCallArguments`（Gemini 3 以上）吐出的分塊帶 `functionCallId`，好讓呼叫能乾淨地交錯。在 Gemini 3 之前，串流一次只回傳一個完整的呼叫。

### 不完整的 JSON 與提早解析的陷阱

在 `arguments` 完整之前，你不能解析它。像 `{"city": "Beng` 這樣不完整的 JSON 是無效的，會拋出例外。正確的閘門是供應商的呼叫結束訊號：OpenAI 的 `finish_reason = "tool_calls"`、Anthropic 的 `content_block_stop`，或 Gemini 的串流結束事件。到那時才嘗試 `json.loads`。更穩健的做法是用一個增量式 JSON 解析器，在結構完成時逐步吐出事件；OpenAI 的串流指南建議在需要顯示即時「思考中」指示器的 UX 上這麼做。用數大括號來判斷完整性並不可靠（引號字串內或跳脫內容中的大括號會造成誤判），只該當成非正式的除錯啟發式。

### 亂序完成

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

宿主的回覆仍然必須標明那些 id：

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

在 OpenAI 或 Anthropic 上，回覆的順序不影響正確性。Gemini 也接受任意順序，只要 id 對得上。

### 基準測試：循序對平行

`code/main.py` 裡的測試框架模擬了三個延遲分別為 400、600、800 毫秒的執行器。循序跑總共 1800 毫秒。平行跑則是 max(400, 600, 800) = 800 毫秒。差距是固定量而非比例量，所以工具數量越多，省下的就越多。

真實世界的但書：平行呼叫會對下游 API 施壓。對一個有速率限制的服務做 10 路扇出會失敗。階段 13 · 17 談閘道層級的背壓；重試語意則規劃在未來的階段。

### 串流扇出的壁鐘時間

如果模型本身在串流，你可以在某一次呼叫的參數一完整就開始執行，而不必等到所有呼叫都定案。OpenAI 有記載這項最佳化，但並非所有 SDK 都暴露它。這一課的測試框架有做：只要模擬串流吐出一個完整的參數物件，宿主就立刻發動那次呼叫。

```figure
tp-parallel-fanout
```

## 框架應用

`code/main.py` 分兩半。前半用 `concurrent.futures.ThreadPoolExecutor` 把三次模擬的天氣呼叫分別以循序與平行跑一遍，並印出壁鐘時間。後半重播一份假的串流回應 —— 三次平行呼叫的 `arguments` 分塊交錯在同一道串流上 —— 並用 `StreamAccumulator` 逐 id 把它們重組起來。沒有 LLM、沒有網路，就只有重組邏輯。

要看的地方有：

- 循序計時器跑到 1.8 秒。同樣的假延遲下，平行計時器只跑到 0.8 秒。
- 累積器靠逐 id 緩衝來處理亂序抵達的分塊，並且只在每次呼叫的 JSON 完整時才解析。
- 執行器在某個 id 的參數一定案就發動，而不是等到所有串流都結束。

## 產出交付

這一課產出 `outputs/skill-parallel-call-safety-check.md`。給定一份工具登錄，這項技能會稽核哪些工具可以安全地平行化、哪些有順序相依，以及哪些會把下游的速率限制壓垮 —— 並回傳一份為每個工具加上 `parallel_safe` 旗標的修訂版登錄。

## 練習

1. 跑一次 `code/main.py` 並改變那些模擬延遲。確認平行對循序的比例大約是 `max/sum`（實際執行會因執行緒排程、序列化與測試框架開銷而略微偏離理想值）。在什麼樣的延遲分布下，平行就不再有意義了？

2. 擴充那個累積器，讓它處理「呼叫在串流中途被取消」的情況：丟掉它的緩衝並吐出一個 `cancelled` 事件。哪家供應商有明確記載這種情況？查一下 Anthropic 的 `content_block_stop` 語意與 OpenAI 的 `finish_reason: "length"` 行為。

3. 把執行緒池換成 `asyncio.gather`。兩者都做基準測試。你應該會看到 async 略勝，因為上下文切換成本較低，但前提是那些執行器真的在做 I/O。

4. 挑兩個「不」該平行化的工具（例如先 `create_file` 再 `write_file`）。在登錄中加上一張 `ordering_dependency` 圖，並讓平行扇出受這張圖節制。這就是相依感知排程所需的最小機件，未來的代理工程階段會把它形式化。

5. 讀 OpenAI 的平行函數呼叫章節與 Anthropic 的 `disable_parallel_tool_use` 文件。找出那一種 Anthropic 建議關掉平行的真實世界工具型別。（提示：對同一個資源做有後果的變更。）

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|------------------------|
| 平行工具呼叫 | 「一輪之內扇出」 | 模型在單一則 assistant 訊息中吐出多次工具呼叫 |
| `parallel_tool_calls` | 「OpenAI 的旗標」 | 啟用或停用多次呼叫的吐出 |
| `disable_parallel_tool_use` | 「Anthropic 的反向旗標」 | 選擇退出的旗標；預設是啟用平行 |
| 工具呼叫 id | 「對應的把手」 | 每次呼叫的識別字，結果訊息必須把它回敘一次 |
| 累積器 | 「串流緩衝區」 | 為每個 id 各配一個、承接部分 `arguments` 分塊的字串緩衝區 |
| 亂序完成 | 「誰快誰先」 | 平行呼叫的完成順序無法預測；id 是黏合劑 |
| 相依圖 | 「順序約束」 | 輸出會餵進其他工具輸入的那些工具；不能平行化 |
| 提早解析的陷阱 | 「JSON.parse 炸了」 | 試圖解析一個尚未完整的 `arguments` 字串 |
| `streamFunctionCallArguments` | 「Gemini 3 的功能」 | 帶每次呼叫唯一 id 的串流參數分塊 |
| 依完成順序回覆 | 「不用等全部」 | 結果一到就回覆，並以 id 為鍵 |

## 延伸閱讀

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) —— 預設行為與退出旗標
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) —— `disable_parallel_tool_use` 與結果批次處理
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) —— 從 Gemini 3 起帶 id 對應的平行呼叫
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) —— OpenAI 串流的分塊參數重組
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) —— 帶 `input_json_delta` 的 `content_block_delta`
