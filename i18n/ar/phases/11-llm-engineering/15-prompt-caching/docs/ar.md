# التخزين السريع وتخزين السياق

> إن طلب نظامك يبلغ 4000 رمز. سياق RAG الخاص بك يبلغ 20,000 رمز. أنت ترسل كلتا مع كل طلب. أنت تدفع أيضاً لكلتا  كل مرة. يسمح الاحتفاظ بالخزينة السريعة للمقدم بإبقاء هذا المقبل دافئًا على جانبه ويفرض عليك 10% من معدل العادة الاستخدام. إذا استخدمت بشكل صحيح، فإنه يقلل من تكلفة الاستنتاج بنسبة 5090% وتخفيف التخفيف من الترميز الأول بنسبة 4085%.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## المشكلة

وكيل التشفير يرسل نفس النظام 15000 رمز على كل جولة من المحادثة$3/M input tokens is $0.90 في تكلفة المدخل وحدها  قبل أي من الرسائل الفعلية للمستخدم. مضاعفة بـ 10,000 محادثة يومية والفاتورة تصل إلى 9,000 دولار / يوم للنص الذي لا يتغير أبدا.

لا يمكنك تقليص الإشارة دون إيذاء الجودة. لا يمكنك تجنب إرسالها  يحتاجها النموذج في كل مرة. الخطوة الوحيدة هي التوقف عن دفع السعر الكامل لمثبتة رأتها مقدمها بالفعل.

هذه الخطوة هي التخزين الآلي السريع. أطلقتها Anthropic في أغسطس 2024 (مع فترة 1 ساعة تمتد من تتي إل في 2025) ، وأتمتها OpenAI في وقت لاحق من ذلك العام ، وأطلقت Google التخزين السياقي الصريح جنبا إلى جنب مع Gemini 1.5, والثلاثة الآن تقدمها ك ميزة من الدرجة الأولى على نماذجها الحدودية.

## المفهوم

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**عندما يطابق مقدمة طلب واحد من طلب حديث، يقوم المقدم بتقديم KV-Cache من الجولة السابقة بدلاً من إعادة تشفير الرموز. تدفع قسطًا صغيرًا من الكتابة في المرة الأولى وخصمًا كبيرًا من القراءة في كل مرة بعد ذلك.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**كل ثلاثة محاورات التخزين فقط. إذا كان أي رمز يختلف بين الطلبات، كل شيء بعد أول رمز مختلف هو غياب. ضع * مستقر* الأجزاء في الأعلى، * المتغير* الأجزاء في الأسفل.

### التخطيط الصديق للتخزين

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

انتهاك النظام  وضع رسالة المستخدم فوق طلب النظام، وتوقف الاستعراضات الديناميكية بين القليل من اللقطات  والخزنة الاحتياطية لا تضرب أبدا.

### حساب الانسجام

تكلفة كتابة Anthropic بنسبة 25% (5 دقيقة TTL) نفسها عند القراءة الأولى ، لأن قراءة التخزين تكلف 0.1x. 1 كتابة + 1 قراءة متوسط 0.675x تكلفة لكل طلب (إمداد 32%) ؛ 1 كتابة + 10 قراءة متوسط 0.205x (إمداد 80%). تتل ساعة واحدة تتقاضى 2x للكتب، لذلك تلك الكتل تحتاج إلى قراءة اثنين للخروج في الأمام. قاعدة عامة: تخزين أي شيء تتوقع إعادة استخدامه على الأقل 3 مرات داخل TTL؛ وهذا يمنع الاختراق على أي من TTL.

```figure
prompt-cache-hit
```

## بناءها

### الخطوة 1: التخزين الآلي للطلبات الإنسانية مع علامات صريحة

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

- نعم`cache_control`علامة تقول أنثروبيك لتخزين الكتلة لمدة 5 دقائق. إعادة استخدام داخل تلك النافذة ضربات؛ إعادة استخدام بعد انتهاء الصلاحية ويكتب مرة أخرى.

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

تحقق من كلا الحقول في CI  إذا `cache_read_input_tokens`يبقى عند الصفر عبر الطلبات، مفاتيح التخزين الخاصة بك تتحرك.

### الخطوة الثانية: تمديد المدة التوقيتية لمدة ساعة واحدة

بالنسبة لموظفات اللحظات طويلة المدى، تنتهي الخمس دقائق المتخلفة بين الوظائف.`ttl`:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

تكلفة التسجيل المباشر لمدة ساعة واحدة ضعف قسط الكتابة (50% عن الخط الأساسي بدلاً من 25%) ، ولكن تسترد بسرعة على أي دفعة تستخدم المقبل أكثر من 5 مرات.

### الخطوة الثالثة: OpenAI التخزين الآلي

لا يقدم لك OpenAI أي شيء لتكوين. أي مقدمة فوق 1024 رمزا تتطابق مع طلب حديث يحصل على خصم 50٪ تلقائيًا.

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

