# تعبیر زبان طبیعی  پیامدهای متنی

> "t شامل h" به معنای یک مطالعه انسانی t است که نتیجه گیری می کند h درست است. NLI وظیفه پیش بینی شامل / تضاد / خنثی است. خسته کننده در سطح، تحمل بار در تولید.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## مشکل

تو يه خلاصه سازي ساختي، يه خلاصه ساختي از کجا ميدوني که خلاصه اش تو تو تو حالي نيست؟

تو يه چت روت درست کردي جوابش بله بود از کجا ميدوني که جوابش توسط متن بازيافته پشتیبانی شده؟

شما باید 10 هزار مقاله خبری را به عنوان موضوع طبقه بندی کنید. شما هیچ برچسب آموزشی ندارید. آیا می توانید یک مدل را دوباره استفاده کنید؟

این سه مشکل به نتیجه گیری زبان طبیعی می رسد.`t`و فرضیه ای`h`، این است`h`که توسط `t`، متناقض یا خنثی (غیر مرتبط) ؟

- **Hallucination check:** `t`= سند منبع، `h`.= ادعاي خلاصه نه نتيجه= توهم
- **Grounded QA:** `t`= عبور بازیافت شده`h`جواب تولید شده نه نتیجه گیری ساختگی
- **Zero-shot classification:** `t`= سند`h`برچسب لفظی شده ("این در مورد ورزش است").

یک کار، سه استفاده در تولید. به همین دلیل هر چارچوب ارزیابی RAG یک مدل NLI را زیر کوپ ارسال می کند.

