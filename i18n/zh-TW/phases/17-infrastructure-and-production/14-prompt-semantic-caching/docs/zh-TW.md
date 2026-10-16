# Prompt 快取與語意快取的經濟學（Prompt Caching and Semantic Caching Economics）

> **定價快照日期：2026-04。** 以下數值宣稱反映本課發布時所擷取的各服務供應商官方費率表；在將其引用至下游決策之前，請務必點選連結查驗最新官方文件。

> 快取分成兩個層次。L2（服務供應商層級）Prompt/前綴快取針對重複前綴重複利用注意力 KV——Anthropic 官方 Prompt 快取文件宣稱在長 Prompt 上最高可降低 90% 的成本與 85% 的延遲；在 Claude 3.5 Sonnet 上，快取讀取單價為 $0.30/M，相比於全新輸入的 $3.00/M 便宜 10 倍，具有 5 分鐘 TTL，並提供寫入溢價為 2 倍的 1 小時 TTL 選項（docs.anthropic.com，2026-04）。OpenAI 的 Prompt 快取則對大於等於 1,024 Token 的 Prompt 自動生效，快取輸入相較於全新輸入給予約 90% 的折扣（platform.openai.com，2026-04）；確切的各模型快取費率取決於即時費率表。L1（應用程式層級）語意快取則在 Embedding 向量相似度命中時，直接徹底繞過 LLM 推論。廠商標稱的「95% 準確率」指的是回傳快取的語意匹配正確性，而非命中率——實測正式環境中的真實命中率從 10%（開放式閒聊）跨越至 70%（結構化 FAQ）；兩大服務供應商皆未發布官方基準線，因此請將其視為社群實測經驗而非絕對保證。兩大經典正式環境陷阱：並行呼叫會徹底殺死快取（在首次快取寫入完成前發出的 N 個並行請求會導致帳單暴增數倍），以及前綴內部夾雜動態內容會導致快取完全無法命中。ProjectDiscovery 實測報告指出，僅僅透過將動態文字移出可快取前綴，其快取命中率便從 7% 暴衝至 74%（2025-11）。

