# 模型脈絡協定（Model Context Protocol, MCP）

> MCP 為 AI 宿主應用程式（Host）提供了一套統一的通訊協定，用以探索並呼叫工具（Tools）、資源（Resources）與 Prompt。2026-07-28 的最新修訂版本使該協定無狀態化（stateless）：能力宣告（capability declaration）與版本脈絡隨每一次獨立請求傳遞，而非綁定在連線的交握工作階段中。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 辨析 MCP 宿主（Host）、用戶端（Client）、伺服器（Server）、傳輸層（Transport）與伺服器原語（Server Primitives）的職責分工
- 建構符合 MCP 2026-07-28 規範所需中繼資料（metadata）的標準 JSON-RPC 請求
- 使用 `server/discover` 端點探測支援版本（supported version）、伺服器識別資訊與能力宣告
- 從工具、資源與 Prompt 回傳具備型別化且相容快取機制的執行結果
- 闡述現代無狀態 MCP 如何與早期依賴交握機制的伺服器實現雙向相容互通
- 為伺服器選擇安全的狀態、傳輸與核准邊界

## The Problem｜問題

你的應用程式需要查詢資料庫、排定行事曆以及讀取檔案。若缺乏通用的共享協定，每款 AI 宿主程式都必須為這同一套外部能力，重複編寫專屬的探索機制、呼叫邏輯、錯誤轉換、傳輸適配與授權（authorization）黏合程式碼。

MCP 縮減了龐雜的整合矩陣。伺服器對外發布標準的 JSON-RPC 介面；任何相容的用戶端皆能探索該介面、將其呈現給模型或終端使用者、執行呼叫並解析回傳結果，無需為個別伺服器撰寫特定廠商的專屬轉接器。

但請留意一個容易忽略的邊界：MCP 只是將通訊協定標準化。它不會決定模型應呼叫哪個工具、不保證不可信外部內容的安全性，也不將無狀態的請求自動轉換為持久化的應用層狀態。你的宿主程式與伺服器端仍須自行負責這些架構決策。

## The Concept｜核心概念

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### 三大伺服器原語

1. **工具（Tools）** 是可被執行的具體動作。每個工具包含名稱、用途描述、JSON Schema 輸入參數規格與處理函式。
2. **資源（Resources）** 是具備 URI 定址、可被用戶端讀取的具名資料內容。
3. **Prompt** 是宿主可向使用者暴露的可重複使用範本。

宿主（Host）即 AI 應用程式本身。宿主內部的 MCP 用戶端（Client）與單一伺服器（Server）進行溝通，傳輸層（Transport）則在兩者之間傳遞 JSON-RPC 訊息。

### 無狀態請求取代連線交握

MCP 2026-07-28 廢除了 `initialize` 與 `notifications/initialized`，同時移除了協定層級的工作階段（Sessions）。每一次請求都在 `params._meta` 中自帶解析所需的完整脈絡：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

協定版本號與用戶端能力宣告為強制必填欄位；用戶端身分識別資訊則為建議項目。若缺少 `_meta`、缺少必填欄位或欄位型別錯誤，視為格式畸形並回傳 Invalid Params（`-32602`）。若版本字串格式合法但伺服器未支援該版本，回傳 `UnsupportedProtocolVersionError`（`-32022`）。伺服器無需仰賴先前的任何交握協商紀錄，即可獨立處理任何合法請求。

無狀態並不意味著應用程式永遠不能保留狀態。它的意思是：狀態資訊不隱藏在底層 MCP 連線或 `Mcp-Session-Id` 標頭之後。若工作流程需要跨請求的連續性，伺服器應核發一個不透明代號（opaque handle），由用戶端在後續的呼叫中作為一般工具引數（tool arguments）傳入。授權狀態在每一次請求中仍必須重新驗證。

### 探索與版本選型

每座現代伺服器皆實作了 `server/discover` 端點。回傳結果宣告了所支援的協定版本清單、能力範疇與伺服器識別資訊：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