## مفهوم

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t`→ `h`. " گربه روی فرش" به معنای " گربه ای هست"
- **Contradiction.** `t`→`h`. " گربه روی فرش" با " گربه ای وجود ندارد" متناقض می شود
- **Neutral.**هيچ نتيجه اي نيست. " گربه روي چادر است " بي طرفي از " گربه گرسنه است "

**Not logical entailment.**این عبارت از "جان سگ خود را راه می رفت" به معنای "جان سگ دارد" در این عبارت است، اما منطق اولین درجه فقط اگر مالکیت را محور سازی کنید، این را می پذیرد.

**Datasets.**

- **SNLI**(2015). 570 هزار جفت با اشاره انسان، عنوانات تصویر به عنوان مکان. دامنه باریک.
- **MultiNLI**(2017). 433k جفت در 10 ژانر. کورپوس آموزش استاندارد در سال 2026.
- **ANLI**(2019). NLI متناقض. انسان ها نمونه هایی را نوشتند که به طور خاص برای شکستن مدل های موجود طراحی شده است. سخت تر.
- **DocNLI, ConTRoL**(202021). مقالات طول مستند. تست های نتیجه گیری چند رک و دور دراز.

**The architecture.**یک کدگر ترانسفورماتور (BERT، RoBERTa، DeBERTa) می خواند `[CLS] premise [SEP] hypothesis [SEP]`.`[CLS]`نمایش دهنده یک نرم حداکثر سه طرف را تغذیه می کند. در MNLI تمرین کنید، بر اساس معیار های بازده، دقت 90٪ + در جفت های توزیع را بدست آورید.

**Zero-shot via NLI.**با توجه به یک سند و برچسب های نامزد، هر برچسب را به یک فرضیه تبدیل کنید ("این متن در مورد ورزش است"). احتمال مربوطه را برای هر یک محاسبه کنید. حداکثر را انتخاب کنید. این مکانیسم پشت Hugging Face است `zero-shot-classification`خط لوله

```figure
nli-router
```

## آن را بسازید

### مرحله اول: اجرای یک مدل NLI پیش از آموزش

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

برای تولید NLI، `facebook/bart-large-mnli`و`MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`. ديبرتا-و3 در رتبه بندی برتر قرار داره

### مرحله دوم: طبقه بندی صفر شات

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

قالب به طور پیش فرض "این مثال در مورد {تعریف}." است. با  سفارشی کنید`hypothesis_template`. هيچ اطلاعات تدريجي نياز نيست . هيچ تعديلي نيست . از كشتي خارج ميشه

### مرحله سوم: بررسی وفاداری برای RAG

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

این هسته ی وفاداری راگاس است. پاسخ تولید شده را به ادعاهای اتمی تقسیم کنید. هر ادعایی را با زمینه های بازیافت شده بررسی کنید. بخش هایی را که شامل آن می شوند گزارش کنید.

### مرحله 4: طبقه بندی کننده NLI دستی (تصوری)

ببین`code/main.py`برای یک اسباب بازی تنها با یک استدلب: فرضیه و فرضیه با استفاده از تعادل لغوی + تشخیص انکار مقایسه می شود. با مدل های ترانسفورمتر رقابت ندارد  اما شکل کار را نشان می دهد: دو متن در، برچسب سه راه خارج، از دست دادن = انترپی متقابل در `{entail, contradict, neutral}`. .

## دام ها

- **Hypothesis-only shortcuts.**مدل ها می توانند برچسب را از فرضیه به تنهایی در ~ 60% در SNLI پیش بینی کنند زیرا "نه"، "هیچ کس"، "هیچ وقت" با تضاد ارتباط دارد. پایه قوی برای تشخیص نشت برچسب.
- **Lexical overlap heuristic.**هوریستیک فرعی ("هر فرعی در اختیار دارد") SNLI را عبور می کند اما HANS/ANLI را شکست می دهد. از معیار های متناقض استفاده کنید.
- **Document-length degradation.**مدل های NLI یک جمله 20+ F1 را در مکان های طول سند رها می کنند. از مدل های آموزش دیده توسط DocNLI برای زمینه های طولانی استفاده کنید.
- **Zero-shot template sensitivity.**"این مثال در مورد {تعارف}" به نسبت به "{تعارف}" به نسبت به "تعارف {تعارف} است" می تواند دقت را با 10+ نقطه تغییر دهد. قالب را تنظیم کنید.
- **Domain mismatch.**MNLI آموزش در زبان انگلیسی عمومی. متن حقوقی، پزشکی و علمی نیاز به مدل های NLI خاص به دامنه (به عنوان مثال SciNLI، MedNLI) دارد.

## ازش استفاده کن

دسته 2026:

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

مدل متا 2026: NLI، نوار آشتی درک متن است. هر زمان که شما نیاز دارید "آیا A از B پشتیبانی می کند؟" یا "آیا A با B متناقض است؟"  قبل از اینکه برای تماس LLM دیگری برسید، به NLI مراجعه کنید.

## -باده

پس از`outputs/skill-nli-picker.md`:

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## تمرینات

1. **Easy.**فرار کن`facebook/bart-large-mnli`در 20 دسته سهگانه دستکاری (پریمیز، فرضیه، برچسب) که سه کلاس را پوشش می دهد. دقت را اندازه گیری کنید. تله های "هیرستیک فرعی" متناقض را اضافه کنید ("ککک را نخوردم" در مقابل "کک را خوردم") و ببینید که آیا شکسته است.
2. **Medium.**مقایسه قالب صفر شات `"This text is about {label}"`مخالف`"The topic is {label}"`و`"{label}"`در 100 خبر خبر خبر خبر خبر خبر خبر
3. **Hard.**یک چک کننده وفاداری RAG بسازید: تجزیه ادعای اتمی + NLI در هر ادعای. بر اساس 50 پاسخ تولید شده توسط RAG با زمینه طلا ارزیابی کنید. نرخ مثبت و منفی غلط را در مقایسه با برچسب های دستی اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## خواندن بیشتر

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) چندان
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) شاخص مرجع ANLI
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI به عنوان طبقه بندی کننده
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) کارگاه NLI 2026
