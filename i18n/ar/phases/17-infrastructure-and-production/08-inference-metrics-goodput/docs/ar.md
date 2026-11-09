# مقاييس الإستدلال  TTFT، TPOT، ITL، Goodput، P99

> خمس مقاييس تحدد ما إذا كان نشر استنتاج يعمل. TTFT هو المكملة المسبقة بالإضافة إلى الصف بالإضافة إلى الشبكة. تبت (غالبا ما يشار إليه باسم ITL ، على الرغم من أن الأدوات تختلف بشأن ما إذا كانت ITL تعتبر الرمز الأول) هو تكلفة فك الرمز المرتبطة بالذاكرة لكل رمز. التأخير من نهاية إلى نهاية هو TTFT زائد TPOT مرات طول الخروج. إنّ التوصيل هو الرموز لكل ثانية المجمعة في جميع أنحاء الأسطول. لكن ما يهم للمنتج هو الجيدبوت  الجزء من الطلبات التي استوفت كل SLO في وقت واحد. إنّ التوصيل العالي عند التوصيل الخير منخفض يعني أنك تقوم بمعالجة رموز لا تصل أبداً إلى المستخدمين في الوقت المحدد. أرقام مرجعية للاما-3.1-8B-إدريس على TRT-LLM في عام 2026: متوسط TTFT 162 ms، متوسط TPOT 7.33 ms، متوسط E2E 1.093 ms. دائماً أبلغ عن P50، P90, P99  أبداً فقط يعني. وراقب فخ القياس: GenAI-Perf يستبعد TTFT من حساب ITL، LLMPerf يضم ذلك؛ اثنين من الأدوات تختلف على TPOT لنفس الجولة.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## أهداف التعلم

- تحديد TTFT، TPOT، ITL، E2E، والعبور، والخيار جيد بدقة وتسمية المكونات التي تقوم كل منها بعملياتها.
- شرح لماذا متوسط هو الإحصاءات الخاطئة لخدمة ماجستير في العلوم العليا وكيفية قراءة P50/P90/P99.
- قم ببناء مقيد متعدد SLO (مثل TTFT<500 ms و TPOT<15 ms و E2E<2 s) وحسب النتائج المثبتة ضده.
- أسمائ أدوات مقياسية لا توافقان على TPOT لنفس السباق وشرح السبب.

## المشكلة

"إنّ إمكانية إرسالنا هي 15 ألف رمز في الثانية". ماذا إذاً؟ إذاً، إذاً إذا تجاوزت 40٪ من الطلبات 2 ثوانٍ من النهاية إلى النهاية، فإنّ المستخدمين قد هجروا الجلسة. الإرسال وحده لا يخبرك ما إذا كان المنتج يعمل.

الإستدلال لديه محورات متعددة من التخفيف وكل واحد يفشل بشكل مختلف. المكملة المسبقة مرتبطة بالحسابات وتقاسم مع طول سريع. إنّ التشخيص مقيدٌ بالذاكرة و يُقيم مع حجم اللحظة تأخير الصف مشكلة عملية الشبكة مشكلة المسافة المادية تحتاج إلى مقاييس مختلفة لكل منها، وتحتاج إلى رصيد، وتحتاج إلى مركب واحد يقول "هل حصل المستخدم على ما كان يتوقع"

## المفهوم

### TTFT  وقت لأول رمز

`TTFT = queue_time + network_request + prefill_time`

يهيمن التملأ قبل الإشارات عندما تكون طويلة. على Llama-3.3-70B FP8 على H100 ، يستغرق طلب 32k ~ 800 ms من التملأ قبل الإشارة. وقت الصف هو سلوك المخطط تحت الحمل. طلب الشبكة هو وقت الأسلاك بما في ذلك TLS. TTFT هو التأخير الذي يراه المستخدم قبل أن يتم تشغيل أي شيء مرة أخرى.

### التخميس بين الشعار

العديد من الأسماء لمقدار واحد`TPOT`(الوقت لكل رمز الخروج)`ITL`(التأخير بين الشعار) ،`decode latency per token` كل نفس. هو الوقت بين رموز التدفق المتتالية بعد الأولى.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

على نفس كومة Llama-3.3-70B H100 مع التملأ المقطع ، TPOT يعني ~ 7 ms. بدون التملأ المقطع ، خلال التملأ المقبل الطويل على تسلسل مجاور ، يمكن أن ترتفع TPOT إلى 50 ms. مشاهدة P99, ليس متوسط.

### تأخير E2E

`E2E = TTFT + TPOT * output_tokens + network_response`

بالنسبة للمخرجات الطويلة (> 500 رمز) ، E2E يهيمن على TPOT. بالنسبة للمخرجات القصيرة مع الطلبات الطويلة، E2E يهيمن على TTFT. تقرير E2E المكون من طول المخرج.

### التشغيل

`throughput = total_output_tokens / elapsed_time`

المقياسات المجمعة تخبرك بفعالية الأسطول لا تخبرك بصحة الطلب الفردي

### المقدمة التي تهتم بها فعلا

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

إن SLO هو قيود متعددة. الطلب "جيد" فقط إذا تم احتفاظ كل قيود. Goodput هو القصة. بعض الأوراق واللواح المراقبة تقرير goodput كمتوسط بدلاً من ذلك: الطلبات في الثانية التي تلبي كل SLO. ضرب القصة بمعدل الطلب لتحويل. ارتفاع التدفق عند 60% goodput هو فشل. انخفاض التدفق عند 99% goodput هو الهدف.

