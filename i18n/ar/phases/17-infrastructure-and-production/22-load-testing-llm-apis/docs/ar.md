# اختبار الحمل إدارة الأعمال التنفيذية APIs  لماذا ك6 والجرداد يكذبون

> لم يتم تصميم اختبارات الحمل التقليدية لاستجابات البث ، وطول الخروج المتغير ، أو مقاييس مستوى الرمز ، أو شبع GPU. اثنين من الفخاخ يضرب معظم الفرق. فخ GIL: قياس مستوى الشعارات Locust يدير الوهم تحت Python GIL، والذي يتنافس مع توليد الطلبات تحت التزامن الثقيل؛ التوهم الخلفي ثم يضخم التأخير بين الشعارات  عميلك هو عقد الزجاجة، وليس الخادم. فخّ التوحيد التوقيت: التوقيتات المماثلة في حلقة اختبار نقطة واحدة على توزيع الرمز؛ حركة المرور الحقيقية لديها طول متغير ومطابقات المواعيد المسبقة المتنوعة. " إل أم فيرف " تصحيح هذا`--mean-input-tokens`+ `--stddev-input-tokens`. خريطة أدوات في عام 2026: تخصص في مجال الدرجة العليا (GenAI-Perf، LLMPerf، LLM-Locust، guidellm) لتحقيق دقة على مستوى الرمز؛ **k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)** إدراك التدفق، Kubernetes-أصل توزيع عبر TestRun / PrivateLoadZone CRDs، أفضل لبوابات CI / CD؛ Vegeta for Go سكر ثابت؛ Locust 2.43.3 فقط مع LLM-Locust تمديد للتدفق. أنماط الحمل: ثابتة الحالة، الرامب، النص (اختبار التدفق الذاتي) ، الغذاء (السرعات الذاكرة).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## أهداف التعلم

- شرح النماذج المضادة (فخ GIL، فخ التوحيد السريع) التي تجعل اختباريات الحمل العامة تكذب على APIs LLM.
- اختر أداة لغرض معين: LLMPerf (إجراء علامة قياسية) ، k6 + التوسع التدفق (بوابة CI) ، guidellm (صناعية على نطاق واسع) ، GenAI-Perf (إشارة NVIDIA).
- صمم أربع أنماط للحميل (مستقر، ريمب، رصيف، غطس) وسمي وضع الفشل لكل صيد.
- بناء توزيع سريع واقعي باستخدام متوسط + stddev من رموز المدخل بدلا من الطول الثابت.

## المشكلة

لقد اختبرت نقطة نهاية ماجستير في القانون في 500 مستخدم متزامن، لقد نجحت، تم شحنها، في الإنتاج في 200 مستخدم فعلي، سقطت الخدمة فوق P99 TTFT انفجرت، والGPUs محصنة.

حدث شيئان. أولاً، أرسلت k6 500 طلب متطابقة  جمع طلبك وتخزين المقبلات جعلت يبدو وكأنك كنت تتعامل مع 500 رمز تعريفي متزامن عندما كنت تتعامل مع واحد. ثانياً، k6 لا تتبع تأخير بين الشعارات على استجابات التدفق بالطريقة التي تعاني بها العين؛ فإنها ترى اتصال HTTP واحد، وليس 500 رمز يصل في فترات مختلفة.

اختبار الحمل للدرجة العليا هو تخصصها الخاص.

## المفهوم

### فخ GIL (الخلط)

يستخدم Locust Python ويقوم بتشغيل جانب العميل للتكنولوجيا تحت GIL. تحت التزامن العالي، يقوم المتصفحون بتشغيل الطلبات. يتضمن تأخير التكنولوجيا المتوسط المتفق عليه متخلفات التكنولوجيا من جانب العميل. تعتقد أن الخادم بطيء؛ إنه التجربة.

الإصلاح: تمديد LLM-Locust يُحرك التكنولوجيا إلى عمليات منفصلة، أو يستخدم حزمة لغة مرتبة (k6, LLMPerf باستخدام tokenizers.rs).

### فخّ التوحيد السريع

يسمح لك جميع اختبارات الحمل المعروفة بتكوين طلب واحد. في اختبار حلقة من 10,000 تكرار يتم إرسال نفس طلب بالضبط في كل مرة. يرى الخادم نفس المشاركة في كل مرة يصل فيها الـ  المشاركة إلى محفظة التخزين إلى 100٪، ويبدو التكامل رائعًا.

الإصلاح: عينة من التوزيع السريع.`--mean-input-tokens 500 --stddev-input-tokens 150` طول مختلف، محتوى مختلف.

### أربعة أنماط للحميل

