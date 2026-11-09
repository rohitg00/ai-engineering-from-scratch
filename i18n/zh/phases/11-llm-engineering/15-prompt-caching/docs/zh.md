# 快速缓存和文本缓存

> 您的系统提示是4000个代币.您的RAG文本是20,000个代币.您每次请求都会发送两种代币.您每次都会支付两种代币.快速缓存允许提供商将该预先端放在其侧面,并将正常使用率的10%收费.如果正确使用,它将推断成本减少5090%和第一次代币延迟4085%.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## 问题

编码代理在每次对话中都会向克劳德发送相同的15000代币系统提示.$3/M input tokens is $只有 0.90 美元的输入成本, 之前用户的任何实际消息.乘以每天的10,000次对话,账单达到9,000美元/天,

您不能减少提示,而不会损害质量.您不能避免发送它. 模型需要它在每一个转折.唯一的举动是停止支付完整的价格为供应商已经看到的预写.

这一举动是快速缓存.安特罗皮克在2024年8月发布 (在2025年推出1小时的延长TTL变体),OpenAI自动化了该年晚些时候,谷歌在双子座1.5号的同时发布了明确的语境缓存,现在这三个都将其作为其边界模型的一流功能.

## 概念

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**当请求的前与最近请求的前相匹配时,提供商将从前运行中提供KV缓存,而不是重新编码代币.你第一次支付小写费,每次都会收取大阅读折扣.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**如果任何代币在请求之间不同,则在第一个不同代币之后的一切都是错误. 放在顶部的 *稳定* 部分,下面的 *变量* 部分.

### 缓存友好的布局

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

违反命令 将用户消息放在系统提示上面, 间接几次截图之间动态检索 和缓存永远不会打.

### 破产平衡计算

由于缓存阅读成本为0.1倍,因此Anthropic的25%的写费 (5分钟的TTL) 在第一次阅读时支付了自己. 1 写 + 1 读平均每次请求的成本 0.675x (节省 32%); 1 写 + 10 读平均 0.205x (节省 80%). 写作需要两个读数才能得到前面. 基本规则:在TLT内预计至少3次重复使用的任何东西,

```figure
prompt-cache-hit
```

## 建立它

### 步骤1: 通过明确标记进行人类提示缓存

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

其他`cache_control`标记告诉人类存储区块5分钟. 在窗口中重复使用; 过期后重复使用,然后再写.

**Response usage fields:**

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

检查IC 中的两个字段,如果 `cache_read_input_tokens`在请求中保持零,你的缓存密钥漂移.

### 步骤2:延长1小时的TTL

对于长期的批次工作,工作间的5分钟违约期会到期.`ttl`其他:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

一小时的TTL成本是写费的两倍 (50%比基线而不是25%),但在任何批次中重复使用前的时间超过5次时,会很快回报.

### 步骤3:OpenAI自动缓存

任何与最近的请求相匹配的1024个代币以上的预写符都会自动获得50%折扣.

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

两个因素会杀死OpenAI的缓存,而不是杀死Anthropic的:改变 `user`字段 (作为缓存密钥组件使用) 和重新排序工具.

### 步骤4:双子座明确的语境缓存

双子座将缓存视为你创建的第一类对象,

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

双子座每一个代币·小时的存储费用是缓存存存储存存存存存存存存存存存存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存存储存存存存存存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存储存存存储存存储存存储存存储存存存存储存存存储存存储存存存存存储存储存存存存存储存存存存存储存存存存存存储存存存存存储存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存存

### 步骤5:测量生产中撞击率

看到`code/main.py`对于一个模拟的三供应商会计师,该会追踪写/阅读/错过计算和计算每1K请求的混合成本. 门部署在目标的成功率大多数生产的人类设置应看到>80%的读数分数在加热后.

## 陷在2026年仍存在

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`系统提示的顶部,每个请求都错过了. 移动时间标签在缓存破点以下.
- **Tool reordering.**系统化工具稳定顺序 部署之间的命令调整,
- **Free-text near-duplicates.**"你是有帮助的. "vs"你是有帮助的助手. "一个字节差异 = 完全错过.
- **Too-small blocks.**哈伊库的小块默默不存储.
- **Blind cost dashboards.**输入代码分为缓存与未缓存.否则流量下降看起来像缓存获利.

## 用它

预备备库2026:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

结合用户信息层的语义缓存 (阶段11 · 11):提示缓存处理 *代币相同*重复使用,语义缓存处理 *意义相同*重复使用.

## 运送它

保存`outputs/skill-prompt-caching-planner.md`其他:

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

## 运动

1. **Easy.**通过5000个代币系统来对抗克劳德进行10轮对话.`cache_control`报告每个输入代码的账单.
2. **Medium.**写一个测试,根据提示模板和请求日志,计算每个提供商的预期成功率和美元节省 (Anthropic 5m,Anthropic 1h,OpenAI自动,Twin explicit).
3. **Hard.**创建布局优化器:给出提示和标记的字段列表 `stable=True/False`通过一个简单的缓存,将一个缓存破解点放在最大的缓存友好的位置,而不输掉信息.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "Makes long prompts cheap" | Reusing a provider-side KV-cache for matching prefixes; 50-90% discount on repeated input tokens. |
| `cache_control` | "The Anthropic marker" | Content-block attribute that declares "everything up to here is cacheable"; `{"type": "ephemeral"}`. |
| Cache write | "Paying the premium" | The first request that populates the cache; billed at ~1.25x input rate on Anthropic, free on OpenAI. |
| Cache read | "The discount" | Subsequent requests matching the prefix; billed at 10% (Anthropic), 50% (OpenAI), ~25% (Gemini). |
| TTL | "How long it lives" | Seconds the cache stays warm; Anthropic 5m default (extendable 1h), OpenAI best-effort up to 1h, Gemini user-set. |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`; 2x write premium but worth it for batch reuse. |
| Prefix match | "Why my cache missed" | Caches only hit when every token from the start up to the breakpoint is byte-identical. |
| Context caching (Gemini) | "The explicit one" | Google's named, storage-billed cache object; best for multi-day reuse of large corpora. |

## 进一步阅读

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) `cache_control`时间1小时,平衡表.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching)自动前匹配.
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) `CachedContent`存储器和存储器的价格.
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching)原始发射站,延迟号码.
- 阶段11 · 05 (文本工程)  如何切断提示器,以便缓存可登陆.
- 对应缓存与用户消息的语义缓存.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) KV缓存存储器模型,提示缓存将用户暴露在缓存中;解释为什么缓存前置器的重读比重新计算便宜10x.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369)预填是阶段提示缓存快捷方式;本文解释了为什么TTFT在缓存中大幅下降,而TPOT不受影响.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192)快速缓存与投机解码,闪光注意力和MQA/GQA作为曲线的杆,
