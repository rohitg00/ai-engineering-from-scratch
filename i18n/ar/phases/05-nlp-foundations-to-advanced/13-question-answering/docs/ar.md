# أنظمة الإجابة على الأسئلة

> ثلاثة أنظمة شكلت قاعدة الذكاء الحديثة. اكتشفت الاستخراجية المدة. استرجاع زيادة أرضهم في الوثائق. تولدت الجيناتية الإجابات. كل مساعد الذكاء الاصطناعي الحديث هو مزيج من الثلاثة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## المشكلة

يكتب المستخدم "متى أطلق أول جهاز iPhone؟" ويوقع "29 يونيو 2007". ليس "تاريخ Apple طويل ومختلف". ليس "2007" يجلس في عزلة دون جملة. إجابة مباشرة ومأرضية صحيحة.

ثلاث معمارات سيطرت على تقييم المعلومات خلال العقد الماضي.

- **Extractive QA.**في حالة وجود سؤال ومقطع يعرف أنه يحتوي على الإجابة، ابحث عن مؤشرات بداية ونهاية فترة الإجابة في المقطع.
- **Open-domain QA.**لا يتم إعطاء المقطع. استرجع المقطع ذي الصلة أولاً، ثم استخراج أو توليد إجابة. هذه هي أساس كل خط أنابيب RAG اليوم.
- **Generative / Closed-book QA.**نموذج لغة كبير يرد من ذاكرة معاييرها لا استرداد أسرع في الاستنتاج أقل موثوقية على الحقائق

الاتجاه في عام 2026 هو هجين: استرداد أفضل بعض المقاطع، ثم إرسال نموذج تولدي للإجابة على أرض الواقع في تلك المقاطع. وهذا هو RAG، ودرس 14 يغطي استرداد نصف عمق. هذا الدرس يبني نصف QA.

## المفهوم

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**تشكيل السؤال والمرور مع محول (عائلة BERT). قم بتدريب رؤساء اثنين يتوقعون مؤشرات البدء والنهاية من الإجابة. الخسارة هي الانتروبيا المتقاطعة على المواقف الصالحة. الخروج هو فترة من الممر. لا تخيل أبدا (ببناء) ، لا يتعامل أبداً الأسئلة التي لا يمكن للممر الإجابة عليها (بناء).

**Retrieval-augmented (RAG).**مرحلتين أولاً، فالمستعيد يجد الجزء العلوي`k`المقاطع من مجموعة. ثانيا، يقوم القارئ (المستخرج أو الجيني) بتوليد الإجابة باستخدام تلك المقاطع. يسمح تقسيم القارئ-المتعلم بتدريب كل منهما وتقييمه بشكل مستقل. غالبًا ما يضيف RAG الحديث إعادة ترتيب بينهما.

**Generative.**ماجستير في التعليمات العليا (GPT، Claude، Llama) فقط يرد على الوزن المتعلم. لا خطوة لاسترداد. ممتازة على المعرفة العامة، كارثية على الحقائق النادرة أو الحديثة. معدل الهلوسة يتصل بشكل عكسي مع تردد الحقائق في بيانات ما قبل التدريب.

```figure
qa-span
```

## بناءها