1. **Steady-state** RPS ثابت لمدة 30-60 دقيقة. الصيد: تراجع أداء خط الأساس.
2. **Ramp** زيادة خطية في نسبة السرعة من 0 إلى الهدف على مدى 15 دقيقة. الصيد: نقطة انقطاع القدرة، تشابهات في التدفئة.
3. **Spike**3-10x RPS فجأة لمدة 2 دقائق ثم العودة.
4. **Soak**- حالة ثابتة لمدة 4-8 ساعات. الصيد: تسربات الذاكرة، تدفق حوض الاتصال، تفوق قابلية للملاحظة.

### 2026 خريطة أدوات

**LLMPerf**(Anyscale)  Python ولكن الاحتفاظ بالتكنولوجيا المدعومة من Rust. الإشارات المتوسط / stddev. مدركة التدفق. أفضل افتراضية لتنفيذ الأداء.

**NVIDIA GenAI-Perf** مرجع NVIDIA. يستخدم عميل Triton؛ تغطية قياسية شاملة. لاحظ أن ITL لا تستثنى TTFT؛ LLMPerf's يشمل ذلك. اثنين من الأدوات تنتج TPOT مختلفة لنفس الخادم.

**LLM-Locust**(تروفوندري)  تمديد الجرثوم الذي يصلح فخ GIL.

**guidellm** تقييم مقارنة صناعي على نطاق واسع.

**k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)**:
- k6 نفسه (Go، مرتبة، لا GIL) أضاف المقاييس المعرفة على التدفق.
- k6 يستخدم المشغل أجهزة اختبار التوزيع المنتشرة TestRun / PrivateLoadZone للتجارب الموزعة الأصلية لـ Kubernetes.
- أفضل لبرامج CI/CD واختبار SLA.

**Vegeta** الذهاب، أبسط من k6. معدل ثابت HTTP التشبيت. ليس LLM واعي ولكن جيد لبوابة / اختبار حدود المعدل.

**Locust 2.43.3 stock** لديه فخ GIL لدرجة الماجستير فقط مع تمديد LLM-Locust.

### بوابة SLA في CI

أطلقوا على العلاقات العامة مع:

- 30-50 إعادة التكرار كل في خط الأساس RPS.
- البوابة: P50/P95 TTFT، 5xx < 5٪، TPOT تحت العد.
- كسر البناء على الانتهاك.

### توزيع سريع واقعي

بناء من عينات حركة المرور الحقيقية (إذا كان لديك) أو من التوزيعات المنشورة (مثل ShareGPT طلبات للرداء، HumanEval للرمز). إمداد المتوسط + stddev إلى LLMPerf. تجنب الحلقة مع واحد-توصيل بأي ثمن.

### أرقام يجب أن تتذكر

- k6 المشغل 1.0 GA: سبتمبر 2025.
- k6 v2026.1.0: مقاييس الوعي بالاتصال.
- تشغيل LLMPerf النموذجي: 100-1000 طلب في التزامن X.
- بوابة المعلومات المعلوماتية النموذجية: 30-50 إعادة التكرار لكل علاقات إعلامية.
- أربعة أنماط: ثابتة، ريمب، نيزة، غطس.

```figure
load-pattern-waves
```

## استخدمها

`code/main.py`يحاكي اختبار الحمل مع توزيع سريع واقعي، ويقيس TPOT الفعال، ويدل على مصيدة الإسراع الموحدة.

## أرسله

هذا الدرس يُنتج`outputs/skill-load-test-plan.md`. بالنظر إلى عبء العمل و SLA ، يختار الأداة ويصمم أنماط الحمل الأربعة.

## التمارين

1. أركض`code/main.py`. مقارنة التوزيع الموحد مقابل الواقعي
2. اكتب نص k6 لبوابة CI: TTFT P95 < 800 ms عند 100 متزامن، وقت تشغيل 5 دقائق.
3. اختبار التغوط يظهر نمو الذاكرة 50 ميغا في الساعة.
4. اختبار النفط من 10 RPS إلى 100 RPS. ما هو الوقت المتوقع للتعافي إذا كان كاربينتر + vLLM سلسلة الإنتاج في مكانها (المرحلة 17 · 03 + 18) ؟
5. جيناي-بيرف تقرير TPOT=6ms؛ LLMPerf تقرير TPOT=11ms على نفس الخادم. شرح.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| LLMPerf | "the LLM harness" | Anyscale benchmark tool, streaming-aware |
| GenAI-Perf | "NVIDIA tool" | NVIDIA reference harness |
| LLM-Locust | "Locust for LLMs" | Locust extension fixing GIL trap |
| guidellm | "synthetic benchmark" | Large-scale synthetic tool |
| k6 Operator | "K8s k6" | CRD-based distributed k6 |
| GIL trap | "Python client overhead" | Tokenization backlog inflates reported latency |
| Prompt-uniformity trap | "single-prompt lie" | Loop with same prompt hits cache, inflates throughput |
| Steady-state | "constant load" | Flat RPS for N minutes |
| Ramp | "linear up" | 0 to target over duration |
| Spike | "burst test" | Sudden multiplier then revert |
| Soak | "long test" | Hours for leak detection |

## المزيد من القراءة

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
