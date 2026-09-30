# 提示詞快取與上下文快取

> 你的系統提示詞是 4,000 個詞元。你的 RAG 上下文是 20,000 個詞元。每一次請求你都把兩者送出去，也為兩者付費 —— 每一次都付。提示詞快取讓供應商在他們那邊把那段前綴保持溫熱，重用時只收你正常費率的 10%。用對了，它能砍掉 50-90% 的推論成本，以及 40-85% 的首詞元延遲。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 11 · 01（提示詞工程）、階段 11 · 05（上下文工程）、階段 11 · 11（快取與成本）
**時間：** 約 60 分鐘

## 問題所在

一個程式代理在對話的每一輪都把同一份 15,000 詞元的系統提示詞送給 Claude。20 輪、輸入每百萬詞元 $3，光輸入成本就是 $0.90 —— 而使用者真正說的話還沒算進去。乘上每天 10,000 段對話，帳單就變成每天 $9,000，全花在一段從不改變的文字上。

你不能為了省錢把提示詞縮短、犧牲品質。你也不能不送它 —— 模型每一輪都需要它。唯一的招數是：別再為供應商早就看過的前綴付全價。

那個招數就是提示詞快取。Anthropic 在 2024 年 8 月推出（2025 年加上 1 小時的延長 TTL 版本），OpenAI 在同年稍晚把它自動化，Google 隨 Gemini 1.5 推出明確的上下文快取，而現在三家都把它當成前沿模型上的一級功能。

## 核心概念

![提示詞快取：寫一次，讀很便宜](../assets/prompt-caching.svg)

**機制。** 當一個請求的前綴和近期某個請求相符時，供應商會直接沿用上一次執行的 KV 快取，而不是重新編碼那些詞元。第一次你付一小筆寫入溢價，之後每一次都拿到很大的讀取折扣。

**2026 年三家供應商的三種口味。**

| 供應商 | API 風格 | 命中折扣 | 寫入溢價 | 預設 TTL | 最小可快取量 |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | 在內容區塊上加明確的 `cache_control` 標記 | 輸入 9 折以上（省 90%） | 加收 25% | 5 分鐘（可延長到 1 小時） | 1,024 詞元（Sonnet/Opus）、2,048（Haiku） |
| OpenAI | 自動前綴偵測 | 輸入省 50% | 無 | 最長 1 小時（盡力而為） | 1,024 詞元 |
| Google（Gemini） | 明確的 `CachedContent` API | 按儲存量計費；讀取約為正常費率的 25% | 每詞元·小時的儲存費 | 使用者自訂（預設 1 小時） | 4,096 詞元（Flash）、32,768（Pro） |

**不變的鐵則。** 三家都只快取前綴。如果請求之間有任何一個詞元不同，從第一個不同的詞元之後全部都算未命中。把**穩定**的部分放最上面，把**會變**的部分放最下面。

### 對快取友善的排版

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

違反這個順序 —— 把使用者訊息放在系統提示詞上面、把動態檢索夾在少樣本範例之間 —— 快取就永遠不會命中。

### 損益兩平的算法

Anthropic 的 25% 寫入溢價意味著一個被快取的區塊至少要被讀兩次才淨省錢。1 次寫入 + 1 次讀取平均是每次請求 0.675 倍成本（省 32%）；1 次寫入 + 10 次讀取平均是 0.205 倍（省 80%）。拇指法則：只要你預期在 TTL 內至少重用 3 次，就把它快取起來。

```figure
prompt-cache-hit
```

## 實作

### 步驟 1：用明確標記做 Anthropic 提示詞快取

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

`cache_control` 標記告訴 Anthropic 把這個區塊存 5 分鐘。在那個窗口內重用就命中；過期後重用則是再寫一次。

**回應的 usage 欄位：**

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

在 CI 裡兩個欄位都要檢查 —— 如果 `cache_read_input_tokens` 跨請求一直是零，就是你的快取鍵在漂移。

### 步驟 2：一小時的延長 TTL

對長時間執行的批次工作來說，5 分鐘的預設值會在工作之間就過期。設定 `ttl`：

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 小時 TTL 的寫入溢價是 2 倍（比基準高 50% 而不是 25%），但只要一個批次重用該前綴超過 5 次，就很快回本。

### 步驟 3：OpenAI 自動快取

OpenAI 沒有任何東西讓你設定。任何超過 1,024 詞元、且與近期請求相符的前綴，自動享 50% 折扣。

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

同樣的「對快取友善的排版」規則適用。有兩件事會殺掉 OpenAI 的快取、但殺不掉 Anthropic 的：改動 `user` 欄位（它是快取鍵的組成之一），以及重新排列工具順序。

### 步驟 4：Gemini 明確的上下文快取

Gemini 把快取當成一個你自己建立並命名的一級物件：

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

只要快取還活著，Gemini 就按每詞元·小時收儲存費，讀取則約為正常輸入費率的 25%。當你要在好幾天之間、跨許多工作階段重用同一份巨大提示詞時，這是對的形狀。

### 步驟 5：在生產環境量測命中率

`code/main.py` 裡有一個模擬三家供應商的計帳器，追蹤寫入／讀取／未命中次數，並算出每 1K 次請求的混合成本。用一個目標命中率當部署的閘門 —— 多數生產級 Anthropic 設定在暖機後應該看到讀取占比超過 80%。

