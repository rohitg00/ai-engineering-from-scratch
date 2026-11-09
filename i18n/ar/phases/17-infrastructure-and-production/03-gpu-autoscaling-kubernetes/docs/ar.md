# GPU Autoscaling على Kubernetes  كاربينتر، KAI Scheduler، تنظيم العصابات

> ثلاث طبقات، وليس واحدة. كربنتر إمدادات العقد الديناميكية (أقل من دقيقة واحدة، 40٪ أسرع من Cluster Autoscaler). يقوم KAI Scheduler بتنظيم المجموعات، وعلم التوبولوجيا، والصفوف الهرمية  يمنع فخ التخصيص الجزئي 7 من 8 حيث تنتظر سبعة عقدات وتحرق على GPU واحدة مفقودة. مقياسات ذاتية على مستوى التطبيق (NVIDIA Dynamo Planner ، llm-d Workload Variant Autoscaler) على إشارات محددة للإستنتاج  عمق الصف ، استخدام cache KV  ليس دورة عمل CPU / DCGM. فخ الكلاسيكي من " HPA " هو ذلك`DCGM_FI_DEV_GPU_UTIL`هو قياس دورة العمل: يمكن أن يكون 100% 10 طلبات أو 100. vLLM يخصص مسبقا ذاكرة cache KV ، لذلك لا يسبب الذاكرة أبداً التنظيم. هذه الدروس تعلمك لتكوين الطبقات الثلاث وتجنب Karpenter الافتراضي `WhenEmptyOrUnderutilized`سياسة التي تنهي تشغيل وظائف الجيبو في منتصف الإستثناء

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## أهداف التعلم

- رسم الرسم البياني لثلاث طبقات التوسع الذاتي (توفير العقد، وتخطيط العصابات، ومستوى التطبيق) وسمية الأداة المستخدمة في كل طبقة.
- اشرح لماذا`DCGM_FI_DEV_GPU_UTIL`هو إشارة HPA الخطأ لـ vLLM وتسمية اثنين من البدائل (عمق الصف ، استخدام cache KV).
- وصف جدول المجموعة والوضع الفشل في التخصيص الجزئي الذي يمنعه KAI Scheduler (7 من أصل 8 GPUs idle).
- أسم سياسة تكامل كاربينتر (`WhenEmptyOrUnderutilized`) التي تنهي تشغيل وظائف الجيبو وتحدد البديل الآمن لعام 2026.

## المشكلة

فريقك يقوم بتقديم خدمة لـ"محققين في القانون" على "كوبرنيتس"`DCGM_FI_DEV_GPU_UTIL`إشارة. أدوات الخدمة عند استخدام 100٪ خلال ساعات العمل. HPA لا تزيد أبدا  انها تعتقد بالفعل أنك مليئة. تضيف نسخة يدويا؛ TTFT ينخفض. HPA لا يزال لا يصل إلى نطاق. الإشارة تكذب عليك.

بشكل منفصل، تستخدم Cluster Autoscaler للعقدات. يصل طلب 1M-token في الساعة 2 صباحاً؛ يقضي الكluster 3 دقائق في تزويد العقدة، وتتوقف أوقات الطلب.

مرة أخرى ، تقوم بتنفيذ نموذج 70B يتطلب 8 GPU عبر 2 عقدات. المجموعة لديها 7 GPU مجانية ، متناثرة على 3 عقدات ، وتحتاج إلى 1 آخر. يقوم Cluster Autoscaler بتوفير عقدة لعاملة GPU 1 المفقودة. يجلس 7 GPU المحجوزات عديمة الفائدة لمدة 4 دقائق حرق المال بينما يصل Kubernetes إلى آخر GPU.

ثلاث طبقات، ثلاثة أوضاع فشل مختلفة. التوسع الذاتي المعرف على GPU في عام 2026 ليس "تشغيل HPA". إنه يضم إمدادات العقد، وتخطيط العصابات، وتوسع إشارات التطبيق.

## المفهوم

### الطبقة 1  توفير العقدة (Karpenter)

