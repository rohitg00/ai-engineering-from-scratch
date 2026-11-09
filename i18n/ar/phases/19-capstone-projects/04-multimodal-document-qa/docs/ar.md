# كابستون 04  مستند متعدد الحركات QA (Vision-First PDF، الجداول، الرسوم البيانية)

> حد الدقائق - QA لعام 2026 انتقل عن OCR-ثم-النص نحو التفاعل المتأخر من الرؤية أولاً. تعامل ColPali، ColQwen2.5، و ColQwen3-omni كل صفحة PDF كصورة، وتدمجها مع تفاعل متأخر متعدد المتجهات، وتسمح للسؤال بالاتصال بالصفات مباشرة. في 10K المالية، ورق علمية، وملاحظات مكتوبة يدويا هذا النمط يتغلب على OCR أولا بحجم كبير. بناء خط الأنابيب من نهايتها إلى نهايتها على 10 ألف صفحة ونشر الجانب إلى الجانب ضد OCR-then-text.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## المشكلة

الشركات تجلس على ملفات PDF التي تُفشل خطوط OCR: 10-Ks المسح مع الجداول المدوّرة، ورق علمية كثيفة مع المعادلات، الرسوم البيانية التي لا تعني إلا الصور، الملاحظات المكتوبة يدوياً. التعامل مع هذه كرسائل الرسائل أولا يعني فقدان نصف الإشارة. الجواب في عام 2026 هو استرداد متعدد المتجهات المتأخرة على صور الصفحة الخام. قدمها كولبالي (تيك إيلولين) ؛ ColQwen2.5 - v0.2 و ColQwen3-omni دفع دقة. في ViDoRe v3 ، تسجل استرداد الرؤية أولاً فوق OCR-ثم-نص بـ حوافز ذات مغزى  وتوسع الفجوة على الرسوم البيانية والجدوليات والخط اليدوي.

التنازل هو التخزين والتخفيف. تضمنت إضافة ColQwen ~ 2048 متجهة معالج لكل صفحة ، وليس متجهًا واحدًا 1024 طولًا. أحواض التخزين الخام. DocPruner (2026) يقدم قصفًا بنسبة 50% دون فقدان دقة قابلة للقياس. ستقوم بتصفية 10k صفحات ، وتقييم ViDoRe v3 nDCG@5 ، وتقديم إجابات أقل من 2 ثانية ، وتقارن مباشرة مع خط أساسي OCR-then-text.

## المفهوم

التفاعل المتأخر يعني أن كل رمز استفسار يسجل مقابل كل رمز تصحيح ، ويتم جمع الحد الأقصى من النتيجة لكل رمز استفسار. تحصل على مطابقة دقيقة دون الحاجة إلى متجه واحد مجتمع. مؤشر متعدد المتجهات (Vespa ، Qdrant المتجهات المتعددة ، أو AstraDB) يحتفظ بتوابل لكل تصحيح ويغلق MaxSim في وقت الاسترداد.

الرد هو نموذج لغة الرؤية الذي يأخذ الاستفسار بالإضافة إلى الصفحات المكتسبة من أعلى الصفحات كصور ويكتب إجابة مع مناطق الأدلة (صناديق الحدود أو مرجع الصفحات). Qwen3-VL-30B ، Gemini 2.5 Pro ، و InternVL3 هي الخيارات الحدودية لعام 2026. بالنسبة للمعادلات واللاحظة العلمية ، يتم تشبيك OCR fallback (Nougat ، dots.ocr) كقناة نص اخيارية.

التقييم هو ماتريكسي ثنائي الأبعاد. محور واحد: نوع المحتوى (فقرات النص المواضيع، الجداول الكثيفة، الرسوم البيانية / الخط، الملاحظات المكتوبة يدويا، المعادلات). محور آخر: نهج الاسترداد (التفاعل المتأخر أولاً مقابل OCR-ثم-النص مقابل هجين). كل خلية تحصل على nDCG@5 ودقة الإجابة. التقرير هو ما يمكن تسليمه.

## الهندسة المعمارية

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## الـ"كثيرة"

- تصويب الصفحة: PyMuPDF (fitz) عند 180 DPI، تصويب رسمية
- نموذج التفاعل المتأخر: ColQwen2.5-v0.2 أو ColQwen3-omni (فريق فيدور على Hugging Face)
- المؤشر: Vespa مع مجال متعدد المتجهات، أو Qdrant المتجهات متعددة المتجهات، أو AstraDB مع MaxSim
- الحصص: سياسة DocPruner 2026 (حافظ على المزقات ذات التباين العالي، 50٪ الضغط عند فقدان دقة < 0.5%)
- إرجاع OCR (معادلات / جداول كثيفة): dots.ocr أو Nougat
- جهاز الإجابة VLM: Qwen3-VL-30B المضيفة الذاتية أو Gemini 2.5 Pro المضيفة؛ InternVL3 كخلف
- تقييم: مؤشر مرجعية ViDoRe v3، M3DocVQA للتفكير متعدد الصفحات
- واجهة تعريف المشاهد: Next.js 15 مع تغطية القماش لمناطق الأدلة

