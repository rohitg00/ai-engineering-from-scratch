# ذخیره سازی سریع و ذخیره سازی متن

> پیامک سیستم شما 4000 توکن است. پیامک RAG شما 20000 توکن است. هر بار هر درخواست هر دو را ارسال می کنید. همچنین هر بار برای هر دو پرداخت می کنید. پیامک سریع به ارائه دهنده اجازه می دهد تا این پیشگویی را گرم نگه دارد و 10٪ از نرخ عادی را در مورد استفاده مجدد به شما پرداخت کند. اگر درست استفاده شود، هزینه نتیجه گیری را 5090% و تاخیر اولین توکن را 4085% کاهش می دهد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## مشکل

يه مامور رمزگاري يه پيغام 15 هزار توکن رو به کلود ميفرستد هر بار که حرف بزنه$3/M input tokens is $0.90 در هزینه ورودی تنها  قبل از هر پیام واقعی کاربر. ضرب به 10،000 مکالمه روزانه و لایحه به 9،000 دلار / روز برای متن که هرگز تغییر نمی کند.

شما نمی توانید بدون آسیب به کیفیت، پرامپتر را کوچک کنید. شما نمی توانید از ارسال آن اجتناب کنید. مدل به آن در هر نوبت نیاز دارد. تنها حرکت این است که هزینه کامل را برای یک پیشگویی که ارائه دهنده قبلاً دیده است، پرداخت نکنید.

این حرکت به سرعت به حافظه کش است. آنترپک آن را در اوت 2024 (با یک نوع 1 ساعت طولانی شده TTL در 2025) عرضه کرد ، OpenAI آن را در اواخر آن سال خودکار کرد ، گوگل به همراه Gemini 1.5 به صورت صریح به حافظه کش زمینه را عرضه کرد و اکنون هر سه آن را به عنوان یک ویژگی درجه اول در مدل های مرزی خود ارائه می دهند.

## مفهوم

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**وقتی پیشگویی یک درخواست با یک درخواست اخیر مطابقت دارد، ارائه دهنده KV-کاش را از اجرا قبلی به جای رمزگذاری مجدد توکن ها ارائه می دهد. شما اولین بار یک هزینه نوشتن کوچک و هر بار بعد تخفیف خواندن بزرگ پرداخت می کنید.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**هر سه پیشگویی فقط. اگر هر نشانه ای بین درخواست ها متفاوت باشد، همه چیز پس از اولین نشانه متفاوت یک خطا است. بخش های ثابت را در بالای صفحه قرار دهید، بخش های متغیر را در پایین.

### طرح دوستانه با کیش

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

از دستور تجاوز کنید  پیام کاربر را بالای پیام سیستم قرار دهید، بازخواهی های پویا را بین چند عکس  و کش هرگز وارد نکنید.

### محاسبه بروک هم

25٪ امتیاز نوشتن Anthropic (5 دقیقه TTL) در اولین خواندن خود را پرداخت می کند، زیرا یک خواندن پیشخودی 0.1x هزینه دارد. 1 نوشتن + 1 خواندن به طور متوسط 0.675x هزینه در هر درخواست (موفق 32٪) ؛ 1 نوشتن + 10 خواندن به طور متوسط 0.205x (موفق 80٪). TTL 1 ساعت 2x برای نوشتن هزینه می کند، بنابراین این بلوک نیاز به دو خواندن برای خروج از جلو دارد. قاعده عمومي: هر چیزی که انتظار دارید حداقل 3 بار در TTL استفاده مجدد کنید، ذخیره کنید؛ که بر روی هر یک از TTL ها شکسته می شود.

```figure
prompt-cache-hit
```

## آن را بسازید

### مرحله 1: ذخیره سازی سریع آنترپیک با نشانگرهای صریح

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

.`cache_control`مارکر به آنترپیک می گوید تا بلوک را برای 5 دقیقه ذخیره کند. دوباره در داخل این پنجره استفاده کنید. پس از انقضا دوباره استفاده کنید و دوباره بنویسید.

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

هر دو زمینه را در IC  بررسی کنید اگر `cache_read_input_tokens`در تمام درخواست ها صفر باقی می ماند، کلید های حافظه کش شما در حال حرکت هستند.

### مرحله دوم: یک ساعت طولانی تر TTL

برای کارهای طولانی مدت، 5 دقیقه پیش بینی بین شغل ها به پایان می رسد.`ttl`:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

یک ساعت TTL دو برابر هزینه نوشتن (50٪ در مقایسه با خط اصلی به جای 25٪) است، اما در هر دسته که از قبل از 5 بار استفاده می شود، به سرعت باز می گردد.

### مرحله 3: OpenAI خودکار ذخیره سازی

OpenAI به شما هیچ چیزی برای تنظیم نمی دهد. هر پیشگویی بیش از 1,024 توکن که با یک درخواست اخیر مطابقت دارد به طور خودکار تخفیف 50٪ دریافت می کند.

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

