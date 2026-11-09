# كابستون 14  خادم إضفاءات التخفيف المضاربة

> فك التشخيص المضاربة  مشروع رخيص يقدم رموز، النموذج المستهدف يصدقهم في مرور واحد  هو الآن تحسين جاهز للإنتاج، وليس خدعة بحث. إيغل-3 في vLLM 0.7 سفن 2.5-3x التنقل على حركة المرور الحقيقية. "ب-إيغل" (AWS 2026) دفع التكهنات المتوازية إلى أبعد من ذلك. "مُدربة "سبيك فورج "في "سجلانغ" تدرب رؤساء الجندات على نطاق واسع مركز المتكهنين في ريد هات نشر مسودات متوافقة لنماذج مفتوحة مشتركة. (تنسورRT-LLM) جعلت عملية فك التشفير المضاربة من الدرجة الأولى على (NVIDIA). إن كومة الإنتاج 2026 هي vLLM أو SGLang مع مسودات عائلة EAGLE، FP8 أو INT4 الكميات، و HPA في انتظار الصف. هذه الحجر النهائي هو خدمة اثنين من النماذج المفتوحة عند 2.5x + التميز القياسي مع تقرير كامل التأخير الذيل.

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**P3 · P7 · P10 · P17
**Time:** 30 hours

## المشكلة

أصبح التشفير المضارب سلعة عام 2026. يقوم رؤساء مشروع EAGLE-3 بتدريب الحالات الخفية لنموذج الهدف ويتوقع رموز N في الأمام؛ يتحقق النموذج الهدف من خلال مرور واحد. معدلات القبول من 60-80٪ تتحول إلى 2-3x من الانتقال من نهاية إلى نهاية. vLLM 0.7 يدمج هذا بشكل طبيعي. SGLang + SpecForge يعطيك خط الأنابيب التدريبية. نشر المتضاربون في ريد هات مسودات متوافقة للاما 3.3 70B، Qwen3-Coder-30B MoE، GPT-OSS-120B.

السفن في عمليات الخدمة ، وليس النموذج. تتحرك معدل القبول مع توزيع حركة المرور (ShareGPT مقابل رمز مقابل بيانات النطاق). تأخر الذيل تحت الرفض أسوأ من دون تكهنة  يجب عليك الإبلاغ p99 في أحجام دفعات متعددة ، وليس فقط رموز حالة ثابتة / ثانية. التكلفة لكل رموز 1M مقابل أنثروبات / OpenAI API هي موفوق المصداقية.

## المفهوم

التشفير المضارب له طبقتين**draft**النموذج (قمة إيغل-3، ngram، أو نموذج أصغر المتحالفة مع الهدف) يقدم k رموز مرشحة لكل خطوة. **target**يُحقق النموذج من جميع k في مرور واحد؛ أي مقدمة مقبولة تحل محل المسار البشع. يعتمد معدل القبول على التوجه المخطط-الهدف وتوزيع المدخل.

يضرب EAGLE-3 مسودات ngram على معظم حركة المرور. يقوم P-EAGLE بالتكهنات الموازية لشجرة مسودات أعمق. التنازل: P99 تأخير على رفض هو أعلى لأن مرسلة التحقق أكبر. يجب على تشكيل الخدمة الإبلاغ عن تأخير حجم البطاقة لتحقيق هذا.

النشر هو Kubernetes. vLLM 0.7 تعمل نسخة واحدة لكل GPU أو شق متوازي التنسور. HPA autoscales على انتظار الصف بدلا من CPU. FP8 (مارلين) و INT4 (AWQ) الكوانتات الحفاظ على ذاكرة GPU داخل لفافة H100 / H200. التقارير النهائية هي الانتقال، معدل قبول، p50 / p99 في المجموعة 1/8/32، والرموز $ / 1M.

## الهندسة المعمارية

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## الـ"كثيرة"