### الخطوة الأولى: الاختيار الاستخرجي مع نموذج متدرب مسبقًا

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2`يتم تدريبها على SQuAD 2.0، والتي تتضمن أسئلة لا تجيب لها.`question-answering`النزيل يعود أعلى مستوى من النقاط حتى عندما يفوز النموذج صفر النقاط  فإنه لا * لا * يعود تلقائيا إجابة فارغة. للحصول على سلوك صريح "لا إجابة" ، مر`handle_impossible_answer=True`إلى مكالمة خط الأنابيب: ثم يعود خط الأنابيب إجابة فارغة فقط عندما تتجاوز النتيجة الصفرية كل نقطة فترة.`score`في كلتا الحالتين

### الخطوة الثانية: خط أنابيب معزز بالانتشاط (رسم)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

خط أنابيب مرحلتين. العثور الكثيف (Sentence-BERT) يجد المقاطع ذات الصلة من خلال التشابه التجميلي. القارئ الاستخرجي (RoBERTa-SQuAD) يسحب فترة الإجابة من المقاطع العليا المشتركة. يعمل على أعضاء صغيرة. بالنسبة لمليوني جسم وثيقة، استخدم FAISS أو قاعدة بيانات متجهة.

### الخطوة الثالثة: التوليد مع RAG

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

النمط السريع مهم. إخباري النمط صراحةً إلى الأرض في السياق وإعادتها "لا أعرف" عندما يكون السياق غير كاف يقلل من معدلات الهلوسة بنسبة 40-60% مقارنةً بالتحفيز البغيض. يضيف الأنماط الأكثر تفصيلاً اقتباسات، درجات الثقة، واستخراج مهيكلي.

### الخطوة الرابعة: تقييم يعكس العالم الحقيقي

استخدامات SQuAD **Exact Match (EM)**و**token-level F1**. . . EM هو مطابقة صارمة بعد التطبيع (أقل حرف، نقطة شريط، إزالة المواد)  إما أن التنبؤ يطابق بالضبط أو أنه يسجل 0. يتم حساب F1 على التداخل بين التنبؤ والإشارة ويعطي الائتمان الجزئي. كلا المقاطع المختلفة من الائتمان: "29 يونيو 2007" مقابل "29 يونيو 2007" عادة ما تحصل على 0 EM (القطع العادية الطبيعية) ولكن لا يزال يحصل على F1 كبير من الوهم المتداخلة.

لإنتاج QA:

- **Answer accuracy**(حكم على الـLLM أو الحكم على الإنسان، لأن المقاييس لا تحصل على تعادل معنوي).
- **Citation accuracy.**هل المقطع المذكور يدعم الإجابة فعلاً؟ من السهل التحقق تلقائياً من مطابقة السلاسل بين المقاطع المذكورة والمتقاطعة.
- **Refusal calibration.**عندما لا تكون الإجابة في المقاطع التي تم استردادها، هل يقول النظام بشكل صحيح "لا أعرف"؟ قياس معدل الثقة الكاذبة.
- **Retrieval recall.**قبل تقييم القارئ، قياس ما إذا كان الردي يحصل على الممر الصحيح إلى أعلى`k`القارئ لا يستطيع إصلاح مقطع مفقود

### الرغاس: إطار تقييم الإنتاج لعام 2026

`RAGAS`وهي مبنية خصيصا لنظم RAG وهي البث الافتراضي في السفن في عام 2026.

- **Faithfulness.**هل كلّ ادعاء في الإجابة يأتي من السياق الذي تمّ استرداده؟
- **Answer relevance.**هل الإجابة تُجاوب السؤال؟ يتم قياسها عن طريق إنتاج أسئلة افتراضية من الإجابة ومقارنة السؤال الحقيقي.
- **Context precision.**من القطاعات التي تم استردادها، ما هو الجزء الذي كان ذو أهمية حقيقية؟
- **Context recall.**هل المجموعة التي تم استردادها تحتوي على كل المعلومات اللازمة؟

تساعدك الوصول إلى درجات خالية من المراجع على تقييم حركة الإنتاج الحية دون إجابات ذهبية. الطبقة LLM كقاضي في الأعلى للأسئلة المفتوحة حيث لا تستخدم المعايير المتماثقة الدقيقة.

`pip install ragas`. قم بتوصيل القرّاء + القرّاء ، احصل على أربع مستويات لكل استفسار . تحذير عن التراجع

## استخدمها

-مجموعة عام 2026

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

أصبحت تقنية الاستخراجية القصوى غير موضع الأزياء في عام 2026 لأن RAG مع LLM تتعامل مع المزيد من القضايا. لا تزال تسير في سياقات تتطلب فيها اقتباس حرفي: البحوث القانونية، الامتثال التنظيمي، أدوات المراجعة.

## أرسله

إبقوا`outputs/skill-qa-architect.md`:

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## التمارين

1. **Easy.**قم بتعيين خط أنابيب استخراج SQuAD أعلاه على 10 مقاطع فيكيبيديا. 10 أسئلة يدوية. قياس عدد المرات التي تكون فيها الإجابة صحيحة. يجب أن ترى 7-9 صحيحة إذا كانت المقاطع والسئلة نظيفة.
2. **Medium.**إضافة تصنيف رفض. عندما تكون أعلى درجة الاسترداد أقل من عتبة (قول 0.3 كوزين) ، ارجع "لا أعرف" بدلاً من الاتصال بالقارئ. ضبط العتبة على مجموعة متأخرة.
3. **Hard.**قم ببناء خط أنابيب RAG على مجموعة من 10,000 وثيقة تختارها. تنفيذ الاستخراج الهجين (BM25 + كثيفة) مع اندماج RRF (انظر الدروس 14). قياس دقة الإجابة مع ودون الخطوة الهجينة. وثيقة من أنواع الأسئلة تستفيد أكثر.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## المزيد من القراءة

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250)ورقة المراجعة
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906)د.بي.آر، الجهاز القائم على الكثافة الكانونية لـ "كيو أيه".
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)-صحيفة تسمّي (راغ)
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) مسح شامل لـ RAG.
