# الاعتراف بالكيان المسمى

> سحب الأسماء خارج. يبدو سهلا حتى تتعامل مع حدود غامضة، كيانات مستجمعة، وجرم النطاقات.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## المشكلة

"أبل دعمت جوجل بسبب صفقة بحثها عن iPhone في الولايات المتحدة". خمسة كيانات: Apple (ORG) ، Google (ORG) ، iPhone (PRODUCT) ، صفقة بحث (ربما) ، US (GPE). نظام NER جيد يستخرج جميعها مع أنواع صحيحة. واحد سيء يفتقد iPhone، يخلط Apple الفاكهة مع Apple الشركة، ويعطي علامة "US" كشخص.

إن إير هو الحصان المكلف تحت كل خط إستخراج مهيكلي. تحليل سير سير العمل، مسح سجل الامتثال، تحليل السجلات الطبية، فهم استفسارات البحث، تأسيس استجابات الـ "تشات بوت"، استخراج العقود القانونية. لا يمكنك أبداً رؤيتها تماماً، أنت دائماً تعتمد عليها.

هذه الدروس تمر المسار الكلاسيكي (قاعدة القواعد، HMM، CRF) إلى المسار الحديث (BiLSTM-CRF، ثم المحولات). كل خطوة تحل قيودا محددة من تلك التي قبلها. النمط هو الدروس.

## المفهوم

**BIO tagging**(أو BILOU) يُحول استخراج الكيان إلى مشكلة في وضع علامات التسلسل.`B-TYPE`(بدء الشركة)`I-TYPE`(كيان داخلي) ، أو`O`(خارج أي كيان)

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

سلسلة الكيانات متعددة الرموز: `New B-GPE`،`York I-GPE`،`City I-GPE`نموذج يفهم البيولوجي يمكن استخراج المدى التعسفي.

تقدم الهندسة المعمارية:

- **Rule-based.**البحث عن المعلومات المُعلنة، دقة عالية على الكيانات المعروفة، صفر تغطية على الكيانات الجديدة.
- **HMM.**نموذج ماركوف المخفي احتمال الإصدار من علامة معينة، احتمال انتقال من علامة إلى علامة، تشفير فيتربي، تدريب على البيانات الملصقة.
- **CRF.**الحقل العشوائي المشروط. مثل HMM ولكن تمييزي، حتى يمكنك خلط ميزات تعسفية (شكل الكلمات، الرموز، الكلمات المجاورة). لا يزال حصان العمل الإنتاج الكلاسيكي في عام 2026 للتنفيذات منخفضة الموارد.
- **BiLSTM-CRF.**الميزات العصبية بدلاً من صنعها يدوياً. LSTM تقرأ الجملة في كلا الاتجاهين، وطبقة CRF في الأعلى تفرض تسلسلات علامات متسقة.
- **Transformer-based.**تحديد المعلومات مع رأس تصنيف الرمز، أفضل دقة، أفضل حساب

```figure
ner-bio-tagging
```

## بناءها

### الخطوة الأولى: مساعدي التسمية البيولوجية

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### الخطوة الثانية: الميزات المصنوعة يدوياً

بالنسبة لـ NER الكلاسيكية (غير العصبية) ، هي الميزات اللعبة. المفيدة:

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")`العائدات`xXxxxx`. .`word_shape("USA-2024")`العائدات`XXX-dddd`أنماط الرأسمالية هي إشارة عالية للاسمين المناسبين

### الخطوة الثالثة: قاعدة بسيطة على القواعد + القاموس

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

المجلات الإنتاجية لديها ملايين الإدخالات المقطوعة من ويكيبيديا و DBpedia.`Apple`(الشركة مقابل الفاكهة) فظيع. لهذا السبب فاز النماذج الإحصائية.

### الخطوة الرابعة: خطوة CRF (رسم، ليس إضافة كاملة)

الـ CRF الكامل من الصفر في 50 سطر لا يُنير بدون أساس نظرية الاحتمال.`sklearn-crfsuite`بدلاً من ذلك:

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1`و`c2`التنظيمات L1 و L2. `all_possible_transitions=True`يسمح للنموذج تعلم تسلسلات غير قانونية (مثل: `I-ORG`بعد`O`) غير محتمل، وهذا هو كيف أن CRF يفرض التماسك البيولوجي دون كتابة القيود.

### الخطوة 5: ما يضيفه BiLSTM-CRF

يتم تعلم الميزات. المدخلات: إدخال الرمز (GloVe أو fastText). يقرأ LSTM من اليسار إلى اليمين و من اليمين إلى اليسار. تتجاوز الحالات الخفية المختلفة طبقة إنتاج CRF. لا يزال CRF يفرض استناداً لتتبع التسمية؛ ويستبدل LSTM الميزات المصنوعة يدوياً بالمتعلمات.

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

لطبقة CRF، استخدم `torchcrf.CRF`المكاسب على CRF المصنوعة يدويا يمكن قياسها ولكن أقل مما تتوقع إلا إذا كان لديك عشرات الآلاف من الجمل المسموحة.

## استخدمها

إن spaCy تسافر في مستوى الإنتاج من نوع NER خارج الصندوق.

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

ملاحظة`iPhone`المعلقة`ORG`بدلاً من`PRODUCT` نموذج spaCy الصغير لديه تغطية ضعيفة للكيانات المنتجة.`en_core_web_lg`(تغيرات)`en_core_web_trf`) يفضل ذلك

"مُحَضّن" لـ "NER" القائم على "BERT":

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"`يدمج رموز B-X، I-X متواصلة في فترة. بدونها، تحصل على علامات على مستوى رموز وتضطر إلى دمج نفسك.