用戶端亦可直接呼叫業務方法並處理版本報錯，但透過探索能讓能力展示與版本協商更加明確。當遇到不支援的版本時，伺服器回傳錯誤碼為 `-32022` 的 `UnsupportedProtocolVersionError`，其附帶資料包含伺服器支援版本陣列 `supported` 與被拒絕的版本 `requested`。

在 stdio 傳輸模式下，具備雙相容能力的用戶端會先以 `server/discover` 進行探測。若收到探索結果或如 `UnsupportedProtocolVersionError` 這類現代已知錯誤，即可斷定對方為現代伺服器；任何未被識別為現代特徵的錯誤或逾時，則允許向下相容退回 2025-11-25 的舊版 `initialize` 流程。舊版機制只作為相容備援程式碼，不是現代系統的預設實作。

### 結果具備顯式狀態

2026-07-28 核心規範下的所有回傳結果皆明確包含 `resultType`：

- `complete` 代表操作已完全執行完畢。
- `input_required` 代表伺服器需要透過多輪來回請求模式（Multi Round-Trip Requests, MRTR）向用戶端索取更多輸入。核心伺服器僅允許在 `tools/call`、`resources/read` 或 `prompts/get` 中回傳此狀態。

用戶端必須將省略 `resultType` 的舊版回傳結果視為已完成（complete）。

伺服器應在所有結果的 `_meta` 中附加 `io.modelcontextprotocol/serverInfo`。該資訊由伺服器自主宣告，僅供展示、日誌紀錄與除錯之用，不應作為安全性決策的依據。

清單查詢與讀取操作的結果亦會附帶 `ttlMs`（快取存活時間）與 `cacheScope`（快取範疇，cache scope）。確定性的 `tools/list` 排序規則搭配快取新鮮度提示，能讓用戶端安全快取探索結果，並提升 Prompt 快取的穩定度。`cacheScope: public` 允許跨工作階段共享快取，`private` 則限制僅能在當前呼叫脈絡中重複使用。

### 傳輸格式與通訊協定

MCP 使用基於 stdio 或 Streamable HTTP 的 JSON-RPC 2.0 協定：

- 請求（Request）包含 `jsonrpc`、`id`、`method` 與 `params`。
- 回應（Response）包含對應的 `id` 以及 `result` 或 `error` 二者之一。
- 通知（Notification）不帶 `id`，且不期望收到任何回應。

現代 Streamable HTTP 僅暴露單一接受 POST 的端點，每一條 JSON-RPC 訊息皆擁有獨立的 POST 請求。請求 POST 會收到單一 JSON 物件回應，或是以最終結果作結的請求級伺服器發送事件（SSE）串流。被接收的通知 POST 則收到不帶 Response Body 的 HTTP 202；在該核心修訂版中，未定義用戶端向伺服器發送的 Streamable HTTP 通知。

在 2026-07-28 中，已移除獨立的 MCP GET 串流、DELETE 關閉工作階段端點、`Mcp-Session-Id` 標頭以及 `Last-Event-ID` 斷線重放機制。長期的變更通知統一採用 `subscriptions/listen` POST 建立，其 HTTP 回應會保持開啟為持續的 SSE 串流。

### 無需伺服器發起請求的用戶端輸入機制

在舊版規範中，允許伺服器主動透過連線逆向發送 `sampling/createMessage`、`roots/list` 或 `elicitation/create` 等請求。現行協定改採多輪來回請求（MRTR）模式取而代之：符合條件的工具呼叫、資源讀取或 Prompt 取得操作會回傳 `resultType: input_required`，並附帶 `inputRequests` 或 `requestState` 中的至少一項。用戶端收集所需的補充輸入後，使用全新的 JSON-RPC ID 與對應的 `inputResponses` 重新呼叫原方法，並在有提供時精確回傳該 `requestState`。若原本未包含 `inputRequests`，重試呼叫時則省略 `inputResponses`。

