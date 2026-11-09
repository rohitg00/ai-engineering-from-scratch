# علامات POS و تحليل اللغة

> كانت الحجم غير موضع الطراز لفترة، ثم كل خط أنابيب ماجستير في العلوم الحكمة يحتاج إلى التحقق من الاستخراج المهيكلي،

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## المشكلة

الدروس الأولى وعدت بأن الـ "ليميتازيشن" تحتاج إلى علامة جزء من الكلام`running`هو فعل، لا يمكن لمهاتيزر أن يقلله إلى`run`بدون معرفة`better`هو صفت، لا يمكن أن تقلل إلى `good`. . .

هذا الوعد يخفي حقلًا فرعيًا كاملًا. تعيين جزء من الكلام للفئات الجهامية. تحليل النصية يعيد بنية الجملة: أي كلمة تعدل أي كلمة ، أي فعل يحكم أي حجج. قضى النمط النووي الكلاسيكي عشرين عامًا على تحسين كل منهما. ثم انهيار التعلم العميق في مهمة تصنيف رمزية فوق محول مقدم تدريب ، ومتواصل مجتمع البحث.

لا مجتمع التطبيق. لا يزال كل خط أنابيب استخراج مهيكلي يستخدم أشجار POS ومدرجة الاعتماد تحت الغطاء. يتم التحقق من JSON التي تم إنشاؤها من خلال LLM ضد القيود النحوية. تقوم أنظمة الإجابة على الأسئلة بتفكيك الأسئلة باستخدام أجزاء تعتمد. يقوم مقدمو جودة الترجمة الآلية بتحقق من التوجه لأجزاء الأجزاء.

هذا الدروس يقدم لك علامات التجديد، خطوط الأساس، ونقطة حيث تتوقف عن تنفيذها من الصفر وتدعو spaCy.

## المفهوم

**POS tagging**يضع علامات على كل رمز مع فئة صفرية.**Penn Treebank (PTB)**التجست هي الإنجليزية الافتراضية. 36 علامة مع الاختلافات يجد القارئ العادي مزعج: `NN`اسم واحد، `NNS`اسم متعدد`NNP`اسم خاص واحد`VBD`فعل الماضي،`VBZ`الفعل الشخص الثالث المتفرد الحاضر، وهلم جرا.**Universal Dependencies (UD)**التجست أكثر قاسية (17 علامة) ومتعددة اللغات؛ وأصبحت الافتراض الافتراضي للعمل عبر اللغات.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**يُنتج شجرة.

- **Constituency parsing.**تعبيرات اسمية، تعبيرات فعل، تعبيرات تعبيرات تعويضية تعيش داخل بعضها البعض. الناتج هي شجرة من الفئات غير النهائية (NP، VP، PP) مع الكلمات كوراق.
- **Dependency parsing.**كل كلمة لديها كلمة رأس واحدة تعتمد عليها ، وتتسم بالعلاقة الجهامية. الناتج هي شجرة حيث كل حافة هي (الرأس ، والاعتماد ، والعلاقة) ثلاثية.

فاز تحليل الاعتماد في 2010s لأنه يجميع بشكل نظيف عبر اللغات، وخاصة تلك التي من ترتيب الكلمات الحرة.

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## بناءها

### الخطوة الأولى: نقطة أساسية للشخصيات الأكثر شيوعاً

أهم علامة POS التي تعمل، لكل كلمة، توقع علامة كانت لديها في التدريب

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

على الجسم البراون، هذا الخط الأساسي يصل إلى دقة 85٪. ليس جيدا، ولكن الأرضية التي لا ينبغي أن تسقط أي نموذج خطير.

### الخطوة الثانية: علامة HMM الكبيرة

نموذج احتمال المشترك للانتظام:

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

الجداول الثانية: احتمالات الانتقال (التسمية مع التسمية السابقة) ، احتمالات الانبعاث (التسمية مع الكلمة). تقدير كل من العد مع تسطيح لابلاس. فك مع Viterbi (برمجة ديناميكية على شبكة التسمية).

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

البيغرام HMM على براون يصل إلى دقة ~ 93٪. قفزة من 85% إلى 93% هي معظم احتمالات الانتقال  يتعلم النموذج `DET NOUN`هو شائع و`NOUN DET`نادرة

### الخطوة الثالثة: لماذا يضرب المشاركون الحديثون هذا

احتمالات الانتقال + الانبعاثات محلية.`saw`هو اسم في "لقد اشتريت ورقة" ولكن فعل في "شاهدت الفيلم". CRF مع ميزات تعسفية (التضاف، شكل الكلمة، كلمة قبل وبعد، كلمة نفسها) يصل ~97٪. BiLSTM-CRF أو المحول يصل ~98% +.

