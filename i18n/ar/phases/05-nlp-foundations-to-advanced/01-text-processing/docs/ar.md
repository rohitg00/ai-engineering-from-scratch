# معالجة النص  التكنولوجيا، التأثير، التنظيم

> اللغة مستمرة، النماذج منفصلة، المعالجة المسبقة هي الجسر.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## المشكلة

لا يمكن أن يقرأ نموذج " القطط كانت تهرب"

كل نظام من النظم النفسية يبدأ بنفس الأسئلة الثلاثة. أين تبدأ كلمة. ما هو جذور الكلمة. كيف نعتبر "الركض" و "الركض" و "الركض" نفس الشيء عندما يساعد، وكأشياء مختلفة عندما لا.

إذا أخطأت في إضفاء الرمز، فستتعلم النموذج من القمامة.`don't`كرمز واحد ولكن`do n't`إذا سقطت صوتك`organization`و`organ`إذا كان الممثل يحتاج إلى سياق جزء من الكلام ولكنك لا تمر به، فالأفعال تصبح تعامل كالنص.

هذا الدروس يبني الخطوات الثلاثة المسبقة للمعالجة من الصفر، ثم يظهر كيف أن NLTK و spaCy يفعلون نفس العمل حتى تتمكن من رؤية التداولات.

## المفهوم

ثلاث عمليات لكل منها وظيفة ووضع فشل

**Tokenization**يفرق سلسلة إلى رموز. "التكون" غامض عمدا لأن الحجم الصحيح يعتمد على المهمة. مستوى الكلمة لـ NLP الكلاسيكية. كلمة فرعية لتحولات. حرف لغات بدون مساحة بيضاء.

**Stemming**يقطع الإضافات مع القواعد سريعة، عدوانية، غبية`running -> run`. .`organization -> organ`هذا الثاني هو وضع الفشل

**Lemmatization**يقلل الكلمة إلى شكل قاموسها باستخدام معرفة اللغة. بطيئة، دقيقة، تحتاج إلى جدول بحث أو محلل مورفولوجي. `ran -> run`(يجب أن تعرف "الرحيل" هو الماضي من "الرحيل").`better -> good`(يجب أن يعرف أشكال مقارنة).

قاعدة الإبهام: استنقط عندما يكون السرعة مهمة ويمكنك تحمل الضجيج (مؤشر البحث ، التصنيف القاسية). قم بتحديد معنى عندما يكون الأمر مهمًا (إجابة الأسئلة ، البحث التعريفي ، أي شيء يقرأه المستخدم).

```figure
edit-distance
```

## بناءها

### الخطوة الأولى: إشارة كلمة regex

ينفصل أسهل رمز مفيد على حروف غير ألفانومرية مع الحفاظ على التخطيط كرمز خاص به. ليس مثالياً، وليس نهائياً، لكنه يعمل في سطر واحد.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

ثلاثة أنماط في الترتيب الأولوي. الكلمات مع اختياري الصفحة الداخلية (`don't`،`it's`) أرقام نقية. أي شخصية واحدة غير صفرية غير صفرية غير فضاء بيضاء كرمز مستقل (بقع).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

أساليب الفشل للاحظة`3pm`تقسيم إلى `['3', 'pm']`لأننا قمنا بالتبديل بين خطوط الرسائل والرقم. جيد بما فيه الكفاية لمعظم المهام. عناوين URL، رسائل البريد الإلكتروني، الهاتشاتغ كل شيء ينفصل.

### الخطوة الثانية: مراسلة (خطوة 1 أ فقط)

خوارزمية بورتر الكاملة لديها خمس مراحل من القواعد. الخطوة 1a وحدها تغطي الأكثر شيوعا الإنجليزية الإستثناءات وتعلم النمط.

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

اقرأ القواعد من أعلى إلى أسفل`ies -> i`القاعدة هي السبب`ponies -> poni`لا ، لا`pony`(بورتر) الحقيقي لديه خطوة (ب) الأولى التي ستصلح الأمر القواعد تتنافس القواعد السابقة تفوز النظام مهم أكثر من أي قاعدة واحدة

### الخطوة الثالثة: المُحَرِّر القائم على البحث

يتطلب التجميع الصحيح المورفولوجيا. إصدار تعليمية قابلة للتدريب يستخدم جدول ليم صغير وقلة.

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