كاربينتر يراقب الحوافز المنتظرة والعقدات الإمدادية في غضون 45-60 ثانية (تستغرق Cluster Autoscaler عادةً 90-120 ثانية بالنسبة لعقدات GPU).`NodePool`القيود  إذا كان الحجر يحتاج إلى 8 H100s والعنقود لا يمتلك عقدة مطابقة، كاربينتر توفر واحد مباشرة بدلا من تحسين مجموعة موجودة.

**The consolidation trap**: كاربينتر الاختلالات `consolidationPolicy: WhenEmptyOrUnderutilized`هو خطير لمجمعات GPU. سوف ينهي عقدة GPU قيد التشغيل لتحويل القنابل إلى مثال أرخص من الحجم الصحيح. لتحديد تحميلات العمل التي تعني إخلاء طلبات تشغيل وإعادة تحميل نموذج 70B على العقدة الجديدة. الخسارة هي دقائق من القدرة بالإضافة إلى فشل طلب.

إعداد آمن لمجمعات GPU:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

يسمح لكربنتر بتجميع العقد الفارغة حقا بعد ساعة ولكن لا تطرد أبدا وظيفة جارية.

### الطبقة 2  تخطيط العصابات (KAI Scheduler)

يقوم KAI Scheduler (المشروع "Karp" الذي تم تسميته بعد ذلك) بمعالجة ما لا يفعله المخطط الكوبي المعياري الافتراضي:

**Gang scheduling** التخطيط كل أو لا شيء. خلية استنتاج مُوزعة تتطلب 8 GPUs إما أن تبدأ كل 8 معاً أو لا تفعل أي شيء. بدون هذا، تحصل على فخ جزئي التخصيص: 7 من 8 خليط تبدأ، تنتظر إلى أجل غير مسمى، تحرق المال.

**Topology awareness** معرفة أي GPUات تشارك NVLink ، والتي تجلس على نفس الرف ، والتي لديها InfiniBand بينها. ضع القنابل وفقا لذلك. يجب أن يبقى عبء عمل متوازي التنسور DeepSeek-V3 67B على نطاق NVLink واحد. يحترم KAI Scheduler ذلك.

**Hierarchical queues** تتنافس فرق متعددة عن نفس مجموعة GPU مع الأولوية والحصة. يتم تخطي مصاصة الإنتاج لفريق A من قبل وظيفة تدريب الفريق B فقط إذا سمحت قواعد الأولوية.

يتم نشر KAI إلى جانب المخطط kube كمناسب ثانوي؛ تقوم بتعليف أحمال العمل لاستخدامها. يدمج Ray و vLLM stack production.

### الطبقة 3  إشارات مستوى التطبيق

**The HPA trap**: `DCGM_FI_DEV_GPU_UTIL`هو مقياس دورة العمل  يقيس ما إذا كانت جهاز المعالجة المعالجة المعالجة يعمل في كل فترة أخذ العينات. يمكن أن يعني الاستخدام بنسبة 100٪ 10 طلبات متزايدة أو 100؛ كان جهاز المعالجة المعالجة المعالجة المعالجة مشغولا في كلتا الحالتين. يتم قياس الحجم على دورة العمل بشكل أعمى.

