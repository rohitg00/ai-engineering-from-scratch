# مجموعة إضفاءات مخصصة للأجهزة  FP8 و NVFP4 على Blackwell

> تجارة تجميع استنتاجات المتخصصة في الأجهزة التنقل للعبث، و TensorRT-LLM  NVIDIA فقط، المنسقة لبلكويل  هو مثال واضح على التجارة تسفر الثمن. على GB200 NVL72 مع ترقية دينامو، قياس SemiAnalysis InferenceX $0.012 per million tokens on a 120B model in Q1-Q2 2026, against $0.09 / M على H100 + vLLM  فجوة اقتصادية 7x. يجمع كومة المكونات تنسيقين من نقاط العبور مع تقنيتين خدمة: FP8 يبقى حاسمًا لخزن KV و نواة الاهتمام لأنه يمتلك النطاق الديناميكي الذي يحتاجونه ؛ NVFP4 (4 بيتات من التوسع الضئيل) يتعامل مع الوزن والتنشيط ؛ تنبؤ متعدد الشكلتين (MTP) والإعداد المزدوج / التفكيك المزدوج يضيفون 2-3x آخر على القمة. تحميل أدوات الدعم اليوم 0 أوزان FP4 مباشرة دون تحويل بعد التدريب. الصيد لفرق الهندسة 2026: TRT-LLM مفتوح المصدر ولكن NVIDIA-specific  CUDA- و Blackwell-specialized  لذلك تبنيه تجارة المحمولة للعبور. إجر الرياضيات على مزيجك من النماذج والجهاز قبل الالتزام.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy FP8/NVFP4 memory and cost calculator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 13 (Quantization)
**Time:** ~75 minutes

## أهداف التعلم

- شرح لماذا يبقى FP8 حاسماً لخزن KV والاهتمام حتى عندما تكون الأوزان في NVFP4.
- قم بحساب بصمة HBM لنموذج الحدود تحت BF16 و FP8 و NVFP4 واطرح سبب عن مصدر المدخرات.
- أسمائ ميزات Blackwell الخاصة بتسخير TRT-LLM (اليوم-0 FP4 ، MTP ، تقسيم الخدمة ، البدائيات الكاملة).
- قرر متى يكون قفل NVIDIA من TRT-LLM يستحق الفجوة في التكلفة 7x مقابل vLLM على هوبر.

## المشكلة

الحدود الاقتصادية للإستنتاج في عام 2026 هي "كم رموز لكل دولار". يعتمد الإجابة على أربعة خيارات متزايدة: توليد الأجهزة (هوبر H100 / H200 مقابل بلاكويل B200 / GB200) ، والدقة (BF16 → FP8 → NVFP4) ، ومحرك الخدمة (vLLM مقابل SGLang مقابل TRT-LLM) ، والترتيب (سطح مقابل منفصل مقابل دينامو).

على هوبر مع VLLM، 120B MoE يدير في ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$0.012  7x أرخص. جزء من الفجوة هي الأجهزة (بلاكويل هو 11-15x لكل GPU LLM throughput مقابل هوبر). بعضها هو كومة: فب 4 الوزن، مسودة MTP، المزدوج المزدوج / فك، و NVLink 5 كل إلى كل للاتصال خبير MoE.

لا يمكنك تكرار هذا خارج كومة NVIDIA. وهذا هو التنازل  التنقل للاقتصاد. فهم أي خيارات كومة يعطي أي حصة من الفجوة هو نقطة هذا الدروس.

## المفهوم

### لماذا FP8 لا يزال الأرضية ل KV cache

خطأ شائع في عام 2026: افتراض أن NVFP4 تنطبق في كل مكان. لا تفعل. يحتاج مخزن KV FP8 (8 نقطة عائمة بتة) لأنه يحتفظ بمفاتيح الاهتمام والقيم التي تتفوق على نطاق ديناميكي واسع. تسبب قياس KV إلى FP4 فقدان دقة كارثي  تنخفض ذيل التوزيع وتنهار درجات الاهتمام. تُعطى بتات المضربات في FP8 مخزن KV النطاق الذي يحتاجه.