في عام 2026، Goodput هو المقياس المستخدم في تقديمات MLPerf Inference v6.0 وفي متابعة SLA الداخلية في مزودي منصات الذكاء الاصطناعي.

### لماذا العدالة هي الإحصاءات الخاطئة

توزيعات تأخر LLM هي متوجية إلى اليمين. يمكن لشحنة تشكيل مع جار طويل التميز شحن 500 رمز مع TPOT ~ 7 ms و 20 رمز مع TPOT ~ 60 ms. متوسط TPOT هو 9 ms. P99 TPOT هو 65 ms. المستخدمين ضرب P99 بانتظام  لهذا السبب يغادرون.

دائماً أبلغ عن الثلاثة (P50، P90, P99). لخبرة المستخدم، P99 هو الذي تحسن.

### أرقام المرجعية  Llama-3.1-8B-Instruct on TRT-LLM، 2026

- متوسط TTFT: 162 ms
- متوسط TPOT: 7.33 ms
- متوسط E2E: 1,093 ms
- P99 TPOT: يختلف من 10-25 ms اعتمادا على تكوين المكملات المسبقة.

هذه هي نقاط مرجعية NVIDIA المنشورة. تتغير مع حجم النموذج (70B سيعرض 3-5x) ، والأجهزة (H100 مقابل B200 ~ 3x) ، والحميل.

### فخ القياس

اثنان من أدوات مقياسية 2026 الأكثر استخداماً يختلفان حول TPOT لنفس السباق:

- **NVIDIA GenAI-Perf**: يستبعد TTFT من حساب ITL. يبدأ ITL من رمز 2.
- **LLMPerf**: يتضمن TTFT. يبدأ ITL من رمز 1.

بالنسبة لطلب مع TTFT 500 ms و 100 رموز خروج في 700 ms إجمالي التشفير ، تقارير GenAI-Perf `ITL = 700/99 = 7.07 ms`، تقارير " LLMPerf "`ITL = 1200/100 = 12.00 ms`اختيار الأداة يغير الرقم

دائماً أعلن أداة، دائماً نشر التعريف

### بناء SLO

وضع نظام تحديد المستهلكين المعقول لنموذج الدردشة 70B في عام 2026:

- TTFT P99 <= 800 ms
- TPOT P99 <= 25 ms
- E2E P99 <= 3 ثانية لخروجيات <300 رمز.
- هدف الإنتاج الجيد >= 99٪

تُشدد أجهزة التشغيل التشغيلي التشغيلي TTFT (200-400 ms) وتُسخّر E2E. المهم هو كتابتها، وقياسها الثلاثة، وتتبع الناتج الجيد كمركز واحد.

### كيفية قياس

- تشغيل حركة المرور الحقيقية أو الواقعية الاصطناعية (LLMPerf مع `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`)
- الهدف 2x ذروة التزامن في السباق المرجعي.
- إستخدم 30 إلى 50 تكرار، خذ مئات مئوية من العينة المشتركة.
- نشر مع اسم الأداة، نسخة الأداة، النموذج، الأجهزة، التزامن، التوزيع السريع.

```figure
throughput-latency
```

## استخدمها

`code/main.py`هو آلة حسابية جيدة التخفيض. توليد توزيع التخفيف الاصطناعي، وتطبيق SLO، وحساب التخفيض. كما يظهر الفرق GenAI-Perf مقابل LLMPerf TPOT على نفس المسار.

- نعم[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1)يظهر جهاز من أين يأتي الوقت لكل رمز خروج على NVIDIA L4. خطوة واحدة لتفكيك تقرأ 16.41 غيغابايت من الوزن ، مما يستغرق على الأقل 54.7 ms عند 300 GB / ثانية ، والخطوة المقاسة استغرق 60.16 ms.

## أرسله

هذا الدرس يُنتج`outputs/skill-slo-goodput-gate.md`. بالنظر إلى عبء العمل و SLO ، فإنه ينتج وصفة مقياسية جاهزة للمعلومات والمواد المتحركة والتي تقوم بإنشاء البوابات على النمو الجيد بدلاً من النمو.

## التمارين

1. أركض`code/main.py`كيف يتغير التوصيل الجيد عندما تضغط على P99 TPOT من 30 ms إلى 15 ms؟
2. أحد البائعين يقتبس "15,000 توك/س في Llama 3.3 70B H100". أسمائ ثلاثة أسئلة يجب طرحها قبل الثقة بها.
3. لماذا يحمي الملفات المسبقة المكونة من قطع من المواد البشرية P99 TPOT ولكن لا يعني TPOT؟
4. بناء SLO المستهلك لمساعد الصوت (الرمز الأول يسمع وليس يقرأ). أي مقياس هو الأكثر مرئية للمستخدم؟
5. اقرأ وثائق LLMPerf README و وثائق GenAI-Perf. حدد ثلاثة مقاييس أخرى حيث تختلف الأدوات.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## المزيد من القراءة

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) التعريف القنوني لـ TTFT، ITL، TPOT.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) تعريفات بديلة وصفة قياس.
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) قياس مُطبق على عمليات النشر الحقيقية.
- [LLMPerf](https://github.com/ray-project/llmperf) مقياس مفتوح المصدر القائم على الأشعة.
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) أداة مقياسية لـ NVIDIA.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) مقياس مقارنة قائم على الخيارات الجيدة المقبول في القطاع.
