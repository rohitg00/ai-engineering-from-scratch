# كابستون 08  إنتاج RAG Chatbot لمتمثلين متدنيين

> هارفي، غلين، مينديبل، ولاماكلود جميعها تعمل نفس شكل الإنتاج في عام 2026. إحتساء مع docling أو Unstructured و ColPali للصور البصرية. البحث الهجري إعادة تصنيف مع Bge-Renanker-V2-gemma. قم بتجميعها مع كلود سونيت 4.7 باستخدام التخزين المحفوظ بسرعة 60-80% من النتائج. الحراس مع حرس لاما 4 و حرس نيمو انتبه لـ (لانغفوز) و (فينكس) تصنيف مع راجاس على مجموعة من الذهب من 200 سؤال. بناء واحد في مجال تنظيمي (قانونية، سريرية، تأمين) ، والحجر النهائي هو عبور مجموعة الذهبية، الفريق الأحمر، و لوحة التحكم التجريبي.

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## المشكلة

النطاق المنظم RAG (العقود القانونية، بروتوكولات التجارب السريرية، سياسات التأمين) هو شكل الإنتاج الأكثر شحنة في عام 2026 لأن ROI واضحة والرهانات ملموسة. هارفي (آلن واوفي) قام ببناءها من أجل القانون أرسلتُ أوراقًا مُتطورةً وذوقًا. غلين تغطي البحث المؤسساتي النمط هو: استيعاب عالية الوفاء، استرداد الهجين مع إعادة التصنيف، وتحليل مع فرض الإشارات والكاشة السريعة، الحراسة مع طبقات السلامة متعددة، ومراقبة التحرك باستمرار.

الأجزاء الصعبة ليست النموذج وهي الامتثال المعرف على الاختصاص القضائي (HIPAA، GDPR، SOC2) ، والتحقق على مستوى الإشارات، والتحكم في التكاليف (التخزين السريع يشتري خصمًا 60-90% عندما يكون معدل الإصابة مرتفعًا) ، وكشف الهلوسة عبر ولاء RAGAS ، وكشف التحرك عندما يتم تحديث وثائق المصدر دون استكمال المؤشر. هذه الحجر الأساسي يطلب منك أن ترسل كل ذلك على مجموعة من 200 سؤال ذهبية مع مجموعة فريق حمراء إلى جانب.

## المفهوم

خط الأنابيب له جانبين**Ingestion**: docling أو Unstructured يصفح الوثائق المهيكلة؛ ColPali يدير الوثائق الغنية بصريا؛ تحصل القطاعات على ملخصات، علامات، وملفات الوصول القائمة على الأدوار. يذهب المتجهات إلى pgvector + pgvector scale (أقل من 50M متجهات) أو Qdrant Cloud؛ BM25 النادر يذهب إلى جانب. **Conversation**: LangGraph يتعامل مع الذاكرة والتحويل المتعدد؛ كل استفسار يدير استرداد هجين، ويتم ترتيبها مع bge-reranker-v2-gemma-2b، ويتم تجميعها مع Claude Sonnet 4.7 (المخزنة على الفور) ، ويمر الخروج من خلال Llama Guard 4 و NeMo Guardrails، ويمنح ردًا مقيدًا بالجزاء.

كومة تقييم لديها أربع طبقات.**Golden set**(مصممة 200 سؤال/إجابة مع اقتباسات) لتحقيق الدقة. **Red team**(الوقوع في السجن، محاولات استخراج المعلومات الشخصية، أسئلة خارج النطاق) للسلامة. **RAGAS**للوثيقة / الصلة الإجابة / دقة السياق تلقائيًا في كل مرة. **Drift dashboard**(أريز فينيكس) مشاهدة جودة الاسترداد والنسبة الهلوسة أسبوعيا.

التخزين الآلي هو الرافعة التكلفة. تدعم كلود 4.5+ و GPT-5+ طلبات نظام التخزين الآلي + السياق المسترد. عند معدل الوصول 60-80٪ ، تنخفض تكلفة كل استفسار 3-5x. يجب تصميم خط الأنابيب لمحافظات مستقرة (تخزين النظام + سياق إعادة التصنيف أولاً) لتحقيق معدلات الوصول الآلي عالية.

## الهندسة المعمارية

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## الـ"كثيرة"

- الإحتساء: Unstructured.io أو الدوكلغ للوثائق المهيكلة؛ ColPali للصور PDF الغنية بالبصر
- المتجه DB: pgvector + pgvectorscale تحت 50M متجهات؛ Qdrant Cloud خلاف ذلك
- السعر: تانتيفي BM25 مع أوزان الميدان
- التنسيق: LlamaIndex سير العمل (إستهلاك) + LangGraph (حوار)
- إعادة التصنيف: bge-reranker-v2-gemma-2b مضيفة ذاتية أو Voyage
- ماجستير في التدريبات العليا: كلود سونيت 4.7 مع التخزين الآلي السريع؛ الرداء Llama 3.3 70B مضيف الذاتي
- إيفال: راغاس 0.2 على الانترنت، ديب إيفال للتوهم و الجيلبرك سويت
- قابلية الملاحظة: Langfuse مضيفة ذاتية مع صف الملاحظات; Arize Phoenix للتحرك
- الحراسة: إدخال / خروج إصدار للاما الحرسة 4، سياسة NeMo Guardrails v0.12، Presidio PII scrub
- الامتثال: علامات الوصول القائمة على الأدوار على الكتائب؛ علامات الولاية القضائية لـ GDPR/HIPAA