**Type:** Learn
**Languages:** Python (stdlib, toy two-layer cache simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 嚴格區分 L2 服務供應商級 Prompt/前綴快取（服務供應商端複用注意力 KV）與 L1 應用層語意快取（基於相似度徹底繞過 LLM）。
- 深入解釋 Anthropic 的 `cache_control` 顯式標註語法，以及兩大 TTL 選項（5 分鐘 vs 1 小時）背後的寫入成本倍率乘數。
- 給定具體命中率、輸入輸出比例與 Token 單價，精確計算月度財務節省期望值。
- 指出會導致帳單暴增 5 至 10 倍的並行呼叫反模式，以及會導致命中率徹底雪崩的動態內容反模式。

## The Problem｜問題

你為團隊的 RAG 服務配置了 Prompt 快取。然而月底的雲端帳單完全沒有下降。你深入分析了命中率指標；結果發現命中率僅有淒慘的 7%。你的 Prompt 表面上看起來完全靜態，但實質上暗藏玄機——系統 Prompt 內部精確包含了格式化到「分」的當前時間戳記、動態生成的請求 ID，以及為了防止單調而隨機打亂順序的 Few-shot 範例。每一個請求都在底層寫入一個全新的獨立快取條目，命中率為零。

在另一個維度，你的 Agent 針對使用者的單一問題並行觸發了 10 個工具呼叫。這 10 個共用相同前綴的請求在第一次快取寫入完成前抵達服務供應商。結果是觸發了 10 次高昂的寫入溢價，快取讀取享受次數為零。你的帳單比原本預期的「啟用快取後」費用高出 5 至 10 倍。

快取是一套運作規則，而不是一個開關。兩個層次，兩種不同的失敗模式。

## The Concept｜核心概念

### L2——雲端服務供應商級 Prompt/前綴快取（L2 — provider prompt/prefix caching）

服務供應商會儲存可快取前綴的注意力 KV，並在下一個符合該前綴的請求中重複使用。你只需在首次未命中時支付一次性寫入成本，後續讀取費用近乎免費。

**Anthropic（Claude 3.5 / 3.7 / 4 系列）**：在請求結構中強制顯式標註 `cache_control`。你親自指定哪些區塊具備可快取性。TTL 生命週期：5 分鐘（寫入成本為基準費率的 1.25 倍）或 1 小時（寫入成本為基準費率的 2 倍）。快取讀取單價：在 Claude 3.5 Sonnet 上僅為 $0.30/M，相對於全新輸入的 $3.00/M 足足便宜 10 倍（docs.anthropic.com，截至 2026-04）。不同模型（Opus/Haiku）費率獨立公布；務必對照即時定價頁面。

**OpenAI**：針對長度大於等於 1,024 Token 的 Prompt 自動開啟快取（platform.openai.com，2026-04）。無需在請求中顯式標記任何開關。在現行 gpt-4o/gpt-5 費率表下，快取輸入單價約為全新輸入的十分之一。官方文件與版本紀錄皆未給出基準命中率保證；社群在精細化 Prompt 模板設計下實測回報約為 30% 至 60%。持續監控 `usage.cached_tokens` 指標以度量你自身的真實收益。

**Google（Gemini）**：透過顯式 Context Caching API 運作；面對百萬級 Token 的超長上下文，快取效益更高。

**開源自建（vLLM、SGLang）**：第 17 課第 06 節詳述的 RadixAttention——在私有算力上實踐完全相同的架構哲學。

### L1——應用層語意快取（L1 — app-level semantic caching）

在發起任何 LLM 網路呼叫之前，先對使用者 Prompt 進行雜湊並計算向量 Embedding，隨後尋找相似的快取請求（通常要求餘弦相似度大於閾值，如 0.95 以上）。若命中，直接回傳快取回應；若未命中，才呼叫 LLM 並將結果寫入快取。

開源方案：Redis Vector Similarity、GPTCache、Qdrant。商業託管：Portkey Cache、Helicone Cache。

廠商宣稱的「95% 準確率」指的是回傳的快取內容在語意上具備實質關聯的機率——絕非你的快取命中率。正式環境中的真實命中率分佈：

- 開放式自由對話：10% 至 15%。
- 結構化業務 FAQ 與客服：40% 至 70%。
- 程式碼輔助生成：20% 至 30%（小幅變化就可能導致快取未命中）。
- 重複 prompt 的語音 agent：50% 至 80%（採用固定語音正規化）。

### 並行反模式（The parallelization anti-pattern）

你的 Agent 並行發起了 10 次工具呼叫。這 10 次呼叫皆攜帶了相同的 4k Token 系統 Prompt。在 Anthropic 的架構中，快取寫入是以單一請求為單位完成的；服務供應商在接收到 Prompt 後約需 300 ms 才能完成快取寫入。第 2 至第 10 個請求在同一個毫秒窗口內蜂擁而至，此時快取尚未就緒，每個請求皆被判定為「快取未命中」。其悲劇結果是：你被迫支付了 10 次高昂的寫入溢價，卻享受到了 0 次讀取折扣。

標準修復架構：**串行首發批次模式（Sequential-first batching）**——先發出單一第 1 個請求，等待快取建立後，再一口氣並行併發第 2 至第 10 個請求。該設計使第一個工具呼叫增加 300 ms，可讓帳單減少 5 至 10 倍。

### 動態內容反模式（The dynamic content anti-pattern）

你的系統 Prompt 被拼接成如下形狀：

```
You are a helpful assistant. The current time is 14:32:17.
User ID: abc123. Today is Tuesday...
```

每個請求的動態時間戳記都不同。每個請求皆被視為全新輸入。每個請求都在浪費寫入費用。命中率恆等於零。

修正方式：將所有真正靜態的內容移至可快取前綴；動態內容則接在快取邊界之後：

```
[cacheable]
You are a helpful assistant. [rules, examples, instructions]
[/cacheable]
[dynamic, not cached]
Current time: 14:32:17. User: abc123.
```

ProjectDiscovery 團隊正是透過這項精細化重構，將快取命中率從 7% 提升至 74%，並在業界公開發表了其架構剖析。

### 疊加批次與快取以攻克離線負載（Stack batch + cache for overnight workloads）

Batch API（第 17 課第 15 節）在 24 小時非同步履約條件下提供 5 折優惠。若在此基礎上疊加 Prompt 快取，輸入成本能再次下砍 10 倍。對於深夜進行的非即時文字分類、海量打標與離線報表生成任務，將兩者技術雙重疊加後，總算力支出能被壓縮至原始未快取同步呼叫的約 10% 極限水準。

### 務必銘記的核心數字指標（Numbers you should remember）

定價資料擷取自 2026-04 的連結文件，費率每隔數月可能有所調整——使用前請重新確認。

- Anthropic 快取讀取費率：Claude 3.5 Sonnet 為 $0.30/M，約比全新輸入便宜 10 倍（docs.anthropic.com）。
- Anthropic 快取寫入溢價：5 分鐘 TTL 為 1.25 倍；1 小時 TTL 為 2 倍。
- OpenAI 自動快取門檻：適用於大於等於 1,024 Token 的 Prompt；快取輸入費率約為全新輸入的 10%（platform.openai.com）。
- 語意快取社群實測命中率：開放聊天約 10%；結構化 FAQ 最高可達約 70%。
- ProjectDiscovery：透過將動態內容移出前綴，命中率從 7% 增至 74%（專案部落格，2025-11）。
- 並行呼叫反模式代價：N 個並行請求搶跑未命中首次寫入時，帳單通常面臨 5 至 10 倍的嚴重虛胖。

```figure
semantic-cache-hit
```

## Use It｜實際應用

`code/main.py` 在混合業務流量下模擬了一套整合 L1 語意快取與 L2 服務供應商前綴快取的雙層快取系統。即時輸出各層級命中率、最終帳單對比，並呈現並行化造成的費用影響。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-cache-auditor.md`。輸入現有 Prompt 模板與業務流量特徵分佈，該 Skill 會評估當前模板的快取友善度，並建議重整方式。

## Exercises｜練習

1. 執行 `code/main.py`。切換並行呼叫開關後，帳單會有多少變化？
2. 你的系統 Prompt 中包含即時動態日期。將其精確移出快取邊界。計算前後的理論快取命中率變化。
3. 給定你自身業務的請求抵達頻率曲線，精確推算選用 1 小時 TTL（2 倍寫入溢價）相比於 5 分鐘 TTL（1.25 倍寫入溢價）的財務損益平衡點。
4. 某語意快取在 0.95 相似度閾值下命中率僅有 20%。當放寬至 0.85 時命中率躍升至 50%，但開始偶發回傳錯誤的歷史回應。你該如何權衡並設定最合理的黃金閾值？
5. 針對單一使用者問題，你的 Agent 需要發起 10 個並行子查詢。在不增加整體端到端延遲的前提下，重構該發送管線以使其對 L2 快取高度友善。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| L2 prompt cache | 「前綴快取」 | 服務供應商儲存重複前綴的 KV |
| `cache_control` | 「Anthropic 快取標記」 | 用來標記可快取區塊的明確屬性 |
| Cache write premium | 「寫入額外費用」 | 首次未命中並寫入快取時產生的額外成本（1.25 倍或 2 倍） |
| L1 semantic cache | 「embedding 快取」 | 呼叫 LLM 前，在應用層對內容雜湊並產生 embedding |
| GPTCache | 「LLM 快取函式庫」 | 常見的開源 L1 快取函式庫 |
| Cache hit rate | 「命中次數／總次數」 | 由快取提供服務的請求比例 |
| Parallelization anti-pattern | 「N 次寫入陷阱」 | N 個並行請求各自都未命中快取，造成 N 次寫入 |
| Dynamic content trap | 「prompt 中的時間陷阱」 | 前綴中的動態內容會破壞快取命中率 |
| RadixAttention | 「副本內快取」 | SGLang 的前綴快取實作 |

## Further Reading｜延伸閱讀

- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 官方 `cache_control` 語意與 TTL 規格說明書。
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) — 自動快取行為與生效條件指南。
- [TianPan — Semantic Caching for LLMs Production](https://tianpan.co/blog/2026-04-10-semantic-caching-llm-production) — 正式環境大模型語意快取架構指南。
- [ProjectDiscovery — Cut LLM Costs 59% With Prompt Caching](https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching) — 透過快取重構節省 59% 成本的實戰案例。
- [DigitalOcean / Anthropic — Prompt Caching](https://www.digitalocean.com/blog/prompt-caching-with-digital-ocean)