نفس قاعدة التخطيط الصديقة للتخزين القياسية تنطبق. هناك شيئين يقتلون التخزين القياسي OpenAI الذي لا يقتلون التخزين القياسي: تغيير `user`الحقل (المستخدم ككون مفتاح التخزين) وأدوات إعادة ترتيب.

### الخطوة الرابعة: تخزين السياق الصريح التجميلي

التوأم يعامل الجهاز كشيء من الدرجة الأولى يمكنك إنشاءه وتسميته:

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

تتقاضى Gemini التخزين لكل رمز·ساعة طالما أن الكاشة تعمل، وتقرأ عند ~ 25% من معدل إدخال العادي. هذا هو الشكل الصحيح عندما تستخدم نفس الإشارة العملاقة عبر العديد من الجلسات على مدى أيام.

### الخطوة 5: قياس معدل الضربة في الإنتاج

انظر`code/main.py`للمحاسب المحاكي الممثل من ثلاثة مزودي يقوم بتتبع حسابات الكتابة / القراءة / الإغفال وحساب التكلفة المختلطة لكل طلبات 1K. تنشر بوابة مع معدل ضرب هدف  معظم الإعدادات الإنتاجية الأنثروبية يجب أن ترى > 80% جزء القراءة بعد التدفئة.

## الفخاخ التي لا تزال تشغل في عام 2026

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`في أعلى طلب النظام كل طلب يفشل، نقلها تحت نقطة كسر التخزين
- **Tool reordering.**إعادة تشكيل الأدوات في ترتيب مستقيم
- **Free-text near-duplicates.**"أنت مفيد". مقابل "أنت مساعد مفيد".
- **Too-small blocks.**إنثروبيك يفرض سطحًا من 1,024 رمزًا (2،048 في هايكو). لا يتم تخزين الكتل الصغيرة بصمت.
- **Blind cost dashboards.**تقسيم "شعار المدخل" إلى مخزن مخزن مقابل غير مخزن مخزن وإلا فإن انخفاض حركة المرور يبدو وكأنه مكاسب مخزن مخزن.

## استخدمها

كومة التخزين الاحتياطي لعام 2026:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

الجمع مع التخزين الآلي (المرحلة 11 · 11) للطبقة الرسالة المستخدم: التخزين الآلي المفاجئ * إعادة استخدام الوهم المماثلة *، التخزين الآلي المماثلة * إعادة استخدام المعنى.

## أرسله

إنقاذ`outputs/skill-prompt-caching-planner.md`:

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

## التمارين

1. **Easy.**إجراء محادثة 10 جولات مع طلب نظام 5,000 رمز ضد كلود.`cache_control`و بعدها مع. إبلغ فاتورة إدخال رموز لكل واحد.
2. **Medium.**اكتب قناة اختبارية، التي، بالنظر إلى نموذج سريع ومسجل طلب، تحسب معدل الوصول المتوقع والوفور بالدولار لكل مزود (Anthropic 5m، Anthropic 1h، OpenAI تلقائي، Gemini صريح).
3. **Hard.**قم ببناء محفز التخطيط: إعطاء عرض وعبارة عن قائمة من الحقول المعلنة `stable=True/False`إعادة كتابة الإشارة لإعادة وضع نقطة وقف واحدة في التخزين في أقصى وضع صديقة للتخزين دون فقدان المعلومات. التحقق من نقطة نهاية الأنثروبيك الحقيقية.

## الشروط الرئيسية

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

## المزيد من القراءة

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) `cache_control`، 1 ساعة TTL ، كسر طاولات التوازن.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) تطابق المقبلات الآلية.
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) `CachedContent`معدل التكلفة و التخزين
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) البريد الأصلي للانطلاق مع أرقام التأخير.
- المرحلة 11 · 05 (هندسة السياق)  أين تقطع المشاركة حتى يتمكن الكاش من الهبوط.
- المرحلة 11 · 11 (التخزين والتكلفة)  زوج التخزين المحفظة التخزينية مع تخزين معنوي على رسائل المستخدم.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) نموذج الذاكرة في الاحتفاظ بالكاش KV الذي يُعرض للمستخدمين للتخزين الآلي؛ يشرح لماذا يكون إعادة قراءة مقدمة محفظة محفظة الأحتفاظ بها ~ 10x أرخص من إعادة الحساب.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) prefill هي اختصارات التخزين المحفظي المطلوب في مرحلة التخزين؛ هذا الورق يشرح لماذا تنخفض TTFT بشكل كبير على ضرب التخزين المحفظي بينما TPOT غير متأثر.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) التخزين الآلي يقع جنبا إلى جنب مع تشفير التكهنات، الانتباه الفلاش، و MQA / GQA كجهاز تدفع يلتوي منحنى تكلفة الاستنتاج؛ اقرأ هذا بالنسبة للثلاثة الأخرى.