Roots（根目錄）、Sampling（模型取樣）與 Logging（日誌）功能雖仍相容，但已被正式標記為棄用（deprecated），新實作不應採用。既有的 Roots 或 Sampling 需求改在 MRTR 的 `inputRequests` 內部傳遞，不可作為獨立的「伺服器對用戶端」JSON-RPC 請求發送。請優先採用顯式的檔案／目錄參數、資源 URI、伺服器端配置以及直接整合的模型服務供應商介面。在 stdio 下使用 stderr 輸出診斷資訊，在正式環境中使用 OpenTelemetry 記錄遙測（telemetry）資料。

```figure
mcp-nxm-collapse
```

## Build It｜動手實作

### 步驟 1：註冊伺服器介面

儘管底層通訊契約已有變化，伺服器端的介面註冊依然保持簡單：

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

收錄於 `code/main.py` 的實作亦註冊了資源與 Prompt。該實作刻意採用 Python 標準函式庫完成，讓你能清楚看見每一層封裝信封，而非將通訊協定交給第三方 SDK。

### 步驟 2：為每個請求附加中繼資料

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

切勿僅將這份中繼資料快取於連線物件中，因為伺服器會在每一次收到的獨立請求上重新驗證。

### 步驟 3：在列出工具前可選擇服務探索

發起 `server/discover` 請求、選定相容版本，隨後呼叫 `tools/list`。若你已事先明確知曉伺服器版本且具備處理 `-32022` 錯誤的能力，直接呼叫 `tools/list` 也是有效的做法。

展示範例依工具名稱字母順序回傳清單，並綁定 `ttlMs`、`cacheScope`、`resultType` 以及伺服器識別資訊。工具呼叫則回傳已完成且不可快取的結果，因為其輸出可能取決於當前系統狀態。

### 步驟 4：將相同請求映射至 HTTP 協定

遠端 `tools/call` POST 請求需包含反映 JSON-RPC 酬載的專屬標頭：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

其中 `MCP-Protocol-Version` 標頭必須與 `_meta` 中的協定版本一致；`Mcp-Method` 在每一次 JSON-RPC 請求中皆屬必填，且必須與 `method` 吻合；`Mcp-Name` 僅在 `tools/call`、`resources/read` 與 `prompts/get` 中為必填項目，且必須對應至工具名稱、資源 URI 或 Prompt 名稱。若缺少必填標頭或數值不一致，伺服器會回傳帶有 `HeaderMismatch` 錯誤碼 `-32020` 的 HTTP 400。

### 步驟 5：在協定狀態之外強制執行安全邊界

- 在每一次 HTTP 請求中驗證授權憑證（Authorization）與受眾對象（Audience）。
- 本機伺服器應綁定至 localhost，並在 Streamable HTTP 模式下校驗 `Origin` 來源。
- 具備副作用的狀態變更工具應標記 `destructiveHint: true`，且必須取得宿主環境的使用者核准確認。
- 顯式傳遞目錄與檔案範圍參數，不要仰賴已棄用的 Roots 機制。
- 一律將所有讀取到的資源與工具輸出內容視為不可信外部資料。
- 在 stdio 模式下，stdout 必須保留給 JSON-RPC 訊息，所有診斷除錯日誌一律寫入 stderr。

## Use It｜實際應用

在該課程目錄下執行測試：

```bash
python3 code/main.py
cd code
python3 -m unittest discover tests -v
```

首行輸出應正確回報探測到執行於 `2026-07-28` 協定下的 `demo-server`。接著檢視 `MCPClient.request`：確認其為每一次呼叫皆動態組裝 `_meta`。試著從某次請求中移除該中繼資料，觀察伺服器如何拒絕該請求。

## Ship It｜交付成果

`outputs/skill-mcp-server-designer.md` 能將特定業務領域轉化為無狀態 MCP 架構設計。其驗收門檻涵蓋：探索結果宣告、單請求中繼資料政策、確定性具快取感知的清單排序、明確的狀態代號（status code）、傳輸標頭規範、授權驗證與危險操作核准規則。

