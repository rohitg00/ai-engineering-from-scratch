# ترجمة الآلة

> الترجمة هي المهمة التي دفعت للبحث عن النفط النووي لمدة ثلاثين عاماً ومازالت تدفع الآن.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## المشكلة

يقرأ نموذج جملة في لغة واحدة وينتج جملة في لغة أخرى. يختلف الطول. يختلف ترتيب الكلمات. بعض الكلمات المصدرية تعبر عن العديد من الكلمات المستهدفة والعكس. يرفض الأغراف الخريطة الواحدة إلى الواحدة. "أفتقدك" في اللغة الفرنسية هي "tu me manques"  حرفيا "أنت تفتقر لي". لا يوجد ترتيب على مستوى الكلمات يبقى من ذلك.

ترجمة الآلة هي المهمة التي أجبرت النلب على اختراع مُشفّرات المُشفّرات والاهتمام والمتحولات، وفي النهاية نموذج LLM بأكمله. كل خطوة إلى الأمام قدمت لأن جودة الترجمة كانت قابلة للقياس والفجوة بين الإنسان والآلة كانت عنيدة.

هذه الدروس تفوت دروس التاريخ وتعليم خط العمل لعام 2026: إعدادات متعددة اللغات (NLLB-200 أو mBART) ، وتعليقاً بالكلمات الفرعية، بحث الشعاع، تقييم BLEU و chrF، ومجموعة قليلة من أساليب الفشل التي لا تزال يتم شحنها إلى الإنتاج دون أن يتم القبض عليها.

## المفهوم

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

MT الحديث هو محول مبرم مبرم مبرم متدرب على نص مواز. يقرأ المبرم المصدر في رمزية لغته. يقوم المبرم بتوليد الهدف، كلمة فرعية واحدة في كل مرة، باستخدام خروج المبرم عبر الانتباه المتقاطع (المدرس 10). يستخدم التشفير البحث عن شعاع لتجنب فخ المبرم المبرم. يتم تفكيك الخروج وتدميرها وتسجيل النتائج مقابل مرجع.

ثلاثة خيارات تشغيلية تدفع جودة MT في العالم الحقيقي.

- **Tokenizer.**تم تدريب SentencePiece BPE على مجموعة لغات مختلطة. المفردات المشتركة بين اللغات هي ما يسمح بأزواج الصفر في NLLB.
- **Model size.**NLLB-200 600M المقطوعة تناسب على جهاز محمول. NLLB-200 3.3B هو الإعداد الافتراضي للإنتاج المنشورة. 54.5B هو السقف البحثي.
- **Decoding.**عرض الشعاع 4-5 للمحتوى العام. عقوبة الطول لتجنب الإخراج قصير جدا. تشفير محدود عندما تحتاج إلى استناداة المصطلحات.

```figure
seq2seq-alignment
```

## بناءها

### الخطوة الأولى: مكالمة MT المسبقة التدريب

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

ثلاثة أشياء مهمة هنا.`src_lang`يخبر الـ Tokenizer بالخطوط والتنقيم الذي يجب تطبيقه. `forced_bos_token_id`يخبر المقرر اللغة التي يجب توليدها. كلاهما خدوش خاصة بال NLLB؛ mBART و M2M-100 يستخدمون اتفاقياتهم الخاصة ولا يمكن تبادلها.

### الخطوة الثانية: BLEU و chrF

يقدر BLEU التداخل بين الناتج والإشارة n-gram. أربعة أحجام إشارة n-gram (1-4) ، المتوسط الهندسي للدقة ، عقوبة الاختصار للخروج قصير جدا. النتيجة في [0, 100]. تستخدم بشكل شائع. محبط للتفسير: 30 BLEU "يمكن استخدامها" ؛ 40 "جيد" ؛ 50 "مستثنائية" ؛ الاختلافات تحت 1 BLEU ضجيج.

chrF يقيس درجة F على مستوى الأحرف. أكثر حساسية للغات الغنية بشكل مورفولوجي حيث يطابق عدد BLEU. غالبًا ما يتم الإبلاغ عنها جنبًا إلى جنب مع BLEU.

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

دائماً استخدم`sacrebleu`يُعَادِلُ الـ"توكينيزيشن" بحيث تكون النتائج مُقارنة عبر الأوراق.

### التسلسل الهرمي للتقييم على ثلاث مستويات (2026)

تقييم MT الحديث يستخدم ثلاث أسرة مترية متكاملة. السفينة مع اثنين على الأقل.

- **Heuristic**(BLEU, chrF) سريع، مستوحى من المرجعية، قابلة للتفسير، غير حساسة للمقارنة.
- **Learned**(COMET، BLEURT، BERTScore) النماذج العصبية المدربة على الحكم البشري؛ مقارنة التشابه الدلالي للترجمة مع المصدر والمرجع. COMET لديها أعلى ارتباط مع أبحاث MT منذ عام 2023 وهي النقطة الافتراضية في الإنتاج 2026 حيث تهتم الجودة.
- **LLM-as-judge**(حرة من الإشارات). إسهل نموذج كبير لتحديد النتائج حول الترجمات على السهولة والكفاءة والنغمة والمناسبة الثقافية. GPT-4 كقاضي يطابق موافقة الإنسان ~ 80% من الوقت عندما يتم تصميم المادة بشكل جيد. استخدم للمحتوى المفتوح حيث لا توجد إشارة.

التجميع العملي لعام 2026: `sacrebleu`لـ BLEU و chrF`unbabel-comet`لـ COMET، و LLM محفز للإشارة النهائية التي تواجه الإنسان. قم بتصفية كل مقياس ضد 50-100 مثال على علامات الإنسان قبل الاعتماد عليه على بيانات الإنتاج.

