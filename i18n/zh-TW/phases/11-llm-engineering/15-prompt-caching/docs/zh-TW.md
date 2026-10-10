# Prompt 快取與脈絡快取（Prompt Caching and Context Caching）

> 你的系統提示有 4,000 個 token，你的 RAG 脈絡有 20,000 個 token。你在每一次請求中都發送了這兩者，而每一次你都在全價付費。Prompt 快取讓服務供應商（provider）端能在伺服器端為你保持該前綴（prefix）的運算狀態，在重複使用時僅收取正常費率的 10%。運用得當，它能將推論成本降低 50% 到 90%，並將首字延遲（TTFT）降低 40% 到 85%。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## The Problem｜問題

一個寫程式的 agent 在一場對話的每一輪都向 Claude 發送相同的 15,000 token 系統提示。在 20 輪對話中，若每百萬輸入 token 為 3 美元，單是系統提示本身就耗費 0.90 美元輸入成本——這還沒算進使用者的任何實際訊息。若乘以每日 10,000 場對話，每天光是傳送相同的文字，帳單就高達 9,000 美元。

你不能刪減 prompt，因為這會損害輸出品質；你也不能不傳它，因為模型在每一輪對話中都需要依賴它。唯一的解法，就是停止為服務供應商早已看過並運算過的前綴支付全額費用。

這個解法就是 Prompt 快取。Anthropic 於 2024 年 8 月首度推出（並於 2025 年推出了 1 小時延長 TTL 變體），OpenAI 隨後在同年實現了全自動快取，Google 則伴隨 Gemini 1.5 推出了顯式脈絡快取。如今，三大服務供應商皆在其前沿模型上將其作為一等公民原生支援。

## The Concept｜核心概念

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**運作原理。** 當某次請求的前綴與近期請求匹配時，服務供應商直接沿用上一次推論所建立的 KV-cache（鍵值快取），而非從頭重新編碼這些 token。你在第一次寫入時支付小額的寫入溢價（cache-write premium），隨後的每一次讀取皆能享有較大的讀取折扣（cache-read discount）。

**2026 年三大服務供應商的快取風格。**

| 服務供應商 | API 風格 | 命中折扣 | 首次寫入溢價 | 預設 TTL | 最低快取閾值 |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | 在內容區塊顯式標註 `cache_control` | 輸入費率 1 折（省 90%） | 額外加收 25% | 5 分鐘（可延長至 1 小時） | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | 自動前綴偵測比對 | 輸入費率 5 折（省 50%） | 無額外溢價 | 最多 1 小時（盡力而為） | 1,024 tokens |
| Google (Gemini) | 顯式 `CachedContent` API | 按儲存時間計費；讀取約正常費率 25% | 依 token·hour 支付儲存費 | 使用者自訂（預設 1 小時） | 4,096 tokens (Flash), 32,768 (Pro) |

**不變量。** 所有服務供應商皆**僅快取前綴**。若兩次請求之間有任何一個 token 發生了差異，從該相異 token 開始往後的所有內容都會未命中。請永遠將**靜態不變**的區塊置於頂部，將**動態易變**的內容置於底部。

### 適合快取的排列方式

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

破壞了這個順序——例如把使用者訊息放在系統提示上方，或者在少樣本範例之間穿插動態檢索內容——快取將無法命中。

### 損益兩平計算

Anthropic 的 25% 寫入溢價意味著：一個被快取的區塊必須至少被讀取 2 次以上，在經濟上才能開始實際省錢。1 次寫入 + 1 次讀取平均每次請求成本為 0.675 倍（節省 32%）；1 次寫入 + 10 次讀取平均僅需 0.205 倍（節省高達 80%）。實務經驗法則：任何你預期在 TTL 存活期內會被重複使用至少 3 次的內容，皆應啟用快取。

```figure
prompt-cache-hit
```

## Build It｜動手實作

### 步驟 1：使用顯式標記實作 Anthropic Prompt 快取

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "You are a senior Python reviewer. Follow the rubric exactly.\n\n" + RUBRIC_15K_TOKENS,
        "cache_control": {"type": "ephemeral"},
    }
]

def review(code: str):
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": code}],
    )
```

`cache_control` 標記明確指示 Anthropic 將該區塊在伺服器端暫存 5 分鐘。在此視窗內的後續複用將命中快取；超時後則過期並重新觸發一次寫入。

**回應中的用量度量欄位：**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # paid at 1.25x
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # paid at 0.1x
```