NVFP4 (2025-2026) ينطبق على الوزن والتنشيط. التنشيط الضئيل: لكل كتلة من الوزن عامل مقياس خاص بها بحيث يمكن للبلوكات الصغيرة امتداد نطاقات ديناميكية مختلفة دون فقدان نطاق التنشر. بالنسبة للتنشيطات ، فإن FP4 يستمر لأن التنشيطات صغيرة النطاق داخل طبقة.

التشغيل النموذجي لـ (بلاكويل):

- الوزن: NVFP4 (4 بتات من التصوير الدقيق).
- التفعيل: NVFP4.
- كاش كيف: FP8.
- مكثف الاهتمام: FP32 (استقرار القوة الرقيقة).

### تستخدم البدائيات الخاصة بـ Blackwell TRT-LLM

- **Day-0 FP4 weights**: مقدمي النموذج يرسلون أوزان FP4 مباشرة؛ تحميلات TRT-LLM دون تحويل بعد التدريب. لا يوجد خطوة AWQ / GPTQ ل FP4.
- **Multi-token prediction (MTP)**: نفس الفكرة مثل EAGLE (المرحلة 17 · 05) ولكن مدمجة في TRT-LLM البناء.
- **Disaggregated serving**: التميز المسبق و فك رموزها على مجموعات GPU منفصلة، يتم نقل مخزن KV عبر NVLink أو InfiniBand. نفس الفكرة مثل Dynamo (المرحلة 17 · 20).
- **All-to-all communication primitives**: NVLink 5 خفض تأخير الاتصال الخبير MoE بمقدار 3x مقابل Hopper. يتم ضبط أجزاء MoE في TRT-LLM لهذا.
- **NVFP4 + MXFP8 microscaling**: التعامل مع عامل الحجم المتسارع على أجهزة Blackwell Tensor Cores.

### الأرقام التي يجب أن تتذكرها

- HGX B200 عند 0.02 $ / M رموز على GPT-OSS-120B عبر TRT-LLM.
- GB200 NVL72 في 0.012/M $ الوهم عبر دينامو (ترتيب TRT-LLM).
- H100 + vLLM ≈ $ 0.09 / M رموز على عبء عمل مقارن.
- زيادة 2.8x في التكامل خلال ثلاثة أشهر من تحديثات TRT-LLM (2026).
- 11-15x لكل جبي يو LLM منتج، بلاكويل مقابل هوبر.
- MLPerf Inference v6.0 (أبريل 2026): بلوكويل يهيمن على كل مهمة تم تقديمها.

### ما تكلفة فترة فترة 4 في الواقع من حيث الجودة

NVFP4 عدواني. على عبء عمل ثقيل التفكير (سلسلة التفكير ، الرياضيات ، ومدينة الكود ذات سياق طويل) ، تراجع أوزان FP4 بشكل مرئي. تخفيف تصفيح كل كتلة ولكن لا يلغي. تستخدم نماذج التفكير في الشحن الفريقية غالبًا أوزان FP8 + تنشيط FP4 كتحسّن ، أو تتعلق بH200 مع FP8 في جميع أنحاءها.

القاعدة: دائماً تأكد من نوعية المهمة على مجموعة تقييمك قبل الالتزام بأوزان NVFP4.

### لماذا هذا قرار إغلاق NVIDIA

TRT-LLM هو C ++ + CUDA + نواة المصدر المغلق. تحتاج إلى تجميع النماذج ل SKU GPU محدد. لا AMD ، لا Intel ، لا ARM. إذا كانت استراتيجيتك تحتية متعددة الجهات التجارية ، فإن TRT-LLM غير محمول للطابق الخدم في TRT-LLM. يمكنك لا يزال الخدمة من vLLM على الأجهزة المختلطة. إذا كنت NVIDIA فقط ، فإن الفجوة 7x تدفع عن القفل.

### 2026 وصفة عملية

