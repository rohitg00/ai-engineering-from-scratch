# FIPA-ACL 與言語行為的傳承

> 在 MCP 之前、在 A2A 之前，有 FIPA-ACL。2000 年，IEEE 的 Foundation for Intelligent Physical Agents 批准了一套代理通訊語言，帶二十種 performative、兩種內容語言，以及一組互動協定 —— contract net、subscribe/notify、request-when。它從業界淡出，是因為本體論的開銷對網頁來說太重；但多代理系統在 LLM 時代的復興，正悄悄地把同樣的構想重新實作一遍，只是少了形式語意：JSON 契約頂替 performative，自然語言頂替本體論。這一課認真讀 FIPA-ACL，好讓你看得出 2026 年哪些協定決策是重新發明、哪些是真的新，以及當前這一波會在哪裡重新發現 2000 年代早就解過的問題。

**類型：** 學習
**程式語言：** Python (stdlib)
**先修單元：** 階段 16 · 01（為什麼要多代理）
**時間：** 約 60 分鐘

## 問題

2026 年的代理協定版圖很熱鬧：工具用 MCP、代理用 A2A、企業稽核用 ACP、去中心化信任用 ANP、自然語言內容用 NLIP，加上 CA-MCP 與二十幾份研究提案。每一份規格都自稱是地基。

誠實的讀法是：其中多數都在重新發現一棵非常特定、二十年前的決策樹。Austin（1962）與 Searle（1969）的言語行為理論給了我們「話語即行動」。KQML（1993）把它變成一份線上協定。FIPA-ACL（2000 年批准）產出了那份參考標準化：二十種 performative、內容語言 SL0/SL1，以及供 contract-net 與 subscribe-notify 用的互動協定。JADE 與 JACK 是 Java 的參考平台。這股努力在 2010 年前後淡去，因為本體論開銷太重，而網頁正在獲勝。

當你看 MCP 的 `tools/call`、A2A 的任務生命週期，或 CA-MCP 的共享脈絡儲存時，你看到的是 FIPA 那些決策的一份較軟、以 JSON 為原生的翻炒。認識這份傳承會告訴你兩件事：哪些新「創新」其實是重新發明，以及新規格會重新發現哪些老的失敗模式。

## 概念

### 一段話講完言語行為

Austin 注意到，有些句子並不描述世界 —— 它們改變世界。「我承諾。」「我請求。」「我宣告。」他把這些叫做 performative utterance（施行性話語）。Searle 把它形式化成五類：斷言型、指令型、承諾型、表達型、宣告型。KQML（Finin 等人，1993）讓這件事對軟體代理變得可操作：一則訊息是一個 performative（那個行動）加上內容（那個行動是關於什麼）。FIPA-ACL 補起 KQML 的缺口，並圍繞二十種 performative 做了標準化。

### FIPA 的二十種 performative（部分清單）

| Performative | 意圖 |
|---|---|
| `inform` | 「我告訴你 P 為真」 |
| `request` | 「我請你做 X」 |
| `query-if` | 「P 為真嗎？」 |
| `query-ref` | 「X 的值是多少？」 |
| `propose` | 「我提議我們做 X」 |
| `accept-proposal` | 「我接受這項提議」 |
| `reject-proposal` | 「我拒絕這項提議」 |
| `agree` | 「我同意做 X」 |
| `refuse` | 「我拒絕做 X」 |
| `confirm` | 「我確認 P 為真」 |
| `disconfirm` | 「我否認 P」 |
| `not-understood` | 「你的訊息解析不了」 |
| `cfp` | 「就 X 徵求提案」 |
| `subscribe` | 「X 改變時通知我」 |
| `cancel` | 「取消進行中的 X」 |
| `failure` | 「我試了 X 但失敗了」 |

完整清單在 `fipa00037.pdf`（FIPA ACL Message Structure）裡。重點不是把它背起來 —— 重點是這裡面每一項，都對應到某個 LLM 協定最終會重新加回去的原語。

### 典範化的 FIPA-ACL 訊息

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

七個欄位承載協定封套；一個欄位（`content`）承載酬載。其餘那些欄位，正是你每次把重試、討論串與本體論栓到 JSON 協定上時所重新發明的東西。

### 那兩個遺產平台

**JADE**（Java Agent DEvelopment framework，1999–2020 年代）是使用最廣的 FIPA 相容執行環境。代理繼承一個基礎類別、交換 ACL 訊息、跑在容器裡，並用「behaviors」來協調。它內附的互動協定庫含 contract-net、subscribe-notify、request-when 與 propose-accept。