在 CI 測試中請檢查這兩個欄位——若在相同的連續請求中 `cache_read_input_tokens` 始終維持為零，代表你的快取鍵（cache key）值正在漂移。

### 步驟 2：1 小時延長 TTL

對於耗時較長的批次離線任務，5 分鐘的預設存活期會在工作之間到期。此時可顯式設定 `ttl`：

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 小時的延長 TTL 需支付 2 倍的寫入溢價（比起基準高出 50%，而非 25%），但在任何重複使用該前綴超過 5 次的批次處理中，能快速回本。

### 步驟 3：OpenAI 自動快取

OpenAI 不需要開發者設定任何參數。任何超過 1,024 個 token 且與近期請求相符的前綴，自動享有 50% 的折扣。

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # long and stable
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # the discounted portion
```

同樣適用於上述適合快取的順序佈局法則。請特別注意：有兩件事會破壞 OpenAI 的快取（但在 Anthropic 上不會發生）：修改 `user` 欄位（OpenAI 將其作為快取金鑰的一部分），以及重新排列工具。

### 步驟 4：Gemini 顯式脈絡快取

Gemini 將快取視為由你親自建立並具備專屬名稱的一等公民物件：

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3.8-flash",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

只要該快取持續存活，Gemini 便會依 token·hour 計收儲存費，而讀取時僅收取約正常輸入費率的 25%。當你需要在數天內跨多個工作階段反覆複用同一個龐大知識庫或程式碼庫時，這是適合的情境。

### 步驟 5：在正式環境中測量命中率（hit rate）

請參閱 `code/main.py` 中模擬的三大服務供應商成本會計器，它能追蹤寫入／讀取／未命中計數，並計算每 1,000 次請求的綜合混合成本。請為部署設定目標命中率閾值——在系統預熱（warm-up）完成後，多數正式環境的 Anthropic 架構的讀取佔比通常應維持在 80% 以上。

## 2026 年依然常見的陷阱

- **在頂部放置動態時間戳記。** 例如在系統提示首行寫上 `"Current time: 2026-04-22 15:30:02"`。這會導致每一次請求都未命中。請將動態時間戳記移至快取中斷點（cache breakpoint）的下方。
- **工具定義順序隨機變動。** 請確保工具定義序列化時具備穩定的固定順序——部署之間字典鍵值的隨機重排會破壞每一次快取命中。
- **自由文字的微小差異。** 例如「You are helpful.」與「You are a helpful assistant.」——哪怕只有一個位元組的差異，整段後續快取都會未命中。
- **區塊尺寸低於閾值。** Anthropic 強制執行 1,024 個 token 的最低門檻（Haiku 為 2,048）。過小的區塊會靜默略過快取。
- **指標儀表板缺乏細分。** 請在監控圖表上將「輸入 token」拆分為快取命中與未命中。否則單純的流量下滑會被誤判為快取效能提升。

## Use It｜實際應用

2026 年的快取選型策略：

| 應用情境 | 最佳選型 |
|-----------|------|
| 擁有穩定 10K+ 系統提示、多輪互動的 Agent | 採用帶有 5 分鐘 TTL 的 Anthropic cache_control |
| 需在 30 分鐘以上反覆複用前綴的批次離線任務 | 採用帶有 `ttl: "1h"` 的 Anthropic 快取 |
| 無自架基礎設施、基於 GPT-5 的 Serverless 端點（endpoint） | 採用 OpenAI 自動快取（只需確保前綴長且恆定穩定） |
| 跨數天反覆複用超大型程式碼庫或文件語料庫 | 採用 Gemini 顯式 `CachedContent` API |
| 跨服務供應商備援降級架構 | 在所有服務供應商間維持相同的可快取前綴排列方式，使任何命中皆能通用 |

請將本技術與語意快取（Phase 11 · 11）結合，用於使用者訊息層級：Prompt 快取專門處理**token 相同**的重複，語意快取則專門處理**語意相同**的抽換詞句。

## Ship It｜交付成果

儲存 `outputs/skill-prompt-caching-planner.md`：

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Given a prompt (system + tools + few-shot + retrieval + history + user) and a usage profile (requests per hour, TTL needed, provider), output:

1. Layout. Reordered sections with a single cache breakpoint marked; explain which sections are stable, which are volatile.
2. Provider mode. Anthropic cache_control, OpenAI automatic, or Gemini CachedContent. Justify from TTL and reuse pattern.
3. Break-even. Expected reads per write within TTL; net cost vs no-cache with math.
4. Verification plan. CI assertion that cache_read_input_tokens > 0 on the second identical request; dashboard split by cached vs uncached tokens.
5. Failure modes. List the three most likely reasons the cache will miss in this setup (dynamic timestamp, tool reorder, near-duplicate text) and how you will prevent each.

Refuse to ship a cache plan that places a dynamic field above the breakpoint. Refuse to enable 1h TTL without a reuse count that makes the 2x write premium pay back.
```

