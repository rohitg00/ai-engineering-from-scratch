# اختيار الخدمات المضيفة الذاتية  تطابق المحرك مع الأجهزة والقياس

> اختيار المحرك هو وظيفة من الأجهزة والقياس والنظام البيئي  ليس قراءة لوحة الدرجة. أربعة محركات تهيمن على الاستنتاج المضيف الذاتي في عام 2026: llama.cpp، Ollama، vLLM، SGLang، مع TGI تتراجع في وضع الصيانة. **llama.cpp**هو أسرع على CPU  أوسع دعم النموذج، والسيطرة الكاملة على الكمية والخيوط. **Ollama**هو التثبيت من جهاز تحميل الكمبيوتر المحمول واحد القيادة، ~ 15-30٪ أبطأ من llama.cpp (Go + CGo + HTTP التسلسل) ، 3x فجوة التوصيل تحت مثل الحمل. **TGI entered maintenance mode December 11, 2025** فقط تحديات الحذاء، ~ 10% بطيئة التوصيل الخام من vLLM ولكن تاريخيا أعلى قابلية للملاحظة وتكامل HF-النظام البيئي. وهذا الوضع الصيانة تجعل من الرهان المخاطر على المدى الطويل  SGLang أو vLLM هي الافتراضات الأمانية للمشاريع الجديدة. **vLLM**هو افتراض الإنتاج العام  v0.15.1 (فبراير 2026) يضيف PyTorch 2.10, RTX Blackwell SM120, تحسين H200. **SGLang**هو المتخصص الوكلي متعدد التحولات / المواصلات الثقيلة  400,000+ GPU في الإنتاج (xAI ، LinkedIn ، Cursor ، Oracle ، GCP ، Azure ، AWS). القيود على الأجهزة: CPU-first → llama.cpp. AMD / غير NVIDIA → vLLM هو الطريق الأكثر دعماً (TRT-LLM مغلق من NVIDIA). نمط خط أنابيب 2026: dev = Ollama، staging = llama.cpp، prod = vLLM أو SGLang. المحركات تأخذ أشكال وزن مختلفة  GGUF لعائلة llama.cpp، HF safetensors لمحركات GPU  بحيث يمكن أن يكون تحويل النمط بين المراحل.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## أهداف التعلم

- اختر محرك معين الأجهزة (CPU / AMD / NVIDIA Hopper / Blackwell) ، والحجم (1 مستخدم / 100 / 10,000) ، والحمل العمل (التحدث العام / وكيل / السياق الطويل).
- أسمي حالة وضع الصيانة TGI لعام 2026 (11 ديسمبر 2025) ولماذا تحيز المشاريع الجديدة نحو vLLM أو SGLang.
- وصف خط الأنابيب التطوير/التصميم/التصميم، بما في ذلك حيث يتم تحويل GGUF إلى أسلوب الجهازات الأمانية بين المراحل.
- شرح لماذا يشير "CPU-first" إلى llama.cpp و"AMD" يستبعد TRT-LLM.

## المشكلة

فريقك يبدأ مشروع جديد للدرجة العليا المضيفة الذاتية. يقول مهندس واحد أولاما، يقول مهندس آخر vLLM، يقول ثالث "هل لا تعمل TGI فقط خارج الصندوق؟" كل ثلاثة مناسبة لاقياصات مختلفة. لا واحد مناسب للجميع.

في عام 2026 فإن شجرة الخيار مهمة: الأجهزة أولاً، والحجم الثاني، والحمية العمل الثالثة. وحدث محدد واحد في عام 2025  تدخل TGI وضع الصيانة 11 ديسمبر  تغير الافتراض للمشاريع الجديدة.

## المفهوم

### المحركات الخمسة

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### القرار الأول عن الأجهزة

**CPU-first**لا يوجد محرك آخر قادر على المنافسة على المعالجة المركزية

**AMD GPU**→ vLLM هو أقوى مسار مدعوم (عملية AMD ROCm). يعمل SGLang أيضا. TRT-LLM مغلق من NVIDIA، لذلك هو خارج.

**NVIDIA Hopper (H100 / H200)**-إنهُم الثلاثة من الدرجة الأولى

**NVIDIA Blackwell (B200 / GB200)**→ TRT-LLM هو قائد التدفق (مرحلة 17 · 07). vLLM و SGLang تتبع قريبًا.

**Apple Silicon (M-series)**- لاما. سي بي (المعدنية) - أولاما يلف هذا

### قرار على المستوى الثاني

**1 user / local dev**أوليما، أوامر واحدة، أول رمز في ثواني.