- الخدمة: vLLM 0.7 أو SGLang 0.4
- أساليب التكهنات: أشرطة إيغل-3، التكهنات المتوازية P-Eagle، إيغل
- مسودة التدريب: SpecForge (SGLang) أو Red Hat Speculators
- النماذج المستهدفة: Llama 3.3 70B، Qwen3-Coder-30B MoE، GPT-OSS-120B
- الكمية: FP8 (مارلين) ، INT4 AWQ
- النشر: Kubernetes + NVIDIA جهاز إضافة؛ HPA على المقياسات انتظار الصف
- Eval: ShareGPT، MT-Bench-v2، GSM8K، HumanEval لقياس قبول النطاقات
- المرجح: تنسير التشفير المضاربي لـ TensorRT-LLM لخط الأساسي للمورد

```figure
cf-spec-decode
```

## بناءها

1. **Target model prep.**اختر Llama 3.3 70B. قم بتحديد الكمية إلى FP8 عبر Marlin. قم بتنفيذ تحت vLLM 0.7 على 1xH100 (أو 2x متوازي التنسور).

2. **Draft source.**سحب رأس مشروع EAGLE-3 المُتواء من Red Hat Speculators (أو تدريب واحد عبر SpecForge). قم بتحميل إعدادات فك التشكيلات في vLLM.

3. **Baseline numbers.**قبل التكهنات: الوهم/الثانية في المجموعة 1/8/32، p50/p99 تأخير، استخدام GPU. نشر.

4. **Enable EAGLE-3.**إعادة تشكيل المرجعية نفسها إعادة تشغيل المرجعية إشارة سرعة، معدل قبول، p99 التخفيف التخفيف

5. **P-EAGLE.**تمكين التكهنات المتوازية؛ قياس أعمق شجرة الصفحة مقابل النسور المتسلسل-3.

6. **Domain traffic.**تشغيل ShareGPT مقابل HumanEval مقابل حركة المرور الخاصة بالمنطقة عبر نفس الخادم. قياس معدل قبول لكل توزيع. تحديد متى تتحرك المسودات.

7. **Second target model.**إشغال نفس الخط على Qwen3-Coder-30B MoE. المسودة أكثر صعوبة (صوت توجيه MoE). تقرير.

8. **K8s HPA.**النشر تحت K8s مع تعقب HPA `queue_wait_ms`-إثبات التوسع عند تثلاث الحمل

9. **Cost comparison.**حساب رموز $ / مليون مقابل النوعية النسخية كлод سونيت 4.7 و OpenAI GPT-5.4 على نفس التقييم. نشر.

## استخدمها

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## أرسله

`outputs/skill-inference-server.md`يصف المنتج، مجموعة تقاسات مع تشفير المضاربة، تقرير مقياس كامل، ونشر K8s.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## التمارين

1. قياس تدهور معدل قبول عندما يكون المسودة نسخة واحدة خلف الهدف (مثل إلاما 3.3 -> 3.4 التحرك).

2. تنفيذ إرجاع النسب: إذا انخفض قبول EAGLE-3 إلى أقل من عتبة، قم بالانتقال إلى مسودات إرجام.

3. إنجاز تجربة مراقبة للطاقة البدنية: نفس Qwen3-Coder-30B مع ضجيج التوجيه المدفوع مقابل خارج. قياس حساسية قبول مشروع.

4. تمديد إلى H200 (141 غيغابايت) ، أبلغ عن حجم النموذج لكل نسخة رأس المكتسبة وما إذا كان بإمكانك خدمة Llama 3.3 70B غير مقياسية.

5. أظهر تشخيص التشخيص التكهنوي لـ TensorRT-LLM على نفس أجهزة H100

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## المزيد من القراءة

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) كومة الخدمات المرجعية
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) ورقة تشخيص المضاربة المتوازية + تكامل
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) خطة تدريبية للقائد المسرحي
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) مركز مشروع متوافق
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/)البدائل البائعة
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) إشارة تجارية
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) ورقة الأسلوب
- [vLLM repository](https://github.com/vllm-project/vllm) الرمز والمؤشرات المرجعية