بالنسبة لفترة استنتاجية سنوية تزيد عن 100 مليون دولار ، يترك تشغيل Hopper + vLLM 7-10x على الطاولة. هاجر أحمال العمل المهيمنة على التكلفة إلى Blackwell + TRT-LLM + Dynamo. حافظ على مستوى التجربة على H100 + vLLM لسرعة تكرار النموذج. تأكد الجودة على كل نموذج NVFP4 المتحول قبل الإنتاج.

### مكافأة التقسيم

يتم تغطية المجموعة المفصلة من TRT-LLM (مجمعات المكملات المسبقة والإفصاح المفصلة) بعمق في المرحلة 17 · 20. في بلاكويل، تقوم بنسق المضاعف: أوزان FP4 × تسريع MTP × وضع مفصل × توجيه ذا أهمية التخزين. يفترض رقم 7x هذه النسق الكاملة.

```figure
pipeline-parallel
```

## استخدمها

`code/main.py`يحسب بصمة HBM ، وتشخيص التكامل (نظام مقيد بالذاكرة) ، والرموز $ / M لنموذج عبر ثلاث أكوام: H100 + BF16 + vLLM ، H100 + FP8 + vLLM ، B200 + NVFP4/FP8 + TRT-LLM. قم بتشغيله لمعرفة تأثير التركيب ونسبة الفجوة التي يساهم بها كل تغيير.

## أرسله

هذا الدرس يُنتج`outputs/skill-trtllm-blackwell-advisor.md`بالنظر إلى حجم العمل والنموذج والحجم السنوي للشعار، فإنه يقرر ما إذا كانت كومة Blackwell + TRT-LLM تستحق قفل NVIDIA.

## التمارين

1. أركض`code/main.py`. على 120B MoE مع 30٪ من المعلمات النشطة، حساب التوصيل القياسي الحد من النطاق النطاق التذاكر على H100 BF16، H100 FP8، و B200 NVFP4/FP8. من أين يأتي أكبر قفزة؟
2. يكلف العميل 2 مليون دولار سنوياً على H100 + vLLM. ما هو عدد البلاكويل GPUs الذي يحتاجون إلى شراءه لتحويل الهجرة إلى TRT-LLM في 12 شهرًا، نظراً للفجوة الاقتصادية التي تزيد عن 7x؟
3. سترى انخفاض دقة 3 نقاط على MATH بعد تحويل الوزن NVFP4. أسماً مسارات الاسترداد: واحدة من الجودة أولاً (احتفاظ بوزن FP8) ، والتكلفة الأولى (تصفية مع بيانات في المجال).
4. اقرأ نتائج استنتاج MLPerf v6.0، أي مهمة لديها أقل فجوة بلاكويل فوق هوبر، ولماذا؟
5. الحساب HBM المطلوب لنموذج 405B عند وزن NVFP4 + FP8 KV cache عند سياق 128k. هل يناسب على عقدة GB200 NVL72 واحدة؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | "eight-bit float" | 8-bit floating point; used for KV cache and attention due to dynamic range |
| NVFP4 | "four-bit micro" | NVIDIA's 4-bit microscaling FP format; weights and activations on Blackwell |
| MXFP8 | "MX eight" | Microscaling FP8 variant; hardware-accelerated on Blackwell Tensor Cores |
| Day-0 FP4 | "ship FP4 weights" | Model providers release weights already in FP4; no post-train conversion step |
| MTP | "multi-token prediction" | TRT-LLM's integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | "split prefill/decode" | Prefill and decode on separate GPU pools; KV transferred over NVLink/IB |
| All-to-all | "MoE expert comm" | Communication pattern routing tokens to expert GPUs; NVLink 5 cuts 3x |
| InferenceX | "SemiAnalysis inference bench" | The 2026 industry-accepted cost-per-token benchmark |

## المزيد من القراءة

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) أبريل 2026 نتائج MLPerf.
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/)نيو لينك 5 كليًا للجميع و نواة MoE
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) وثائق محرك رسمية
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) التنسيق المفصل فوق TRT-LLM.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/)مجموعة المراجع التي تنشر أرقام بلاكويل
