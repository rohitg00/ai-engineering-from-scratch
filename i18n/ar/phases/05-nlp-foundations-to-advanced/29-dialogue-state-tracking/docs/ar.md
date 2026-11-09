# تحديد حالة الحوار

> أريد مطعم رخيص في الشمال... في الواقع جعله معتدلا... وأضيف الإيطالي.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## المشكلة

في نظام حوار موجه للمهمة، يتم تشفير هدف المستخدم كمجموعة من أزواج القيمة: `{cuisine: italian, area: north, price: moderate}`. كل مستخدم يُمكن أن يضيف أو يغير أو يُزيل فتحة. يجب على النظام قراءة المحادثة بأكملها وإخراج الحالة الحالية بشكل صحيح.

إذا أخطأت في فتحة واحدة، فإن النظام يحجز المطعم الخطأ، أو يحدد الرحلة الخطأ، أو يفرض رسومًا على البطاقة الخطأ.

لماذا لا يزال الأمر مهمًا في عام 2026 على الرغم من القانون:

- المجالات الحساسة على الامتثال (الخدمات المصرفية والرعاية الصحية والحجز للخطوط الجوية) تتطلب قيم الفتحات المحددة، وليس توليد الشكل الحر.
- وكلاء استخدام الأدوات لا يزالون بحاجة إلى حل فتحة قبل الاتصال بـ (إباي)
- تصحيح المكالمات المتعددة أصعب مما يبدو: "في الواقع لا، اجعل ذلك يوم الخميس".

خط الأنابيب الحديث: مفاهيم DST الكلاسيكية + مستخرجات LLM + حواجز إنتاج مهيكلة.

## المفهوم

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**تعريف النظام المجال (المطعم والفندق والتاكسي) ومواقعها (المطبخ والمنطقة والسعر والناس). يمكن أن تكون كل فتحة فارغة، ومليئة بقيمة من مجموعة مغلقة (السعر: {رخيص، متوسط، مكلف}) ، أو قيمة شكل حر (اسم: "مخزن النحاس").

**Two DST formulations.**

- **Classification.**لكل زوج (قسمة، مقترح_قيمة) ، توقع نعم / لا. يعمل على فتحات مغلقة. القياسية قبل عام 2020.
- **Generation.**نظراً للحوار، قم بتوليد قيم القمار كنص حر يعمل على القمار المفتوحة.

**Metric.**دقة الهدف المشترك (JGA)  جزء من المداولات التي يكون فيها * كل * فتحة صحيحة. كل أو لا شيء. MultiWOZ 2.4 تصل إلى أعلى مستوى حوالي 83٪ في عام 2026.

**Architectures.**

1. **Rule-based (slot regex + keyword).**نقطة أساس قوية للمناطق الضيقة قابلة للتحليل
2. **TripPy / BERT-DST.**إنتاج القاعدة النسخية مع تشفير BERT، معيار ما قبل LLM.
3. **LDST (LLaMA + LoRA).**ماجستير في العلوم التدريبية مع استدعاء الحلقة المجالية. يصل إلى مستوى ChatGPT على MultiWOZ 2.4.
4. **Ontology-free (2024–26).**تخطي النظام، توليد أسماء القواعد والقيم مباشرة. التعامل مع المجالات المفتوحة.
5. **Prompt + structured output (2024–26).**ماجستير في التدريبات مع مخطط "بيدانتيك" + تشفير محدود، 5 خطوط من الشفرة، جاهزة للإنتاج

### أساليب الفشل الكلاسيكية

- **Co-reference across turns.**"دعونا نبقى مع الخيار الأول". يحتاج إلى حل أي خيار.
- **Over-write vs append.**المستخدم يقول "إضافة الإيطالية". هل تستبدل المطبخ أو إضافة؟
- **Implicit confirmations.**"حسناً، رائع" هل قبلت الحجز المقدم؟
- **Correction.**"في الواقع، يجب أن يكون الساعة السابعة مساءً" يجب أن يُحديث الوقت دون تغيير الفتحات الأخرى.
- **Coreference to previous system utterance.**"نعم، هذا" أيّ "هذا"؟

```figure
n5-slot-tracker
```

## بناءها

### الخطوة الأولى: مستخرج فتحة قائمة على القواعد

انظر`code/main.py`قاموس "ريجكس+" المختلفة تغطي 70٪ من التصريحات القنوية في مجالات ضيقة:

```python
CUISINE_SYNONYMS = {
    "italian": ["italian", "pasta", "pizza", "italy"],
    "chinese": ["chinese", "chow mein", "noodles"],
}


def extract_cuisine(utterance):
    for canonical, synonyms in CUISINE_SYNONYMS.items():
        if any(syn in utterance.lower() for syn in synonyms):
            return canonical
    return None
```

فهي غير قابلة للتطبيق في المفردات القنونية، وتعمل على تأكيدات الفتحة المحددة.

### الخطوة الثانية: حلقة تحديث الحالة

```python
def update_state(state, utterance):
    new_state = dict(state)
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value
    for slot in NEGATION_CLEARS:
        if is_negated(utterance, slot):
            new_state[slot] = None
    return new_state
```

ثلاثة مستحيلات:

- لا تعيد إعادة تعيين فتحة لم يلمسها المستخدم
- يجب أن يكون الرفض الصريح ("لا يهم المطبخ") واضحا.
- تصحيح المستخدم ("في الواقع ...") يجب أن يكون مبالغ فيه، وليس إضافة.

### الخطوة الثالثة: DST القائم على الدرجة العليا مع إنتاج مهيكلي

```python
from pydantic import BaseModel
from typing import Literal, Optional
import instructor

class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None


def llm_dst(history, llm):
    prompt = f"""You track the slot values of a restaurant booking across turns.
Dialogue so far:
{render(history)}

Update the state based on the latest user turn. Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)
```

المعلم + Pydantic يضمن وجود كائن حالة صالحة لا يوجد regex، لا تخطيطات، لا فتحات الهلوسة.

### الخطوة الرابعة: تقييم الجمعيات العامة

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

التصفية: ما هو جزء من المداولات التي يحصل عليها النظام على جميع فتحات الحق؟ بالنسبة لمليتو ز 2.4 ، أفضل أنظمة 2026: 80-83٪. يجب أن يتجاوز نظامك في المجال ذلك على المفرد الضيق أو خط الأساس LLM تفوقك.

### الخطوة 5: تصحيح التعامل

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

عند التعديل المكتشف، قم بإعادة كتابة الفتحة المحدثة الأخيرة بدلاً من إضافة. من الصعب الحصول على الحق دون مساعدة LLM. النمط الحديث: دع LLM دائمًا يعيد التاريخ بالكامل بدلاً من تحديثه تدريجيًا  هذا يتعامل بطبيعة الحال مع التعديلات.

## الفخاخ

- **Full-history regeneration cost.**السماح لـ " ماجستير في إدارة الأعمال " بتحديث كل دور من التكاليف$O(n^2)$إحصائيات الإجمالية. تاريخ السقف أو تلخيص المداولات القديمة.
- **Schema drift.**إضافة فتحات جديدة بعد التدريب يكسر بيانات التدريب القديمة
- **Case sensitivity.**"إيطالي" ضد "إيطالي" ضد "إيطالي"  تتعايش في كل مكان.
- **Implicit inheritance.**إذا كان المستخدم قد حدد "لـ 4 أشخاص" في السابق، لا ينبغي أن يزيل طلب جديد لفترة مختلفة الأشخاص.
- **Free-form vs closed-set.**الاسماء والزمان والعناوين تحتاج إلى فتحات حرة؛ المطبخات والمناطق مغلقة.

## استخدمها

"مجموعة 2026"

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## أرسله

إبقوا`outputs/skill-dst-designer.md`:

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, compliance needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for compliance-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## التمارين

1. **Easy.**قم ببناء متابعة الحالة القائمة على القواعد في `code/main.py`لـ 3 فتحات (المطبخ، المساحة، السعر) الاختبار على 10 حوارات مصنوعة يدوياً. قياس JGA.
2. **Medium.**نفس مجموعة البيانات مع المعلم + Pydantic + ماجستير في العلوم الصغيرة مقارنة JGA فحص أصعب المدار
3. **Hard.**تنفيذ كل من الطريق: القاعدة الأساسية، والإسترداد LLM عندما تقوم القاعدة الإصدار <2 فتحات مع الثقة. قياس الجمعية الجمعية والتكلفة الاستنتاجية لكل دور.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## المزيد من القراءة

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) مقياس القنوني.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) ضبط تعليمات LLaMA + LoRA لـ DST.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877)-الفرس العمل DST القائم على النسخ
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) الوفاة غير المشرفة القائمة على الإصابة بالعدوى
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz)نتائج DST القنوني