يحدد السقف على هذه المهمة من خلال خلاف الملاحظين. الملاحظون البشريين يوافقون على حوالي 97% من الوقت على بن تريبانك. النماذج التي تجاوزت 98% على الأرجح تتجاوز معدات الاختبار.

### الخطوة الرابعة: رسم تحليل الاعتماد

التبعية الكاملة تحليل من الصفر خارج نطاق؛ التعامل الكانوني دروس الكتاب هو في جورافسكي ومارتن. العائلات الكلاسيكية للاعتراف:

- **Transition-based**تعمل المصفحات (مستعدة للقوس ، ومعايير القوس) مثل المصفحات المقللة للدورة: فهي تقرأ الرموز ، وتحويلها إلى كومة ، وتطبق إجراءات تقلل تخلق القوس. يتم تشفير الشموع بسرعة. التنفيذ الكلاسيكي هو MaltParser. النسخة العصبية الحديثة: المصفح القائم على انتقال تشين ومانينغ.
- **Graph-based**يُسجلُ الجزر (الخوارزميةِ الآيزنرِ، Dozat-Manning biaffine) كل حافةٍ محتملةٍ تعتمد على الرأس ويحددُ الأشجارِ التي تُمتدُ أقصى مدىً. أبطأُ ولكن أكثر دقةً.

بالنسبة لمعظم العمل المطبق، اتصل بـ spaCy:

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

اقرأ`dep`عمود من أسفل إلى أعلى و هيكل الجملة النحوية ينزلق.

## استخدمها

كل مكتبة إنتاج NLP ترسل POS و إحصائيات الاعتماد كجزء من خط أنابيب قياسي.

- **spaCy**(`en_core_web_sm`- لا ، لا`md`- لا ، لا`lg`- لا ، لا`trf`السرعة، الدقة، متكاملة مع التكنولوجيا + NER + التنظيم. `token.tag_`(بين) ، `token.pos_`(UD) ، `token.dep_`(علاقة الاعتماد)
- **Stanford NLP (stanza)**. خليفة ستانفورد لـ CoreNLP . أحدث التكنولوجيا على أكثر من 60 لغة
- **trankit**-تعتمد على محول، دقة جيدة
- **NLTK**. .`pos_tag`قابلة للاستخدام، بطيئة، أكبر سناً، جيدة للتدريس

### حيث لا يزال هذا مهمًا في عام 2026

- **Lemmatization.**الدروس رقم واحد تحتاج إلى POS لتعريفها بشكل صحيح دائماً
- **Structured extraction from LLM outputs.**تأكيد أن الجملة المولدة تحترم القيود النحوية (مثل اتفاق الموضوع والفعل، والتحديلات المطلوبة).
- **Aspect-based sentiment.**تحليلات الاعتماد تخبرك أي صفت تعدل أي اسم
- **Query understanding.**"الأفلام التي قام بها (ويس أندرسون) بتمثيل (بيل موراي) " تتحلل إلى قيود مهيكلة عبر التحليل.
- **Cross-lingual transfer.**علامات UD وعلاقات الاعتماد هي لغوية-مجهولة، مما يسمح بتحليل هيكلي صفر إطلاق من اللغات الجديدة.
- **Low-compute pipelines.**إذا لم تتمكن من شحن محول، فإن POS + تحليل الاعتماد + جاجتير يجعلك متفاجئاً بعيداً.

## أرسله

إبقوا`outputs/skill-grammar-pipeline.md`:

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## التمارين

1. **Easy.**باستخدام خط الأساس الأكثر تواترًا على مجموعة صغيرة من العلامات (على سبيل المثال ، مجموعة فرعية براون من NLTK) ، قياس دقة الجمل التي تم استمرارها. تحقق من نتيجة ~ 85٪.
2. **Medium.**قم بتدريب HMM الكبير أعلاه وتقرير الدقة / استدعاء لكل علامة.
3. **Hard.**استخدم تحليل الاعتماد spaCy لاستخراج ثلاثة أجزاء من الموضوع - الفعل - الموضوع من عينة 1000 جملة. تقييم على 50 ثلاثية معلقة يدويا. وثيقة حيث يفشل استخراج (غالبا ما تكون السلبية والتنسيقات والموضيع المتفردة).

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## المزيد من القراءة

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) التعامل مع الكانونيكية في الكتب المدرسية لـ POS والتحليل.
- [Universal Dependencies project](https://universaldependencies.org/) مجموعة علامات متعددة اللغات ومجموعة "تريب بانك" تستخدمها كل محلل متعدد اللغات.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) إشارة عملية لكل سمة تم عرضها على `Token`. . .
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf)الورقة التي جلبت المفصلات العصبية إلى السيطرة الرئيسيّة