```figure
canary-rollout
```

## بناءها

1. **Ingestion.**قم بتحليل جسمك (1000-10000 مستند لإنشاء خطير) مع غير منظم أو المستندات. بالنسبة للصفحات المسحة / البصرية الثقيلة ، اتجه عبر ColPali. قم بتحويل قطع مع ملخصات ، علامات الدوام ، علامات الولاية.

2. **Index.**التثبيتات الكثيفة (Voyage-3 أو Nomic-embed-v2) في pgvector + pgvector scale. مؤشر جانب BM25 عبر Tantivy.

3. **Hybrid retrieve.**تصفية حسب الدور+الولاية أولاً؛ ثم متوازية كثيفة + BM25؛ دمج مع مزيج الترتيب المتبادل؛ أعلى 20 إلى إعادة ترتيب؛ أعلى 5 إلى التجميع.

4. **Synthesize with prompt caching.**طلب النظام + سياسات ثابتة في عنوان التخزين ؛ إعادة ترتيب السياق كمتوسع التخزين ؛ سؤال المستخدم كإضافية غير محفوظة. حدد معدل ضرب التخزين في حالة ثابتة 60- 80٪.

5. **Guardrails.**إنشاء جهاز إضافة للاما 4؛ سكة حديدات NeMo Guardrails تمنع الأسئلة خارج النطاق أو الموضوعات المحظورة في السياسة؛ يزيل Presidio المعلومات الشخصية غير المقصودة في الخروج؛ بعد تصفية تطبيق الإشارات.

6. **Golden set.**200 زوج من الأسئلة / الإجابة التي يضعها خبير في مجال مع (الجواب ، والحجج). وكيل النتيجة على مطابقة الحجج الدقيقة ، دقة الإجابة ، والصدق (RAGAS).

7. **Red team.**50 إشارة معارضة: إختراقات السجن (PAIR، TAP) ، محاولات إخفاء المعلومات الشخصية، تسريبات خارج النطاق، تسريبات عبر الولايات القضائية.

8. **Drift dashboard.**أريز فينيكس تتبع جودة الاسترداد (nDCG، صدق الإقتباسات) أسبوعياً. تحذير على انخفاض بنسبة 5٪.

9. **Cost report.**لنجفوز: معدل الوصول إلى التخزين السريع، الرموز لكل استفسار، تحزيم $/استفسار حسب المرحلة.

## استخدمها

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## أرسله

`outputs/skill-production-rag.md`يصف المنتج. إنشطة دردشة في النطاق المنظم يتم نشرها مع علامات الامتثال، تمر عبر المادة، ويتم مراقبته مع مراقبة التدفق الحي.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## التمارين

1. بناء شريحة ثانية من الجهاز القضائي تحت اختصاص مختلف (مثل HIPAA جنبا إلى جنب مع GDPR). إظهار تصفية الدور + الجهاز القضائي لمنع التسريب المتبادل في تحقيق متبادل الجهاز القضائي من 20 سؤال.

2. قياس معدل إصابة الكاشة السريعة خلال أسبوع من حركة الإنتاج تحديد أي استفسارات تنتهك الملف التسبيقي. إعادة هيكلة.

3. أضف ذاكرة متعددة التحولات مع حافظة ملخصة 10K. قياس ما إذا كان الوفاء ينخفض مع نمو المحادثة.

4. استبدل (كلود سونيت) 4.7 لـ (لاما) 3.3 70 ب) المضيفة الذاتية، قياس (الدولار/سؤال) و (ديلتا) الوفاء

5. إضافة وضع "غير متأكد": إذا كانت النتيجة الأولى التي تم إعادة ترتيبها أقل من عتبة، يقول الوكيل "ليس لدي اقتباسات ثقة" بدلاً من الرد. قم بتقليل الثقة الكاذبة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## المزيد من القراءة

- [Harvey AI](https://www.harvey.ai) سلسلة الإنتاج القانونية المرجعية
- [Glean enterprise search](https://www.glean.com) المرجعية في المجموعة المشتركة على نطاق المؤسسات
- [Mendable documentation](https://mendable.ai) إشارة المطورين-دوائر RAG
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) تناول المواد المدار
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) إشارة الرافعة المالية
- [RAGAS 0.2 documentation](https://docs.ragas.io/) إطار تقييم RAG القنوني
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) ملاحظة التحرك المرجعي
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) تصنيف السلامة 2026
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/)إطار السياسة السككية
