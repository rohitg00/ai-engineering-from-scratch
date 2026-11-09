# كابستون 02  RAG على قاعدة الكود (البحث الاسمية عبر البيانات)

> كل منظمة هندسية خطيرة في عام 2026 تقوم بعمل بحث داخلي في الشفرة يفهم المعنى وليس مجرد أسطر مصدر الرسم البياني Amp، أجوبة قاعدة البرمجيات Cursor، الرسم البياني المؤسسة Augment، Aider repomap، Pinterest الداخلية MCP  نفس الشكل. تناول العديد من المشاركات، تحليل مع الحارس الشجرة، تضمين وظيفة ودرجة الطراز قطع، بحث هجين، إعادة تصنيف، الإجابة مع الاقتباسات. هذه الحجر النهائي يطلب منك أن تبني واحدة التي تتعامل مع 2M خطوط من الشفرة عبر 10 repos والتي تنجو إعادة إدراج التنويع التدريجي في كل دفع.

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## المشكلة

بحلول عام 2026 كل وكيل للتشفير الحدودي يُرسل طبقة استرداد قاعدة الشفرة لأن نوافذ السياق وحدها لا تحل أسئلة التشفير المتقاطعة. يُساعد السياق 1M-token لـ (كلود) ؛ فهو لا يزيل الحاجة إلى استرداد الترتيب. البحث البطيء عن الكسوسين على قطع سموم خام يؤدي إلى النتائج على الرمز المولود، على تكرار monorepo، وعلى الذيل الطويل من الرموز نادرا ما يتم استيرادها. الجواب الإنتاج هو بحث هجين (كثيف + BM25) على قطع واعية للـ AST مع إعادة التصنيف ، مدعومة بخريطة من مرجعات الرمز.

تتعلم هذا عن طريق فهرس أسطول حقيقي  ليس إعادة تقديم تعليمات واحدة  وتقييم MRR@10 ، وفاء الإقتباسات ، والجدولية الزائدة. أنماط الفشل هي البنية التحتية: 100k ملف monorepo ، دفع الذي يعيد نصف الملفات ، استفسار يحتاج إلى عبور أربعة إعادة تقديمات للإجابة بشكل صحيح.

## المفهوم

أنبوب استهلاك واعي AST يحتل كل ملف مع محيط الأشجار، ويستخرج وظيفة وعقدة الفصل، والقطع في حدود العقدة بدلا من نوافذ رمزية ثابتة. كل قطعة تحصل على ثلاثة تمثيلات: إضافة كثيفة (Voyage-code-3 أو اسمية-embed-code) ، وشروط BM25 نادرة، وجملة قصيرة للغة الطبيعية. يضيف الموجز التالي طريقة قابلة للتحويل الثالثة  يطرح المستخدمون "كيف يتم تفويض X" وذكر الموجز "authz" ، حتى لو كان الرمز فقط `check_permission`. . .

الاسترداد هو هجين يطلق البحث كل من البحث الكثيف و BM25 ، ويهضم top-k ، ويمنح الاتحاد إعادة ترتيب المترجمين (Cohere rerank-3 أو bge-reranker-v2-gemma-2b). وتذهب القائمة التي تم تصنيفها مرة أخرى إلى جهاز تجميع السياق الطويل (كلود سونيت 4.7 مع التخزين الآلي، أو Llama 3.3 70B المضيفة الذاتية) مع تعليمات لتنقل كل مطالبة حسب الملفات ومدى الخطوط. الردود بدون استشهادات يتم رفضها من خلال تصفية بعد.

الطفافة الزائدة هي مشكلة البنية التحتية. يؤدي إضافة Git إلى اختلاف: أي ملفات تغيرت، أي رموز تغيرت. يتم إعادة إدراج قطع فقط المتأثرة. يتم إعادة حساب حواف رموز الملفات المتقاطعة المتأثرة (الإيرادات، دعوات الطرق). يبقى المؤشر متسقًا دون إعادة معالجة 2M خطوط كل تعزيز.

## الهندسة المعمارية

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## الـ"كثيرة"

- التحليل: محيط الأشجار مع 17 لغة (بايتون، ت.س، رست، جو، جاوا، سي++، إلخ.)
- التوابل الكثيفة: Voyage-code-3 (مضيفة) أو nomic-embed-code-v1.5 (مضيفة ذاتية) ، bge-code-v1 fallback
- مؤشر الخصم: Tantivy (Rust) مع BM25F، معدل الحقل على اسم الرمز مقابل الجسم
- DB المتجه: Qdrant 1.12 مع البحث الهجري، أو pgvector + pgvectorscale للفرق تحت 50M متجهات
- نموذج ملخص جزئي: كلود هايكو 4.5 أو جيميني 2.5 فلاش، محفظة محفظة
- إعادة التصنيف: إعادة التصنيف 3 أو bge-reanker-v2-gemma-2b مضيفة ذاتية
- التنسيق: LlamaIndex سير العمل للاستهلاك، LangGraph لوسيلة الاستفسار
- المختلط: كلود سونيت 4.7 (1M سياق) مع التخزين الآلي
- الرسم البياني للرموز: Neo4j (مدار) أو kuzu (مدمج) لجهاز الاستيراد والدعوة
- الملاحظة: امتدادات المفاصل للفوز لكل خطوة استرداد + عملية التوليد

