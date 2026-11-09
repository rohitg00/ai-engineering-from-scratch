# پیگیری وضعیت گفتگویی

> "من يه رستوران ارزان در شمال ميخوام... در واقع يه رستوران معتدل سازيم... و يه رستوران ايطاليايي اضافه کنم".

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## مشکل

در یک سیستم دیالوگ کار گرا، هدف کاربر به عنوان مجموعه ای از زوج های ارزش اسلات کدگذاری می شود: `{cuisine: italian, area: north, price: moderate}`هر نوبت کاربر می تواند یک اسلات را اضافه، تغییر یا حذف کند. سیستم باید کل مکالمه را بخواند و وضعیت فعلی را به درستی صادر کند.

یک سلاتی اشتباه کنید و سیستم رستوران اشتباه را ثبت کند، پرواز اشتباه را برنامه ریزی کند یا کارت اشتباه را شارژ کند. DST بین آنچه که کاربر گفته و آنچه که پشت سر انجام می دهد، است.

چرا هنوز در سال 2026 مهم است با وجود LLM:

- دامنه های حساس به رعایت (بانکی، مراقبت های بهداشتی، رزرو خطوط هوایی) نیاز به ارزش های قطعات تعیین کننده دارند، نه تولید شکل آزاد.
- ماموران استفاده از ابزار هنوز هم قبل از تماس با API ها نیاز به حل اسلات دارند.
- اصلاح چند نوبت سخت تر از آن است که به نظر می رسد: "در واقع نه، آن را پنجشنبه".

خط لوله مدرن: مفاهیم کلاسیک DST + استخراج کننده های LLM + محافظهای ساختاری.

## مفهوم

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**یک طرح دامنه ها (ستوران، هتل، تاکسی) و سلائت های آنها (طبخ، منطقه، قیمت، مردم) را تعریف می کند. هر سلائت می تواند خالی باشد، با یک مقدار از یک مجموعه بسته (قیمت: { ارزان، متوسط، گران قیمت}) یا یک مقدار آزاد (نام: "کتل مس") پر شود.

**Two DST formulations.**

- **Classification.**برای هر جفت (slot، candidate_value) ، پیش بینی بله/نه. برای سلائت های لغاتی بسته کار می کند. استاندارد قبل از سال 2020.
- **Generation.**با توجه به دیالوگ، ارزش های اسلات را به عنوان متن آزاد تولید کنید. برای اسلات های لغت باز کار می کند. پیش فرض مدرن.

**Metric.**دقت هدف مشترک (JGA)  بخش از پیچ هایی که در آن هر نقطه درست است. همه یا هیچ. MultiWOZ 2.4 در سال 2026 در حدود 83٪ در رتبه بندی قرار دارد.

**Architectures.**

1. **Rule-based (slot regex + keyword).**خط پايين قوي براي دامنه هاي تنگ، قابل اصلاح
2. **TripPy / BERT-DST.**تولید مبتنی بر کپی با کد BERT استاندارد قبل از LLM
3. **LDST (LLaMA + LoRA).**LLM تنظیم شده با آموزش با درخواست دامنه. به کیفیت سطح ChatGPT در MultiWOZ 2.4 می رسد.
4. **Ontology-free (2024–26).**از طرح تخفیف خارج شوید، نام و ارزش های اسلات را مستقیماً تولید کنید. دامنه های باز را اداره می کند.
5. **Prompt + structured output (2024–26).**LLM با طرح پيدانتيك + رمزگشایی محدود 5 خط کد آماده توليد

### حالت های شکست کلاسیک

- **Co-reference across turns.**"با اولين گزینه ادامه بده" بايد تصميم بگيريم که کدامين
- **Over-write vs append.**کاربر میگه "ایطالوی اضافه کن". آیا شما آشپزخانه را جایگزین می کنید یا اضافه می کنید؟
- **Implicit confirmations.**"خوب خب"  آیا این رزرو پیشنهاد شده را قبول کرد؟
- **Correction.**"در واقع ساعت 7 عصر میره" باید بدون پاک کردن سایر نقاط زمان رو به روز کنم
- **Coreference to previous system utterance.**"آره، اون يکي" کي "اون"؟

