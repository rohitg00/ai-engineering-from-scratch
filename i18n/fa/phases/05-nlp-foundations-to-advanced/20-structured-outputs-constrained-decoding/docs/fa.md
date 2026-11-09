# خروجی های ساختاری و رمزگذاری محدود

> در تولید، "زیاد" مشکل است. رمزگذاری محدود با ویرایش سوابق قبل از نمونه گیری به "زیاد" تبدیل می شود.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## مشکل

یک طبقه بندی کننده به یک LLM می گوید: " یکی از {مثبت، منفی، خنثی} را برگردانید". مدل باز می گردد "رسی مثبت است  این بررسی بسیار مطلوب است زیرا مشتری صریحاً می گوید که آنها ...". پارسر شما خراب می شود. F1 طبقه بندی کننده شما 0.0 است.

تولید فرمی آزاد قرارداد نیست بلکه پیشنهاد است. یک سیستم تولید نیاز به قرارداد دارد.

سه لایه در سال 2026 وجود دارد.

1. **Prompting.**خوب بپرس. "تنها شی JSON را برگردانید". در مدل های مرز 80٪ کار می کند، کمتر در مدل های کوچکتر.
2. **Native structured output APIs.**OpenAI `response_format`، استفاده از ابزار انسان، حالت جمن JSON . قابل اعتماد در طرح های پشتیبانی شده . قفل فروشنده
3. **Constrained decoding.**در هر مرحله تولید، علامت ها را تغییر دهید تا مدل * نمی تواند * توکن های باطل را منتشر کند. 100٪ معتبر توسط ساخت. در هر مدل محلی کار می کند.

این درس برای هر سه نفر با هوش و نام هایی که برای کدام یک می توان به دست آمد، ایجاد می کند.

## مفهوم

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**در هر مرحله نسل، LLM یک وکتور منطقی را در سراسر لغات تولید می کند (~ 100k توکن). یک پردازنده Logit بین مدل و نمونه گیر قرار دارد. این حساب می کند که کدام توکن ها با توجه به موقعیت فعلی در گرامر هدف  JSON Schema، regex، گرامر بدون زمینه  معتبر هستند و لۆژیت های تمام توکن های باطل را به بی نهایت منفی تنظیم می کند. نرمترین مقدار در مورد logits باقی مانده، تنها در ادامه های معتبر، مقدار احتمال را قرار می دهد.

اجرای در سال 2026:

- **Outlines.**به شکل ماشین حالت محدود، طرح JSON یا regex را مرتب می کند. هر توکن یک$O(1)$بر اساس FSM، پس طرح های تکراری نیاز به مسطح کردن دارند.
- **XGrammar / llguidance.**موتورهای گرائمری بدون زمینه. مدیریت طرح JSON تکراری. تقریبا صفر کید کردن هزینه های بالا. OpenAI در اجرای محصول ساختاری خود در سال 2025 راهنمایی را به حساب آورد.
- **vLLM guided decoding.**-بنیاده شده`guided_json`،`guided_regex`،`guided_choice`،`guided_grammar`از طریق طرح ها، XGrammar، یا lm-format-enforcer پس زمینه.
- **Instructor.**بسته بندی مبتنی بر Pydantic بر روی هر LLM. بازبینی در مورد شکست تأیید. ارائه دهنده های مختلف، اما تغییر نمی کند logits  این بر روی بازبینی + ساختاری-خروجی آگاهانه است.

### نتیجه ضد حدس

رمزگذاری محدود اغلب * سریعتر * از تولید بدون محدودیت است. دو دلیل. اول، آن را کوچک می کند فضای جستجو بعدی توکن. دوم، پیاده سازی هوشمند تخفیف تولیدی توکن به طور کامل برای توکن های اجباری (اسکافلد مانند )`{"name": "` هر بایت مشخص می شود).

### اون دام که بهت ميده

نظم ساحلي مهمه`answer`قبل از`reasoning`. و مدل قبل از اینکه فکر کند به یک پاسخ متعهد می شود. JSON معتبر است. پاسخ اشتباه است. هیچ اعتبار آن را دریافت نمی کند.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

ترتیب میدان طرح منطق است نه فرمت کردن