```figure
ce-late-interaction
```

## بناءها

1. **Ingest.**قم بتشغيل مجموعة من 10 ألف صفحة PDF عبر 10 كيلو، ورق علمية، وثائق مسحوبة. قم بإعادة كل صفحة إلى 1536x2048 PNG. استمر `{doc_id, page_num, image_path}`. . .

2. **Embed.**تشغيل ColQwen2.5-v0.2 على كل صورة صفحة. شكل الخروج ~ 2048 إدخال اللصوص من 128. تطبيق DocPruner للحفاظ على نصف أعلى إشارة. كتابة إلى Vespa متعددة المتجهات الحقل أو Qdrant متعددة المتجهات.

3. **Query.**لكل استفسار قادم، تضم مع برج الاستفسار (إدمجات مستوى الرمز). تشغيل ماكس سيم ضد المؤشر: لكل رمز استفسار، خذ ماكس نقطة منتج على إدمجات تصحيح الصفحة، المجموع. عودة صفحة أعلى-ك.

4. **Synthesize.**اتصل بـ Qwen3-VL-30B مع الاستفسار وصور الصفحة العليا الخمسة. العريضة: "استجيب باستخدام الصفحات المقدمة فقط. ذكر كل مطالبة بـ (doc_id، الصفحة) وسم المنطقة (الشكل، الجدول، الفقرة). "

5. **Evidence regions.**بعد معالجة الإجابة لاستخراج المناطق المذكورة. إذا قام VLM بإصدار صناديق حدودية (Qwen3-VL يفعل ذلك) ، قم بتصويرها كتمليات في المشاهد.

6. **OCR fallback.**بالنسبة للصفحات التي يتم تحديدها على أنها كثيفة المعادلة (الهيورستيكية على اختلاف الصورة) ، قم بتشغيل Nougat أو dots.ocr وإرسال نص OCR كقناة إضافية إلى جانب الصورة.

7. **Eval.**تشغيل ViDoRe v3 (التحقيق nDCG@5) و M3DocVQA (دقة QA متعددة الصفحات). أيضا تشغيل خط أنابيب OCR-then-text على نفس الجسم مع نفس المختبر. إنتاج نمط نوع المحتوى × النهج.

8. **UI.**النموذج الأول المضيء على التيار؛ مشاهدة إنتاج Next.js 15 مع تغطية دليل-منطقة صفحة بعد صفحة.

## استخدمها

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## أرسله

`outputs/skill-doc-qa.md`يصف المنتج: نظام QA متعدد الحركات الأولية للدقائق المحددة المنسقة إلى مجموعة محددة وتقييمها على أساس OCR-then-text على ViDoRe v3.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## التمارين

1. مقياس ColQwen2.5v0.2 مقابل ColQwen3-omni على نفس الجسم. أي صفحات تحصل واحدة على الحق والآخر يفتقد؟ إضافة علامة "مجموعة المحتوى" إلى المؤشر لالتوجه حسب النوع.

2. تحذير التوابل بشكل عنيف (75%، 90%). العثور على صخر الضغط: النقطة التي ينخفض فيها ViDoRe nDCG@5 دون خط أساسي OCR.

3. بناء هجين: تشغيل OCR-then-text و ColQwen بالتوازي، ضم مع RRF، إعادة تصنيف مع جهاز تشفير. هل الهجين يضرب إما وحده؟ أين يساعد ذلك أكثر؟

4. تغيير Qwen3-VL-30B مقابل VLM أصغر (Qwen2.5-VL-7B). قياس منحنى الدقة لكل دولار.

5. إضافة دعم ملاحظات مكتوبة يدوياً، قم بإعادة الكتب المكتوبة يدوياً، ووضعها مع ColQwen، وقاس الاسترداد، وقارنها مع خط أنابيب OCR مكتوبة يدوياً.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## المزيد من القراءة

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) استرجاع الوثائق المتأخرة التفاعل
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) ورقة الأساليب الأساسية
- [ColQwen family on Hugging Face](https://huggingface.co/vidore)نقاط تفتيش جاهزة للإنتاج
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) خط أساسية للـ RAG متعدد الصفحات
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) كومة الخدمات المرجعية
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) مؤشر بديل
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) مؤشر إدارة بديل
- [Nougat OCR](https://github.com/facebookresearch/nougat) تراجع OCR القادر على المعادلة