## Continue the MCP Deep Dive｜深入探索 MCP 系列

本課為你建立了核心協定架構。Phase 13 進一步將四個正式環境的邊界拆解為獨立的實作與驗證課程：

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md) 深入封閉式輸入 Schema、結構化內容、路由中繼資料、不透明分頁、補全授權，以及協定層與工具業務層錯誤的本質差異。
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md) 涵蓋請求取消、長效任務終止、超時限制、等冪性保護、背壓（backpressure）控制、代理緩衝與斷線重連行為。
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md) 探討命名空間所有權證明、產物溯源驗證、不可變版本釘選、即時漂移偵測、註冊中心審查證據與版本回滾機制。
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md) 涵蓋標準與負向網路傳輸日誌錄製、嚴格版本劃分、SDK 實作差異對比、代理審計證據、敏感資料遮除、健康閘門與發布回滾。

當你的伺服器即將跨越團隊界限或信任邊界時，請依序修習上述課程。它們會帶你從「介面可執行」，逐步邁向「合約在部署過程中仍安全且可診斷」。

## Exercises｜練習

1. 新增一個 `subtract` 工具，並驗證 `tools/list` 依然按照字母順序升冪排序。
2. 刻意移除 protocol-version 鍵值並確認收到 Invalid Params（`-32602`）。隨後傳送格式合法但未受支援的舊版版本號 `2025-11-25`，確認觸發 `-32022` 錯誤、驗證回傳的 `requested` 正確記錄該版本，並能從 `supported` 清單中重新協商。
3. 為建立操作實作由伺服器核發的 `draftId`，隨後要求在更新操作中將其作為引數傳回。說明為何這屬於應用層的業務狀態，而非協定層級的工作階段。
4. 針對需要使用者確認的操作，實作回傳 `input_required` 的工具。使用全新的 JSON-RPC ID、`inputResponses` 條目以及完全一致的 `requestState` 重新發起原本的呼叫，而非自行構造非法的「伺服器對用戶端」逆向請求。
5. 構思一套具備雙版本相容能力的 stdio 用戶端。將正常結果或已知現代錯誤視為現代伺服器特徵，僅在遭遇無法識別的錯誤或逾時時，才允許退回 `initialize` 舊版流程。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|------------------------|
| MCP | 「專為 LLM 設計的工具協定」 | 用於伺服器探索、工具、資源、Prompt 與擴充功能的標準 JSON-RPC 協定 |
| 宿主（Host） | 「那個 AI App」 | 掌控模型與 UI 介面，並掛載一個或多個 MCP 用戶端的頂層應用程式 |
| 用戶端（Client） | 「連接器」 | 代表宿主應用程式與單一 MCP 伺服器進行通訊的協定轉譯實體 |
| 無狀態 MCP（Stateless MCP） | 「不用維護 Session」 | 每個請求自帶版本與能力宣告；協定層不維護任何綁定於連線實體上的隱式狀態 |
| `server/discover` | 「能力探測端點」 | 伺服器必須實作的標準方法，對外宣告支援版本、功能範疇與身分識別 |
| `resultType` | 「結果狀態旗標」 | 明確將回傳結果標記為已完成（`complete`）或需補充輸入（`input_required`） |
| 狀態代號（State handle） | 「工作流 ID」 | 由伺服器核發、作為普通工具引數傳遞的應用層不透明識別標籤 |
| Streamable HTTP | 「遠端傳輸協定」 | 僅暴露單一接受 POST 的 HTTP 端點，以 JSON 或請求級 SSE 串流傳回回應 |
| MRTR | 「詢問並重試」 | 多輪來回請求模式——在結果中置入輸入請求，隨後對原操作發起帶有補全引數的重新呼叫 |

## Further Reading｜延伸閱讀

- [MCP 2026-07-28 主要變更](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP 伺服器探索](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP 多輪來回請求（MRTR）](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 已棄用功能](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