الحالة الأخيرة هي لحظة تعليمية رئيسية`watched`ليس على طاولتنا و تراجعنا فقط يُمسّك`ing`. تغطية ليميتيزة حقيقية`ed`، الفعال غير المنتظمة، الصفات المقارنة، الكثائف مع تغييرات الصوت (`children -> child`هذا هو السبب في أن أنظمة الإنتاج تستخدم WordNet، المورفولوجيزر spaCy، أو تحليل المورفولوجية الكاملة.

### الخطوة الرابعة: قم بتجميعها

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

الجزء المفقود هو علامة POS. المرحلة 5 · 07 (POS Tagging) يخلق واحدة.`NOUN`واعتراف بالقيود

## استخدمها

نلتك و سباي سيبعثان نسخة الإنتاج، بضع خطوط لكل واحد

### الـ " نيلتيك "

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize`يتعامل مع الإختناقات، و (يونيكود) ، و الحافة التي تفوتها (ريجكس)`PorterStemmer`يمر كل الخمس مراحل`WordNetLemmatizer`تحتاج إلى علامة POS التي تم ترجمتها من نظام Penn Treebank من NLTK إلى مجموعة اختصار WordNet.

### السباق

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

سيباساي يخفي خط الأنابيب كله خلفه`nlp(text)`. التكنولوجيا، التسمية التجارية، والتميز الكاملة. أسرع من NLTK في المقياس. أكثر دقة خارج الصندوق. التنازل هو أنه لا يمكنك بسهولة تبادل المكونات الفردية.

### متى لا تختار أي

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### الوضعين الفاشلين لا أحد يحذرك عنهم

معظم الدروس تدريس الخوارزميات ووقف. شيئين سوف يضربون خط الأنابيب الحقيقية قبل المعالجة، و أنها تقريبا أبدا تغطية.

**Reproducibility drift.**NLTK و spaCy تغيير التكنولوجيا والسلوكية lemmatizer بين الإصدارات. ما الذي أدى `['do', "n't"]`في spaCy 2.x قد تنتج `["don't"]`في 3.x تم تدريب نموذجك على توزيع واحد. التأثير الآن يعمل على توزيع آخر. الدقة تتدهور بهدوء ولا أحد يعرف لماذا.`requirements.txt`. اكتب اختبار رجعة قبل المعالجة الذي يتجمد التشريع المتوقع من 20 جملة عينات.

**Training / inference mismatch.**تدريب مع عملية التحضير المسبق العدوانية (أقل حرفًا ، إزالة كلمة وقف ، التأثير) ، نشر على مدخل المستخدم الخام ، ومرقبة أداء المراقبة. هذه هي الفشل الوحيد الأكثر شيوعا في الإنتاج من أجهزة النمط النووية. إذا قمت بتعديل أثناء التدريب ، يجب عليك تشغيل الوظيفة المماثلة أثناء الاستنتاج. أرسل عملية التحضير المسبق كعمل داخل حزمة النمط ، وليس كخلية لوح الملاحظة تقوم فريق الخدمة بإعادة كتابتها.

## أرسله

طلب قابل للاستخدام مرة أخرى يساعد المهندسين على اختيار استراتيجية التحضير المسبق دون قراءة ثلاثة كتب دراسية.

إبقوا`outputs/prompt-preprocessing-advisor.md`:

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## التمارين

1. **Easy.**التمديد`tokenize`للحفاظ على عناوين URL كرموز واحد. اختبار: `tokenize("Visit https://example.com today.")`يجب أن تنتج رمز URL واحد.
2. **Medium.**تنفيذ خطوة بورتر 1ب إذا كان الكلمة تحتوي على صوتية وتنتهي في`ed`أو`ing`إزالتها. إمساك قاعدة المزدوج المتصادم (`hopping -> hop`لا ، لا`hopp`)
3. **Hard.**قم ببناء lematizer يستخدم WordNet كجدول بحث ولكن يعود إلى مؤشر Porter عندما لا يكون WordNet مدخل. قياس دقة على جسم معلّم مقابل WordNet و Porter بسيط.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## المزيد من القراءة

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt)الورقة الأصلية، خمسة صفحات، لا يزال واضحة التفسير.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) كيف يتم توصيل خط أنابيب حقيقي
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html)قضايا حافة التكنولوجيا التي لم تفكر بها بعد