```figure
n5-slot-tracker
```

## آن را بسازید

### مرحله 1: استخراج کننده ی قاعده ای

ببین`code/main.py`. لغات های مترادف "ریگکس+" ۷۰ درصد از اظهارات قنونی را در حوزه های باریک پوشش می دهند:

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

خارج از لغات قنونيک، براي تاییدات قطعات تعیین کننده کار ميکنه

### مرحله 2: حلقه بروزرسانی حالت

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

سه نوع غیر متغیر:

- هرگز یک سلاتی را که کاربر لمس نکرده است، تنظیم مجدد نکنید.
- انکار صریح ("مطبخ را فراموش کنید") باید واضح شود.
- تصحیحات کاربر ("در واقع...") باید اضافه شود نه اضافه شود.

### مرحله 3: DST مبتنی بر LLM با تولید ساختار یافته

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

آموزش دهنده + پيدانتيك تضمین ميکنه که يه جسم حالت درست باشه.

### مرحله چهارم: ارزیابی JGA

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

کالیبر: سیستم چه فرقی از نوبتها را درست می کند؟ برای MultiWOZ 2.4، سیستم های 2026 برتر: 80-83٪. سیستم در دامنه شما باید از لغت تنگ شما فراتر رود یا خط پایه LLM شما را پیروز می کند.

### مرحله 5: اصلاح دستکاری

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

در یک تصحیح شناسایی شده، آخرین نقطه به جای اضافه کردن را اضافه کنید. بدون کمک LLM سخت است. الگوی مدرن: همیشه اجازه دهید LLM کل وضعیت را از تاریخ بازسازی کند به جای به طور تدریجی به روز شدن.

## دام ها

- **Full-history regeneration cost.**اجازه دادن به هر دوره ای که هزینه های LLM را به حالت تازه ای برسانند$O(n^2)$کل توکن ها. سابقه کاپ یا خلاصه ی دور های قدیمی تر
- **Schema drift.**اضافه کردن سلايت هاي جديد پس از هک داده هاي آموزش هاي قديمي رو خراب ميکنه
- **Case sensitivity.**"اِتاليايي" در مقابل "اِتاليايي" در مقابل "اِتاليايي" همه جا به طور معمول تبديل ميشه
- **Implicit inheritance.**اگر کاربر قبلاً "برای 4 نفر" را مشخص کرده باشد، درخواست جدید برای زمان دیگری نباید افراد را پاک کند. همیشه تاریخچه کامل را ارسال کنید.
- **Free-form vs closed-set.**نام ها، زمان ها و آدرس ها نیاز به سلاوت های آزاد دارند؛ آشپزخانه ها و مناطق بسته شده اند. هر دو را در طرح مخلوط کنید.

## ازش استفاده کن

دسته 2026:

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## -باده

پس از`outputs/skill-dst-designer.md`:

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

## تمرینات

1. **Easy.**در  ایجاد ردیابی حالت مبتنی بر قوانین`code/main.py`برای 3 سلاوت (طبخ، منطقه، قیمت) ، آزمایش در 10 دیالوگ دستکاری. اندازه گیری JGA.
2. **Medium.**همون مجموعه داده ها با Instructor + Pydantic + LLM کوچک مقایسه JGA سخت ترین پیچ ها را بررسی کنید
3. **Hard.**پیاده سازی هر دو و مسیر: اصول اولیه مبتنی بر قانون، LLM fallback زمانی که قوانین مبتنی بر انتشار <2 slots با اطمینان. اندازه گیری ترکیبی JGA و هزینه نتیجه گیری در هر نوبت.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## خواندن بیشتر

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) معیار قانونی.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) تنظیم دستورالعمل LLaMA + LoRA برای DST.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) کارگاه DST مبتنی بر کپی
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) مرگ غیرمراقب مبتنی بر EM
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) نتایج DST کاینونیک
