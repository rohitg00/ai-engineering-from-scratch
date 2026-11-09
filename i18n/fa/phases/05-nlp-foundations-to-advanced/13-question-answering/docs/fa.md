# سیستم های پاسخگویی

> سه سیستم QA مدرن را شکل دادند. استخراج کشش های یافت شده. بازیافت افزوده شده آنها را در اسناد زمین کرد. تولید کننده پاسخ ها تولید کرد. هر دستیار هوش مصنوعی مدرن ترکیبی از سه است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## مشکل

یک کاربر می نویسد "اولین آیفون چه زمانی عرضه شد؟" و انتظار دارد "29 ژوئن 2007". نه "تاریخ اپل طولانی و متنوع است". نه "2007" که بدون جمله در آئسولیشن می ماند. یک پاسخ مستقیم، زمینی و صحیح.

سه معماری در دهه گذشته بر QA تسلط داشته اند.

- **Extractive QA.**در صورت داشتن یک سوال و یک بخش که معلوم است جواب را در خود دارد، شاخص های شروع و پایان مدت پاسخ را در بخش پیدا کنید. SQuAD مرجع مرجعیت کانونیک است.
- **Open-domain QA.**این بخش داده نشده است. ابتدا بخش مربوطه را بازپس بگیرید، سپس پاسخ را استخراج کنید یا تولید کنید. این سنگ بنیاد هر لوله لوله RAG امروز است.
- **Generative / Closed-book QA.**مدل بزرگ زبان از حافظه پارامتریش پاسخ می دهد، هیچ بازیافتی نیست، سریع ترین نتیجه گیری، کمترین اعتماد به واقعیت است.

روند در سال 2026 ترکیبی است: بهترین چند بخش را بازپس بگیرید، سپس یک مدل تولید کننده را برای پاسخ دادن به آن بخش ها تشویق کنید. این RAG است، و درس 14 نیمی از بازپس گیری را به طور عمیق پوشش می دهد. این درس نیمی از QA را ایجاد می کند.

## مفهوم

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**سوال و گذر را با یک ترانسفورماتور (برت خانواده) کدگذاری کنید. دو سر را آموزش دهید که شاخص های شروع و پایان نماد پاسخ را پیش بینی می کنند. از دست دادن در موقعیت های معتبر است. تولید یک فاصله از گذر است. هرگز توهم نمی گذارد (به وسیله ساخت) ، هرگز با سوالات که گذر نمی تواند پاسخ دهد (به وسیله ساخت) برخورد نمی کند.

**Retrieval-augmented (RAG).**دو مرحله اول، يه رترويور به سمت بالا ميگرده`k`در واقع، یک خواننده (استراکتوری یا تولید کننده) با استفاده از این بخش ها پاسخ را تولید می کند. تقسیم بازیافت کننده- خواننده به هر یک از آنها اجازه می دهد تا به طور مستقل آموزش داده و ارزیابی شود. RAG مدرن اغلب یک ررنکر بین آنها را اضافه می کند.

**Generative.**یک LLM تنها از طریق کد کدرها (GPT، Claude، Llama) از وزن های آموخته پاسخ می دهد. هیچ مرحله بازیافتی نیست. در مورد دانش مشترک عالی است، در مورد حقایق نادر یا اخیر فاجعه بار است. میزان توهم در مقایسه با فرکانس واقعیت در داده های پیش از آموزش.

```figure
qa-span
```

## آن را بسازید

### مرحله 1: QA استخراج با یک مدل پیش از آموزش

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

`deepset/roberta-base-squad2`آموزش در SQuAD 2.0 که شامل سوالات غیرقابل پاسخ است.`question-answering`خط لوله بالاترین مدت نمره را باز می گرداند حتی وقتی نماد صفر برنده شود  *نه* به طور خودکار پاسخ خالی را باز می گرداند. برای دریافت رفتار صریح "هیچ پاسخ" ، عبور کنید `handle_impossible_answer=True`به تماس خط لوله: خط لوله سپس پاسخ خالی را تنها زمانی باز می گرداند که نمره صفر از هر نمره زمان عبور کند. همیشه `score`به هر حال میدان

### مرحله دوم: یک خط لوله افزایش یافته برای بازیافت (نمونه)

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

خط لوله دو مرحله ای. بازیافتگر کثیف (Sentence-BERT) از طریق شباهت معنوی، بخش های مرتبط را پیدا می کند. خواننده استخراج کننده (RoBERTa-SquAD) دامنه پاسخ را از بخش های بالا ترکیب می کند. روی کارورهای کوچک کار می کند. برای یک مجموعه اسناد میلیون، از FAISS یا یک پایگاه داده ویکتور استفاده کنید.

### مرحله 3: تولید با RAG

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