### الـ "NER" القائم على الـ "LLM" (خيار 2026)

إن برنامج LLM NER الصفري والقليل الآن تنافس مع نماذج دقيقة في العديد من المجالات، وأفضل بشكل كبير عندما تكون البيانات المسموحة نادرة.

- **Zero-shot prompting.**أعط ماجستير في التدريس قائمة من أنواع الكيانات ومثالية النظام. اطلب من إنتاج JSON. يعمل خارج الصندوق؛ الدقة معتدلة على المجالات الجديدة.
- **ZeroTuneBio-style prompting.**قم بتحلل المهمة إلى استخراج المرشح → التفسير → الحكم → التحقق من جديد. تحفيز خطوة متعددة المراحل (ليس في وقت واحد) دقة بشكل كبير على NER الطبية الحيوية. يعمل نفس النمط للسيطرة القانونية والمالية والعلمية.
- **Dynamic prompting with RAG.**استعادة أكثر الأمثلة مسموحة مماثلة من مجموعة صغيرة من البذور الملحوظة لكل دعوة استنتاج؛ بناء عرض القليل من الألقاب على الفور. في معايير 2026، هذا يرفع GPT-4 الطبية الحيوية NER F1 بنسبة 11-12٪ على الاستجابة ثابتة.
- **Per-entity-type decomposition.**بالنسبة للوثائق الطويلة، فإن مكالمة واحدة التي تستخرج جميع أنواع الكيانات في وقت واحد تفقد التذكر مع نمو الطول. قم بتشغيل مرور استخراج واحد لكل نوع الكيان. تكلفة استنتاج أعلى، دقة أعلى بشكل كبير. هذا النمط القياسي للملاحظات السريرية والعقود القانونية.

توصية الإنتاج اعتبارا من عام 2026: ابدأ بموجب خطة أساسية لمدرسة التدريب قبل جمع بيانات التدريب. غالبًا ما تكون الفورمولا 1 جيدة بما فيه الكفاية بحيث لا تحتاج إلى ضبطها.

### حيث لا يزال النظام الكلاسيكي النووي يفوز

حتى مع الـ LLM المتاحة، نيل كلاسيكية عندما:

- ميزانية التأخير أقل من 50ms
- لديك الآلاف من الأمثلة المسموحة وتحتاج إلى 98٪ + F1.
- المجال لديه أونتولوجيا مستقرة حيث CRF أو BiLSTM المدربة مسبقا ينقل بشكل جيد.
- القيود التنظيمية تتطلب نموذجًا محليًا غير مولد.

### حيث انهار

- **Domain shift.**(نير) المدرب في العقود القانونية أسوأ من (جابريتر)
- **Nested entities.**"بنك أوف أمريكا برج" هو في نفس الوقت ORG و FASILITY. لا يمكن أن تمثل BIO القياسية التداخلات المتداخلة. تحتاج إلى NER المجمعة (نموذجات متعددة المرور أو القائمة على التداول).
- **Long entities.**"شركة التأمين على الودائع الاتحادية في الولايات المتحدة". نماذج مستوى الرمز أحيانا تقسيم هذا. استخدام `aggregation_strategy`أو بعد العملية
- **Sparse types.**علامات NER الطبية مثل DRUG_BRAND، ADVERSE_EVENT، DOSE. النماذج العامة لا فكرة لها. Scispacy و BioBERT هي نقاط البداية هناك.

## أرسله

إبقوا`outputs/skill-ner-picker.md`:

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## التمارين

1. **Easy.**تنفيذ`bio_to_spans`(العكس من `spans_to_bio`) والتحقق من استنتاجية الرحلة الروتينية على 10 جمل.
2. **Medium.**تدريب مركز التدريبات المركزية للشركات المختلفة أعلاه على مجموعة بيانات NER الإنجليزية CoNLL-2003.`seqeval`النتيجة النموذجية: ~ 84 F1.
3. **Hard.**-حسناً`distilbert-base-cased`على مجموعة بيانات NER محددة للمجال (طبية أو قانونية أو مالية). مقارنة مع نموذج spaCy الصغير.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## المزيد من القراءة

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360)ورقة BiLSTM-CRF. تقني.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) يقدم نمط تصنيف الرمز الذي أصبح معيارًا.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) إشارة عملية لكل سمة على `Doc.ents`و`Span`. . .
- [seqeval](https://github.com/chakki-works/seqeval)المكتبة المقاييس الصحيحة استخدمها دائما