```figure
ce-hybrid-retrieval
```

## بناءها

1. **Ingestion walker.**إعادة التاريخ على كل خطوة إضافة. جمع الملفات المعدلة. لكل ملف، تحليل مع الحارس الشجرة، استخراج وظيفة وعقدات الفصل مع فترة المصدر الكاملة. إصدار سجلات شكل`{repo, path, start_line, end_line, symbol, body}`. . .

2. **Chunk summarizer.**تُدعى "Hakeu 4.5" بمساعدة محفظة سرية على إضافة إشارة النظام. "تجميع هذه الوظيفة في جملة واحدة، وتسمية العقد العام والآثار الجانبية".

3. **Embedding pool.**صفين متوازيان: كثيفة (رمز الرحلة-3 مجموعة 128) والتمويل (المثل النموذج، ولكن على سلسلة التجميع).`{repo, path, start_line, end_line, symbol, kind}`. . .

4. **BM25 index.**مؤشر Tantivy الموزن في الحقل: سمبول اسم وزن 4، سمبول وزن الجسم 1، ملخص وزن 2. تمكين "العثور على الوظيفة المسمى X" استفسارات جنبا إلى جنب مع "العثور على الوظيفة التي تفعل X".

5. **Symbol graph.**لكل قطعة، سجل الحواف: الاستيراد (هذا الملف يستخدم الرمز Y من repo Z) ، الدعوات (تدعو هذه الوظيفة طريقة M على الفئة C) ، التراث. تخزين في kuzu. تستخدم في وقت الاستفسار لتوسيع الاسترداد عبر حدود repo.

6. **Query agent.**لنجرافي مع ثلاث عقدات.`retrieve`حرائق كثيفة + BM25 بالتوازي، وتكرارها عن طريق (الرد، المسار، الرمز). `rerank`يدير المُشفّر المتقاطع على أعلى 50 ويحافظ على أعلى 10. `synth`يطلب Claude Sonnet 4.7 مع قطع المرتبة المُجددة في السياق، يحفظ محاكاة النظام، يتطلب إشارات ملف:خط.

7. **Citation enforcement.**تحليل النموذج المخرج ؛ أي ادعاء بدون`(repo/path:start-end)`يتم وضع علامة على المرسوم لإعادة طلب أو إسقاط. أعيد الإجابة المشار إليها فقط للمستخدم.

8. **Incremental re-index.**في كل شبكة شبكة، حساب فرق مستوى الرمز. فقط إعادة إدراج قطع التي تغير نصها. إعادة حساب حواف الرمز للقطع التي تغير استيرادها. قياس: إعادة تحديد 50 ملف في أقل من 60 ثانية لسفينة 2M-LOC.

9. **Eval.**وضع علامة على 100 سؤال متقاطع مع ملف ذهب: إجابات خط. قياس MRR@10, nDCG@10, وفاء الإشارات (جزء من المطالبات مع المرافق المتحققة) ، و p50/p99 تأخير.

## استخدمها

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## أرسله

مهارة قابلة للتسليم`outputs/skill-codebase-rag.md`. في حالة وجود مجموعة من المعلومات، فإنه يظهر خط الأنابيب المستهلكة، والمعدل الهجري، ووكيل الاستفسار، ويرد إجابة مدرجة لأي سؤال متبادل.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## التمارين

1. تغيير Voyage-code-3 لـ Nomic-embed-code المضيفة الذاتية. قياس delta MRR@10. إبلاغ ما إذا كان الفجوة تغلق مع إعادة التصنيف تمكين.

2. حقن 20% من الرمز المولود (الطبقة المولدة من LLM) في الجسم وإعادة تقييم. لاحظ التسمم الاستردادي. أضف علامة "مولودة" إلى الحمل المفيد وتقلل من الوزن من تلك الضربات.

3. قم بتحديد البحث الهجري Qdrant مقابل pgvector + pgvectorscale في حجم الجسم الخاص بك.

4. إضافة فحص التجول القائم على العينات: أسبوعياً، إعادة تشغيل 100 سؤال. تحذير عند انخفاض MRR@10 > 5%.

5. تمديد إلى قرار رموز عبر اللغات: وظيفة Python التي تدعو خدمة Go عبر gRPC. استخدم الرسم البياني الرمز لربطها.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## المزيد من القراءة

- [Sourcegraph Amp](https://ampcode.com) معلومات عن رموز الإنتاج المتبادلة
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) غوص عميق للمرجعية لهذه الحجر الرئيسي
- [Aider repo-map](https://aider.chat/docs/repomap.html) عرض repo المتسق من الحارس
- [Augment Code enterprise graph](https://www.augmentcode.com) الرمز التجاري الرسم البياني RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) تنفيذ مرجع
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) تفاصيل الرحلات
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) إشارة مُعبرة
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) إشارة داخلية للمنصة