**JACK**（Agent Oriented Software，商業產品）在 FIPA 訊息之上強調 BDI（信念—欲望—意圖）推理。更形式化，採用度較低。

網頁堆疊吃掉多代理的使用情境之後，兩者都衰退了。MCP 與 A2A 就是 2026 年那些執行環境「容器」。

### FIPA 為什麼淡出

- **本體論開銷。** FIPA 要求有一份共享本體論才能解析 `content`。要在本體論上取得共識是一場多年的標準化流程。網頁那邊就只用 HTTP + JSON。
- **沒人用的形式語意。** SL（Semantic Language）給出嚴謹的真值條件，但多數生產系統用的是自由形式的內容，並且忽略那套形式化。
- **工具鏈鎖定。** JADE 只有 Java；JACK 是商業產品。多語言團隊繞過了兩者。
- **網際網路贏了那套堆疊。** REST、然後 JSON-RPC、然後 gRPC 取代了 ACL 的傳輸。

### LLM 時代的復興是 FIPA 精簡版

拿 FIPA 的 `request` 跟 MCP 的 `tools/call` 比較：

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

同樣的封套，不同的語法。兩者都帶著：誰、給誰、意圖、酬載、關聯 id。兩者相對於彼此都不是什麼革命 —— 它們是同一份設計上的不同取捨。

Liu 等人 2025 年那份綜述（〈A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP〉，arXiv:2505.02279）把這條血脈講得很明白：MCP 對應工具使用的言語行為、A2A 對應代理對代理的言語行為、ACP 對應稽核軌跡的言語行為、ANP 對應去中心化身分的延伸。這些新規格是 ACL 的後代，帶 JSON 語法與更鬆的語意。

### 把取捨直白說出來

**FIPA 給你、而現代規格丟掉的：**

- 形式語意 —— 你可以證明 `inform` 蘊含發送者相信那份內容。
- 一份正典的 performative 目錄 —— 你不必再爭論一次「我們該不該有 `cancel`？」。
- 幾十年的互動協定樣式 —— contract-net、subscribe-notify、propose-accept —— 帶著已知的正確性性質。

**現代規格給你、而 FIPA 沒有的：**

- 與每一種現代工具相容的 JSON 原生酬載。
- LLM 不必手寫本體論就能詮釋的自然語言內容。
- 網頁堆疊的傳輸（HTTP、SSE、WebSocket）。
- 透過自我描述文件做能力發現（MCP 的 `listTools`、A2A 的 Agent Card）。

用更鬆的意圖語意，換更容易的實作。這就是那筆交易。

### 值得移植過來的互動協定

FIPA 出貨了約 15 種互動協定。有三種值得帶進 LLM 多代理系統：

1. **合約網協定（CNP）。** 管理者發出 `cfp`（徵求提案）；投標者以 `propose` 回應；管理者接受／拒絕。這是那個典範化的任務市場模式（階段 16 · 16 談判）。
2. **Subscribe/Notify。** 訂閱者送出 `subscribe`；發布者在主題改變時送出 `inform`。這就是 2026 年的每一條事件匯流排。
3. **Request-When。** 「當條件 Y 成立時做 X。」帶前置條件的延遲行動。2026 年的對應物是持久工作流引擎裡的延後任務（階段 16 · 22 生產擴展）。

每一種都能乾淨地對映到現代的訊息佇列、HTTP + 輪詢，或 SSE 串流上。

### 丟掉本體論之後會壞掉什麼

沒有共享本體論，代理就從自然語言內容中推斷意義。2026 年有記錄的失敗模式是**語意漂移**：兩個代理用同一個詞（`"customer"`）指涉細微不同的概念，接收端的代理依錯誤的詮釋行動，而沒有任何 schema 驗證器抓得到。FIPA 那項本體論要求，本來會在解析時就把該訊息拒絕掉。

不用走到完整本體論的緩解方式：

- 對 `content` 做 JSON Schema —— 在線上就拒絕結構錯誤。
- 具型別的產物（A2A）—— 拒絕錯誤的模態。
- 在封套中明寫 performative —— 就算內容是自然語言，意圖也不含糊。

### 把 2026 年的規格對映到言語行為的傳承

| 現代規格 | FIPA 對應物 | 它保留了什麼 | 它丟掉了什麼 |
|---|---|---|---|
| MCP `tools/call` | `request` | 明寫的意圖、關聯 id | 形式語意、本體論 |
| MCP `resources/read` | `query-ref` | 明寫的意圖、關聯 id | 形式語意 |
| A2A 的 Task 生命週期 | contract-net + request-when | 非同步生命週期、狀態轉移 | 形式化的完備性保證 |
| A2A 的串流事件 | subscribe/notify | 非同步推送 | 具型別述詞的訂閱 |
| CA-MCP 的共享脈絡 | 黑板（Hayes-Roth 1985） | 多寫入者的共享記憶 | 邏輯一致性模型 |
| NLIP | 自然語言內容 | LLM 原生 | schema |