قانون مشابه طرح دوستانه به کش اعمال می شود. دو چیز از کش OpenAI را می کشند که از آنترپیک را نمی کشند: تغییر `user`فیلدی (که به عنوان یک بخش کلید حافظه کش استفاده می شود) و ابزار تنظیم مجدد.

### مرحله 4: ذخیره سازی متن صریح دوقلوها

جمیانی با کیش به عنوان یک شی درجه اول که شما ایجاد می کنید و نام می دهید، رفتار می کند:

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

جمیانی ذخیره سازی را در هر توکن ساعت تا زمانی که حافظه کش زنده است، هزینه می کند و با ~25٪ از نرخ ورودی معمولی می خواند. این شکل مناسب است وقتی شما از همان پیام عظیم در چندین جلسه در طول روز استفاده می کنید.

### مرحله 5: اندازه گیری میزان ضربه در تولید

ببین`code/main.py`برای یک حسابدار سه ارائه دهنده شبیه سازی شده که حساب های نوشتن / خواندن / گمشدن را ردیابی می کند و هزینه های مخلوط را برای هر درخواست 1K محاسبه می کند. دروازه در نرخ هدف قرار می گیرد  اکثر تنظیمات تولید Anthropic باید بعد از گرم شدن > 80٪ بخش خواندن را ببینند.

## خطرهایی که هنوز در سال 2026 وجود دارند

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`هر درخواست گم شده است. وقت مهر را در زیر نقطه شکستن حافظه پیشگیری حرکت دهید.
- **Tool reordering.**سریالیز کردن ابزارها در یک نظم پایدار  یک تغییر دستور بین انتشارات هر ضربه را می شکند.
- **Free-text near-duplicates.**"شما کمک کننده هستید". مقابل "شما یک دستیار مفید هستید".  یک بایت تفاوت = گمشدن کامل.
- **Too-small blocks.**آنترپیک یک طبقه 1,024 توکن را اجرا می کند (2،048 برای هیکو). بلوک های کوچکتر به طور خاموشی ذخیره نمی شوند.
- **Blind cost dashboards.**"توکن ورودی" را به زیرنویس و زیرنویس تقسیم کنید. در غیر این صورت کاهش ترافیک به نظر می رسد به عنوان یک برنده زیرنویس.

## ازش استفاده کن

"پاكي" مخزن 2026:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

ترکیب با کیشنگ معنوی (فاز 11 · 11) برای لایه پیام کاربر: دستی های کیشنگ فوری * استفاده مجدد شبیه به توکن* ، دستی های کیشنگ معنوی * استفاده مجدد شبیه به معنی*

## -باده

نگه دار`outputs/skill-prompt-caching-planner.md`:

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

## تمرینات

1. **Easy.**با يه تماس با سيستم 5000 توکن با کلاود 10 نوبت رو بگير`cache_control`و بعدش با. گزارش حساب ورودی توکن برای هر یک.
2. **Medium.**یک تست هرنس بنویسید که با توجه به یک قالب فوری و یک دفترچه درخواست، نرخ ضربه و پس انداز دلاری انتظار می رود را در هر ارائه دهنده محاسبه کند (Anthropic 5m، Anthropic 1h، OpenAI خودکار، Gemini صریح).
3. **Hard.**ایجاد یک بهینه سازی طرح: به یک پرامپت و یک لیست از زمینه های مشخص شده داده شده است `stable=True/False`، به سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت سمت

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) `cache_control`، 1 ساعت TTL ، ميز هاي توازن رو قطع کن
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) تطابق خودکار پیشگویی
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) `CachedContent`قیمت گذاری API و ذخیره سازی
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) پست اصلی راه اندازی با شماره های تاخیر.
- مرحله 11 · 05 (انجینر متن)  کجا باید پرامپت را برش دهید تا حافظه کش بتواند فرود بیاید.
- مرحله 11 · 11 (Caching and Cost)  جوانه های پرتاب به پیشگیری با یک پیشگیری معنوی در پیام های کاربر.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) مدل حافظه KV-cache که به کارگیری از حافظه کش می کند، به کاربران نشان می دهد؛ توضیح می دهد که چرا پیشگویی ذخیره شده برای خواندن مجدد 10 برابر ارزان تر از محاسبه مجدد است.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) prefill راه حل های کوتاه پیشگیری از مرحله ای است؛ این مقاله توضیح می دهد که چرا TTFT به طور چشمگیری در هنگام ضربه به پیشگیری کاهش می یابد در حالی که TPOT تحت تأثیر قرار نمی گیرد.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) پیشخودی سریع در کنار رمزگذاری حدس زدنی، توجه فلاش و MQA/GQA به عنوان اهرم هایی که منحنی هزینه های نتیجه گیری را خم می کنند قرار می گیرد؛ این را برای سه مورد دیگر بخوانید.