أسوأ من ذلك، فإن محركات vLLM ومحركات مماثلة تقوم بتخصيص ذاكرة cache KV مسبقاً (حتى `--gpu-memory-utilization`يظل استخدام الذاكرة قريبًا من 90٪ حتى عند طلب واحد.

**2026 replacement signals**:

- عمق الصف (عدد الطلبات التي تنتظر الوفاء مسبقًا).
- استخدام cache KV (ما هو جزء من الكتل المخصصة لترتيبات نشطة).
- كل نسخة P99 TTFT (إشارة SLA الخاص بك).
- قوة الإنتاج (طلبات تلبية جميع المواقع المتداولة في الثانية).

تستخدم NVIDIA Dynamo Planner و llm-d Workload Variant Autoscaler هذه الإشارات ونسخ النسخ. أنها تحل محل HPA بالكامل لخدمة LLM.

### متى تستخدم ما

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### إزالة الملفات المُزقة تعقد كل شيء

إذا قمت بتشغيل تعريفات المقبلات/تفكيك المفصلة (المرحلة 17 · 17) ، لديك فئتين من فئتين القنبلة مع محفزات مختلفة للتوسع: مقياس القنبلة المقبلات على عمق الصفوف، مقياس القنبلة المعدة على ضغط الاحتفاظ KV.`Services`مع HPA لكل دور. لا تحاول وضع HPA واحد أمام كليهما.

### البدء البارد مهم هنا أيضاً

تخفيف بدء البرد (مرحلة 17 · 10) هو حيث يصبح وقت إمدادات العقد مرئيًا للمستخدم. استحرار كاربينتر 45-60 ثانية بالإضافة إلى تحميل نموذج 20 جيجابايت بالإضافة إلى إنيت المحرك يعني طلب من الصفر يستغرق 2-5 دقائق.`min_workers=1`) للطرق الحرجة لـ SLO، أو استخدام التفتيش على شكل Modal في طبقة التطبيق.

### أرقام يجب أن تتذكر

- إمدادات عقدة كاربينتر: ~ 45-60s مقابل Cluster Autoscaler ~ 90-120s (عقدات GPU).
- المخطط KAI يمنع فخ النفايات القصرية
- `DCGM_FI_DEV_GPU_UTIL`كإشارة HPA: مكسورة؛ استخدم عمق الصف أو استخدام KV.
- كاربنتر `WhenEmptyOrUnderutilized`: ينهي تشغيل وظائف الجيبو`WhenEmpty + consolidateAfter: 1h`للاستنتاج

```figure
autoscaling
```

## استخدمها

`code/main.py`يحاكي محاكاة ثلاث طبقات على عبء عمل GPU منفجر. يقارن HPA الباهض (دورة العمل) ، HPA عمق الصف ، و KAI-غند المخطط للمحاسبة. يبلغ عن طلبات غير متوفرة ، دقائق GPU عديمة الفائدة ، والنتيجة المركبة.

## أرسله

هذا الدرس يُنتج`outputs/skill-gpu-autoscaler-plan.md`نظراً لتوبولوجيا المجموعة وشكل الحملة والحجم المحدد، فإنه يصمم خطة قياس السيارات ثلاث طبقات.

## التمارين

1. أركض`code/main.py`تحت عبء عمل متفرق، كم من الطلبات التي يلقي بها HPA في دورة العمل الباهية التي تلتقط HPA في عمق الصف؟ من أين يأتي الفرق؟
2. تصميم كارتبينتر NodePool لمجموعة تخدم Llama 3.3 70B FP8 على H100 SXM5. تحديد `capacity-type`،`disruption.consolidationPolicy`،`consolidateAfter`و تلوث يبقي عبء العمل غير من GPU بعيدا عن هذه العقد
3. فريقك يبلغ أن التنفيذات عالقة في انتظار لأن "GPU متاحة ولكن القنبلة لن يجدد. " التشخيص  هل هذا كاربينتر، كوب-جدول، أو KAI جدول؟ أي المقاييس تؤكد؟
4. اختر إشارة إلى غلافات التملأ المفصلة ذاتية القياس والإشارة المختلفة لغلافات فك الشفرة، تبرير كليهما
5. حساب تكلفة `WhenEmptyOrUnderutilized`فخّ التوحيد على خدمة إنتاج 24 × 7 التي تتوسط 60 حدثًا في اليوم يُسقط الطلبات عند P99 TTFT > 10s.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## المزيد من القراءة

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) وثائق التصميم ومثلة على التكوين.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) سياسة تعزيز النطقية والإغراض غير الآمنة مع GPU.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) دينامو خطط التوسع الإشارات.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html)نمط تكامل الأشعة
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) إدارة الإرشادات الخاصة بـ "كوبرنيتس".
- [llm-d GitHub](https://github.com/llm-d/llm-d) تصميم متغيرات الحمل العامل