## Exercises｜練習

1. **基礎題**。取一場針對 Claude 且擁有 5,000 token 系統提示的 10 輪對話。分別在未加 `cache_control` 與加上 `cache_control` 的條件下執行，計算並比較兩者的輸入 token 總帳單。
2. **進階題**。撰寫一套測試評估工具：給定一個 Prompt 範本與歷史請求日誌，精確計算出各服務供應商（Anthropic 5m、Anthropic 1h、OpenAI 自動、Gemini 顯式）的預期快取命中率與實質節省美金金額。
3. **挑戰題**。建構一套佈局最佳化器（optimizer）：給定一個 Prompt 以及標註為 `stable=True/False` 的欄位清單，在不丟失任何資訊的前提下，將其自動重構為在最佳位置放置單一快取中斷點的高效佈局。在真實 Anthropic 端點上驗證成效。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| Prompt 快取（Prompt caching） | 「讓長 Prompt 變便宜」 | 在服務供應商端為相符的前綴重用 KV-cache；在重複的輸入 token 上享有 50% 到 90% 的折扣 |
| `cache_control` | 「Anthropic 的快取標記」（cache marker） | 內容區塊的專屬屬性，宣告「在此之前的所有內容皆可快取」；格式為 `{"type": "ephemeral"}` |
| 快取寫入（Cache write） | 「支付寫入溢價」 | 首個用於建立並填入快取空間的請求；在 Anthropic 上約收取 1.25 倍輸入費率，在 OpenAI 上免費 |
| 快取讀取（Cache read） | 「享受折扣」 | 後續與該前綴相符的請求；收取 10%（Anthropic）、50%（OpenAI）、約 25%（Gemini）的優惠費率 |
| TTL | 「快取能活多久」 | 快取保持有效的秒數；Anthropic 預設 5 分鐘（可延長至 1 小時），OpenAI 盡力而為約 1 小時，Gemini 由使用者自訂 |
| 延長 TTL（Extended TTL） | 「Anthropic 的 1 小時快取」 | 宣告為 `{"type": "ephemeral", "ttl": "1h"}`；需支付 2 倍寫入溢價，但在批次重複使用時划算 |
| 前綴匹配（Prefix match） | 「為什麼我快取沒命中」 | 快取僅在前綴完全相同時生效；從起始位置到中斷點之間，只要有任何一個 token 不一致即宣告未命中 |
| 脈絡快取（Context caching, Gemini） | 「Google 的顯式快取」 | Google 旗下具名且依儲存容量計費的快取物件；最適合大型語料庫跨數天的高頻重複使用 |

## Further Reading｜延伸閱讀

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) ——官方手冊，涵蓋 `cache_control`、1 小時 TTL 與損益兩平對照表
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) ——OpenAI 自動前綴匹配機制官方指南
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) ——`CachedContent` API 與儲存計費規格
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) ——Anthropic 原始發布技術專文，附帶延遲數字
- Phase 11 · 05 (Context Engineering) ——探討該在何處切分 Prompt 以讓快取命中
- Phase 11 · 11 (Caching and Cost) ——將 Prompt 快取與使用者訊息層級的語意快取搭配
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) ——Prompt 快取暴露給使用者的底層 KV-cache 記憶體模型；闡明為何重讀快取前綴比重算便宜 10 倍
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) ——Prompt 快取走捷徑跳過的是 Prefill 階段；本文說明為何快取命中時 TTFT 下降但 TPOT 不受影響
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) ——Prompt 快取與推測解碼、Flash Attention 及 MQA/GQA 並列，都是能壓低推論成本曲線的手段