الگوی فوری مهم است. به طور صریح به مدل می گوید که در زمینه زمین و بازگشت "من نمی دانم" هنگامی که زمینه کافی نیست، میزان توهم را 40-60% در مقایسه با تحریک ساده کاهش می دهد. الگوهای پیچیده تر اضافه کردن نقل قول، امتیاز اعتماد و استخراج ساختاری است.

### مرحله چهارم: ارزیابی که دنیای واقعی را منعکس کند

استفاده از SQuAD**Exact Match (EM)**و**token-level F1**. . EM یک مطابقت دقیق پس از نرمال سازی است (نورمال، خط بندی، حذف مقالات)  یا پیش بینی دقیقاً مطابقت دارد یا نمره 0. F1 بر روی تعادل رمز بین پیش بینی و مرجع محاسبه می شود و اعتبار جزئی را می دهد. هر دو پارافرز زیر اعتبار: "29 ژوئن 2007" در مقابل "29 ژوئن 2007" معمولاً 0 EM (نورمال سازی وقفه های عادی) را دریافت می کند اما هنوز از توکن های همپوشانی F1 قابل توجهی را به دست می آورد.

برای تولید QA:

- **Answer accuracy**(در مورد LLM یا انسان قضاوت می شود، زیرا متریک ها معادلات معنوی را ضبط نمی کنند).
- **Citation accuracy.**آیا متن نقل شده واقعاً از پاسخ پشتیبانی می کند؟ ساده برای بررسی خودکار با مطابقت رشته بین نقل قول های تولید شده و متن های بازیافت شده.
- **Refusal calibration.**وقتی پاسخ در متن های بازیافت نشده است، آیا سیستم به درستی می گوید "من نمی دانم؟" میزان اعتماد نادرست را اندازه گیری کنید.
- **Retrieval recall.**قبل از ارزیابی خواننده، اندازه گیری کنید که آیا بازیافت کننده به سمت بالا عبور می کند یا نه`k`. يک خواننده نمي تونه يه متن گم شده رو درست کنه

### RAGAS: چارچوب ارزیابی تولید 2026

`RAGAS`این دستگاه برای سیستم های RAG ساخته شده و در سال 2026 پیش فرض حمل و نقل است.

- **Faithfulness.**آیا هر ادعای در پاسخ از زمینه بازیافت شده است؟ با استفاده از نتیجه گیری مبتنی بر NLI اندازه گیری شده است.
- **Answer relevance.**آیا پاسخ به سوال پاسخ می دهد؟ با ایجاد سوالات فرضی از پاسخ و مقایسه با سوال واقعی اندازه گیری می شود.
- **Context precision.**از قطعات بازیافت شده، چه کسری واقعاً مرتبط بود؟ دقت پایین = صدا در سریع.
- **Context recall.**آیا مجموعه بازیافت شده تمام اطلاعات مورد نیاز را در خود دارد؟ یادآوری کم = خواننده نمی تواند موفق شود.

امتیاز بدون مرجع به شما اجازه می دهد تا بدون پاسخ های طلایی در ترافیک تولید زنده ارزیابی کنید. سطح LLM به عنوان قاضی در بالای سوالات باز که متریک مطابقت دقیق بی فایده است.

`pip install ragas`. رترایور + خواننده رو وصل کن . هر سوال چهار اسکالر رو بگير . هشدار در مورد بازپسين

## ازش استفاده کن

-پاك سال 2026

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

QA استخراج در سال 2026 از moda نیست زیرا RAG با LLM پرونده های بیشتری را اداره می کند. هنوز هم در زمینه هایی که نرخ واقعی مورد نیاز است، ارسال می شود: تحقیقات حقوقی، انطباق مقررات، ابزارهای حسابرسی.

## -باده

پس از`outputs/skill-qa-architect.md`:

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

## تمرینات

1. **Easy.**لوله استخراج SQuAD را در بالای 10 قسمت ویکی پدیا تنظیم کنید. 10 سوال دستکاری. اندازه گیری کنید که جواب چقدر درست است. اگر قسمت ها و سوالات تمیز باشند باید 7-9 درست را ببینید.
2. **Medium.**یک طبقه بندی کننده رد اضافه کنید. هنگامی که نمره بالا بازیافت زیر یک حد (بگو 0.3 cosine) است، به جای تماس با خواننده، "من نمی دانم" را برگردانید. حد را بر روی مجموعه ای که نگه داشته شده است تنظیم کنید.
3. **Hard.**یک لوله لوله RAG را بر روی یک مجموعه 10،000 سند که شما انتخاب می کنید بسازید. بازیافت ترکیبی (BM25 + کثافت) را با فیوژن RRF پیاده سازی کنید (به درس 14 نگاه کنید). دقت پاسخ را با و بدون مرحله ترکیبی اندازه گیری کنید. سندی که از نوع سوالات بیشترین سود را می برد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## خواندن بیشتر

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) مقالات مرجع
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) DPR، بازیافت کننده کثافت کانونیک برای QA
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)روزنامه اي که نامش راگ رو گذاشت
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) بررسی جامع RAG