**10-100 users / small team**-الـ"VLLM" بـ"GPU"

**100-10k users / production**→ مجموعة إنتاج vLLM (مرحلة 17 · 18) أو SGLang.

**10k+ users / enterprise**→ vLLM - مستوى الإنتاج + مقسم (مرحلة 17 · 17) + LMCache (مرحلة 17 · 18).

### ثالث قرار - عبء العمل

**General chat / Q&A**فوز vLLM على الاختلافات الواسعة

**Agentic multi-turn (tools, planning, memory)**تهيمن "RadixAttention" (المرحلة 17 · 06) من SGLang.

**RAG with heavy prefix reuse**-إلى (سجلانغ)

**Code generation**→ vLLM بخير؛ SGLang أفضل قليلا على التخزين.

**Long context (128K+)**→ vLLM + إعادة التعبئة المزروعة؛ SGLang + KV المرتبة.

### فخّ الصيانة TGI

دخلت Hugging Face TGI وضع الصيانة 11 ديسمبر 2025  فقط تصحيحات الأخطاء في المستقبل. تاريخيا: قابلية مراقبة على المستوى العالي ، أفضل في الفئة HF-التنمية التكامل (بطاقات النموذج ، أدوات السلامة) ، قليلاً خلف vLLM على الانتقال الخام.

بالنسبة للمشاريع الجديدة في عام 2026: الافتراض بعيدا عن TGI. يمكن استمرار نشر TGI الموجودة ولكن يجب أن تنتقل في نهاية المطاف. SGLang و vLLM هي الافتراضات الأكثر أمانا.

### نمط خط الأنابيب

Dev (Ollama) → staging (llama.cpp) → prod (vLLM). تأخذ المحركات تنسيقات وزن مختلفة  GGUF لعائلة llama.cpp ، HF safetensors لمحركات GPU  بحيث يمكن أن يكون تحويل النمط بين المراحل. يقوم المهندسون بالتكرار بسرعة على أجهزة الكمبيوتر المحمولة. تعكس المرايا المرحلة كمية الإنتاج.

### تحذير أولاما

أولاما عظيمة لـ dev. لا تناسب الإنتاج المشترك: إضافة التسلسلات HTTP إلى التكلفة العليا، وإدارة التزامن أبسط من vLLM، تأخيرات دعم OpenTelemetry. استخدم أولاما حيث يضيء  مستخدم واحد، أوامر واحدة  والتحول إلى vLLM للمشاركة.

### المضيف الذاتي مقابل المدير هو قرار منفصل

المرحلة 17 · 01 (مدارات المعدلات المضخمة) · 02 (مواقع الإضفاء) تغطية إدارة. هذا الدروس يفترض أنك قررت بالفعل استضافة الذات. أسباب الاستضافة الذاتية: إقامة البيانات، تحسينات مخصصة، امتلاك التكلفة الإجمالية على النطاق، نموذج النطاق غير متوفر على المضيف.

### أرقام يجب أن تتذكر

- وضع الصيانة TGI: 11 ديسمبر 2025.
- vLLM v0.15.1: فبراير 2026; PyTorch 2.10؛ دعم بلاكويل SM120.
- أثر إنتاج SGLang: 400،000+ GPU.
- فجوة التوصيل في Ollama مقابل llama.cpp: 15-30% أبطأ؛ 3x تحت الحمل الإضافي.

```figure
data-parallel
```

## استخدمها

`code/main.py`هو المشي في شجرة القرار: مع إعطاء الأجهزة + الحجم + عبء العمل، يختار المحرك ويوضح السبب.

## أرسله

هذا الدرس يُنتج`outputs/skill-engine-picker.md`وبالنظر إلى القيود، يختار محركاً ويكتب خطة الهجرة

## التمارين

1. أركض`code/main.py`مع أجهزة / حجم / عبء العمل الخاص بك. هل الخروج يطابق بديهيتك؟
2. إنفرانتيك 12 H100s و 8 MI300X AMD أي محرك؟ لماذا ترت-LLM خارج الطاولة؟
3. فريق يريد استخدام TGI في عام 2026 لأن "هذا ما نعرفه".
4. أولاما ديف إلى vLLM prod: ما هي التغييرات في الكمية، التكوين، واللاحظية؟
5. منتج RAG مع طول المرفق الأول P99 8K واستخدام عالي بين المستأجرين. اختيار محرك ووضعها مع المرحلة 17 · 11 + 18.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM; weight formats differ per engine |

## المزيد من القراءة

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) إطلاق الملاحظات.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