## 到 2026 年還是常見的陷阱

- **把動態時間戳放在最上面。** 系統提示詞開頭寫著 `"Current time: 2026-04-22 15:30:02"`。每一次請求都未命中。把時間戳移到快取斷點之下。
- **重排工具順序。** 用穩定的順序序列化工具 —— 部署之間一次字典重排就打壞每一次命中。
- **自由文字的近似重複。** 「You are helpful.」和「You are a helpful assistant.」—— 差一個位元組 = 完全未命中。
- **區塊太小。** Anthropic 強制 1,024 詞元的下限（Haiku 是 2,048）。更小的區塊會靜默地不被快取。
- **看不見細節的成本儀表板。** 把「輸入詞元」拆成已快取與未快取。否則流量下滑看起來會像快取的功勞。

## 實務應用

2026 年的快取技術棧：

| 情境 | 選這個 |
|-----------|------|
| 帶穩定 10k+ 系統提示詞、多輪對話的代理 | Anthropic `cache_control`，5 分鐘 TTL |
| 一個前綴重用 30 分鐘以上的批次工作 | Anthropic 搭 `ttl: "1h"` |
| 跑在 GPT-5 上的無伺服器端點、沒有客製基礎設施 | OpenAI 自動（只要讓你的前綴又長又穩定） |
| 跨多天重用一份龐大的程式碼／文件語料庫 | Gemini 明確的 `CachedContent` |
| 跨供應商備援 | 讓可快取的前綴排版在各供應商之間完全一致，這樣任何一邊命中都算 |

搭配語意快取（階段 11 · 11）處理使用者訊息那一層：提示詞快取處理**詞元完全相同**的重用，語意快取處理**語意相同**的重用。

## 產出

存成 `outputs/skill-prompt-caching-planner.md`：

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

## 練習

1. **簡單。** 拿一段 10 輪對話、搭配 5,000 詞元的系統提示詞去打 Claude。先不帶 `cache_control` 跑一次，再帶著跑一次。報告兩者的輸入詞元帳單。
2. **中等。** 寫一套測試框架：給定一個提示詞模板和一份請求日誌，算出各供應商（Anthropic 5 分鐘、Anthropic 1 小時、OpenAI 自動、Gemini 明確）的預期命中率與省下的金額。
3. **困難。** 做一個排版最佳化器：給定一個提示詞和一份標了 `stable=True/False` 的欄位清單，在不損失資訊的前提下改寫提示詞，把唯一的快取斷點放在最有利於快取的位置。在真實的 Anthropic 端點上驗證。

## 關鍵術語

| 術語 | 大家怎麼說 | 它實際上是什麼 |
|------|-----------------|-----------------------|
| 提示詞快取（Prompt caching） | 「讓長提示詞變便宜」 | 對相符的前綴重用供應商端的 KV 快取；重複的輸入詞元享 50-90% 折扣。 |
| `cache_control` | 「Anthropic 的那個標記」 | 內容區塊的屬性，宣告「到這裡為止的一切都可快取」；`{"type": "ephemeral"}`。 |
| 快取寫入（Cache write） | 「付溢價」 | 第一個把快取填起來的請求；在 Anthropic 上約按輸入費率 1.25 倍計價，在 OpenAI 上免費。 |
| 快取讀取（Cache read） | 「折扣」 | 後續與前綴相符的請求；計價為 10%（Anthropic）、50%（OpenAI）、約 25%（Gemini）。 |
| TTL | 「它能活多久」 | 快取保持溫熱的秒數；Anthropic 預設 5 分鐘（可延長到 1 小時）、OpenAI 盡力而為最長 1 小時、Gemini 由使用者設定。 |
| 延長 TTL（Extended TTL） | 「Anthropic 的 1 小時快取」 | `{"type": "ephemeral", "ttl": "1h"}`；寫入溢價 2 倍，但對批次重用來說很值得。 |
| 前綴比對（Prefix match） | 「我的快取為什麼沒命中」 | 只有從開頭到斷點的每一個詞元都逐位元組相同時，快取才會命中。 |
| 上下文快取（Gemini） | 「明確的那個」 | Google 那個具名、按儲存量計費的快取物件；最適合大型語料庫的跨多天重用。 |

## 延伸閱讀

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) —— `cache_control`、1 小時 TTL、損益兩平表。
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) —— 自動前綴比對。
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) —— `CachedContent` API 與儲存定價。
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) —— 最初的發表文，附延遲數據。
- 階段 11 · 05（上下文工程）—— 該在哪裡切提示詞，快取才落得下去。
- 階段 11 · 11（快取與成本）—— 把提示詞快取和使用者訊息上的語意快取配起來用。
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) —— 提示詞快取暴露給使用者的那個 KV 快取記憶體模型；解釋為什麼重讀一段被快取的前綴，比重新計算便宜約 10 倍。
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) —— prefill 正是提示詞快取抄掉的那個階段；這篇說明為什麼快取命中時 TTFT 大幅下降、而 TPOT 不受影響。
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) —— 提示詞快取和推測式解碼、Flash Attention、MQA/GQA 並列為能扳彎推論成本曲線的槓桿；另外三個看這篇。