المقاييس الخالية من المراجع (COMET-QE، BLEURT-QE، LLM-as-judge) تسمح لك بتقييم الترجمات دون مرجع، وهو أمر مهم بالنسبة لأزواج اللغات الطويلة حيث لا توجد ترجمات مرجعية.

### الخطوة الثالثة: ما الذي ينفذ في الإنتاج

خط الأنابيب العاملة أعلاه سوف يترجم بشكل متساوٍ 80٪ من الوقت ويتعطل صامتًا 20٪ المتبقية.

- **Hallucination.**النموذج يختلق محتوى لم يكن في المصدر. شائع في مفردات النطاق غير المألوفة. الأعراض: الخروج متساوى ولكن يدعي الحقائق لم يذكر المصدر. التخفيف: تشفير محدود على شروط النطاق، مراجعة البشرية على المحتوى المنظم، مراقبة الخروج أطول بكثير من المدخل.
- **Off-target generation.**النموذج يترجم إلى اللغة الخطأ. إن إيل بي هي مُتعرضة للشكل المدهش لهذا في أزواج اللغات النادرة. التخفيف: التحقق `forced_bos_token_id`و دائماً ما تقوم بتفكيك النموذج مع تعريف اللغة
- **Terminology drift.**"التسجيل" يصبح "s'inscribe" في الوثيقة 1 و "creer un compte" في الوثيقة 2. بالنسبة إلى نص UI والسلسلسلة المستخدمة، فإن التوافق مهم أكثر من الجودة الخام. التخفيف: تشفير القواعد المحدود أو قاموس ما بعد التحرير.
- **Formality mismatch.**الفرنسية "tu" مقابل "vous" ، مستويات اللطف اليابانية. يختار النموذج أي شكل كان أكثر شيوعا في التدريب. بالنسبة للمحتوى المتحكم في العملاء عادة ما يكون هذا خطأ. التخفيف: إرساء إضافة إضافية فورمالية إذا كان النموذج يدعمها ، أو ضبط نموذج صغير على الهيئات الرسمية فقط.
- **Length explosion on short input.**غالبًا ما تنتج جمل المدخلات القصيرة جدًا ترجمات طويلة للغاية لأن عقوبة الطول تقع من صخرة أقل من 5 رموز المصدر. التخفيف: القفز القاسية لقطعة الطول المتساوية لطول المصدر.

### الخطوة الرابعة: ضبط الدوائر

النماذج المتدربة مسبقاً هي عامة. يحصل الترجمة القانونية أو الطبية أو الحوار اللعبية على فائدة كبيرة من ضبط الدقة على البيانات المتوازية للمجال.

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

بضعة آلاف من الأمثلة المتوازية عالية الجودة تفوق بضعة مئات الآلاف من تلك التي تم شرائها على شبكة الإنترنت.

## استخدمها

سلسلة الإنتاج لعام 2026 لـ MT:

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

الآن تتفوق LLM على نماذج MT المتخصصة على عدة أزواج اللغات اعتبارًا من عام 2026 ، لا سيما على المحتوى الإيديوماتي والسياق الطويل. التنازل هو التكلفة لكل رمز وتأخير. اختيار LLM عندما يكون طول السياق أو الاتساق النمطي أو تكييف النطاق عبر إشعار الأمور أكثر من الانتقال.

## أرسله

إبقوا`outputs/skill-mt-evaluator.md`:

```markdown
---
name: mt-evaluator
description: Evaluate a machine translation output for shipping.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Given a source text and a candidate translation, output:

1. Automatic score estimate. BLEU and chrF ranges you would expect. State whether a reference is available.
2. Five-point human-verifiable check list: (a) content preservation (no hallucinations), (b) correct language, (c) register / formality match, (d) terminology consistency with glossary if provided, (e) no truncation or length explosion.
3. One domain-specific issue to probe. E.g., for legal: named entities and statute citations. For medical: drug names and dosages. For UI: placeholder variables `{name}`.
4. Confidence flag. "Ship" / "Ship with review" / "Do not ship". Tie to the severity of issues found in step 2.

Refuse to ship a translation without a language-ID check on output. Refuse to evaluate without a reference unless the user explicitly opts in to reference-free scoring (COMET-QE, BLEURT-QE). Flag any content over 1000 tokens as likely needing chunked translation.
```

## التمارين

1. **Easy.**ترجمة فقرة إنجليزية من 5 جمل إلى الفرنسية ثم إلى الإنجليزية باستخدام `nllb-200-distilled-600M`.قيس مدى قرب الرحلة ذهاباً وإياباً من الأصلي . يجب أن ترى الحفاظ على النطق مع الانتقال من اختيار الكلمات
2. **Medium.**تنفيذ التحقق من الهوية اللغوية على نتائج الترجمة باستخدام `fasttext lid.176`أو`langdetect`. إدماج في مكالمة MT حتى يتم القبض على الأجيال خارج الهدف قبل العودة.
3. **Hard.**-حسناً`nllb-200-distilled-600M`على مجموعة من 5000 زوج من النطاقات التي تختارها. قياس BLEU على مجموعة متواصلة قبل وبعد التنسيق الدقيق. تقرير أنواع الجمل تحسن والتي تراجع.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## المزيد من القراءة

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) ورقة NLLB.
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/)لماذا ؟`sacrebleu`هو الطريقة الصحيحة الوحيدة للإبلاغ عن BLEU.
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/)ورقة chrF
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) التنسيق العملي المباشر