```figure
constrained-decoder
```

## آن را بسازید

### مرحله اول: نسل محدود regex از ابتدا

ببین`code/main.py`برای اجرای مستقل FSM. ایده اصلی در 30 خط:

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

FSM ردیابی می کند که تا حالا چه قسمت هایی از دستور زبان را برآورده کردیم.`valid_tokens(state, tokenizer)`محاسبه می کند که کدام توکن های لغت می توانند FSM را بدون ترک مسیر پذیرش پیشرفت دهند.

### مرحله 2: طرح های طرح JSON

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

صفر اشتباه اعتبارسنجی، هرگز، FSM باعث می شود که محصول ناشناس قابل دسترسی نباشد

### مرحله 3: مربی برای Pydantic

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

مکانیسم مختلف. آموزگار به logits دست نمی دهد. این طرح را به پرامپت فرمت می کند، خروجی را تجزیه و تحلیل می کند و در مورد شکست تأیید (پیش فرض 3 بار) دوباره تلاش می کند. با هر ارائه دهنده کار می کند. تلاش های تکراری تاخیر و هزینه را اضافه می کند. حمل و نقل بین ارائه دهندگان نقطه فروش است.

### مرحله 4: API های فروشنده بومی

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

کدنگی محدود در سمت سرور، تراز قابلیت اطمینان با طرح های پشتیبانی شده، هیچ مدیریت مدل محلی، شما را به فروشنده قفل می کند.

## دام ها

- **Recursive schemas.**طرح ها بازخورد را به عمق ثابت صاف می کند. محصولهای ساختار یافته درخت (تبصرات مهره شده، AST) نیاز به XGrammar یا llguidance (به پایه CFG) دارند.
- **Huge enums.**10 هزار گزینه enum به آرامی یا زمان خارج می شود. به یک بازیافتگر تغییر دهید: پیش بینی اولین کاندیداهای top-k اول، محدود به آنها.
- **Grammar too strict.**قدرت`date: "YYYY-MM-DD"`regex و مدل نمیتونن تولید کنن`"unknown"`براي تاريخ هاي گمشده مدل با اختراع تاريخ تعويض ميکنه`null`یا نگهبان
- **Premature commitment.**.ببینید که در بالا به ترتیب میدان میره . همیشه استدلال را اول قرار بده
- **Vendor JSON mode without schema.**حالت JSON خالص فقط JSON معتبر را تضمین می کند، *برای مورد استفاده شما معتبر نیست.* همیشه یک طرح کامل را ارائه دهید.

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## -باده

پس از`outputs/skill-structured-output-picker.md`:

```markdown
---
name: structured-output-picker
description: Choose a structured output approach, schema design, and validation plan.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Given a use case (provider, latency budget, schema complexity, failure tolerance), output:

1. Mechanism. Native vendor structured output, Instructor retries, Outlines FSM, or XGrammar CFG. One-sentence reason.
2. Schema design. Field order (reasoning first, answer last), nullable fields for "unknown", enum vs regex, required fields.
3. Failure strategy. Max retries, fallback model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema compliance rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## تمرینات

1. **Easy.**یک مدل کوچک با وزن باز (به عنوان مثال، Llama-3.2-3B) را بدون رمزگذاری محدود برای `Review(sentiment, confidence, evidence_span)`اندازه گیری بخش که به عنوان JSON معتبر در 100 بررسی تجزیه و تحلیل می شود.
2. **Medium.**همان corpus با حالت JSON Outlines. نرخ مطابقت، تاخیر و دقت معنوی را مقایسه کنید.
3. **Hard.**یک کد کد را از نو برای شماره های تلفن اجرا کنید (`\d{3}-\d{3}-\d{4}`) 0 نتیجه غیر معتبر را در 1000 نمونه بررسی کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## خواندن بیشتر

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) مقاله Outlines
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) رمزگذاری محدود سریع مبتنی بر CFG.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) ادغام سرور نتیجه گیری
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) مرجع API + gotchas
- [Instructor library](https://python.useinstructor.com/) Pydantic + دوباره در بین ارائه دهندگان تلاش می کند.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) مقایسه 6 چارچوب های محدود رمزگذاری
