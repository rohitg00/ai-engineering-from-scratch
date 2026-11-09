# الخروج المهيكل والتشفير المقيّد

> اطلب من ماجستير في التدريس JSON. الحصول على JSON في معظم الأحيان. في الإنتاج، "أكثر" هي المشكلة. تحويل التشفير المحدود "أكثر" إلى "أبدا" عن طريق تحرير اللوجيت قبل أخذ العينات.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## المشكلة

يقوم المصنف بإرسال طلب لـ LLM: "رجع واحد من {إيجابي، سلبي، محايد}." يعود النموذج "الرؤية إيجابية  هذا المراجعة هو ملائم بشكل ساحق لأن العميل يعلن صراحة أنهم ...". ينهار محلل الخاص بك. F1 تصنيفك هو 0.0.

إن توليد الشكل الحر ليس عقدًا بل اقتراحًا. نظام إنتاج يحتاج إلى عقد.

هناك ثلاث طبقات في عام 2026.

1. **Prompting.**اسأل بشكل لطيف. "رجع فقط كائن JSON". يعمل حوالي 80% على نماذج الحدود، أقل على الأصغر.
2. **Native structured output APIs.**افتتاح`response_format`أداة الأنثروبية، وضع جيني جي إس او إن، موثوقة على النظم المدعومة، مقفلة من البائع.
3. **Constrained decoding.**تعديل الخصائص في كل خطوة من مراحل التوليد بحيث لا يمكن أن يُصدّر النموذج رموز غير صالحة. 100% صالحة من خلال البناء. يعمل على أي نموذج محلي.

هذا الدروس يبني الحدس لكل ثلاثة وأسماء متى يجب الوصول إليها.

## المفهوم

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**في كل خطوة جيل، ينتج ماجستير في التدريس متجهًا منطقياً على المفردات الكاملة (~ 100k tokens). معالج *logit* يقع بين النموذج ومعينة. يحسب ما هي الرموز صالحة بالنظر إلى الموقف الحالي في النحو اللغوي المستهدف  JSON Schema ، regex ، النحو اللغوي خالي من السياق  ويقوم بتحديد التخفيفات لجميع الرموز غير صالحة إلى اللانهاية السلبية. يضع القيمة المرنة على الأغراض المتبقية كتلة الاحتمال فقط على مواصلات صالحة.

تنفيذات عام 2026:

- **Outlines.**يجمع نظام JSON أو regex إلى آلة الحالة المحدودة. كل رمز يحصل على $O(1)$البحث عن الوسائل القادمة القادمة، لذا يجب أن يتم تسطيح النظم الترددية.
- **XGrammar / llguidance.**محركات اللغة الخالية من السياق. معالجة مخطط JSON التكراري. تكلفة تشفير القليل تقريباً. منح OpenAI إرشادًا في تنفيذها المهيكلي للخروج في عام 2025.
- **vLLM guided decoding.**متكامل`guided_json`،`guided_regex`،`guided_choice`،`guided_grammar`عبر الخطوط المخططة، XGrammar، أو إم-صيغة-مطبق الخلفية.
- **Instructor.**غلاف على أساس Pydantic على أي LLM. تستعيد فشل التحقق. مزود متعدد، ولكن لا يعدل التسجيلات  يعتمد على التجربات المُعدّلة + الإشارات المُهيّنة المُدركة للإنتاج.

### النتيجة المعادية للدراسه

غالباً ما يكون التشفير المقيّد * أسرع * من التوليد غير المقيّد. أسباب: أولاً، إنه يقلل من مساحة البحث التالية للشعار. ثانياً، تتمكن التطبيقات الذكية من تجنب توليد الشعار بالكامل لتحقيق الشعار القسري (مثل الرفع على الارض)`{"name": "` يتم تحديد كل بايت).

### الفخ الذي يكلفك

النظام الميداني مهم`answer`قبل ذلك`reasoning`ويقوم النموذج بتعهد بإجابة قبل أن يفكر. JSON صالحة. الجواب خاطئ. لا توثيق يلتقطها.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

ترتيب الحقل من المخطط هو المنطق، وليس التنسيق.

```figure
constrained-decoder
```

## بناءها

### الخطوة الأولى: التوليد المحدود من البداية

انظر`code/main.py`لتنفيذ مستقل لـ FSM. الفكرة الأساسية في 30 سطر:

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

ويتتبع نظام التدريب الفني الأساسي أجزاء من اللغة التي قمنا بتلبيتها حتى الآن`valid_tokens(state, tokenizer)`يحسب أي رموز لمجموعة الكلمات يمكن أن تقدم في FSM دون ترك مسار قبول.

### الخطوة 2: الخطوط الجراحية لنظام JSON

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

صفر أخطاء التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق

### الخطوة الثالثة: مدرب لمقدم معتاد على المرضى

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

آلية مختلفة. لا يلمس المعلم التسجيلات. يقوم بتصميم النمط إلى الإشارة ، ويقوم بتحليل الخروج ، ويعود إلى محاولة فشل التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق من التحقق.

### الخطوة الرابعة: APIs المورد الأصلي

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

إضافة إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافة إضافية إلى إضافية إضافية إلى إضافة إضافية إلى إضافية إضافية إلى إضافية إضافية إلى إضافية إضافية إلى إضافية إضافية إضافية إلى إضافية إضافية إضافية إضافية إلى إضافية إضافية إضافية إضافية إلى إضافية إضافية إضافية إضافية إضافية إلى إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية إضافية

## الفخاخ

- **Recursive schemas.**المخططات تبطئ التكرار إلى عمق ثابت. الخروج المهيمنة على الأشجار (التعليقات المربطة، AST) تحتاج إلى XGrammar أو إيلغيدانس (بناء على CFG).
- **Huge enums.**إنّ عدد الخيارات 10000 يُجمع ببطء أو في وقتٍ ما. انتقل إلى جهاز إستعادة: توقع أول مرشحين في المرتبة الأولى، ثم تقيد إلى أولئك.
- **Grammar too strict.**القوة`date: "YYYY-MM-DD"`لا يمكن أن تنطلق regex والنموذج `"unknown"`النموذج يعوض من خلال اختراع تاريخ.`null`أو حارس
- **Premature commitment.**انظروا إلى الحيل الميدانية أعلاه، ضع الأسباب أولاً
- **Vendor JSON mode without schema.**وضع JSON النقي يضمن فقط JSON صالحة، غير صالح *للحالة الاستخدام الخاصة بك.

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## أرسله

إبقوا`outputs/skill-structured-output-picker.md`:

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

## التمارين

1. **Easy.**قم بتصميم نموذج صغير ومفتوح (مثل Llama-3.2-3B) دون تشفير محدود ل `Review(sentiment, confidence, evidence_span)`. قياس الجزء الذي يحلل ك JSON صالحة على 100 مراجعة.
2. **Medium.**نفس الجسم مع وضع الخطوط الجارية JSON. مقارنة معدل الامتثال، التأخير، والدقة التفاصيل.
3. **Hard.**تنفيذ مُشعّر إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصدارات إصات إصدارات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إصات إص`\d{3}-\d{3}-\d{4}`) التحقق من 0 نتائج غير صالحة على 1000 عينة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## المزيد من القراءة

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) ورقة المخططات
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) تشفير مقيد سريع على أساس CFG.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) تكامل خادم الاستنتاج
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) إشارة إطار الإطار المعمول به + إشارة إشارة إطار الإطار المعمول به
- [Instructor library](https://python.useinstructor.com/) Pydantic + تحاول مرة أخرى عبر مزودي الخدمات.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) تقييم مقارنة 6 إطار تشفير محدود.