從上讀到下，樣式是：保住結構性原語、丟掉形式化，讓 LLM 去把含糊的地方糊過去。

```figure
sw-contract-net
```

## 動手實作

`code/main.py` 實作一個純 stdlib 的 FIPA-ACL 轉譯器。它編碼與解碼那份典範化的 ACL 封套，並展示每一種 MCP／A2A 的訊息形狀，都化約成同樣那七個欄位。示範內容：

- 把五則 MCP 式與 A2A 式的訊息編碼成 FIPA-ACL。
- 把 FIPA-ACL 解碼回現代的對應物。
- 用 `cfp`、`propose`、`accept-proposal`、`reject-proposal` 在一位管理者與三位投標者之間跑一場玩具版合約網協商。

跑：

```
python3 code/main.py
```

輸出是一份並排軌跡，顯示每一則現代訊息在 2026 年 JSON 形式與 FIPA-ACL 形式下的樣子，接著是一次合約網投標的往返。同樣的協定原語撐過了那趟往返；不同的只有語法。

## 框架應用

`outputs/skill-fipa-mapper.md` 是一項技能，會讀任何代理協定規格並產出它的 FIPA-ACL 對映。在採用一份新協定之前用它來回答：「這真的是新的，還是只是換上 JSON 語法的 `inform`？」

## 產出交付

不要把 FIPA-ACL 帶回來。把它的檢查清單帶回來：

- 每一則訊息的意圖原語（performative）是什麼？
- 有沒有供請求—回應與取消用的關聯 id？
- 有沒有明寫的內容語言（JSON-RPC、純文字、具型別的結構化產物）？
- 互動協定是一等公民，還是你正在從零重新實作 contract-net？
- 當兩個代理對內容意義有分歧時會發生什麼事（語意漂移）？

在把任何新協定推進生產之前，先替這五個問題留下文件。

## 練習

1. 跑 `code/main.py`。觀察那趟往返編碼。指認出 `tools/call`、`resources/read` 與 A2A 任務建立各自對應哪個 FIPA performative。
2. 替合約網示範擴充一個 `cancel` performative，讓管理者能在投標進行中撤回任務。`cancel` 解決了哪個單靠重試解決不了的失敗案例？
3. 讀 FIPA ACL Message Structure（http://www.fipa.org/specs/fipa00037/）第 4.1–4.3 節。挑一個本課沒涵蓋的 performative，描述它在現代 JSON-RPC 中的對應物。
4. 讀 Liu 等人，arXiv:2505.02279。針對 MCP、A2A、ACP、ANP 各自列出它們保留與丟掉的 FIPA performative 家族。
5. 替你自己系統中 `request` performative 的 `content` 欄位設計一份最小的 JSON Schema。那份 schema 給了你什麼純自然語言給不了的東西，而它的代價是什麼？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 言語行為 | 「一句會做事的話」 | Austin／Searle：話語即行動。ACL 的理論父輩。 |
| FIPA | 「那個很舊的 XML 東西」 | IEEE Foundation for Intelligent Physical Agents。2000 年把 ACL 標準化。 |
| ACL | 「代理通訊語言」 | FIPA 的封套格式：performative + 內容 + 中繼資料。 |
| Performative | 「那個動詞」 | 一則訊息的意圖類別：`inform`、`request`、`propose`、`cfp` 等。 |
| KQML | 「FIPA 的前身」 | Knowledge Query and Manipulation Language（1993）。更簡單、更窄。 |
| 本體論 | 「共享詞彙」 | 對內容語言所談概念的形式化定義。 |
| SL0 / SL1 | 「FIPA 的內容語言」 | Semantic Language 的第 0 與第 1 級 —— 那個形式化內容語言家族。 |
| 合約網 | 「任務市場」 | 管理者發 cfp；投標者提案；管理者接受。那個典範化的互動協定。 |
| 互動協定 | 「訊息的樣式」 | 一串帶已知正確性的 performative 序列：request-when、subscribe-notify 等。 |

## 延伸閱讀

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) —— 把現代規格連回 FIPA 傳承的那份 2025 典範綜述
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) —— 2000 年批准的封套格式
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) —— 完整的 performative 目錄
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) —— `request`／`query-ref` 在當前無狀態工具使用上的對應物
- [A2A specification](https://a2a-protocol.org/latest/specification/) —— contract-net 與 subscribe-notify 的現代代理對代理對應物
